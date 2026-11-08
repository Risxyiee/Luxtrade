/**
 * ═══════════════════════════════════════════════════════════════════════
 * GROWTH SENTINEL — Otak "kerja saat zero-traffic" (karyawan: Kevin)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * MASALAH (SOP Bos): master-autonomous & COO-agent hidup di cron 08:00
 * WIB → aktivitas dasar ada, tapi "proaktif narik user baru" belum.
 * Saat zero-traffic (sepi visitor, nol signup) TIDAK ADA yang kerja.
 *
 * ARSITEKTUR 3 LAPIS:
 *   1. SENTINEL (cron 15-menit, file route-nya) — deteksi kekeringan dari
 *      DATA RIIL → pilih 1 aksi dari playbook (cooldown per aksi) →
 *      eksekusi: refresh social proof, refresh hook CS bot, draf email
 *      welcome lead baru (ACC Bos), alarm kekeringan ke Discord.
 *   2. CS BOT PROAKTIF (landing) — CS bot tidak lagi nunggu ditanya:
 *      teaser bubble + chip quick-reply memakai hook terbaru sentinel,
 *      email visitor yang tertarik → tabel growth_leads (migrasi 043).
 *   3. FOLLOW-UP — draf email welcome per lead masuk ai_pending_actions
 *      (human-in-the-loop, konsisten SOP kantor) → Resend via
 *      execute-action GROWTH_WELCOME_EMAIL.
 *
 * FILE INI = FUNGSI MURNI (tanpa import DB/network) supaya bisa dites
 * langsung dari kode asli (pola ekstraksi Bun.Transpiler) dan dipakai
 * bersama route sentinel + route chat. Semua angka yang masuk HARUS
 * dari data riil — LLM hanya menarasikan (anti-halusinasi).
 * ═══════════════════════════════════════════════════════════════════════
 */

/* ── METRIK & DETEKSI KEKERINGAN ──────────────────────────────────────── */

export interface GrowthMetrics {
  /** Signup baru 6 jam terakhir (profiles.created_at). */
  signups6h: number
  /** Signup 24 jam terakhir. */
  signups24h: number
  /** Signup 7 hari terakhir. */
  signups7d: number
  /** Lead growth_leads status 'new' (belum dihubungi). -1 = tabel belum ada (SQL 043 belum dijalankan). */
  leadsNew: number
  /** Lead baru 24 jam terakhir (semua status). -1 = tabel belum ada. */
  leads24h: number
  /** Sinyal VIP ter-broadcast hari ini (market_alerts). -1 = tabel belum ada. */
  signalsToday: number
  /** Trade baru 24 jam terakhir (user aktif). -1 = tabel tidak terbaca. */
  trades24h: number
  /** Total member (profiles). -1 = tidak terbaca. */
  members: number
  /** true = ada tabel yang gagal dibaca (SQL migrasi belum jalan) → jangan alarm palsu. */
  dataIncomplete: boolean
}

export type DroughtLevel = 'healthy' | 'quiet' | 'drought' | 'critical'

export interface DroughtVerdict {
  level: DroughtLevel
  reasons: string[]
}

/**
 * Deteksi kekeringan pertumbuhan dari angka RIIL.
 *   critical : nol signup 7 HARI (darurat tumbuh — alarm ke Bos)
 *   drought  : nol signup 24 jam DAN nol lead baru
 *   quiet    : signup 24 jam ≤ 2 (ramai sepi)
 *   healthy  : sisanya
 * dataIncomplete membatasi ke 'quiet' (jangan alarm palsu karena SQL
 * migrasi belum dijalankan — pelajaran dari tabel market_alerts).
 */
export function detectDrought(m: GrowthMetrics): DroughtVerdict {
  const reasons: string[] = []
  if (m.dataIncomplete) {
    reasons.push('sebagian tabel belum terbaca (migrasi SQL belum lengkap) — alarm dibatasi')
  }
  if (m.signups7d === 0) {
    reasons.push('0 signup dalam 7 hari')
    if (!m.dataIncomplete) return { level: 'critical', reasons }
    return { level: 'quiet', reasons }
  }
  const noLeads = m.leads24h === 0
  if (m.signups24h === 0) {
    reasons.push('0 signup dalam 24 jam')
    if (noLeads) reasons.push('0 lead baru dari CS bot dalam 24 jam')
    if (!m.dataIncomplete) return { level: noLeads ? 'drought' : 'drought', reasons }
    return { level: 'quiet', reasons }
  }
  if (m.signups24h <= 2) {
    reasons.push(`signup 24 jam hanya ${m.signups24h}`)
    return { level: 'quiet', reasons }
  }
  reasons.push(`${m.signups24h} signup 24 jam, ${m.signups7d} signup 7 hari`)
  return { level: 'healthy', reasons }
}

/* ── PLAYBOOK (satu aksi per run, cooldown per aksi) ──────────────────── */

export type PlaybookAction = 'lead-welcome' | 'social-proof' | 'cs-hook' | 'drought-alarm' | 'rest'

/** Cooldown default (ms) — bisa dioverride env SENTINEL_COOLDOWN_<AKSI>_MS. */
export const SENTINEL_COOLDOWNS_MS: Record<Exclude<PlaybookAction, 'rest'>, number> = {
  'lead-welcome': 60 * 60_000,   // lead baru cepat dingin — sweep tiap 1 jam
  'social-proof': 2 * 3600_000,  // angka cukup stabil — 2 jam
  'cs-hook': 4 * 3600_000,       // hook baru maks ~6×/hari (hemat LLM)
  'drought-alarm': 12 * 3600_000,// jangan spam Discord Bos
}

export interface SentinelState {
  /** ISO timestamp eksekusi terakhir per aksi. */
  lastRun?: Partial<Record<Exclude<PlaybookAction, 'rest'>, string>>
  /** Hari WIB (yyyy-mm-dd) pertama kali terdeteksi kering beruntun. */
  droughtSince?: string
}

function elapsedMs(stamp: string | undefined, now: number): number {
  if (!stamp) return Number.POSITIVE_INFINITY
  const t = new Date(stamp).getTime()
  return Number.isFinite(t) ? Math.max(0, now - t) : Number.POSITIVE_INFINITY
}

/**
 * Pilih SATU aksi untuk run ini (prioritas):
 *   1. lead-welcome  — ada lead 'new' menunggu (paling rentan dingin)
 *   2. social-proof  — angka publik basi >2 jam (murah, tanpa LLM)
 *   3. cs-hook       — hook CS bot basi >4 jam (1 panggilan LLM)
 *   4. drought-alarm — kering parah & alarm terakhir >12 jam
 *   5. rest          — semua sehat/dalam cooldown → hemat kuota
 */
export function pickPlaybook(
  state: SentinelState,
  m: GrowthMetrics,
  drought: DroughtVerdict,
  now: number = Date.now(),
): { action: PlaybookAction; reason: string } {
  if (m.leadsNew > 0 && elapsedMs(state.lastRun?.['lead-welcome'], now) >= SENTINEL_COOLDOWNS_MS['lead-welcome']) {
    return { action: 'lead-welcome', reason: `${m.leadsNew} lead baru menunggu email welcome` }
  }
  if (elapsedMs(state.lastRun?.['social-proof'], now) >= SENTINEL_COOLDOWNS_MS['social-proof']) {
    return { action: 'social-proof', reason: 'angka social proof publik perlu disegarkan' }
  }
  if (elapsedMs(state.lastRun?.['cs-hook'], now) >= SENTINEL_COOLDOWNS_MS['cs-hook']) {
    return { action: 'cs-hook', reason: 'hook sapaan CS bot perlu konteks hari ini' }
  }
  if ((drought.level === 'drought' || drought.level === 'critical') &&
      elapsedMs(state.lastRun?.['drought-alarm'], now) >= SENTINEL_COOLDOWNS_MS['drought-alarm']) {
    return { action: 'drought-alarm', reason: `keadaan ${drought.level}: ${drought.reasons[0] || 'nol pertumbuhan'}` }
  }
  return { action: 'rest', reason: 'semua playbook dalam cooldown / sehat — hemat kuota LLM' }
}

/* ── SOCIAL PROOF (angka riil untuk bot & landing) ────────────────────── */

export interface SocialProof {
  members: number
  tradesTotal: number | null
  signals7d: number | null
  lastSignal: { symbol: string; action: string; createdAt: string } | null
  generatedAt: string
}

/** Baris teks jujur untuk diinjeksi ke prompt CS bot (angka PERSIS, boleh dikutip). */
export function socialProofLines(sp: SocialProof): string[] {
  const lines: string[] = []
  if (sp.members >= 0) lines.push(`Total member Luxtradee: ${sp.members}`)
  if (sp.tradesTotal != null && sp.tradesTotal >= 0) lines.push(`Trade terjurnal user: ${sp.tradesTotal}`)
  if (sp.signals7d != null && sp.signals7d >= 0) {
    let s = `Sinyal VIP 7 hari terakhir: ${sp.signals7d}`
    if (sp.lastSignal) {
      const when = new Date(sp.lastSignal.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
      s += ` (terakhir: ${sp.lastSignal.action} ${sp.lastSignal.symbol}, ${when} WIB)`
    }
    lines.push(s)
  }
  return lines
}

/* ── HOOK CS BOT (fallback deterministik — LLM gagal tetap ada) ───────── */

export interface CsHook {
  greeting: string
  chips: string[]
  note: string
  generatedAt: string
  model: string
}

/**
 * Hook fallback DETERMINISTIK dari data riil (tanpa LLM). Dipakai saat
 * LLM gagal / run pertama sebelum sentinel sempat menulis hook.
 */
export function buildHookFallback(m: GrowthMetrics, now: number = Date.now()): CsHook {
  const hasSignals = m.signalsToday > 0
  const greeting = hasSignals
    ? `Halo! 👋 Ada ${m.signalsToday} sinyal trading baru hari ini. Mau lihat, atau tanya-tanya dulu soal Luxtradee?`
    : `Halo! 👋 Mau tahu cara trader jurnal semua entry-nya biar nggak FOMO lagi? Tanya aja di sini.`
  return {
    greeting,
    chips: ['Lihat sinyal terbaru 📊', 'Cara mulai gratis? 🆓'],
    note: 'hook fallback deterministik (data riil, tanpa LLM)',
    generatedAt: new Date(now).toISOString(),
    model: 'fallback-deterministik',
  }
}

/* ── EMAIL WELCOME (fallback deterministik per lead) ──────────────────── */

export interface GrowthLead {
  id: string
  email: string
  language: string
  first_message: string | null
  notes?: string | null
}

export interface WelcomeEmailDraft {
  leadId: string
  email: string
  subject: string
  body: string
}

function emailPrefix(email: string): string {
  const p = email.split('@')[0] || 'sahabat'
  return p.charAt(0).toUpperCase() + p.slice(1)
}

/** Email welcome fallback (tanpa LLM) — jujur, singkat, ada CTA nyata. */
export function buildWelcomeEmailFallback(lead: GrowthLead, proof: SocialProof | null, now: number = Date.now()): WelcomeEmailDraft {
  const name = emailPrefix(lead.email)
  const signalLine = proof && proof.signals7d != null && proof.signals7d > 0
    ? `Minggu ini saja ada ${proof.signals7d} sinyal VIP XAU/USD yang ter-broadcast ke user PRO.`
    : `Setiap ada peluang entry XAU/USD, sistem kami broadcast arah + entry + SL/TP ke user PRO.`
  return {
    leadId: lead.id,
    email: lead.email,
    subject: `${name}, ini cara baca sinyal XAU/USD biar nggak nebak-nebak`,
    body:
      `Halo ${name},\n\n` +
      `Kamu tadi sempat tanya-tanya di website Luxtradee${lead.first_message ? ` tentang "${lead.first_message.slice(0, 80)}"` : ''}. ` +
      `Senang banget kami bisa bantu.\n\n` +
      `${signalLine}\n\n` +
      `Mulai gratis dulu saja: buat akun, catat 3 trade terakhirmu, dan lihat pola loss-mu keluar sendiri oleh AI kami (FOMO? overtrading? revenge trading?).\n\n` +
      `👉 Daftar gratis: https://luxtradee.web.id/auth/signup\n\n` +
      `Kalau ada yang mau ditanya, balas email ini ya — dibalas langsung.\n\nSalam hijau,\nTim Luxtradee`,
  }
}

/* ── LEAD CAPTURE (CS bot landing) ────────────────────────────────────── */

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i

/**
 * Deteksi email di pesan visitor chat. Balik null kalau tidak ada /
 * cuma contoh palsu (xxx@..., contoh@..., test@..., a@b.cc singkat).
 * Dipakai route /api/chat + widget landing.
 */
export function extractEmail(text: string): string | null {
  if (!text) return null
  const match = EMAIL_RE.exec(text)
  if (!match) return null
  const email = match[0].toLowerCase()
  const local = email.split('@')[0] || ''
  // Buang placeholder yang jelas bukan lead sungguhan
  if (/^(xxx+|contoh|example|test|tes|user|nama|email|asdf+|abc@?$)/.test(local)) return null
  if (local.length < 2) return null
  const domain = email.split('@')[1] || ''
  if (domain.length < 4) return null
  return email
}

/** Sanitasi pesan visitor sebelum disimpan (jaga ukuran kolom & PII berlebih). */
export function clipLeadMessage(text: string | null | undefined, n = 300): string | null {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return null
  return t.length <= n ? t : t.slice(0, n) + '…'
}
