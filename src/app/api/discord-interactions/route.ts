import { NextRequest, NextResponse } from 'next/server'
import { callMorteraDirect } from '@/lib/ai-llm'
import { DISCORD_COMMANDS } from '@/lib/discord-commands'
import { getSelfFetch } from '@/lib/cloudflare-bindings'
import { sendDiscordNotification } from '@/lib/discord'

/**
 * POST /api/discord-interactions
 *
 * 💬 CHAT 2 ARAH BOS ↔ ALEXANDER via Discord — tanpa Gateway/WebSocket!
 *
 * Kenapa bukan Discord Gateway bot? WebSocket bot butuh proses yang
 * SELALU hidup — cron Cloudflare Workers cuma hidup 15 menit sekali,
 * tidak bisa jaga koneksi WS. Solusi resmi Discord untuk serverless:
 * INTERACTIONS ENDPOINT (HTTP POST) — Discord mengirim payload tiap
 * ada slash command, kita jawab. 100% kompatibel Workers.
 *
 * Perintah yang didukung (definisi: src/lib/discord-commands.ts):
 *   /bos <pesan>   → Alexander (CEO AI) jawab pakai modelnya + konteks briefing
 *   /nba-oke       → catat Bos OKE pada prioritas hari ini (sama dgn tombol dashboard)
 *   /nba-not       → catat NOT OKE — prioritas diganti
 *   /setuju [id]   → ✅ ACC & EKSEKUSI proposal teratas di Antrean Eksekusi
 *   /tolak [id]    → ❌ tolak proposal (agen dihentikan usulkan hal sama 24 jam)
 *   /kerjakan [job]→ 🫡 pencicit: 1 tugas karyawan AI jatuh tempo dikerjakan sekarang
 *   /laksanakan    → 🚀 semua tugas jatuh tempo dikerjakan satu per satu (maks 8)
 *   /antrean       → 📋 daftar proposal yang menunggu ACC Bos
 *   /status        → 🏢 fase bisnis + jumlah antrean ACC
 *
 * SETUP SEKALI (Bos) — lihat juga tombol 🤖 Daftarkan /bos di Ruang Rapat:
 *   1. discord.com/developers → New Application → copy APPLICATION ID
 *      → Cloudflare secret DISCORD_APP_ID
 *   2. Tab Bot → Reset Token → copy → secret DISCORD_BOT_TOKEN
 *   3. Tab General Information → copy PUBLIC KEY → secret DISCORD_PUBLIC_KEY
 *   4. Interactions Endpoint URL: https://luxtradee.web.id/api/discord-interactions
 *   5. OAuth2 → URL Generator → scope bot + applications.commands → invite
 *   6. Panggil action discord-setup di ceo-agent (daftarkan slash command)
 *
 * Alasan model: Alexander = Llama 3.1 8B via OpenRouter (sama dengan briefing).
 * Jawaban >3 detik: kita balas DEFERRED (type 5) dulu lalu edit pesan via
 * REST API bot — aman walau LLM butuh waktu.
 */

export const dynamic = 'force-dynamic'

/* ---------- env helpers (process.env → fallback binding CF Workers) ---------- */
function envGet(name: string): string {
  const v = (process.env[name] || '').trim()
  if (v) return v
  try {
    const sym = Symbol.for('__cloudflare-context__')
    const ctx = (globalThis as Record<symbol, unknown>)[sym] as { env?: Record<string, string> } | undefined
    return (ctx?.env?.[name] || '').trim()
  } catch { return '' }
}

/* ---------- KV kecil (tabel agent_kv sama dengan ceo-agent) ---------- */
function sbUrl() { return (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '') }
/* agent_kv terkunci client sejak migrasi 027 — tulis wajib service_role.
   envGet: process.env → fallback binding CF Workers. */
function sbKey() { return envGet('SUPABASE_SERVICE_ROLE_KEY') || envGet('NEXT_PUBLIC_SUPABASE_ANON_KEY') }
function sbH(): Record<string, string> {
  const k = sbKey()
  return { apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' }
}
async function kvGetRaw(key: string): Promise<string | null> {
  const url = sbUrl(); if (!url || !sbKey()) return null
  try {
    const res = await fetch(`${url}/rest/v1/agent_kv?select=value&key=eq.${encodeURIComponent(key)}`, { headers: sbH(), signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const rows = (await res.json()) as { value?: string }[]
    return rows[0]?.value ?? null
  } catch { return null }
}
async function kvSetRaw(key: string, value: string): Promise<void> {
  const url = sbUrl(); if (!url || !sbKey()) return
  try {
    await fetch(`${url}/rest/v1/agent_kv?on_conflict=key`, {
      method: 'POST', headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ key, value }), signal: AbortSignal.timeout(8000),
    })
  } catch { /* non-kritis */ }
}
async function memAddRaw(who: string, text: string): Promise<void> {
  const raw = (await kvGetRaw('mem:list')) || '[]'
  try {
    const arr = JSON.parse(raw) as { at: string; who: string; text: string }[]
    arr.unshift({ at: new Date().toISOString(), who, text: String(text).replace(/\s+/g, ' ').trim().slice(0, 190) })
    await kvSetRaw('mem:list', JSON.stringify(arr.slice(0, 24)))
  } catch { /* non-kritis */ }
}

/* ---------- verifikasi tanda tangan Ed25519 (wajib Discord) ---------- */
async function verifyDiscordSignature(req: NextRequest, rawBody: string): Promise<boolean> {
  const publicKeyHex = envGet('DISCORD_PUBLIC_KEY')
  const signatureHex = req.headers.get('x-signature-ed25519') || ''
  const timestamp = req.headers.get('x-signature-timestamp') || ''
  if (!publicKeyHex || !signatureHex || !timestamp) return false
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) return false // anti-replay

  try {
    // hex → Uint8Array
    const toBytes = (hex: string) => new Uint8Array(hex.match(/.{2}/g)?.map(b => parseInt(b, 16)) || [])
    const keyBytes = toBytes(publicKeyHex)
    const sigBytes = toBytes(signatureHex)
    if (keyBytes.length !== 32 || sigBytes.length !== 64) return false

    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes as unknown as ArrayBuffer, { name: 'Ed25519' }, false, ['verify'])
    const msg = new TextEncoder().encode(timestamp + rawBody)
    return await crypto.subtle.verify({ name: 'Ed25519' }, cryptoKey, sigBytes as unknown as ArrayBuffer, msg as unknown as ArrayBuffer)
  } catch { return false }
}

/* ---------- Alexander menjawab (Mortera → OpenRouter → Gemini → jujur) ---------- */
async function alexanderAnswer(question: string): Promise<string> {
  /* Konteks: briefing terakhir + NBA — Bos sering tanya "prioritas apa?" */
  let ctx = ''
  try {
    const b = JSON.parse((await kvGetRaw('briefing:last')) || 'null') as { text?: string } | null
    if (b?.text) ctx += `\nBRIEFING TERAKHIR:\n${b.text.slice(0, 1200)}`
    const nba = JSON.parse((await kvGetRaw('nba:last')) || 'null') as { text?: string } | null
    if (nba?.text) ctx += `\nPRIORITAS HARI INI (NBA): ${nba.text.slice(0, 300)}`
  } catch { /* konteks opsional */ }

  const sys =
    'Kamu Alexander, CEO AI Luxtradee (jurnal trading XAUUSD untuk trader Indonesia). ' +
    'Bos (pemilik) mengobrol denganmu lewat slash command Discord. Jawab SINGKAT, tegas, bahasa Indonesia santai-profesional, ' +
    'maks 120 kata. Kalau ditanya angka/prioritas, pakai data briefing di bawah. Kalau tidak tahu, jujur dan sarankan buka Ruang Rapat di /kantor-ceo. ' +
    'Jangan pakai format markdown berat — Discord biasa saja.' + ctx

  /* LAPIS 1 — MORTERA (berbayar — permintaan Bos: "api karyawan ai ke
     mortera SEMUA, fallback gratis"). */
  const morNotes: string[] = []
  const mor = await callMorteraDirect(sys, question, 512, morNotes, 0.6).catch(() => null)
  if (mor?.text) return mor.text

  /* LAPIS 2 — OpenRouter (katalog hidup) — cadangan gratis. */
  const orKey = envGet('OPENROUTER_API_KEY')
  /* Task 35: model lama (llama-3.1-8b:free) 404 — bot /bos pakai katalog hidup.
     Task 35c: inkling DIBUANG (403 policy-blocked) → Nemotron Ultra 550B. */
  const chain = [envGet('OPENROUTER_MODEL') || 'google/gemma-4-31b-it:free',
    'nvidia/nemotron-3.5-lightning:free', 'google/gemma-4-26b-a4b-it:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free']
    .filter((v, i, a) => v && a.indexOf(v) === i)

  if (orKey) {
    for (const model of chain) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${orKey}` },
          body: JSON.stringify({
            model,
            max_tokens: 320,
            temperature: 0.6,
            messages: [{ role: 'system', content: sys }, { role: 'user', content: question }],
          }),
          signal: AbortSignal.timeout(25_000),
        })
        if (!res.ok) continue
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
        const text = data?.choices?.[0]?.message?.content?.trim()
        if (text) return text
      } catch { /* lanjut cadangan */ }
    }
  }

  const gKey = envGet('GEMINI_API_KEY')
  if (gKey) {
    try {
      const model = envGet('GEMINI_MODEL') || 'gemini-2.5-flash'
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sys }] },
          contents: [{ role: 'user', parts: [{ text: question }] }],
          generationConfig: { maxOutputTokens: 320, temperature: 0.6 },
        }),
        signal: AbortSignal.timeout(25_000),
      })
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      if (text) return text
    } catch { /* jatuh ke fallback */ }
  }

  return 'Maaf Bos, otakku sedang tidak terhubung (LLM gagal) — coba lagi sebentar, atau buka Ruang Rapat di /kantor-ceo untuk laporan lengkap.'
}

/* ---------- balas deferred: edit pesan @original via REST bot ---------- */
async function followUpAnswer(interactionToken: string, answer: string): Promise<void> {
  const appId = envGet('DISCORD_APP_ID')
  const botToken = envGet('DISCORD_BOT_TOKEN')
  if (!appId || !botToken) return
  try {
    await fetch(`https://discord.com/api/v10/webhooks/${appId}/${interactionToken}/messages/@original`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bot ${botToken}` },
      body: JSON.stringify({ content: answer.slice(0, 2000) }),
      signal: AbortSignal.timeout(12_000),
    })
  } catch { /* Discord menampilkan "Thinking..." — biarkan */ }
}

/* jalankan di belakang — waitUntil kalau ada (Workers), fire-and-forget kalau tidak */
function background(p: Promise<unknown>): void {
  try {
    const sym = Symbol.for('__cloudflare-context__')
    const ctx = (globalThis as Record<symbol, unknown>)[sym] as { ctx?: { waitUntil?: (p: Promise<unknown>) => void } } | undefined
    if (ctx?.ctx?.waitUntil) { ctx.ctx.waitUntil(p); return }
  } catch { /* ignore */ }
  p.catch(() => {})
}

/* ============================================================
   JARINGAN INTERNAL (anti-522) + ANTREAN ACC + EKSEKUSI
   ============================================================
   /setuju · /tolak · /kerjakan · /laksanakan · /antrean · /status —
   Bos memimpin kantor dari Discord TANPA buka dashboard.
   Loop-back fetch PAKAI SELF service binding (getSelfFetch) — fetch
   ke domain sendiri dari dalam worker terbukti 522 di edge CF. */

async function siteBase(): Promise<string> {
  const s = envGet('NEXT_PUBLIC_SITE_URL') || envGet('NEXT_PUBLIC_APP_URL') || envGet('NEXT_PUBLIC_BASE_URL')
  if (s) return s.replace(/\/+$/, '')
  return process.env.NODE_ENV === 'production' ? 'https://luxtradee.web.id' : 'http://localhost:3000'
}

async function selfFetcher(): Promise<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>> {
  try { const f = await getSelfFetch(); if (f) return f } catch { /* fallback */ }
  return fetch
}

/** ACC/tolak proposal via /api/execute-action (jalur admin-key internal —
    keputusan tetap milik Bos: signature interaction sudah diverifikasi
    Ed25519 sebelum handler ini jalan). */
async function postExecuteAction(id: string, decision: 'approve' | 'reject'): Promise<{ ok: boolean; detail: string }> {
  const key = envGet('ADMIN_SECRET') || envGet('CRON_SECRET')
  if (!key) return { ok: false, detail: 'ADMIN_SECRET/CRON_SECRET belum diset di server — ACC via Discord tidak bisa dieksekusi. Set secret-nya lalu Deploy.' }
  try {
    const doFetch = await selfFetcher()
    const res = await doFetch(`${await siteBase()}/api/execute-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
      body: JSON.stringify({ id, decision }),
      signal: AbortSignal.timeout(110_000),
    })
    const data = (await res.json().catch(() => null)) as { error?: string; detail?: string } | null
    if (!res.ok) return { ok: false, detail: String(data?.error || `HTTP ${res.status}`) }
    return { ok: true, detail: String(data?.detail || (decision === 'approve' ? 'dieksekusi' : 'ditolak')) }
  } catch (x: unknown) { return { ok: false, detail: String((x as Error)?.message || x) } }
}

/** Panggil ceo-agent internal (?key=CRON_SECRET — sama dengan cron). */
async function ceoAgent(params: string): Promise<{ ok: boolean; json?: Record<string, unknown>; detail: string }> {
  const key = envGet('CRON_SECRET') || envGet('ADMIN_SECRET')
  const sep = params.includes('?') ? '&' : '?'
  try {
    const doFetch = await selfFetcher()
    const res = await doFetch(`${await siteBase()}/api/ceo-agent?${params}${key ? `${sep}key=${encodeURIComponent(key)}` : ''}`, {
      signal: AbortSignal.timeout(110_000),
    })
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (!res.ok) return { ok: false, detail: String(json?.error || `HTTP ${res.status}`) }
    return { ok: true, json: json || {}, detail: '' }
  } catch (x: unknown) { return { ok: false, detail: String((x as Error)?.message || x) } }
}

type PendingRow = { id: string; agent_name: string; action_type: string; action_payload?: Record<string, unknown>; status?: string; created_at?: string }

/** Daftar proposal pending dari ai_pending_actions (service_role — tabel
    admin; anon diblokir RLS). Tabel belum ada? → [] (jujur di pesan). */
async function listPendingRows(limit = 20): Promise<PendingRow[]> {
  const url = sbUrl()
  const k = envGet('SUPABASE_SERVICE_ROLE_KEY') || sbKey()
  if (!url || !k) return []
  try {
    const sel = encodeURIComponent('id,agent_name,action_type,action_payload,status,created_at')
    const res = await fetch(`${url}/rest/v1/ai_pending_actions?select=${sel}&status=eq.pending&order=created_at.desc&limit=${limit}`, {
      headers: sbH(), signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    return (await res.json()) as PendingRow[]
  } catch { return [] }
}

/** Ringkasan 1 baris untuk pesan Discord. */
function describeAction(r: PendingRow): string {
  const p = (r.action_payload || {}) as Record<string, unknown>
  const pick = String(p.subject || p.caption || p.title || p.personalized_message || p.body || p.message || '')
    .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  const tgt = Array.isArray(p.target_emails) ? ` → ${p.target_emails.length} email` : (p.lead ? ' → lead baru' : '')
  return `**${r.agent_name}** · ${r.action_type}${tgt}${pick ? ` — "${pick.slice(0, 80)}${pick.length > 80 ? '…' : ''}"` : ''}`
}

/** Resolve id option (boleh potongan awal UUID) → row. Tanpa id = teratas. */
function pickRow(rows: PendingRow[], optId: string): PendingRow | null {
  if (!optId) return rows[0] || null
  const q = optId.toLowerCase()
  return rows.find((r) => r.id.toLowerCase() === q || r.id.toLowerCase().startsWith(q)) || null
}

/** Kirim hasil ke Bos: channel Discord dulu (bot/webhook), kalau gagal →
    edit pesan konfirmasi awal interaction (token valid 15 menit). */
async function reportResult(token: string, msg: string): Promise<void> {
  try {
    const r = await sendDiscordNotification(msg)
    if (r?.ok) return
  } catch { /* lanjut fallback */ }
  await followUpAnswer(token, msg)
}

/* ---------- AUTO-REGISTER slash commands (fix "/bos tidak muncul/diam") ----------
   Interactions Endpoint HANYA respons SLASH COMMAND — pesan biasa/mention di
   channel TIDAK memicu event HTTP (itu butuh Gateway WebSocket yang mustahil
   di Workers). Jadi SEMUA command WAJIB terdaftar di Discord.
   Definisi SATU SUMBER di src/lib/discord-commands.ts (bulk overwrite PUT →
   command yang tidak ada di daftar otomatis DIHAPUS Discord, makanya semua
   harus lewat satu array yang sama).
   Throttle 6 jam (KV) supaya tidak spam API. Dipicu: GET endpoint ini (buka
   URL sekali), handshake verifikasi URL, dan cron harian 08:00
   (worker-entry.ts) — kalau Bos reset aplikasi/token, command otomatis
   terdaftar lagi dalam ≤1 hari. */

async function registerCommandsOnce(): Promise<void> {
  const appId = envGet('DISCORD_APP_ID')
  const botToken = envGet('DISCORD_BOT_TOKEN')
  if (!appId || !botToken) return
  const REG_COOLDOWN_MS = 6 * 3600_000
  const last = parseInt((await kvGetRaw('discord:cmd-reg')) || '0', 10) || 0
  if (Date.now() - last < REG_COOLDOWN_MS) return
  try {
    const res = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
      method: 'PUT', // bulk overwrite = idempotent, command lama diperbarui bukan didobel
      headers: { 'Content-Type': 'application/json', Authorization: `Bot ${botToken}` },
      body: JSON.stringify(DISCORD_COMMANDS),
      signal: AbortSignal.timeout(12_000),
    })
    await kvSetRaw('discord:cmd-reg', String(res.ok ? Date.now() : 0))
  } catch { /* gagal jaringan — slot cron berikutnya mencoba lagi */ }
}

/* ---------- handler ---------- */
export async function POST(req: NextRequest) {
  const raw = await req.text()

  const okSig = await verifyDiscordSignature(req, raw)
  if (!okSig) return NextResponse.json({ error: 'invalid signature — cek secret DISCORD_PUBLIC_KEY' }, { status: 401 })

  if (!envGet('DISCORD_APP_ID') || !envGet('DISCORD_BOT_TOKEN'))
    return NextResponse.json({
      type: 4,
      data: { content: '⚠️ Bot belum lengkap terpasang — set DISCORD_APP_ID & DISCORD_BOT_TOKEN di Cloudflare, lalu panggil discord-setup di ceo-agent.' },
    })

  let it: {
    type?: number
    token?: string
    data?: { name?: string; options?: { name: string; value: string }[] }
  }
  try { it = JSON.parse(raw) } catch { return NextResponse.json({ error: 'body bukan JSON' }, { status: 400 }) }

  /* 1) handshake verifikasi URL Discord — sekalian auto-register commands
        (kalau Bos baru reset token/aplikasi, sekali klik Verify langsung pulih) */
  if (it.type === 1) { background(registerCommandsOnce()); return NextResponse.json({ type: 1 }) }

  /* 2) slash command */
  if (it.type === 2 && it.data?.name && it.token) {
    const name = it.data.name
    const token = it.token

    if (name === 'nba-oke' || name === 'nba-not') {
      const v = name === 'nba-oke' ? 'oke' : 'not'
      /* Task 35g: pakai tanggal WIB (dulu UTC — jam 00:00–06:59 WIB verdict Bos
         ditulis ke key "kemarin" → briefing baca key hari ini & verdict terasa hilang) */
      const day = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
      await kvSetRaw(`nba-verdict:${day}`, v)
      let snippet = ''
      try { snippet = String(JSON.parse((await kvGetRaw('nba:last')) || '{}')?.text || '').slice(0, 90) } catch { /* ignore */ }
      await memAddRaw('CEO Alexander', v === 'oke'
        ? `Bos konfirmasi OKE untuk NBA hari ini (via Discord): "${snippet}…" — dieksekusi`
        : `Bos jawab NOT OKE untuk NBA hari ini (via Discord): "${snippet}…" — prioritas diganti`)
      return NextResponse.json({
        type: 4,
        data: { content: v === 'oke' ? `✅ OKE dicatat Bos — NBA dieksekusi: ${snippet}` : `❌ NOT OKE dicatat — besok Alexander pilih prioritas baru.` },
      })
    }

    /* ── /setuju · /tolak — ACC/tolak proposal karyawan (Antrean Eksekusi) ──
       Alur: resolve id (REST cepat) → jawab type 4 langsung → eksekusi
       di background via /api/execute-action (jalur admin-key) → hasil
       diterbitkan ke channel (fallback: edit pesan konfirmasi). */
    if (name === 'setuju' || name === 'tolak') {
      const decision: 'approve' | 'reject' = name === 'setuju' ? 'approve' : 'reject'
      const optId = String(it.data?.options?.find((o) => o.name === 'id')?.value || '').trim()
      const rows = await listPendingRows(20)
      if (!rows.length)
        return NextResponse.json({ type: 4, data: { content: '✅ Antrean ACC kosong Bos — tidak ada proposal yang menunggu keputusan. Karyawan lagi nunggu kerja: /kerjakan atau /laksanakan.' } })
      const row = pickRow(rows, optId)
      if (!row)
        return NextResponse.json({ type: 4, data: { content: `❌ Proposal id "${optId.slice(0, 12)}" tidak ditemukan di antrean — ketik /antrean untuk lihat daftar lengkap.` } })
      const desc = describeAction(row)
      background((async () => {
        const r = await postExecuteAction(row.id, decision)
        const msg = r.ok
          ? decision === 'approve'
            ? `✅ ACC via Discord — ${desc}\n🛠 Hasil eksekusi: ${r.detail}`
            : `❌ Ditolak via Discord — ${desc}\n(Agen tidak akan mengusulkan hal sama dalam 24 jam)`
          : `⚠️ ACC ${desc} GAGAL dieksekusi: ${r.detail}\nProposal tetap pending — coba lagi, atau ACC di /kantor-ceo.`
        await reportResult(token, msg)
      })())
      return NextResponse.json({ type: 4, data: { content: `⏳ ${decision === 'approve' ? 'ACC' : 'Tolak'} diterima Bos — ${desc}\nEksekusi jalan di belakang; hasil kuterbitkan di channel sebentar lagi…` } })
    }

    /* ── /kerjakan — pencicit: 1 tugas jatuh tempo (atau job spesifik force) ── */
    if (name === 'kerjakan') {
      const job = String(it.data?.options?.find((o) => o.name === 'job')?.value || '').trim()
      background((async () => {
        const r = await ceoAgent(job ? `action=work&only=${encodeURIComponent(job)}&force=1` : 'action=tick')
        if (!r.ok) { await reportResult(token, `⚠️ Kerja gagal dijalankan: ${r.detail.slice(0, 300)}`); return }
        const d = r.json || {}
        if (d.idle) { await reportResult(token, '😴 Bos, tidak ada tugas jatuh tempo sekarang — semua job hari ini sudah dikerjakan.'); return }
        const made = Array.isArray(d.made) ? d.made.map(String) : []
        const failed = Array.isArray(d.failed) ? d.failed.map(String) : []
        const label = String(d.label || d.ran || 'tugas')
        await reportResult(token,
          `🫡 **${label}** selesai dikerjakan${made.length ? `\n📦 Artefak: ${made.join(', ')}` : ''}${failed.length ? `\n⚠️ Gagal: ${failed.join(', ')}` : ''}`)
      })())
      return NextResponse.json({ type: 4, data: { content: job
        ? `🫡 Siap Bos — job "${job}" dipaksakan jalan sekarang. Hasil kuterbitkan di channel…`
        : '🫡 Pencicit dinyalakan — 1 tugas jatuh tempo dikerjakan sekarang. Hasil kuterbitkan di channel…' } })
    }

    /* ── /laksanakan — semua tugas jatuh tempo, tick berulang (maks 8) ──
       Tick dedup harian → aman diulang; kalau worker mati di tengah, slot
       cron 15-menit otomatis melanjutkan sisa pekerjaan. */
    if (name === 'laksanakan') {
      background((async () => {
        const done: string[] = []
        const failed: string[] = []
        for (let i = 0; i < 8; i++) {
          const r = await ceoAgent('action=tick')
          if (!r.ok) { failed.push(`tick ${i + 1}: ${String(r.detail).slice(0, 80)}`); break }
          const d = r.json || {}
          if (d.idle) break
          done.push(String(d.label || d.ran || 'job'))
          if (Array.isArray(d.failed) && d.failed.length) for (const f of (d.failed as unknown[]).slice(0, 3)) failed.push(String(f))
          await new Promise((res) => setTimeout(res, 1500))
        }
        if (!done.length && !failed.length)
          await reportResult(token, '😴 LAKSANAKAN selesai cek: semua tugas hari ini sudah dikerjakan — tidak ada yang tersisa.')
        else
          await reportResult(token,
            `🚀 **LAKSANAKAN selesai** — ${done.length} tugas dikerjakan:\n✅ ${done.join(' · ') || '—'}${failed.length ? `\n⚠️ Gagal: ${failed.join(' · ')}` : ''}${done.length >= 8 ? '\n♻️ Masih ada antrian — tick otomatis melanjutkan tiap 15 menit.' : ''}`)
      })())
      return NextResponse.json({ type: 4, data: { content: '🚀 Siap Bos — semua tugas jatuh tempo dikerjakan satu per satu sekarang (maks 8 per putaran). Rekap kuterbitkan di channel…' } })
    }

    /* ── /antrean — daftar proposal menunggu ACC ── */
    if (name === 'antrean') {
      background((async () => {
        const rows = await listPendingRows(10)
        if (!rows.length) { await followUpAnswer(token, '✅ Antrean ACC kosong — tidak ada proposal yang menunggu keputusan Bos.'); return }
        const lines = rows.map((r, i) => `${i + 1}. ${describeAction(r)}\n   id: \`${r.id.slice(0, 8)}\``)
        await followUpAnswer(token, `📋 **ANTREAN ACC** (${rows.length} proposal):\n\n${lines.join('\n\n')}\n\nACC: /setuju (tanpa id = teratas) atau /setuju id:\`8 karakter awal\`. Tolak: /tolak.`)
      })())
      return NextResponse.json({ type: 5 })
    }

    /* ── /status — fase bisnis + antrean ── */
    if (name === 'status') {
      background((async () => {
        const [pend, phase] = await Promise.all([listPendingRows(10), ceoAgent('action=phase')])
        const p = (phase.json || {}) as Record<string, unknown>
        const fase = String(p.phase || (p.info as Record<string, unknown> | undefined)?.phase || '?')
        const wib = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
        await followUpAnswer(token,
          `🏢 **KANTOR LUXTRADEE** — ${wib} WIB\n` +
          `📊 Fase bisnis: **${fase}**\n` +
          `📋 Antrean ACC: **${pend.length}** proposal menunggu${pend.length ? ' → /antrean untuk daftar, /setuju untuk ACC teratas' : ''}\n` +
          `🫡 Kerja karyawan: /kerjakan (1 tugas) · /laksanakan (semua)\n` +
          `💬 Tanya aku: /bos pesan:<pertanyaan>`)
      })())
      return NextResponse.json({ type: 5 })
    }

    if (name === 'bos') {
      const q = String(it.data?.options?.find(o => o.name === 'pesan')?.value || '').trim()
      if (!q)
        return NextResponse.json({ type: 4, data: { content: 'Tulis pesannya Bos — contoh: `/bos pesan:prioritas hari ini apa?`' } })
      /* jawaban LLM bisa >3 dtk → DEFERRED dulu (Discord tunjuk "Thinking..."),
         lalu hasilnya dipasang lewat REST bot di background */
      background((async () => { await followUpAnswer(token, await alexanderAnswer(q)) })())
      return NextResponse.json({ type: 5 })
    }
  }

  return NextResponse.json({ type: 4, data: { content: 'Perintah belum dikenal — pakai /bos, /setuju, /tolak, /kerjakan, /laksanakan, /antrean, /status, /nba-oke, atau /nba-not.' } })
}

export async function GET() {
  /* Auto-register commands sekali per kunjungan URL (throttle 6 jam di dalam) —
     Bos cukup buka URL ini di browser kalau /bos hilang dari Discord. */
  background(registerCommandsOnce())
  const ready = !!(envGet('DISCORD_APP_ID') && envGet('DISCORD_BOT_TOKEN') && envGet('DISCORD_PUBLIC_KEY'))
  return NextResponse.json({
    ok: true,
    secretsReady: ready,
    message: ready
      ? 'Endpoint Interactions aktif — 9 slash command dijamin terdaftar (global): /bos · /setuju · /tolak · /kerjakan · /laksanakan · /antrean · /status · /nba-oke · /nba-not. CATATAN: bot ini merespons SLASH COMMAND saja; pesan biasa/mention di channel tidak bisa dijawab oleh Interactions Endpoint (butuh Gateway WebSocket yang tidak tersedia di Cloudflare Workers).'
      : 'Endpoint hidup, tapi secret belum lengkap — set DISCORD_APP_ID · DISCORD_BOT_TOKEN · DISCORD_PUBLIC_KEY di Cloudflare Workers (Settings → Variables & Secrets) lalu Deploy.',
    setup: [
      '1. discord.com/developers → aplikasi Alexander → General Information',
      '2. Interactions Endpoint URL: https://luxtradee.web.id/api/discord-interactions',
      '3. Secret wajib: DISCORD_PUBLIC_KEY · DISCORD_BOT_TOKEN · DISCORD_APP_ID',
      '4. Klik tombol 🤖 Daftarkan /bos di Ruang Rapat (/kantor-ceo) ATAU buka URL endpoint ini sekali',
      '5. DI DISCORD KETIK SLASH COMMAND — PESAN BIASA TIDAK DIJAWAB (batasan serverless)',
    ],
    commands: [
      '/bos <pesan> — ngobrol dengan Alexander',
      '/setuju [id] — ACC & eksekusi proposal teratas di Antrean',
      '/tolak [id] — tolak proposal',
      '/kerjakan [job] — pencicit: 1 tugas jatuh tempo dikerjakan sekarang',
      '/laksanakan — semua tugas jatuh tempo satu per satu',
      '/antrean — daftar proposal menunggu ACC',
      '/status — fase bisnis + antrean',
      '/nba-oke · /nba-not — setujui/tolak prioritas hari ini',
    ],
  })
}
