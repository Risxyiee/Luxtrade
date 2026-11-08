import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCronAdmin, isMissingTableError } from '@/lib/cron-supabase'
import { callLLM, callMorteraDirect, extractJson } from '@/lib/ai-llm'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { sendDiscordNotification } from '@/lib/discord'
import {
  detectDrought, pickPlaybook, buildHookFallback, buildWelcomeEmailFallback,
  socialProofLines, SENTINEL_COOLDOWNS_MS,
  type GrowthMetrics, type SentinelState, type SocialProof, type CsHook,
  type GrowthLead, type WelcomeEmailDraft, type DroughtVerdict,
} from '@/lib/growth-sentinel'

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🕵️ GROWTH SENTINEL — KEVIN (Growth Hunter) · "kerja saat zero-traffic"
 * ═══════════════════════════════════════════════════════════════════════
 *
 * GAP (SOP Bos): master-autonomous & COO-agent hidup di cron 08:00 WIB →
 * aktivitas dasar ADA, tapi semua pasif (SEO nunggu Google, TikTok nunggu
 * algoritma, email cuma buat user LAMA). "Proaktif narik user BARU"
 * belum ada — apalagi saat sepi.
 *
 * KEVIN KERJA TIAP 15 MENIT (numpang slot cron 15-menit yang sudah ada —
 * CF Free max 5 trigger, semua terpakai), tapi HEMAT: tiap run baca angka
 * riil, lalu pilih MAKS 1 aksi dari playbook (cooldown per aksi — run
 * sehat tanpa LLM sama sekali):
 *
 *   1. lead-welcome  — lead baru dari CS bot (growth_leads 'new') →
 *                      LLM racik email welcome personal → draf masuk
 *                      ai_pending_actions (ACC Bos → Resend). Cooldown 1 jam.
 *   2. social-proof  — hitung angka RIIL (member, trade, sinyal 7 hari)
 *                      → agent_kv 'growth:social-proof' → dipakai CS bot
 *                      & landing (trust = konversi). Tanpa LLM. Cooldown 2 jam.
 *   3. cs-hook       — LLM tulis hook sapaan proaktif CS bot HARI INI
 *                      (konteks: angka riil + level kekeringan) →
 *                      agent_kv 'growth:cs-hook'. Cooldown 4 jam.
 *   4. drought-alarm — kering parah (0 signup 24 jam/7 hari) → 1 pesan
 *                      Discord ke Bos berisi angka + saran konkret.
 *                      Cooldown 12 jam.
 *   5. rest          — semua sehat & dalam cooldown → TIDAK melakukan
 *                      apa pun (hemat kuota LLM — laporan tetap jujur).
 *
 * MEMORI KANTOR: hasil ditulis ke office_memory (type 'report') + entri
 * ringkas ke agent_kv 'mem:list' (tampil di panel Memori Kantor
 * /kantor-ceo & terinjeksi ke briefing Alexander otomatis).
 *
 * AUTH: Bearer CRON_SECRET — FAIL-CLOSED (pola master-autonomous).
 * PARAMS: ?dry=true (baca semua, TANPA tulis/kirim), ?force=true (lewati
 * cooldown, butuh secret), ?action=<nama> (paksakan satu aksi utk debug).
 *
 * OTAK MURNI di @/lib/growth-sentinel (dites langsung dari kode asli).
 * ═══════════════════════════════════════════════════════════════════════
 */

export const dynamic = 'force-dynamic'

const RUN_VERSION = 'growth-sentinel@1-kevin'
const MAX_DRAFTS_PER_RUN = 5

/* ── ENV helpers (pola cron lama: CF binding → process.env) ─────────── */
async function envVal(name: string, fallback = ''): Promise<string> {
  try {
    const v = (await getEnvVar(name, { quiet: true })) || process.env[name] || ''
    return v || fallback
  } catch {
    return process.env[name] || fallback
  }
}

function wibDateStr(d = new Date()): string {
  return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10)
}

function clip(s: unknown, n: number): string {
  const t = String(s ?? '')
  return t.length <= n ? t : t.slice(0, n) + '…'
}

/* ── KV kecil (agent_kv) ─────────────────────────────────────────────── */
async function kvGet(admin: SupabaseClient, key: string): Promise<string | null> {
  try {
    const { data } = await admin.from('agent_kv').select('value').eq('key', key).maybeSingle()
    return (data as { value?: string } | null)?.value ?? null
  } catch { return null }
}
async function kvSet(admin: SupabaseClient, key: string, value: string): Promise<void> {
  try { await admin.from('agent_kv').upsert({ key, value }, { onConflict: 'key' }) } catch { /* non-kritis */ }
}

/* ── LLM (rantai Mortera → fallback gratis — SOP multi-agent) ────────── */
async function callKevin(
  systemPrompt: string, userPrompt: string, maxTokens = 700,
): Promise<{ text: string; model: string; notes: string[] } | null> {
  const notes: string[] = []
  const mor = await callMorteraDirect(systemPrompt, userPrompt, Math.max(maxTokens, 1024), notes, 0.7, 60_000)
  if (mor) return { text: mor.text, model: `mortera/${mor.model}`, notes }
  const fb = await callLLM(systemPrompt, userPrompt, maxTokens)
  if (fb) return { text: fb.text, model: `${fb.provider}/${fb.model}`, notes: [...notes, ...(fb.notes || [])] }
  return null
}

/* ── METRIK dari data RIIL (graceful kalau tabel belum ada) ──────────── */
async function sinceIso(hours: number): Promise<string> {
  return new Date(Date.now() - hours * 3600_000).toISOString()
}

async function countRows(admin: SupabaseClient, table: string, filters: string): Promise<number> {
  try {
    const { count, error } = await admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .or(filters.length ? filters : 'id.neq.__none__')
    if (error) throw error
    return count ?? 0
  } catch {
    // Tabel belum ada / kolom tidak cocok → -1 (pemanggil tahu datanya
    // tidak tersedia, bukan nol sungguhan — anti alarm palsu).
    return -1
  }
}

async function gatherMetrics(admin: SupabaseClient): Promise<GrowthMetrics> {
  const [s6, s24, s7d, leadsNew, leads24h, signalsToday, trades24h, members] = await Promise.all([
    countRows(admin, 'profiles', `created_at.gte.${sinceIso(6)}`),
    countRows(admin, 'profiles', `created_at.gte.${sinceIso(24)}`),
    countRows(admin, 'profiles', `created_at.gte.${sinceIso(24 * 7)}`),
    countRows(admin, 'growth_leads', 'status.eq.new'),
    countRows(admin, 'growth_leads', `created_at.gte.${sinceIso(24)}`),
    countRows(admin, 'market_alerts', `created_at.gte.${sinceIso(24)}`),
    countRows(admin, 'trades', `created_at.gte.${sinceIso(24)}`),
    countRows(admin, 'profiles', ''),
  ])
  const core = [s6, s24, s7d, members]
  const optional = [leadsNew, leads24h, signalsToday, trades24h]
  return {
    signups6h: Math.max(0, s6), signups24h: Math.max(0, s24), signups7d: Math.max(0, s7d),
    leadsNew, leads24h, signalsToday, trades24h, members,
    dataIncomplete: core.some(v => v < 0) || optional.every(v => v < 0),
  }
}

/* ── AKSI: SOCIAL PROOF ──────────────────────────────────────────────── */
async function runSocialProof(admin: SupabaseClient, m: GrowthMetrics, dry: boolean): Promise<SocialProof> {
  let lastSignal: SocialProof['lastSignal'] = null
  let signals7d: number | null = null
  try {
    const { count } = await admin
      .from('market_alerts').select('id', { count: 'exact', head: true })
      .gte('created_at', sinceIso(24 * 7))
    signals7d = count ?? 0
    const { data } = await admin
      .from('market_alerts').select('symbol, action, created_at')
      .order('created_at', { ascending: false }).limit(1)
    const row = (data as Array<{ symbol: string; action: string; created_at: string }> | null)?.[0]
    if (row) lastSignal = { symbol: row.symbol, action: row.action, createdAt: row.created_at }
  } catch { /* tabel market_alerts belum ada (SQL 041) — biarkan null */ }

  let tradesTotal: number | null = null
  try {
    const { count } = await admin.from('trades').select('id', { count: 'exact', head: true })
    tradesTotal = count ?? 0
  } catch { /* opsional */ }

  const proof: SocialProof = {
    members: Math.max(0, m.members),
    tradesTotal, signals7d, lastSignal,
    generatedAt: new Date().toISOString(),
  }
  if (!dry) await kvSet(admin, 'growth:social-proof', JSON.stringify(proof))
  return proof
}

/* ── AKSI: CS HOOK (1 panggilan LLM) ─────────────────────────────────── */
const HOOK_SYSTEM = `Kamu KEVIN, Growth Hunter Luxtradee (jurnal trading XAUUSD untuk trader Indonesia, PRO Rp49.000/bulan).
Tugasmu menulis HOOK SAPAAN PROAKTIF untuk CS bot di landing page — untuk pengunjung yang BARU tahu Luxtradee (bukan user lama).
Sapaan harus bikin penasaran & relevan HARI INI berdasarkan DATA RIIL yang diberikan. Gaya: santai khas trader Indonesia, max 1 emoji, TANPA klaim profit, TANPA angka karangan (angka hanya boleh dari DATA RIIL).

Output WAJIB JSON murni tanpa markdown fence:
{"greeting":"...max 160 karakter...","chips":["...max 28 char","...max 28 char"],"note":"1 kalimat alasan hook ini (untuk Bos)"}
chips = 2 tombol quick-reply yang diklik pengunjung. Chip pertama menggoda lihat sinyal/pasarnya, chip kedua mengarah ke "mulai gratis"/cara kerja.`

async function runCsHook(admin: SupabaseClient, m: GrowthMetrics, drought: DroughtVerdict, dry: boolean): Promise<CsHook> {
  const proofLines = socialProofLines({
    members: Math.max(0, m.members), tradesTotal: null, signals7d: m.signalsToday >= 0 ? m.signalsToday : null,
    lastSignal: null, generatedAt: new Date().toISOString(),
  })
  const userPrompt =
    `DATA RIIL HARI INI (WIB ${wibDateStr()}):\n` +
    `${proofLines.map(l => `- ${l}`).join('\n') || '- (belum ada data publik)'}\n` +
    `- Kondisi traffic: ${drought.level} (${clip(drought.reasons.join('; '), 140)})\n\n` +
    `Tulis hook sapaan untuk pengunjung baru hari ini. ${m.signalsToday > 0 ? `Ada ${m.signalsToday} sinyal hari ini — manfaatkan.` : 'Belum ada sinyal hari ini — jangan mengarang angka sinyal.'}`
  const res = await callKevin(HOOK_SYSTEM, userPrompt, 400)
  if (res) {
    const parsed = extractJson<{ greeting?: string; chips?: string[]; note?: string }>(res.text)
    const greeting = clip(parsed?.greeting || '', 200).trim()
    const chips = (Array.isArray(parsed?.chips) ? parsed.chips : [])
      .map(c => clip(String(c), 28).trim()).filter(Boolean).slice(0, 3)
    if (greeting.length >= 12 && chips.length >= 1) {
      const hook: CsHook = {
        greeting, chips,
        note: clip(parsed?.note || '', 160) || `hook via ${res.model}`,
        generatedAt: new Date().toISOString(), model: res.model,
      }
      if (!dry) await kvSet(admin, 'growth:cs-hook', JSON.stringify(hook))
      return hook
    }
  }
  // LLM gagal / format rusak → fallback deterministik tetap segarkan hook
  const fb = buildHookFallback(m)
  if (!dry) await kvSet(admin, 'growth:cs-hook', JSON.stringify(fb))
  return fb
}

/* ── AKSI: LEAD WELCOME (draf → antrean ACC Bos) ─────────────────────── */
async function runLeadWelcome(admin: SupabaseClient, dry: boolean): Promise<{
  drafted: number; drafts: WelcomeEmailDraft[]; tableMissing: boolean
}> {
  let leads: GrowthLead[] = []
  try {
    const { data, error } = await admin
      .from('growth_leads').select('id, email, language, first_message')
      .eq('status', 'new').order('created_at', { ascending: true })
      .limit(MAX_DRAFTS_PER_RUN)
    if (error && isMissingTableError(error)) return { drafted: 0, drafts: [], tableMissing: true }
    if (error) throw error
    leads = (data as GrowthLead[]) || []
  } catch {
    return { drafted: 0, drafts: [], tableMissing: true }
  }
  if (!leads.length) return { drafted: 0, drafts: [], tableMissing: false }

  // Social proof terbaru (kalau ada) untuk konteks email
  let proof: SocialProof | null = null
  try { proof = JSON.parse((await kvGet(admin, 'growth:social-proof')) || 'null') as SocialProof | null } catch { proof = null }

  // SATU panggilan LLM untuk semua lead (hemat kuota) — JSON array
  const drafts: WelcomeEmailDraft[] = []
  const proofLines = proof ? socialProofLines(proof) : []
  const userPrompt =
    `Buat email welcome personal UNTUK SETIAP lead di bawah (bahasa Indonesia, santai, jangan hard-sell — beri nilai dulu). ` +
    `Konteks angka RIIL Luxtradee:\n${proofLines.map(l => `- ${l}`).join('\n') || '- (data belum tersedia)'}\n\n` +
    `OUTPUT WAJIB JSON murni: {"emails":[{"id":"<id lead>","subject":"...","body":"...paragraf pendek, baris baru \\n\\n..."}]}\n\n` +
    leads.map((l, i) => `LEAD ${i + 1}: id=${l.id} email=${l.email} pesan_awal=${clip(l.first_message || '(kosong)', 120)}`).join('\n')
  const res = await callKevin(
    `Kamu KEVIN, Growth Hunter Luxtradee. Tulis email welcome singkat (max 120 kata) yang terasa personal (sebut konteks pesan lead), jujur (angka hanya dari DATA RIIL), dan diakhiri CTA daftar gratis https://luxtradee.web.id/auth/signup.`,
    userPrompt, 1100,
  )
  if (res) {
    const parsed = extractJson<{ emails?: Array<{ id?: string; subject?: string; body?: string }> }>(res.text)
    for (const e of parsed?.emails || []) {
      const lead = leads.find(l => l.id === e.id)
      if (!lead) continue
      const subject = clip(e.subject || '', 120).trim()
      const body = String(e.body || '').trim()
      if (subject.length >= 8 && body.length >= 60) {
        drafts.push({ leadId: lead.id, email: lead.email, subject, body })
      }
    }
  }
  // LLM gagal / sebagian lead terlewat → fallback deterministik
  for (const lead of leads) {
    if (!drafts.some(d => d.leadId === lead.id)) {
      drafts.push(buildWelcomeEmailFallback(lead, proof))
    }
  }

  if (!dry) {
    // Draf → ai_pending_actions (ACC Bos) + tandai lead 'drafted'
    for (const d of drafts.slice(0, MAX_DRAFTS_PER_RUN)) {
      const { error } = await admin.from('ai_pending_actions').insert({
        agent_name: 'Kevin',
        action_type: 'GROWTH_WELCOME_EMAIL',
        action_payload: { lead: { email: d.email, leadId: d.leadId }, subject: d.subject, body: d.body },
        status: 'pending',
      })
      if (!error) {
        await admin.from('growth_leads').update({ status: 'drafted', notes: 'draf welcome menunggu ACC Bos' }).eq('id', d.leadId)
      } else {
        console.error('[growth-sentinel] insert ai_pending_actions gagal:', clip(error.message, 140))
      }
    }
  }
  return { drafted: drafts.length, drafts, tableMissing: false }
}

/* ── AKSI: DROUGHT ALARM (Discord ke Bos) ────────────────────────────── */
async function runDroughtAlarm(m: GrowthMetrics, drought: DroughtVerdict, dry: boolean): Promise<{ sent: boolean; error?: string }> {
  const proofLines = socialProofLines({
    members: Math.max(0, m.members), tradesTotal: null,
    signals7d: m.signalsToday >= 0 ? m.signalsToday : null, lastSignal: null, generatedAt: new Date().toISOString(),
  })
  const msg =
    `🕵️ **GROWTH SENTINEL — ${drought.level.toUpperCase()}**\n` +
    `Karyawan AI lapor: pertumbuhan ${drought.level} (${clip(drought.reasons.join('; '), 160)}).\n\n` +
    `📊 ${proofLines.join(' · ') || 'data belum tersedia'}\n` +
    `📈 Signup: 6j=${m.signups6h} · 24j=${m.signups24h} · 7h=${m.signups7d}${m.leadsNew >= 0 ? ` · Lead nunggu ACC: ${m.leadsNew}` : ''}\n\n` +
    `💡 Saran Kevin (pilih salah satu):\n` +
    `1. ACC email welcome di Antrean Eksekusi (Ruang CEO) — lead dingin cepat\n` +
    `2. Posting video/Reels manual dari artifact Sinta — algoritma butuh konten\n` +
    `3. Bagikan referral link — komisi jalan, user lama jadi sales\n` +
    `4. Cek hook CS bot terbaru di landing — pintu depan harus menarik`
  if (dry) return { sent: false, error: 'dry-run — tidak dikirim' }
  const res = await sendDiscordNotification(msg)
  return { sent: res.ok, error: res.ok ? undefined : res.error }
}

/* ── MEMORI KANTOR (office_memory + mem:list) ────────────────────────── */
async function rememberOffice(admin: SupabaseClient, content: Record<string, unknown>): Promise<void> {
  try {
    await admin.from('office_memory').insert({
      agent_name: 'Kevin', run_date: wibDateStr(), memory_type: 'report', content,
    })
  } catch { /* memori opsional */ }
  try {
    let list: Array<{ at: string; who: string; text: string }> = []
    try { list = JSON.parse((await kvGet(admin, 'mem:list')) || '[]') } catch { /* reset */ }
    const text = typeof content.lesson === 'string' ? content.lesson : 'laporan growth'
    list.unshift({ at: new Date().toISOString(), who: 'Growth Kevin', text: clip(text, 165) })
    await kvSet(admin, 'mem:list', JSON.stringify(list.slice(0, 24)))
  } catch { /* non-kritis */ }
}

/* ── AUTH & HANDLER ──────────────────────────────────────────────────── */
async function isAuthorized(request: NextRequest): Promise<boolean> {
  const secret = await envVal('CRON_SECRET')
  if (!secret) return process.env.NODE_ENV === 'development'
  const provided = request.headers.get('authorization')?.replace('Bearer ', '') || ''
  return provided === secret
}

async function handleRequest(request: NextRequest) {
  const startedAt = Date.now()
  const { searchParams } = new URL(request.url)
  const dry = searchParams.get('dry') === 'true'
  const forcedAction = (searchParams.get('action') || '').toLowerCase()

  const admin = await getCronAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Database unavailable (Supabase admin client gagal dibuat)' }, { status: 503 })
  }

  // ── 1. Metrik riil + verdict kekeringan ──
  const metrics = await gatherMetrics(admin)
  const drought = detectDrought(metrics)

  // ── 2. State + pilih aksi ──
  let state: SentinelState = {}
  try { state = JSON.parse((await kvGet(admin, 'growth:sentinel-state')) || '{}') as SentinelState } catch { state = {} }
  const picked = pickPlaybook(state, metrics, drought)
  const action: typeof picked.action =
    forcedAction && forcedAction in SENTINEL_COOLDOWNS_MS
      ? (forcedAction as typeof picked.action)
      : picked.action
  const reason = forcedAction ? `dipaksa via ?action=${forcedAction}` : picked.reason

  // ── 3. Eksekusi aksi (maks 1 per run) ──
  const notes: string[] = []
  let actionData: Record<string, unknown> | undefined
  if (action !== 'rest') {
    if (action === 'social-proof') {
      const proof = await runSocialProof(admin, metrics, dry)
      actionData = { proof }
      notes.push(`social proof disegarkan: ${proof.members} member, sinyal 7 hari ${proof.signals7d ?? '?'}`)
    } else if (action === 'cs-hook') {
      const hook = await runCsHook(admin, metrics, drought, dry)
      actionData = { hook }
      notes.push(`hook CS bot: "${clip(hook.greeting, 80)}" via ${hook.model}`)
    } else if (action === 'lead-welcome') {
      const lw = await runLeadWelcome(admin, dry)
      actionData = { ...lw, drafts: lw.drafts.map(d => ({ email: d.email, subject: d.subject })) }
      notes.push(lw.tableMissing
        ? 'tabel growth_leads belum ada — jalankan migrasi 043 (lead belum bisa diikuti)'
        : `${lw.drafted} draf email welcome masuk antrean ACC Bos`)
    } else if (action === 'drought-alarm') {
      const alarm = await runDroughtAlarm(metrics, drought, dry)
      actionData = alarm
      notes.push(alarm.sent ? 'alarm kekeringan terkirim ke Discord Bos' : `alarm GAGAL: ${alarm.error}`)
    }
    if (!dry) {
      state.lastRun = { ...(state.lastRun || {}), [action]: new Date().toISOString() }
      await kvSet(admin, 'growth:sentinel-state', JSON.stringify(state))
    }
  }

  // ── 4. Memori kantor (jangan nulis tiap 15 menit kalau rest) ──
  if (action !== 'rest' && !dry) {
    await rememberOffice(admin, {
      lesson: `Sentinel ${action}: ${reason}. Signup 24j=${metrics.signups24h}/7h=${metrics.signups7d}, lead baru=${metrics.leadsNew}`,
      level: drought.level, action, metrics: {
        signups24h: metrics.signups24h, signups7d: metrics.signups7d,
        leadsNew: metrics.leadsNew, signalsToday: metrics.signalsToday,
      },
    })
  }

  return NextResponse.json({
    success: true,
    version: RUN_VERSION,
    dryRun: dry,
    durationMs: Date.now() - startedAt,
    metrics,
    drought,
    action,
    reason,
    notes,
    data: actionData ?? null,
    hint: metrics.leadsNew < 0 ? 'tabel growth_leads belum ada — jalankan supabase-migrations/043_growth_leads.sql' : undefined,
  })
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return await handleRequest(request)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[growth-sentinel] Fatal:', clip(msg, 400))
    return NextResponse.json({ success: false, error: clip(msg, 400) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
