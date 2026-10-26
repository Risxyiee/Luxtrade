import { NextRequest, NextResponse } from 'next/server'

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
 * Perintah yang didukung:
 *   /bos <pesan>   → Alexander (CEO AI) jawab pakai modelnya + konteks briefing
 *   /nba-oke       → catat Bos OKE pada prioritas hari ini (sama dgn tombol dashboard)
 *   /nba-not       → catat NOT OKE — prioritas diganti
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
function sbKey() { return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' }
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

/* ---------- Alexander menjawab (Llama 3.1 8B → Gemini → jawaban jujur) ---------- */
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

  const orKey = envGet('OPENROUTER_API_KEY')
  const chain = [envGet('OPENROUTER_MODEL') || 'meta-llama/llama-3.1-8b-instruct:free', 'meta-llama/llama-3.1-8b-instruct:free']
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

  /* 1) handshake verifikasi URL Discord */
  if (it.type === 1) return NextResponse.json({ type: 1 })

  /* 2) slash command */
  if (it.type === 2 && it.data?.name && it.token) {
    const name = it.data.name
    const token = it.token

    if (name === 'nba-oke' || name === 'nba-not') {
      const v = name === 'nba-oke' ? 'oke' : 'not'
      const day = new Date().toISOString().slice(0, 10)
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

  return NextResponse.json({ type: 4, data: { content: 'Perintah belum dikenal — pakai /bos, /nba-oke, atau /nba-not.' } })
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Endpoint Interactions Discord Alexander aktif — pasang URL ini di Discord Developer Portal',
    setup: [
      '1. discord.com/developers → aplikasi Alexander → General Information',
      '2. Interactions Endpoint URL: https://luxtradee.web.id/api/discord-interactions',
      '3. Secret wajib: DISCORD_PUBLIC_KEY · DISCORD_BOT_TOKEN · DISCORD_APP_ID',
      '4. Klik tombol 🤖 Daftarkan /bos di Ruang Rapat (/kantor-ceo)',
    ],
    commands: ['/bos <pesan> — ngobrol dengan Alexander', '/nba-oke — setujui prioritas hari ini', '/nba-not — tolak & minta ganti'],
  })
}
