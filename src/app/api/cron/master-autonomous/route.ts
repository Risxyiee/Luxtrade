import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCronAdmin, fetchAllRows, isMissingTableError, isMissingColumnError } from '@/lib/cron-supabase'
import { slugify, renderSafeArticleHtml } from '@/lib/blog-html'
import { extractJson, callLLM } from '@/lib/ai-llm'
import { getEnvVar, getSelfFetch } from '@/lib/cloudflare-bindings'
import { sendDiscordNotification } from '@/lib/discord'
import { bagasCooldownSince, bagasCooldownOrExpr, emailsFromActionRows } from '@/lib/bagas-cooldown'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏢 MASTER AUTONOMOUS CRON — "Fully Autonomous AI Workforce" (8 Karyawan)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * SATU endpoint, DELAPAN agen:
 *
 *   🚀 FARHAN   (Growth Hacker) — riset keyword dgn TREN RIIL (Google Trends
 *               RSS Indonesia, tanpa API key) + learning loop views →
 *               artikel SEO 600+ kata (Actor-Critic) + link internal antar
 *               artikel + FAQ featured-snippet + CTA signup → slug/meta/
 *               keyword TERSIMPAN (migrasi 040, fallback agent_kv) →
 *               AUTO-TERBIT di blog_posts → TAMPIL di /blog via API publik
 *               /api/blog/posts (halaman blog baca tabel, bukan hard-code)
 *   📣 SINTA    (CMO)          — RISET TikTok: LAPORAN ANALISIS pasar
 *               niche trading — BERBASIS DATA RIIL (top-5 konten TikTok
 *               sendiri + TREN SEARCH GOOGLE INDONESIA hari ini) →
 *               dibagikan ke briefing Alexander, prompt Farhan & Bagas,
 *               panel Memori Kantor. + 3 draf skrip provokatif (Actor-
 *               Critic, selaras riset) → nunggu ACC Bos. LINGKARAN ACC
 *               KINI UTUH: skrip yang Bos ACC pagi disetor ke studio
 *               video & jadi INTI video sore (bukan pajangan lagi) +
 *               selera Bos masuk memori. Shift SORE dia (19.10 WIB, job
 *               "sinta-video"): produksi & posting VIDEO TikTok + IG
 *               Reels otomatis (studio /api/cron/video-bot → render
 *               Remotion → Content Posting API) → katalog tiktok_posts
 *               terisi otomatis via /api/tiktok/report dari runner.
 *   🖥️ RAKA     (CTO)          — security sweep black-box v2: 19 probe
 *               (route kritis, canary P0, JALUR REVENUE /auth/signup,
 *               SEO infra sitemap/robots, API publik blog) + latency &
 *               CONTENT SANITY (deploy white-screen HTTP 200 tidak lolos)
 *               + cek security headers landing + TREN antar-run
 *               (membaik/sama/memburuk, P1 molor naik eskalasi) →
 *               P1 = ALARM @here LANGSUNG dari Raka ke Discord (dulu
 *               cuma lewat wave Alexander — run solo tidak menyalakan
 *               sirene). Alexander tetap backup kalau alarm gagal terkirim.
 *   👥 MAYA     (CSO)          — rasio aktif vs pasif (data riil) →
 *               email win-back (Actor-Critic) → draf nunggu ACC Bos
 *   💼 BAGAS    (COO)          — hot leads (free user teraktif 7 hari) →
 *               draf email konversi PRO → nunggu ACC Bos
 *   💰 PUTRI    (CFO)          — MRR = matematika HARDCODED di kode (bukan
 *               LLM) + pantau kuota API (OpenRouter/Gemini/Resend) →
 *               deteksi dini risiko rate-limit 429
 *   📊 DEWI     (Data Analyst) — statistik emosi vs profit dihitung DI
 *               KODE dari trades riil → LLM hanya menarasikan → insight
 *   👔 ALEXANDER(CEO)          — agregasi SEMUA hasil → Morning Briefing +
 *               1 "Next Best Action" → kirim otomatis ke Discord
 *               (env DISCORD_BOT = token bot + DISCORD_CHANNEL_ID, ATAU
 *               DISCORD_WEBHOOK_URL — auto-terdeteksi, lihat lib/discord.ts)
 *
 * ARSITEKTUR EKSEKUSI:
 *   - 7 pekerja → Promise.allSettled PARALEL (kegagalan 1 agen TIDAK menular;
 *     tiap agen juga try-catch sendiri → selalu return AgentResult, tak throw).
 *   - Alexander fanned-in SETELAH semuanya selesai (dia butuh hasil semua —
 *     CEO tidak bisa merapikan pekerjaan yang belum ada).
 *   - MEMORI KANTOR (office_memory, migration 016): tiap agen membaca
 *     "pelajaran" run sebelumnya (hasil critic, temuan security) dan menulis
 *     pelajaran baru → agen belajar lintas hari. Tabel belum ada? Tetap jalan
 *     tanpa memori (degrade gracefully, pola cron-supabase).
 *
 * KEAMANAN & ANTI-SERAKAH:
 *   - Auth: Bearer CRON_SECRET (SATU nama saja — nama env di Cloudflare
 *     Bos: CRON_SECRET). P0 HARDENING: FAIL-CLOSED — kalau CRON_SECRET
 *     tidak diset, endpoint DITOLAK di produksi (dulu: terbuka dengan
 *     guard interval; sekarang dev lokal saja yang boleh tanpa secret).
 *   - ?dry=true      → snapshot data RIIL tanpa LLM, tanpa tulis DB, tanpa Discord
 *   - ?agents=farhan,sinta → jalankan subset (debugging)
 *   - ?force=true    → lewati guard interval (butuh secret valid)
 *
 * KUOTA LLM (SOP multi-agent — Task 35/35c):
 *   rantai model TERVERIFIKASI HIDUP di OpenRouter (gemma-2-9b:free,
 *   llama-3.1-8b:free, glm-4-flash sudah 404 — DILARANG dipakai lagi).
 *   Primary per agen bisa dioverride lewat env OR_MODEL_FARHAN / OR_MODEL_SINTA / dst.
 *
 * Trigger harian: .github/workflows/master-autonomous-cron.yml (08.00 WIB).
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const dynamic = 'force-dynamic'

/* ═══════════════════════ KONFIGURASI & HELPERS DASAR ═══════════════════════ */

const RUN_VERSION = 'master-autonomous@3-skillmax'
const DEFAULT_MIN_INTERVAL_MIN = 30

/** Env resolver: CF Workers binding → process.env (pola cron lama). */
async function envVal(name: string, fallback = ''): Promise<string> {
  try {
    const v = (await getEnvVar(name, { quiet: true })) || process.env[name] || ''
    return v || fallback
  } catch {
    return process.env[name] || fallback
  }
}

/** Tanggal WIB (UTC+7) untuk kunci kuota harian & run_date memori. */
function wibDateStr(d = new Date()): string {
  return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10)
}

/** Ringkas string untuk prompt/log — jaga token & ukuran respons. */
function clip(s: unknown, n: number): string {
  const t = String(s ?? '')
  return t.length <= n ? t : t.slice(0, n) + '…'
}

/** Pelacak kuota per-run (dibaca Putri, dilaporkan Alexander, ditotal di akhir). */
const quotaTracker = { llmCalls: 0, llmFailures: 0, perAgent: {} as Record<string, number> }
function resetQuotaTracker(): void {
  quotaTracker.llmCalls = 0
  quotaTracker.llmFailures = 0
  quotaTracker.perAgent = {}
}

/* ═══════════════════════ callAgent — OpenRouter MURNI ═══════════════════════ */

const OR_URL = 'https://openrouter.ai/api/v1/chat/completions'

/* SOP Multi-Agent: rantai diurutkan dari hasil tes HIDUP terbaru (diag Bos:
   gemma-4-26b & gemma-4-31b = HTTP 429 free-tier; nemotron & xingchen hidup).
   Model 429 di urutan depan = tiap panggilan agen buang 2x percobaan →
   model hidup dulu, gemma di belakang sebagai cadangan saat kuota reset. */
const OR_LIVE_CHAIN = [
  'nvidia/nemotron-3.5-lightning:free',      // ✅ hidup (339 ms)
  'nvidia/nemotron-3-ultra-550b-a55b:free',  // ✅ hidup (372 ms)
  'xingchen-agi/xing4.0-29b-a4b:free',       // ✅ hidup (1527 ms)
  'google/gemma-4-26b-a4b-it:free',          // ⚠️ 429 free-tier — cadangan
  'google/gemma-4-31b-it:free',              // ⚠️ 429 free-tier — cadangan
]
const DEFAULT_OR_MODEL = OR_LIVE_CHAIN[0]

interface AgentLLMResult { text: string; model: string }

interface CallAgentOpts {
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
  /** Override model primary (env OR_MODEL_<TAG> tetap menang). */
  model?: string
}
/**
 * Helper LLM WAJIB semua agen: fetch OpenRouter murni (tanpa SDK — aman di
 * CF Workers) + failover rantai model hidup + pencatatan kuota per agen.
 * Return null kalau key kosong / semua model gagal → caller WAJIB punya
 * fallback deterministik (data riil tetap dilaporkan jujur).
 */
async function callAgent(
  agentTag: string,
  systemPrompt: string,
  userPrompt: string,
  opts: CallAgentOpts = {},
): Promise<AgentLLMResult | null> {
  const key = (await envVal('OPENROUTER_API_KEY')).trim()
  if (!key) {
    console.warn(`[master:${agentTag}] OPENROUTER_API_KEY kosong — fallback ke Groq/Gemini (ai-llm)`)
  } else {
  const primary = (await envVal(`OR_MODEL_${agentTag.toUpperCase()}`)).trim() || opts.model || DEFAULT_OR_MODEL
  const chain = [...new Set([primary, ...OR_LIVE_CHAIN])]

  for (const model of chain) {
    try {
      const res = await fetch(OR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: opts.temperature ?? 0.7,
          max_tokens: opts.maxTokens ?? 800,
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 45_000),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        console.error(`[master:${agentTag}] OpenRouter ${model} ${res.status}: ${clip(body, 140)}`)
        quotaTracker.llmFailures++
        continue
      }
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const text = data?.choices?.[0]?.message?.content?.trim()
      if (!text) {
        console.error(`[master:${agentTag}] OpenRouter ${model} balik kosong`)
        quotaTracker.llmFailures++
        continue
      }
      quotaTracker.llmCalls++
      quotaTracker.perAgent[agentTag] = (quotaTracker.perAgent[agentTag] || 0) + 1
      return { text, model }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[master:${agentTag}] OpenRouter ${model} error: ${clip(msg, 140)}`)
      quotaTracker.llmFailures++
    }
  }
  }

  // ── Fallback: Groq (free ±14.400 req/hari) → Gemini (free 1.500/hari) ──
  // Helper ai-llm sudah ter-bundle di worker & Workers-safe (fetch murni).
  // Catatan: temperature fallback tetap bawaan helper (opts.temperature diabaikan).
  const fb = await callLLM(systemPrompt, userPrompt, opts.maxTokens ?? 800)
  if (fb) {
    quotaTracker.llmCalls++
    quotaTracker.perAgent[agentTag] = (quotaTracker.perAgent[agentTag] || 0) + 1
    console.log(`[master:${agentTag}] LLM sukses via fallback ${fb.provider}/${fb.model}`)
    return { text: fb.text, model: `${fb.provider}/${fb.model}` }
  }
  console.warn(`[master:${agentTag}] Semua provider LLM gagal (OpenRouter kosong/semua model gagal, GROQ_API_KEY & GEMINI_API_KEY tidak diset/gagal)`)
  return null
}

/* ═══════════════════════ ACTOR-CRITIC LOOP (revisi mandiri) ════════════════ */

interface CriticVerdict { score: number; feedback: string }
interface ActorCriticResult {
  text: string
  model: string
  score: number // -1 = critic tidak tersedia (key/kuota habis)
  revisions: number
  trail: string[]
}

function criticSystemPrompt(rubric: string): string {
  return `Kamu CRITIC internal yang KERAS, jujur, dan susah puji. Tugasmu MENILAI draf karyawan, bukan menulis ulang.

RUBRIK PENILAIAN:
${rubric}

Skor 1-10 (7 = layak tayang; di bawah 7 = WAJIB direvisi). Feedback maksimal 3 poin, spesifik & bisa dieksekusi.

Output WAJIB JSON murni tanpa markdown fence:
{"score": 7, "feedback": "- poin1 - poin2 - poin3"}`
}

async function criticJudge(agentTag: string, rubric: string, draft: string): Promise<CriticVerdict | null> {
  const res = await callAgent(`${agentTag}-critic`,
    criticSystemPrompt(rubric),
    `NILAI DRAF INI SEKARANG:\n\n${clip(draft, 6000)}`,
    { maxTokens: 260, temperature: 0.2, timeoutMs: 30_000 },
  )
  if (!res) return null
  const parsed = extractJson<{ score?: unknown; feedback?: unknown }>(res.text)
  const score = Number(parsed?.score)
  if (!Number.isFinite(score)) return null
  return {
    score: Math.max(1, Math.min(10, Math.round(score))),
    feedback: clip(parsed?.feedback ?? 'tanpa catatan', 400),
  }
}

/**
 * Actor-Critic loop: draf → dinilai critic → kalau skor < passScore,
 * direvisi maks `maxRevisions` kali dengan catatan critic. Trail dicatat ke
 * memori kantor agar agen belajar dari revisi hari sebelumnya.
 */
async function actorCritic(
  agentTag: string,
  params: {
    system: string
    user: string
    rubric: string
    maxTokens?: number
    temperature?: number
    passScore?: number
    maxRevisions?: number
    /** Timeout per panggilan LLM (ms) — default 90s untuk draf panjang free-tier. */
    timeoutMs?: number
  },
): Promise<ActorCriticResult | null> {
  const passScore = params.passScore ?? 7
  const maxRevisions = params.maxRevisions ?? 1
  const trail: string[] = []

  const first = await callAgent(agentTag, params.system, params.user, {
    maxTokens: params.maxTokens, temperature: params.temperature,
    timeoutMs: params.timeoutMs ?? 90_000,
  })
  if (!first) return null
  let draft = first
  trail.push(`draf#1 via ${first.model}`)

  let verdict = await criticJudge(agentTag, params.rubric, draft.text)
  let revisions = 0
  while (verdict && verdict.score < passScore && revisions < maxRevisions) {
    trail.push(`critic ${verdict.score}/10: ${clip(verdict.feedback, 120)}`)
    const reviseUser =
      `${params.user}\n\n` +
      `=== DRAF SEBELUMNYA (dinilai critic ${verdict.score}/10 — TIDAK LULUS) ===\n${clip(draft.text, 3000)}\n` +
      `=== CATATAN CRITIC (WAJIB diperbaiki semua) ===\n${verdict.feedback}\n\n` +
      `Tulis ULANG draf yang jauh lebih baik sesuai catatan. Sertakan SEMUA requirement format dari instruksi awal.`
    const revised = await callAgent(agentTag, params.system, reviseUser, {
      maxTokens: params.maxTokens, temperature: params.temperature,
      timeoutMs: params.timeoutMs ?? 90_000,
    })
    if (!revised) break // kuota habis — pakai draf terakhir yang ada
    draft = revised
    revisions++
    trail.push(`revisi#${revisions} via ${revised.model}`)
    verdict = await criticJudge(agentTag, params.rubric, draft.text)
  }
  const finalScore = verdict?.score ?? -1
  trail.push(finalScore < 0 ? 'final: tanpa penilaian critic' : `final: ${finalScore}/10 (lolos≥${passScore}=${finalScore >= passScore})`)
  return { text: draft.text, model: draft.model, score: finalScore, revisions, trail }
}

/* ═══════════════════════ MEMORI KANTOR (office_memory) ═════════════════════ */

/**
 * Tulis memori. Tabel belum dibuat → diabaikan senyap (belajar lintas hari
 * itu fitur opsional; cron tetap hijau) — pola degrade-gracefully cron lama.
 */
async function officeRemember(
  admin: SupabaseClient,
  agentName: string,
  memoryType: 'critic' | 'lesson' | 'security' | 'report',
  content: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await admin.from('office_memory').insert({
      agent_name: agentName,
      run_date: wibDateStr(),
      memory_type: memoryType,
      content,
    })
    if (error && !isMissingTableError(error)) {
      console.warn(`[master:memory] gagal simpan memori ${agentName}: ${clip(error.message, 120)}`)
    }
  } catch { /* non-kritis */ }
}

/** Ambil pelajaran terakhir agen (maks `limit`) untuk diinjeksi ke prompt. */
async function officeRecallLessons(admin: SupabaseClient, agentName: string, limit = 3): Promise<string[]> {
  try {
    const { data, error } = await admin
      .from('office_memory')
      .select('content')
      .eq('agent_name', agentName)
      .in('memory_type', ['lesson', 'critic'])
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return (data as Array<{ content: { lesson?: string } }>)
      .map(r => r.content?.lesson)
      .filter((l): l is string => typeof l === 'string' && l.trim().length > 0)
  } catch {
    return []
  }
}

function lessonsBlock(lessons: string[]): string {
  if (!lessons.length) return 'BELAJAR DARI KEMARIN: (belum ada memori — run pertama)'
  return `BELAJAR DARI KEMARIN (memori kantor — WAJIB dihindari/diperbaiki):\n${lessons.map(l => `- ${l}`).join('\n')}`
}

/* ── RISET TIKTOK lintas divisi ──────────────────────────────────────────
 * Sinta (CMO) tidak cuma bikin konten: tiap pagi dia menyusun LAPORAN
 * RISET TikTok (analisis pasar niche trading) yang DIPAKAI KANTOR:
 *   - Alexander  → dimasukkan ke Morning Briefing
 *   - Farhan     → bahan riset keyword artikel SEO
 *   - Bagas      → bahan angle email konversi PRO
 *   - Bos        → panel 🧠 Memori Kantor di /kantor-ceo
 * Laporan disimpan di office_memory (type 'report', agent 'Sinta'). */

interface SintaRiset {
  ringkasan?: string
  pola_yang_works?: string[]
  rekomendasi_topik?: string[]
  waktu_posting?: string
  insight_lintas_divisi?: Array<{ untuk?: string; insight?: string }>
  risiko?: string
}

/** Baca LAPORAN RISET TikTok terakhir dari Sinta (office_memory 'report'). */
async function officeRecallRisetSinta(admin: SupabaseClient, limit = 1): Promise<SintaRiset[]> {
  try {
    const { data, error } = await admin
      .from('office_memory')
      .select('content')
      .eq('agent_name', 'Sinta')
      .eq('memory_type', 'report')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return (data as Array<{ content: { riset?: SintaRiset } }>)
      .map(r => r.content?.riset)
      .filter((r): r is SintaRiset => !!r && typeof r === 'object')
  } catch {
    return []
  }
}

/** Blok teks riset Sinta untuk prompt agen lain ('' kalau belum ada).
 *  Catatan: Sinta menyusun riset hari ini di wave 2 yang PARALEL dengan
 *  Farhan (dan lebih telat dari Bagas di wave 1) → yang terbaca di sini
 *  riset run SEBELUMNYA (kemarin) — cukup, analisis pasar tidak
 *  kedaluwarsa dalam sehari. */
async function risetSintaBlock(admin: SupabaseClient): Promise<string> {
  const [latest] = await officeRecallRisetSinta(admin, 1)
  if (!latest) return ''
  const lines: string[] = []
  if (latest.ringkasan) lines.push(`Ringkasan pasar: ${latest.ringkasan}`)
  if (latest.rekomendasi_topik?.length) lines.push(`Topik berpeluang: ${latest.rekomendasi_topik.join('; ')}`)
  for (const i of latest.insight_lintas_divisi || []) {
    if (i?.insight) lines.push(`Untuk ${i.untuk || 'semua divisi'}: ${i.insight}`)
  }
  if (latest.risiko) lines.push(`Risiko: ${latest.risiko}`)
  return lines.length
    ? `\nRISET TIKTOK SINTA (CMO) TERAKHIR — pertimbangkan sebagai bahan:\n${lines.map(l => `- ${l}`).join('\n')}\n`
    : ''
}

/** Publikasikan riset Sinta ke panel 🧠 Memori Kantor /kantor-ceo.
 *  Tulis ke agent_kv `mem:list` — format PERSIS memAdd di /api/ceo-agent
 *  supaya entri tampil di dashboard & ikut terinjeksi ke prompt briefing. */
async function shareRisetToOfficeMemory(admin: SupabaseClient, riset: SintaRiset): Promise<void> {
  try {
    let list: Array<{ at: string; who: string; text: string }> = []
    try { list = JSON.parse((await kvGet(admin, 'mem:list')) || '[]') } catch { /* korup → reset */ }
    const insight = riset.insight_lintas_divisi?.find(i => i?.insight)?.insight
    const body = clip([riset.ringkasan, insight].filter(Boolean).join(' · '), 165)
    if (!body) return
    list.unshift({ at: new Date().toISOString(), who: 'CMO Sinta', text: `LAPORAN RISET TikTok — ${body}` })
    await kvSet(admin, 'mem:list', JSON.stringify(list.slice(0, 24)))
  } catch { /* memori opsional — jangan ganggu tugas utama */ }
}

/* ═══════════════════════ KV KECIL (agent_kv — migration 012) ═══════════════ */

async function kvGet(admin: SupabaseClient, key: string): Promise<string | null> {
  try {
    const { data } = await admin.from('agent_kv').select('value').eq('key', key).maybeSingle()
    return (data as { value?: string } | null)?.value ?? null
  } catch { return null }
}
async function kvSet(admin: SupabaseClient, key: string, value: string): Promise<void> {
  try { await admin.from('agent_kv').upsert({ key, value }, { onConflict: 'key' }) } catch { /* non-kritis */ }
}

/* ═══════════ SKILL-MAX SISA KARYAWAN (audit 8 Nov: Maya·Bagas·Putri·Dewi) ═════
 * Helper bersama yang menutup temuan audit:
 *   • fetchUnsubUserIds  → M3/B2: suppression list unsubscribe lintas kampanye
 *   • readEmailSignal    → B1: sinyal webhook Resend (open:{email})
 *   • parseWinbackStamp  → M1: cooldown winback dua fase (draft 3 hari /
 *                          sent 14 hari sejak BENERAN terkirim)
 *   • insightDewiBlock   → D2: pipa insight Dewi ke Farhan/Bagas/Sinta
 * ══════════════════════════════════════════════════════════════════════════ */

/** SUPPRESSION BERSAMA (M3/B2): id user yang minta berhenti di-email dari
 *  dua kampanye cron (re_engagement_emails / daily_reminder_logs.unsubscribed).
 *  Fail-open: tabel belum ada / gagal baca → set kosong (perilaku lama). */
async function fetchUnsubUserIds(admin: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>()
  for (const tbl of ['re_engagement_emails', 'daily_reminder_logs']) {
    try {
      const { data } = await admin.from(tbl).select('user_id').eq('unsubscribed', true).limit(1000)
      for (const r of (data || []) as Array<{ user_id?: string | null }>) if (r.user_id) ids.add(r.user_id)
    } catch { /* tabel opsional */ }
  }
  return ids
}

interface EmailSignal { count?: number; clicks?: number; bounced?: boolean; last?: string }

/** Sinyal email per penerima (ditulis webhook /api/webhooks/resend).
 *  B1: lead yang SUDAH buka/klik = penasaran → angle beda; bounced = jangan
 *  diganggu lagi. Null kalau belum ada sinyal. */
async function readEmailSignal(admin: SupabaseClient, email: string): Promise<EmailSignal | null> {
  try {
    const raw = await kvGet(admin, `open:${email.toLowerCase().trim()}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as EmailSignal
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch { return null }
}

/** Parser stamp cooldown winback — kompatibel format lama (ISO polos dianggap
 *  'sent' agar lead yang sudah di-email dulu tetap terlindungi). */
function parseWinbackStamp(raw: string | null): { phase: 'sent' | 'draft'; at: number } | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as { phase?: string; at?: string }
    if (p && (p.phase === 'sent' || p.phase === 'draft')) {
      const t = new Date(p.at || '').getTime()
      return Number.isFinite(t) && t > 0 ? { phase: p.phase as 'sent' | 'draft', at: t } : null
    }
  } catch { /* format lama: ISO string polos */ }
  const t = new Date(raw).getTime()
  return Number.isFinite(t) && !Number.isNaN(t) ? { phase: 'sent', at: t } : null
}

/* ── DATA DEWI lintas divisi (audit D2) ──────────────────────────────────
 * Dewi menghitung statistik trading RIIL tiap pagi, tapi dulu insight-nya
 * berhenti di briefing Alexander. Kini Farhan (topik artikel), Bagas
 * (angle email) & Sinta (riset pasar) ikut membacanya → emosi/jam entry
 * terburuk user jadi bahan topik konten & angle penawaran. */
interface DewiMemory { insight?: string; recommendation?: string; stats?: { winrate?: number; tradesAnalyzed?: number } }

async function officeRecallInsightDewi(admin: SupabaseClient, limit = 1): Promise<DewiMemory[]> {
  try {
    const { data, error } = await admin
      .from('office_memory')
      .select('content')
      .eq('agent_name', 'Dewi')
      .eq('memory_type', 'report')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return (data as Array<{ content: DewiMemory }>)
      .map(r => r.content)
      .filter(c => !!c && typeof c === 'object' && typeof c.insight === 'string' && c.insight.length > 0)
  } catch { return [] }
}

/** Blok insight Dewi untuk prompt agen lain ('' kalau belum ada). */
async function insightDewiBlock(admin: SupabaseClient): Promise<string> {
  const [latest] = await officeRecallInsightDewi(admin, 1)
  if (!latest?.insight) return ''
  const lines = [`Insight: ${latest.insight}`]
  if (latest.recommendation) lines.push(`Rekomendasi: ${latest.recommendation}`)
  return `\nDATA ANALYST DEWI TERAKHIR (statistik riil trading user — peluang topik/angle, angka JANGAN diubah):
${lines.map(l => `- ${l}`).join('\n')}\n`
}

/* ═══════════════════════ TIPE HASIL AGEN ═══════════════════════════════════ */

interface AgentResult {
  agent: string
  status: 'ok' | 'error' | 'skipped'
  summary: string
  data?: Record<string, unknown>
  error?: string
}

function okResult(agent: string, summary: string, data?: Record<string, unknown>): AgentResult {
  return { agent, status: 'ok', summary, data }
}
function skipResult(agent: string, summary: string, data?: Record<string, unknown>): AgentResult {
  return { agent, status: 'skipped', summary, data }
}
function errResult(agent: string, error: unknown, data?: Record<string, unknown>): AgentResult {
  const msg = error instanceof Error ? error.message : String(error)
  console.error(`[master:${agent}] ERROR: ${clip(msg, 300)}`)
  return { agent, status: 'error', summary: 'gagal — lihat error', error: clip(msg, 400), data }
}

const ANTI_HALUSINASI =
  'ATURAN KERAS (anti-halusinasi): gunakan HANYA angka & fakta dari blok DATA RIIL. ' +
  'DILARANG mengarang angka, nama user, atau klaim. Output HANYA JSON valid tanpa teks lain.'

/* ═══════════════════════════════════════════════════════════════════════════
 * 🚀 AGEN 1 — FARHAN (Growth Hacker · Outbound SEO Engine)
 * ═══════════════════════════════════════════════════════════════════════════ */

const FARHAN_SYSTEM = `Kamu FARHAN, Growth Hacker Luxtradee (jurnal trading XAUUSD untuk trader retail & prop firm, harga PRO Rp49.000/bulan).
Kamu menulis artikel SEO berbahasa Indonesia yang BENAR-BENAR enak dibaca — bukan karangan SEO robot.

GAYA WAJIB:
- Seperti trader senior ngobrol ke teman: tegas, praktis, kadang sarkas ringan. BUKAN bahasa korporat kaku.
- Spesifik: sebut angka, contoh RR, contoh skenario XAUUSD nyata. Nol kalimat kosong seperti "trading membutuhkan strategi yang baik".
- SEO natural: keyword utama muncul di judul, kalimat pembuka, 1 H2, dan penutup. Jangan keyword-stuffing.
- LINK INTERNAL: sisipkan minimal 2 tautan ke artikel lain Luxtradee (<a href="/blog/...">...</a>) secara natural di dalam isi — anchor text deskriptif, bukan "klik di sini".
- CTA penutup: link teks <a href="/auth/signup">jurnal trading AI Luxtradee</a> di paragraf akhir, halus tanpa hard-sell.
- FAQ: akhir artikel WAJIB ada <h3>FAQ</h3> berisi 2 pertanyaan + jawaban singkat (2-3 kalimat) yang relevan dengan keyword — material featured snippet Google.

FORMAT OUTPUT WAJIB JSON MURNI (tanpa markdown fence):
{"title": "...", "meta_description": "...", "html_body": "<h2>...</h2><p>...</p>..."}

html_body: HTML murni — hanya tag <h2>, <h3>, <p>, <ul>, <li>, <strong>, <a>. TANPA <html>/<body>/<h1>. Minimal 600 kata.`

const FARHAN_RUBRIC = `- Panjang MINIMAL (BUKAN maksimal!): hitung kata body — di bawah 600 kata = otomatis nilai 5. Rentang sehat 600–1.200 kata. JANGAN PERNAH menasihati memangkas/mempersingkat kecuali draf lebih dari 1.500 kata.
- Struktur SEO: judul mengandung keyword, H2/H3 rapi, pembuka langsung to-the-point.
- Tautan internal: minimal 2 <a href="/blog/..."> tersisip natural + 1 CTA <a href="/auth/signup"> di penutup + bagian FAQ (2 pertanyaan) di akhir. Tanpa semuanya = turun nilai.
- Kepercayaan: ada angka/skenario nyata XAUUSD, bukan basa-basi generik.
- Gaya: terbaca seperti manusia (bukan template AI), CTA natural.`

interface FarhanKeyword { keyword: string; angle: string }

/**
 * Tren pencarian Google Indonesia HARI INI — DATA RIIL dari Google Trends RSS
 * (https://trends.google.com/trending/rss?geo=ID), tanpa API key, fetch murni
 * (Workers-safe). Gagal/timeout → array kosong (riset lanjut dgn intuisi niche,
 * ditandai eksplisit di prompt). Dulu: riset Farhan 100% halusinasi LLM.
 */
async function fetchGoogleTrendsId(timeoutMs = 8000): Promise<string[]> {
  try {
    const res = await fetch('https://trends.google.com/trending/rss?geo=ID', {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LuxtradeeBot/1.0)' },
    })
    if (!res.ok) return []
    const xml = await res.text()
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    const out: string[] = []
    for (const it of items) {
      const m = it[1].match(/<title>([\s\S]*?)<\/title>/)
      const title = m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : ''
      if (title) out.push(clip(title, 60))
      if (out.length >= 8) break
    }
    return out
  } catch {
    return []
  }
}

/**
 * Artikel berperforma terbaik (views pembaca RIIL — kolom views migrasi 040).
 * Belum dimigrasi / belum ada pembaca → kosong (prompt tanpa blok ini).
 * Ini LEARNING LOOP Farhan: dia belajar pola artikel yang menang, bukan
 * nulis buta tiap hari.
 */
async function fetchTopBlogArticles(
  admin: SupabaseClient,
): Promise<Array<{ title: string; views: number; keyword: string }>> {
  try {
    const { data, error } = await admin
      .from('blog_posts')
      .select('title,views,keyword')
      .eq('status', 'published')
      .gt('views', 0)
      .order('views', { ascending: false })
      .limit(5)
    if (error || !data?.length) return []
    return (data as Array<{ title: string; views: number; keyword: string | null }>).map(r => ({
      title: r.title,
      views: r.views,
      keyword: r.keyword || '',
    }))
  } catch {
    return []
  }
}

/** Kandidat link internal: artikel terbit terakhir (+slug, migrasi 040 → fallback slugify judul). */
async function fetchBlogLinkCandidates(
  admin: SupabaseClient,
): Promise<Array<{ title: string; slug: string }>> {
  try {
    const { data, error } = await admin
      .from('blog_posts')
      .select('title,slug')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(8)
    if (error) {
      if (!isMissingColumnError(error)) return []
      const q2 = await admin
        .from('blog_posts')
        .select('title')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(8)
      if (q2.error) return []
      return (q2.data || [] as Array<{ title: string }>).map(r => ({ title: r.title, slug: slugify(r.title) }))
    }
    return (data || [] as Array<{ title: string; slug: string | null }>).map(r => ({
      title: r.title,
      slug: r.slug || slugify(r.title),
    }))
  } catch {
    return []
  }
}

async function agentFarhan(admin: SupabaseClient, dry: boolean): Promise<AgentResult> {
  // Data riil: judul yang SUDAH terbit (hindari nulis ulang topik sama)
  let existingTitles: string[] = []
  let tableReady = true
  try {
    const { data, error } = await admin.from('blog_posts').select('title').order('created_at', { ascending: false }).limit(30)
    if (error) {
      if (isMissingTableError(error)) tableReady = false
      else throw error
    } else existingTitles = (data as Array<{ title: string }>).map(r => r.title)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!isMissingTableError(err)) throw new Error(clip(msg, 200))
    tableReady = false
  }

  const lessons = tableReady ? await officeRecallLessons(admin, 'Farhan') : []
  if (dry) {
    return skipResult('Farhan', `dry-run — LLM & publikasi dilewati (${existingTitles.length} judul terakhiran terbaca, tabel blog_posts ${tableReady ? 'siap' : 'BELUM ADA — jalankan migration 015'})`,
      { recentTitles: existingTitles.slice(0, 5) })
  }

  // ── Fase 1: riset keyword tren harian (+ bahan riset TikTok Sinta) ──
  const avoidList = existingTitles.slice(0, 15).map(t => clip(t, 90)).join(' | ') || '(kosong)'
  const risetSintaFarhan = await risetSintaBlock(admin)
  // AUDIT D2: insight Dewi ikut jadi bahan topik artikel (emosi/jam terburuk
  // user = topik yang LAGI dibutuhkan pembaca)
  const dewiBlockFarhan = await insightDewiBlock(admin)

  /* SKILL BARU (1): TREN PENCARIAN RIIL — Google Trends RSS Indonesia.
     Dulu riset 100% halusinasi LLM; sekarang ada sinyal pasar nyata. */
  const trends = await fetchGoogleTrendsId()
  const trendsBlock = trends.length
    ? `TREN PENCARIAN GOOGLE INDONESIA HARI INI (DATA RIIL Google Trends — bukan asumsi):
${trends.map((t, i) => `${i + 1}. ${t}`).join('\n')}
→ Kalau ada tren yang bisa disambungkan ke niche trading emas/XAUUSD/prop firm, jadikan itu angle utama. Kalau TIDAK ada yang relevan, tetap pilih dari niche — tapi sebutkan tren mana yang paling dekat konteksnya.`
    : '(Google Trends tidak tersedia run ini — pakai intuisi niche, TANDAI jawaban sebagai asumsi)'

  /* SKILL BARU (2): LEARNING LOOP — artikel dgn views terbanyak (data riil
     pembaca /blog, kolom views migrasi 040). Farhan belajar pola menang. */
  const topArticles = await fetchTopBlogArticles(admin)
  const topBlock = topArticles.length
    ? `ARTIKEL PERFORMA TERBAIK (views pembaca riil — pelajari polanya; topik serupa BOLEH diulang dengan angle BARU):
${topArticles.map(a => `- "${clip(a.title, 70)}" — ${a.views} views${a.keyword ? ` (keyword: ${a.keyword})` : ''}`).join('\n')}`
    : ''

  const kwRes = await callAgent('Farhan',
    'Kamu riset keyword SEO harian untuk niche trading emas/XAUUSD & prop firm (audiens Indonesia). Cari topik yang SEDANG dicari orang, bukan topik usang.',
    `Tanggal run: ${wibDateStr()}.
JUDUL YANG SUDAH TERBIT (JANGAN diulang topiknya): ${avoidList}
${lessonsBlock(lessons)}${risetSintaFarhan}${dewiBlockFarhan}
${trendsBlock}
${topBlock}

Usulkan 5 keyword/article-angle berpotensi mendatangkan trafik Google hari ini (strategi XAUUSD, psikologi trading, prop firm challenge, risk management, news emas). Pilih yang BELUM dibahas di daftar atas.

Output JSON murni: {"keywords": [{"keyword": "...", "angle": "sudut pandang unik artikelnya"}]}`,
    { maxTokens: 450, temperature: 0.8 })

  let keywords: FarhanKeyword[] = []
  if (kwRes) {
    const parsed = extractJson<{ keywords?: FarhanKeyword[] }>(kwRes.text)
    keywords = (parsed?.keywords || []).filter(k => k?.keyword).slice(0, 5)
  }
  // Fallback deterministik (riset gagal → tetap kerja): rotasi topik evergreen
  if (!keywords.length) {
    keywords = [
      { keyword: 'strategi scalping XAUUSD untuk akun kecil', angle: 'risk per trade 0.5% + killzone London' },
      { keyword: 'kesalahan psikologi trader pemula emas', angle: 'revenge trading & FOMO dengan contoh angka' },
      { keyword: 'cara lolos prop firm challenge emas', angle: 'daily drawdown vs total drawdown' },
      { keyword: 'jurnal trading untuk trader emas', angle: 'data yang wajib dicatat tiap posisi XAUUSD' },
    ]
    console.warn('[master:Farhan] riset keyword LLM gagal — pakai rotasi evergreen')
  }
  const chosen = keywords[0]

  // ── Fase 2: tulis artikel (Actor-Critic) ──
  /* SKILL BARU (3): LINK INTERNAL — kandidat artikel terbit (slug riil)
     disuntikkan ke prompt → artikel saling terhubung (SEO + session length). */
  const linkCandidates = await fetchBlogLinkCandidates(admin)
  const linkBlock = linkCandidates.length
    ? `TAUTAN INTERNAL WAJIB (sisipkan minimal 2 secara natural di dalam isi, format <a href="/blog/<slug>"><anchor deskriptif></a>):
${linkCandidates.slice(0, 4).map(c => `- <a href="/blog/${c.slug}">${clip(c.title, 70)}</a>`).join('\n')}`
    : '(belum ada artikel lain — lewati link internal, CTA signup tetap wajib)'

  const ac = await actorCritic('Farhan', {
    system: FARHAN_SYSTEM + (lessons.length ? `\n\n${lessonsBlock(lessons)}` : ''),
    user: `Tulis artikel SEO hari ini.

KEYWORD UTAMA: ${chosen.keyword}
ANGLE: ${chosen.angle}
KEYWORD CADANGAN (boleh diselipkan natural): ${keywords.slice(1, 3).map(k => k.keyword).join(' ; ') || '-'}
${linkBlock}

TARGET: minimal 650 kata (aman di atas batas 600), sasar trader Indonesia yang mau pegang konsistensi. Jangan lupa bagian FAQ di akhir.`,
    rubric: FARHAN_RUBRIC,
    maxTokens: 2600,
    temperature: 0.75,
    passScore: 7,
    maxRevisions: 1,
  })
  if (!ac) {
    return errResult('Farhan', 'LLM tidak tersedia (semua model OpenRouter gagal — free-tier sering 429/timeout di panggilan panjang; isi saldo ≥$10 → limit 1000/hari) — artikel tidak dibuat')
  }

  const parsedArt = extractJson<{ title?: string; meta_description?: string; html_body?: string }>(ac.text)
  const title = clip(parsedArt?.title || chosen.keyword, 200)
  let html = String(parsedArt?.html_body || '').trim()
  const meta = clip(parsedArt?.meta_description || chosen.angle, 300)

  // Hitung kata riil (strip tag HTML) — hitungan DETERMINISTIK, bukan
  // klaim critic LLM (kasus nyata 2026-11-07: draf 510 kata dinilai
  // critic "melebihi batas maksimal 600" → revisi malah MEMANGKAS →
  // artikel hangus padahal materinya bagus).
  const countWords = (h: string) => h.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
  let wordCount = countWords(html)

  /* ── Fase 2b: EXPAND DETERMINISTIK (skill karyawan maksimal —
     draf kurang panjang TIDAK langsung dibuang). Critic LLM terbukti
     sering salah hitung kata; batas panjang ini soal angka, jadi
     diperiksa kode + diperpanjang 1x dengan instruksi eksplisit. */
  if (html && wordCount < 600) {
    const expand = await callAgent('Farhan',
      FARHAN_SYSTEM,
      `Artikel di bawah hanya ${wordCount} kata — KURANG dari 600 (tidak lolos standar publikasi).
PERPANJANG menjadi 750–950 kata dengan CARA MENAMBAH:
- contoh skenario XAUUSD dengan angka konkret (lot, pips, RR, persen risiko)
- langkah/checklist praktis yang bisa langsung dipraktikkan pembaca
- penjelasan "kenapa penting" di tiap bagian
JANGAN memangkas isi yang sudah ada. Pertahankan judul & keyword utama.

Output JSON murni sama: {"title": "...", "meta_description": "...", "html_body": "<h2>...</h2>..."}

=== ARTIKEL SEKARANG (PERPANJANG INI) ===
${clip(html, 6000)}`,
      { maxTokens: 2600, temperature: 0.6 })
    if (expand) {
      const p2 = extractJson<{ title?: string; meta_description?: string; html_body?: string }>(expand.text)
      const html2 = String(p2?.html_body || '').trim()
      const w2 = countWords(html2)
      if (html2 && w2 > wordCount) {
        html = html2
        wordCount = w2
        /* Judul & meta TETAP dari draf asli (konsisten utk dedup & SEO). */
        ac.revisions += 1
        ac.trail.push(`expand deterministik: ${wordCount} kata via ${expand.model}`)
      }
    }
  }
  const passLen = wordCount >= 600

  /* SKILL BARU (4): SANITIZE + PERSIST SEO — html di-whitelist sebelum
     masuk DB; slug/meta_description/keyword tersimpan di kolom (migrasi
     040) → kalau kolom belum ada, insert kolom inti + meta disimpan di
     agent_kv 'blog_seo:<id>' (dibaca API blog publik sebagai fallback). */
  const slug = slugify(title)
  const safeHtml = renderSafeArticleHtml(html)
  if (safeHtml) html = safeHtml
  const internalLinks = (html.match(/href="\/blog\//g) || []).length
  const wordCountFinal = countWords(html)
  if (wordCountFinal > 0) wordCount = wordCountFinal // sanitasi bisa memotong tag berbahaya dgn isi

  await officeRemember(admin, 'Farhan', 'critic', {
    lesson: ac.score >= 7 && passLen
      ? `Artikel "${clip(title, 60)}" (keyword: ${clip(chosen.keyword, 40)}) lolos critic ${ac.score}/10 (${wordCount} kata, ${internalLinks} link internal) — gaya & struktur dipertahankan`
      : `Artikel "${clip(title, 60)}" hanya ${ac.score < 0 ? 'tanpa nilai' : `${ac.score}/10`} & ${wordCount} kata — catatan: ${clip(ac.trail.join(' | '), 180)}; besok perbaiki`,
    score: ac.score, revisions: ac.revisions, wordCount, model: ac.model,
  })

  if (!html || !passLen) {
    return {
      agent: 'Farhan', status: 'error',
      summary: `draf ${wordCount ? `${wordCount} kata` : 'kosong'} (<600 wajib${wordCount && wordCount < 600 ? ', sudah dicoba expand otomatis 1x' : ''}) — TIDAK diterbitkan (hindari konten tipis di mata Google)`,
      data: { title, keyword: chosen.keyword, wordCount, criticScore: ac.score, trail: ac.trail },
    }
  }
  if (!tableReady) {
    return skipResult('Farhan', `artikel siap (${wordCount} kata) tapi tabel blog_posts belum ada — jalankan supabase-migrations/015_create_ai_pending_actions.sql`,
      { title, keyword: chosen.keyword, wordCount, html_body: html, meta_description: meta })
  }

  // ── Fase 3: AUTO-TERBIT (dedup judul + insert resilient SEO) ──
  const { data: dup } = await admin.from('blog_posts').select('id').ilike('title', title).limit(1)
  if (dup && dup.length > 0) {
    return skipResult('Farhan', 'artikel dengan judul serupa sudah ada — dilewati (dedup)', { title })
  }

  const baseRow = {
    title,
    content_body: html,
    author: 'Farhan (Growth Hacker — AI Agent)',
    status: 'published',
  }
  const seoRow = {
    ...baseRow,
    slug,
    meta_description: meta,
    keyword: chosen.keyword,
  }

  // Coba insert dgn kolom SEO (migrasi 040) → kolom belum ada? fallback
  // kolom inti + meta SEO disimpan di agent_kv (API blog membacanya).
  let ins = await admin.from('blog_posts').insert(seoRow)
  let insErr = ins.error
  let seoStoredAs = 'columns'
  if (insErr && isMissingColumnError(insErr)) {
    ins = await admin.from('blog_posts').insert(baseRow)
    insErr = ins.error
    seoStoredAs = 'agent_kv'
    if (!insErr) {
      try {
        const { data: nr } = await admin.from('blog_posts').select('id')
          .ilike('title', title).order('created_at', { ascending: false }).limit(1)
        const newId = (nr?.[0] as { id?: string } | undefined)?.id
        if (newId) {
          await admin.from('agent_kv').upsert({
            key: `blog_seo:${newId}`,
            value: JSON.stringify({ slug, meta_description: meta, keyword: chosen.keyword, wordCount }),
            updated_at: new Date().toISOString(),
          })
        }
      } catch {
        /* kv belum ada → meta hilang run ini; besok migrasi 040 menyelesaikan */
      }
    }
  }
  if (insErr) {
    return errResult('Farhan', `insert blog_posts gagal: ${insErr.message}`, { title, wordCount })
  }

  return okResult('Farhan', `artikel SEO TERBIT: "${clip(title, 70)}" (${wordCount} kata, critic ${ac.score < 0 ? 'n/a' : `${ac.score}/10`}, ${ac.revisions} revisi, ${internalLinks} link internal, SEO di ${seoStoredAs})`,
    { title, slug, keyword: chosen.keyword, wordCount, meta_description: meta, criticScore: ac.score, revisions: ac.revisions, model: ac.model, published: true, internalLinks, seoStoredAs })
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 📣 AGEN 2 — SINTA (CMO · Riset Pasar TikTok + Content Factory)
 * DUA tugas pagi:
 *   1. LAPORAN RISET TIKTOK — analisis pasar niche trading (bukan cuma
 *      bahan konten): pola yang works, topik berpeluang, jadwal posting,
 *      insight lintas divisi (Farhan/Bagas/Maya/Bos). Dibagikan ke:
 *      briefing Alexander, prompt Farhan & Bagas, panel Memori Kantor.
 *   2. 3 DRAF SKRIP TikTok (Actor-Critic) — WAJIB selaras hasil riset
 *      → nunggu ACC Bos. (Shift SORE dia: produksi + posting video
 *      otomatis 20.00 WIB — job "sinta-video".)
 * ═══════════════════════════════════════════════════════════════════════════ */

const SINTA_SYSTEM = `Kamu SINTA, CMO Luxtradee — spesialis konten TikTok edukasi & psikologi trading XAUUSD untuk trader Indonesia.
Kamu bikin skrip yang bikin jempol BERHENTI scroll: hook provokatif 2-3 detik, isi nyindir kebiasaan buruk trader, tutup dengan CTA.

GAYA WAJIB:
- Bahasa gaul trader Indonesia (SMC/ICT: entry, RR, killzone, liquidasi, revenge trading) — natural, tidak dipaksakan
- Provokatif TAPI edukatif: menyindir, bukan menghina; memantik refleksi, bukan janji profit
- Script 30-45 detik (80-120 kata), patah-patah ala TikTok

FORMAT OUTPUT WAJIB JSON MURNI (tanpa markdown fence):
{"analysis": "1 paragraf angle yang dipilih & kenapa", "drafts": [{"hook": "...", "script": "...", "caption": "...", "cta": "..."}]}

Tepat 3 draf di array "drafts".`

const SINTA_RUBRIC = `- 3 hook TIDAK BOLEH mirip satu sama lain; kalimat pertama harus bikin penasaran/tersindir.
- Spesifik psikologi XAUUSD (FOMO saat candle emas lari, revenge trading setelah SL, overconfidence saat green streak) — bukan motivasi kosong.
- Script 30-45 detik dengan alur: hook → masalah → refleksi/edukasi → CTA.
- Caption mengulang hook + hashtag relevan.`

const SINTA_RISET_SYSTEM = `Kamu SINTA, CMO Luxtradee. Tugas ini RISET & ANALISIS — bukan bikin konten.
Susun LAPORAN RISET TikTok niche trading Indonesia (XAUUSD) untuk SELURUH KANTOR:
- Alexander memakainya di Morning Briefing
- Farhan (artikel SEO) & Bagas (email jualan) membaca insight-nya besok
- Bos membacanya di panel Memori Kantor untuk strategi marketing minggu ini

DASAR ANALISIS (bahan nyata disuntik di pesan user):
- DATA RIIL konten TikTok sendiri (views/likes/komentar) — pola yang TERBUKTI works
- DATA RIIL tren search Google Indonesia hari ini — topik yang SEDANG dicari publik; kaitkan ke XAUUSD/trading bila relevan (atau tandai eksplisit kalau tidak relevan)
- Kalau data tidak tersedia untuk suatu klaim, katakan eksplisit "asumsi/intuisi" (JANGAN karang angka)

ANALISIS WAJIB:
- Pola hook/format yang terbukti menarik — DASARKAN pada DATA RIIL di atas
- Topik/angle berpeluang FYP minggu ini (selaraskan dgn tren search) + rekomendasi jadwal posting
- Insight lintas divisi (untuk: Farhan | Bagas | Maya | Bos)
- Risiko: hal yang harus dihindari (klaim profit, kata sensitif, dll)

FORMAT OUTPUT WAJIB JSON MURNI (tanpa markdown fence):
{"ringkasan": "2-3 kalimat kondisi niche TikTok trading", "pola_yang_works": ["..."], "rekomendasi_topik": ["..."], "waktu_posting": "jadwal + alasan", "insight_lintas_divisi": [{"untuk": "Farhan", "insight": "..."}], "risiko": "..."}`

function sanitizeRiset(r: SintaRiset | null): SintaRiset | null {
  if (!r || typeof r !== 'object') return null
  const arr = (a: unknown, n: number, max: number): string[] =>
    Array.isArray(a)
      ? a.slice(0, n).map(x => clip(typeof x === 'string' ? x : JSON.stringify(x), max)).filter(Boolean)
      : []
  const riset: SintaRiset = {
    ringkasan: r.ringkasan ? clip(r.ringkasan, 400) : undefined,
    pola_yang_works: arr(r.pola_yang_works, 5, 160),
    rekomendasi_topik: arr(r.rekomendasi_topik, 5, 160),
    waktu_posting: r.waktu_posting ? clip(r.waktu_posting, 200) : undefined,
    insight_lintas_divisi: Array.isArray(r.insight_lintas_divisi)
      ? (r.insight_lintas_divisi as Array<{ untuk?: unknown; insight?: unknown }>)
          .slice(0, 5)
          .map(i => ({ untuk: clip(i?.untuk, 30), insight: clip(i?.insight, 220) }))
          .filter(i => i.insight)
      : [],
    risiko: r.risiko ? clip(r.risiko, 200) : undefined,
  }
  if (!riset.ringkasan && !riset.pola_yang_works?.length && !riset.rekomendasi_topik?.length) return null
  return riset
}

async function agentSinta(admin: SupabaseClient, dry: boolean): Promise<AgentResult> {
  // Data riil: 5 konten TikTok dengan views tertinggi (pola yang TERBUKTI FYP)
  const topRefs: Array<{ caption: string; views: number; likes: number; comments: number }> = []
  try {
    const { data, error } = await admin.from('tiktok_posts').select('caption, views, likes, comments').order('views', { ascending: false }).limit(5)
    if (!error && data) {
      for (const r of (data as Array<{ caption: string | null; views: number; likes: number; comments: number }>)) {
        topRefs.push({ caption: clip(r.caption || '(tanpa caption)', 120), views: r.views || 0, likes: r.likes || 0, comments: r.comments || 0 })
      }
    }
  } catch { /* tabel opsional — Sinta tetap jalan */ }

  /* FIX kekurangan Sinta (7 Nov): riset dulu murni intuisi LLM. Kini dia
     juga membaca TREN SEARCH GOOGLE INDONESIA hari ini (sumber yang sama
     dengan Farhan — Google Trends RSS, data riil tanpa API key) supaya
     laporan risetnya berpijak pada apa yang LAGI dicari orang, bukan
     karangan model. Gagal fetch → jalan tanpa blok ini. */
  const trends = await fetchGoogleTrendsId()
  const trendsBlockSinta = trends.length
    ? `DATA RIIL — TREN SEARCH GOOGLE INDONESIA HARI INI (topik yang sedang dicari publik — kaitkan ke XAUUSD/trading bila relevan):
${trends.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
    : ''

  if (dry) {
    return skipResult('Sinta', `dry-run — LLM & simpan draf dilewati (${topRefs.length} referensi TikTok terbaca${trends.length ? `, ${trends.length} tren Google terbaca` : ''})`, { topRefs, trendsCount: trends.length })
  }

  const lessons = await officeRecallLessons(admin, 'Sinta')
  // AUDIT D2: statistik Dewi jadi bahan laporan riset Sinta (topik konten
  // selaras dengan masalah RIIL trader — emosi/jam entry terburuk)
  const dewiBlockSinta = await insightDewiBlock(admin)
  const refBlock = [
    topRefs.length
      ? `DATA RIIL — 5 KONTEN TIKTOK VIEWS TERTINGGI (pelajari polanya, tiru yang works):\n${topRefs.map((r, i) => `${i + 1}. [${r.views.toLocaleString('id-ID')} views · ${r.likes.toLocaleString('id-ID')} likes · ${r.comments.toLocaleString('id-ID')} komentar] ${r.caption}`).join('\n')}`
      : '(belum ada referensi TikTok tersimpan — andalkan intuisi pasar, TANDAI sebagai asumsi)',
    trendsBlockSinta,
  ].filter(Boolean).join('\n\n')

  /* ══ TUGAS 1 — LAPORAN RISET TIKTOK (analisis utk SELURUH kantor) ══
     Bukan cuma bahan konten: Alexander pakai di briefing, Farhan & Bagas
     baca di prompt mereka besok, Bos baca di panel Memori Kantor.
     Biaya: 1 panggilan LLM (Putri pantau kuota). Gagal → draf tetap jalan. */
  let riset: SintaRiset | null = null
  let risetModel = ''
  try {
    const res = await callAgent('Sinta',
      SINTA_RISET_SYSTEM + (lessons.length ? `\n\n${lessonsBlock(lessons)}` : ''),
      `${refBlock}${dewiBlockSinta}

Tanggal run: ${wibDateStr()}.
Susun LAPORAN RISET TikTok hari ini untuk seluruh kantor.`,
      { maxTokens: 900, temperature: 0.6 })
    if (res?.text) {
      riset = sanitizeRiset(extractJson<SintaRiset>(res.text))
      if (riset) risetModel = res.model
    }
  } catch { /* riset opsional — draf tetap jalan */ }

  if (riset) {
    await officeRemember(admin, 'Sinta', 'report', {
      lesson: `LAPORAN RISET TikTok ${wibDateStr()}: ${clip(riset.ringkasan || riset.rekomendasi_topik?.join('; ') || '', 220)}`,
      riset,
      model: risetModel,
    })
    await shareRisetToOfficeMemory(admin, riset) // tampil di panel Memori Kantor /kantor-ceo
  }

  /* ══ TUGAS 2 — 3 DRAF SKRIP (WAJIB selaras hasil riset sendiri) ══ */
  const risetForDrafts = riset
    ? `\nHASIL RISET KAMU HARI INI (WAJIB dipakai — topik/hook selaras dengan riset):\n${[
        riset.ringkasan ? `Ringkasan: ${riset.ringkasan}` : '',
        riset.pola_yang_works?.length ? `Pola works: ${riset.pola_yang_works.join('; ')}` : '',
        riset.rekomendasi_topik?.length ? `Topik berpeluang: ${riset.rekomendasi_topik.join('; ')}` : '',
      ].filter(Boolean).join('\n')}\n`
    : ''

  const ac = await actorCritic('Sinta', {
    system: SINTA_SYSTEM + (lessons.length ? `\n\n${lessonsBlock(lessons)}` : ''),
    user: `${refBlock}${risetForDrafts}
Bikin 3 draf skrip TikTok dengan 3 ANGLE BERBEDA, tema: edukasi/psikologi trading XAUUSD.`,
    rubric: SINTA_RUBRIC,
    maxTokens: 1600,
    temperature: 0.9,
    passScore: 7,
    maxRevisions: 1,
  })
  if (!ac) {
    if (riset) {
      return okResult('Sinta', `LAPORAN RISET TikTok tersimpan & dibagikan ke kantor — tapi LLM tewas saat bikin draf skrip (draf dilewati hari ini)`,
        { riset })
    }
    return errResult('Sinta', 'LLM tidak tersedia — riset & draf TikTok tidak dibuat')
  }

  const parsed = extractJson<{ analysis?: string; drafts?: Array<{ hook?: string; script?: string; caption?: string; cta?: string }> }>(ac.text)
  const drafts = (parsed?.drafts || []).filter(d => d?.hook && d?.script).slice(0, 3)
  if (!drafts.length) {
    return errResult('Sinta', `JSON draf tidak valid dari model ${ac.model} — tidak disimpan`, { raw: clip(ac.text, 300) })
  }

  await officeRemember(admin, 'Sinta', 'critic', {
    lesson: ac.score >= 7
      ? `Draf TikTok lolos critic ${ac.score}/10 — pola hook dipertahankan`
      : `Critic ${ac.score < 0 ? 'tak menilai' : `${ac.score}/10`}: ${clip(ac.trail.join(' | '), 180)} — besok hook lebih tajam`,
    score: ac.score, revisions: ac.revisions, model: ac.model,
  })

  // Simpan draf → antrean ACC Bos (Dashboard Alexander, human-in-the-loop)
  let saved = false
  let saveNote = ''
  try {
    const { error: insErr } = await admin.from('ai_pending_actions').insert({
      agent_name: 'Sinta',
      action_type: 'PUBLISH_CONTENT',
      action_payload: {
        platform: 'tiktok',
        title: `3 Draf Skrip TikTok — ${wibDateStr()}`,
        analysis: clip(parsed?.analysis || '', 600),
        drafts,
        note: 'Video harian OTOMATIS diproduksi & diposting Sinta jam 20.00 WIB (prime time). Draf ini buat Bos pilih angle favorit — mau pakai skrip ini untuk video berikutnya? bilang saja ke kantor.',
      },
      status: 'pending',
    })
    if (insErr) saveNote = isMissingTableError(insErr)
      ? 'tabel ai_pending_actions belum ada (jalankan supabase-migrations/015_create_ai_pending_actions.sql)'
      : clip(insErr.message, 160)
    else saved = true
  } catch (e: unknown) {
    saveNote = clip(e instanceof Error ? e.message : String(e), 160)
  }

  if (!saved) {
    return skipResult('Sinta', `3 draf dibuat${riset ? ' + laporan riset tersimpan' : ''} (critic ${ac.score < 0 ? 'n/a' : `${ac.score}/10`}) tapi GAGAL disimpan: ${saveNote}`,
      { drafts, criticScore: ac.score, riset: riset || undefined })
  }
  return okResult('Sinta', `3 draf skrip TikTok nunggu ACC Bos + LAPORAN RISET TikTok dibagikan ke kantor (briefing/Farhan/Bagas/Memori Kantor${riset ? `, model ${risetModel}` : ' — riset gagal, draf jalan tanpa riset'}) · critic ${ac.score < 0 ? 'n/a' : `${ac.score}/10`}`,
    { angles: drafts.map(d => clip(d.hook, 80)), criticScore: ac.score, revisions: ac.revisions, riset: riset || undefined })
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 🖥️ AGEN 3 — RAKA (CTO · Security Sweep & Uptime Watchdog) — v2
 * 100% deterministik (TANPA LLM):
 *   • 19 probe: route kritis + CANARY P0 + Jalur revenue (/auth/signup) +
 *     SEO infra (sitemap/robots) + API publik artikel blog (Farhan)
 *   • Latency per probe + CONTENT SANITY (deploy white-screen yang balas
 *     HTTP 200 tidak lolos lagi — landing/blog/signup dicek isinya)
 *   • Security headers landing dicek (HSTS/XCTO/XFO/Referrer-Policy)
 *   • TREN ANTAR-RUN: bandingkan dgn sweep kemarin → membaik/sama/memburuk;
 *     P1 yang sama molor 2 run → ditesaskan di pesan alarm
 *   • ALARM LANGSUNG dari Raka ke Discord (@here) — dulu alarm hanya
 *     dikirim Alexander di wave terakhir; run `?agents=raka` solo tidak
 *     pernah menyalakan sirene. Alexander skip alarm duplikat.
 * ═══════════════════════════════════════════════════════════════════════════ */

type ProbeClass = 'public' | 'protected' | 'sensitive' | 'cron'
interface ProbeDef { path: string; method: 'GET' | 'POST'; cls: ProbeClass; label: string }
interface ProbeFinding { path: string; method: string; label: string; status: number | null; verdict: 'ok' | 'P1' | 'P2' | 'info'; note: string; latencyMs?: number }

const RAKA_PROBES: ProbeDef[] = [
  { path: '/', method: 'GET', cls: 'public', label: 'Landing page (uptime + isi + security headers)' },
  { path: '/blog', method: 'GET', cls: 'public', label: 'Blog (uptime + SEO)' },
  { path: '/api/blog/posts', method: 'GET', cls: 'public', label: 'API publik artikel blog (Farhan)' },
  { path: '/auth/signup', method: 'GET', cls: 'public', label: 'Halaman signup (JALUR REVENUE)' },
  { path: '/kantor-ceo', method: 'GET', cls: 'public', label: 'Dashboard Bos (uptime)' },
  { path: '/api/health', method: 'GET', cls: 'public', label: 'Canary /api/health' },
  { path: '/sitemap.xml', method: 'GET', cls: 'public', label: 'Sitemap (SEO infra)' },
  { path: '/robots.txt', method: 'GET', cls: 'public', label: 'Robots.txt (SEO infra)' },
  { path: '/api/trades', method: 'GET', cls: 'protected', label: 'API jurnal trades' },
  { path: '/api/profile/me', method: 'GET', cls: 'protected', label: 'API profil user' },
  { path: '/api/analyze-screenshot', method: 'POST', cls: 'protected', label: 'AI vision (analisa screenshot)' },
  { path: '/api/chat/support', method: 'POST', cls: 'protected', label: 'CS chat' },
  // CANARY P0 (hardening): endpoint bahaya SUDAH DIHAPUS/di-lock. 2xx tanpa auth
  // = file lama hidup lagi / endpoint baru telanjang → ALARM P1 otomatis.
  { path: '/api/auth/admin-login', method: 'POST', cls: 'sensitive', label: 'ADMIN-LOGIN backdoor (harus 404/405)' },
  { path: '/api/admin/debug-activate', method: 'POST', cls: 'sensitive', label: 'DEBUG-ACTIVATE PRO gratis (harus 404/405)' },
  { path: '/api/check-env', method: 'GET', cls: 'sensitive', label: 'CHECK-ENV bocor env (harus 404)' },
  { path: '/api/email-campaigns', method: 'GET', cls: 'sensitive', label: 'EMAIL-CAMPAIGNS blast (harus 401/403)' },
  { path: '/api/seed', method: 'GET', cls: 'sensitive', label: 'SEED database (harus 401/403)' },
  { path: '/api/setup', method: 'GET', cls: 'sensitive', label: 'SETUP database (harus 401/403)' },
  { path: '/api/cron/pine-alerts', method: 'GET', cls: 'cron', label: 'Cron pine-alerts (harus ber-auth)' },
]

/** Content sanity per probe publik — return '' kalau wajar, atau alasan "isi tidak wajar".
 *  Hanya BOOLEAN/pola sederhana — ISI body tidak pernah di-log (keamanan). */
function contentSanity(path: string, body: string): string {
  if (!body || body.length < 40) return 'isi kosong/terlalu pendek (white-screen?)'
  const lower = body.slice(0, 400).toLowerCase()
  if (path === '/sitemap.xml') {
    return (lower.includes('<urlset') || lower.includes('<sitemapindex')) ? '' : 'bukan XML sitemap'
  }
  if (path === '/robots.txt') {
    return /user-agent|sitemap|disallow/i.test(body.slice(0, 800)) ? '' : 'isi robots.txt tidak wajar'
  }
  if (path.startsWith('/api/')) {
    try { return JSON.parse(body) ? '' : 'bukan JSON valid' } catch { return 'bukan JSON valid' }
  }
  // halaman HTML (/, /blog, /auth/signup, /kantor-ceo)
  return lower.includes('<html') || lower.includes('<!doctype html') ? '' : 'bukan dokumen HTML'
}

/** Header keamanan wajib untuk halaman publik — return daftar yang TIDAK ADA. */
function missingSecurityHeaders(headers: Headers): string[] {
  const need = ['strict-transport-security', 'x-content-type-options', 'x-frame-options', 'referrer-policy']
  return need.filter(h => !headers.has(h))
}

/** Baca sweep terakhir Raka dari office_memory → untuk TREN antar-run. */
async function officeRecallSecurityLast(admin: SupabaseClient): Promise<{ p1Count?: number; p2Count?: number; runDate?: string } | null> {
  try {
    const { data, error } = await admin
      .from('office_memory')
      .select('content, run_date')
      .eq('agent_name', 'Raka')
      .eq('memory_type', 'security')
      .order('created_at', { ascending: false })
      .limit(1)
    if (error || !data?.length) return null
    const c = (data[0] as { content?: { p1Count?: number; p2Count?: number }; run_date?: string }).content
    if (!c || typeof c.p1Count !== 'number') return null
    return { p1Count: c.p1Count, p2Count: c.p2Count, runDate: (data[0] as { run_date?: string }).run_date }
  } catch { return null }
}

async function agentRaka(admin: SupabaseClient, baseUrl: string, dry: boolean): Promise<AgentResult> {
  const base = baseUrl.replace(/\/+$/, '')
  // Self service binding (kalau sudah di-deploy): fetch ke worker ini sendiri
  // TANPA lewat edge/DNS — fetch publik ke custom domain sendiri dari dalam
  // worker terbukti balas 522 palsu. Fallback ke fetch publik kalau binding
  // belum ada (deploy lama / lokal).
  const selfFetch = await getSelfFetch()
  const doFetch = (selfFetch ?? fetch) as typeof fetch
  const viaSelf = selfFetch ? 'service-binding' : 'public'

  const probeOne = async (p: ProbeDef): Promise<ProbeFinding> => {
    const baseF: ProbeFinding = { path: p.path, method: p.method, label: p.label, status: null, verdict: 'info', note: '' }
    let status: number | null = null
    let netErr = ''
    let bodyText = ''
    let headers: Headers | null = null
    const t0 = Date.now()
    try {
      const res = await doFetch(`${base}${p.path}`, {
        method: p.method,
        headers: { 'Content-Type': 'application/json' },
        body: p.method === 'POST' ? '{}' : undefined,
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
      })
      status = res.status
      headers = res.headers
      // Body dibaca untuk sanity check POLA SAJA — TIDAK pernah di-log
      // (jangan bocorkan isi env/secret ke log/memori).
      bodyText = (await res.text().catch(() => '')).slice(0, 20_000)
    } catch (e: unknown) {
      netErr = clip(e instanceof Error ? e.message : String(e), 80)
    }
    const latencyMs = Date.now() - t0

    // Catatan khusus 52x — Cloudflare edge tidak tembus ke origin (infra, bukan error aplikasi)
    const cfEdge = (s: number) => (s >= 521 && s <= 527) ? ' — Cloudflare edge tidak tembus ke origin (infra)' : ''
    const latNote = latencyMs > 5000 ? ` · lambat ${latencyMs}ms` : ''

    if (status === null) {
      return { ...baseF, verdict: p.cls === 'public' ? 'P1' : 'info', note: netErr || 'tidak terjangkau', latencyMs }
    }
    if (p.cls === 'public') {
      if (status >= 500) return { ...baseF, status, verdict: 'P2', note: `HTTP ${status}${cfEdge(status)} — endpoint publik error${latNote}`, latencyMs }
      // 3xx (redirect, mis. /kantor-ceo → login): endpoint HIDUP — sanity
      // isi tidak relevan utk redirect (body memang kecil).
      if (status >= 300 && status < 400) return { ...baseF, status, verdict: 'ok', note: `HTTP ${status} — redirect (hidup)${latNote}`, latencyMs }
      if (status < 400) {
        // FIX kekurangan Raka: HTTP 200 tidak otomatis sehat — deploy
        // white-screen (blank page / JSON rusak) dulu lolos begitu saja.
        const sanity = contentSanity(p.path, bodyText)
        if (sanity) return { ...baseF, status, verdict: 'P2', note: `HTTP ${status} tapi ${sanity}${latNote}`, latencyMs }
        // Security headers hanya relevan utk halaman (bukan API cron dsb)
        let hdrNote = ''
        let hdrP2 = false
        if (p.path === '/') {
          const missing = missingSecurityHeaders(headers || new Headers())
          if (missing.length >= 3) { hdrP2 = true; hdrNote = ` · header keamanan hilang: ${missing.join(', ')}` }
          else if (missing.length) hdrNote = ` · header kurang: ${missing.join(', ')}`
        }
        const latP2 = latencyMs > 15_000
        return {
          ...baseF, status,
          verdict: hdrP2 || latP2 ? 'P2' : 'ok',
          note: `HTTP ${status}${hdrP2 ? '' : ' — isi wajar'}${hdrNote}${latP2 ? ` · sangat lambat ${latencyMs}ms` : latNote}`,
          latencyMs,
        }
      }
      return { ...baseF, status, verdict: 'P2', note: `HTTP ${status}${cfEdge(status)} — endpoint publik tidak sehat${latNote}`, latencyMs }
    }
    if (p.cls === 'cron') {
      if (status === 401 || status === 403) return { ...baseF, status, verdict: 'ok', note: `HTTP ${status} — terlindungi secret${latNote}`, latencyMs }
      return { ...baseF, status, verdict: 'P2', note: `HTTP ${status}${cfEdge(status)} — route cron TIDAK ber-auth (set CRON_SECRET!)${latNote}`, latencyMs }
    }
    // protected & sensitive: 2xx TANPA auth = celah terbuka
    if (status >= 200 && status < 300) {
      return { ...baseF, status, verdict: 'P1', note: `HTTP 2xx TANPA auth — ${p.cls === 'sensitive' ? 'route sensitif TERBUKA' : 'route user TERBUKA'}!${latNote}`, latencyMs }
    }
    if (status >= 500) return { ...baseF, status, verdict: 'P2', note: `HTTP ${status}${cfEdge(status)} — server error${latNote}`, latencyMs }
    // 400/401/403/404/405/429 = tertutup / validasi jalan
    return { ...baseF, status, verdict: 'ok', note: `HTTP ${status} — tertutup${latNote}`, latencyMs }
  }

  // Dry-run tetap boleh probe (read-only & murah) — Bos bisa uji sweep kapan pun
  const settled = await Promise.allSettled(RAKA_PROBES.map(probeOne))
  const findings: ProbeFinding[] = []
  for (const s of settled) if (s.status === 'fulfilled') findings.push(s.value)

  const p1 = findings.filter(x => x.verdict === 'P1')
  const p2 = findings.filter(x => x.verdict === 'P2')
  const alarm = p1.length > 0

  /* ── TREN ANTAR-RUN (FIX kekurangan Raka: dulu tiap sweep amnesiak —
     P1/P2 yang sama berulang tidak pernah naik kelas & tidak terlihat
     apakah keamanan membaik atau memburuk) ── */
  const prev = await officeRecallSecurityLast(admin)
  let trend: 'membaik' | 'sama' | 'memburuk' | null = null
  if (prev) {
    const d1 = p1.length - prev.p1Count!
    const d2 = p2.length - (prev.p2Count ?? 0)
    trend = (d1 > 0 || d2 > 0) ? 'memburuk' : (d1 < 0 || d2 < 0) ? 'membaik' : 'sama'
  }

  const data = {
    baseUrl: base,
    probeVia: viaSelf,
    totalProbes: findings.length,
    okCount: findings.filter(x => x.verdict === 'ok').length,
    p1,
    p2,
    findings,
    alarm,
    trend,
    prevRun: prev ? { p1Count: prev.p1Count, p2Count: prev.p2Count, runDate: prev.runDate } : null,
    alarmMessage: alarm ? `🚨 P1: ${p1.map(x => `${x.method} ${x.path} (${x.note})`).join(' ; ')}` : '',
    alarmSentByRaka: null as boolean | null,
    alarmError: '' as string,
  }

  if (!dry) {
    await officeRemember(admin, 'Raka', 'security', {
      lesson: alarm
        ? `P1 BELUM DIPASTIKAN BERES: ${p1.map(x => x.path).join(', ')}${trend && trend !== 'membaik' ? ` (tren ${trend} vs run sebelumnya — eskalasi ke Bos!)` : ' — cek ulang run berikutnya'}`
        : `Sweep bersih (${findings.length} probe, P2: ${p2.length}${trend ? `, tren ${trend}` : ''})`,
      p1Count: p1.length, p2Count: p2.length, baseUrl: base,
      trend, prevP1: prev?.p1Count, prevP2: prev?.p2Count,
    })

    /* ── ALARM LANGSUNG dari Raka (FIX kekurangan: dulu alarm hanya lewat
       Alexander di wave terakhir — run solo ?agents=raka tidak pernah
       menyalakan sirene Discord). Alexander akan skip kalau sudah terkirim
       di sini (dedupe via data.alarmSentByRaka). ── */
    if (alarm) {
      const trendNote = trend && trend !== 'membaik' ? `\n⚠️ TREN ${trend.toUpperCase()} vs sweep sebelumnya (${prev?.p1Count ?? '?'} P1 → ${p1.length} P1).` : ''
      const alarmMsg = `@here 🚨 **ALARM DARURAT (P1) — RAKA/CTO**\n${clip(data.alarmMessage || 'Celah keamanan terdeteksi', 500)}${trendNote}\n\n👉 Tutup route / set CRON_SECRET sekarang. Detail: Panel Memori Kantor /kantor-ceo.`
      try {
        const sent = await sendDiscordNotification(alarmMsg)
        data.alarmSentByRaka = sent.ok
        if (!sent.ok) data.alarmError = sent.error || 'unknown'
      } catch (e: unknown) {
        data.alarmSentByRaka = false
        data.alarmError = clip(e instanceof Error ? e.message : String(e), 100)
      }
    }
  }

  const trendSuffix = trend ? `, tren ${trend} vs kemarin` : ''
  const summary = alarm
    ? `ALARM P1! ${p1.length} celah terbuka: ${p1.map(x => x.path).join(', ')}${trendSuffix}${dry ? ' (dry-run — alarm Discord tidak dikirim)' : ''}`
    : `sweep selesai — ${findings.length} route dicek, 0 P1, ${p2.length} peringatan${trendSuffix}`

  return okResult('Raka', summary, data)
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 👥 AGEN 4 — MAYA (CSO · Onboarding & Churn Rescue)
 * ═══════════════════════════════════════════════════════════════════════════ */

const MAYA_SYSTEM = `Kamu MAYA, CSO Luxtradee yang jaga retensi. Kamu menulis email win-back untuk DUA segmen trader yang mulai menghilang:
1. SEGMENT "pasif" — sudah pernah nyatet trade, tapi 2-8 minggu tidak aktif. CTA: balik lagi nyatet jurnal (empati dulu, 1 langkah kecil: upload 1 jurnal / buka dashboard).
2. SEGMENT "cold" — daftar cukup lama tapi BELUM PERNAH nyatet trade sekali pun. CTA: bantu dia lewati hambatan pertama (upload trade pertama, tawarin bantuan/auto-import) — jangan anggap dia pernah pakai produk.
TUJUAN: bikin dia balik PAKAI produk — bukan menekan. Empati dulu, baru ajakan ringan.

GAYA WAJIB: hangat, personal, singkat (maks 120 kata per email), tanpa guilt-trip berlebihan, 1 CTA jelas.
FORMAT OUTPUT WAJIB JSON MURNI (tanpa markdown fence) — SATU email PER target, urut sesuai daftar target di prompt:
{"emails": [{"subject": "...", "body": "...", "html_body": "<p>...</p>..."}]}`

const MAYA_RUBRIC = `- Tidak terdengar seperti blast mass-production (jangan "Kami menyadari..." kaku).
- Ada 1 insight nyata kenapa trader berhenti nyatet (malu SL banyak, sibuk, lupa) — empatik.
- CTA 1 langkah kecil & spesifik (bukan "kunjungi website kami" generik) DAN HARUS cocok dgn segmen target (cold ≠ pasif).
- Maks 120 kata per email; subjek <60 karakter & tidak clickbait palsu.`

async function agentMaya(admin: SupabaseClient, dry: boolean): Promise<AgentResult> {
  // Data riil: profil + waktu aktivitas terakhir tiap user. Window trades
  // 90 HARI (audit M2: window 60 hari dulu membuat user COLD — daftar lama
  // tapi belum pernah nyatet sekali pun — tidak pernah terlihat).
  const profiles = await fetchAllRows<{ id: string; email: string | null; created_at?: string | null }>(
    (from, to) => admin.from('profiles').select('id, email, created_at').range(from, to),
  )
  const since90 = new Date(Date.now() - 90 * 86400_000).toISOString()
  const tradeRows = await fetchAllRows<{ user_id: string | null; created_at: string }>(
    (from, to) => admin.from('trades').select('user_id, created_at').gte('created_at', since90).range(from, to),
  )
  const lastActive = new Map<string, number>()
  for (const t of tradeRows) {
    if (!t.user_id) continue
    const ts = new Date(t.created_at).getTime()
    if (!lastActive.has(t.user_id) || ts > (lastActive.get(t.user_id) || 0)) lastActive.set(t.user_id, ts)
  }

  const now = Date.now()
  const D7 = 7 * 86400_000
  let activeCount = 0
  const candidates: Array<{ id: string; email: string; idleDays: number; segment: 'pasif' | 'cold' }> = []
  for (const p of profiles) {
    if (!p.email) continue
    const last = lastActive.get(p.id) || 0
    if (last && now - last < D7) activeCount++
    const idleDays = last ? Math.floor((now - last) / 86400_000) : -1
    if (last && idleDays >= 14 && idleDays <= 60) {
      candidates.push({ id: p.id, email: p.email, idleDays, segment: 'pasif' })
    } else if (!last) {
      // AUDIT M2: segmen COLD — daftar 14-90 hari lalu, belum pernah nyatet
      const ageDays = p.created_at ? Math.floor((now - new Date(p.created_at).getTime()) / 86400_000) : -1
      if (ageDays >= 14 && ageDays <= 90) candidates.push({ id: p.id, email: p.email, idleDays: ageDays, segment: 'cold' })
    }
  }
  const totalWithEmail = profiles.filter(p => p.email).length
  const passiveCount = candidates.filter(c => c.segment === 'pasif').length
  const coldCount = candidates.filter(c => c.segment === 'cold').length
  const activeRatio = totalWithEmail ? Math.round((activeCount / totalWithEmail) * 100) : 0

  // AUDIT M3 + M4: suppression di SUMBER — user unsubscribe & alamat bounce
  // tidak jadi target (gerbang akhir juga ada di /api/execute-action).
  const unsubIds = await fetchUnsubUserIds(admin)
  const bouncedEmails = new Set<string>()
  for (const c of candidates.slice(0, 40)) {
    const sig = await readEmailSignal(admin, c.email)
    if (sig?.bounced) bouncedEmails.add(c.email.toLowerCase())
  }
  const eligible = candidates.filter(c => !unsubIds.has(c.id) && !bouncedEmails.has(c.email.toLowerCase()))

  // AUDIT M1: cooldown winback DUA FASE — dulu cooldown 14 hari jalan SAAT
  // DRAF dibuat, jadi draf yang Bos tolak/abaikan tetap membekukan lead
  // 14 hari. Kini: 'draft' = proteksi antre 3 hari (draf lama dianggap
  // hangus → lead boleh dipilih lagi), 'sent' = cooldown penuh 14 hari
  // sejak email BENERAN terkirim (ditulis oleh /api/execute-action).
  const targets: typeof eligible = []
  for (const u of [...eligible].sort((a, b) => b.idleDays - a.idleDays)) {
    const stamp = parseWinbackStamp(await kvGet(admin, `winback:${u.email.toLowerCase()}`))
    if (stamp) {
      const age = now - stamp.at
      if (stamp.phase === 'sent' && age < 14 * 86400_000) continue
      if (stamp.phase === 'draft' && age < 3 * 86400_000) continue
    }
    targets.push(u)
    if (targets.length >= 2) break
  }

  const snapshot = { totalUsers: totalWithEmail, activeCount, passiveCount, coldCount, activeRatio, bouncedSkipped: bouncedEmails.size, unsubscribed: unsubIds.size, targets: targets.map(t => `${t.email} (${t.segment})`) }
  if (dry) return skipResult('Maya', `dry-run — snapshot: ${activeCount}/${totalWithEmail} aktif (7 hari), ${passiveCount} pasif + ${coldCount} cold, ${targets.length} kandidat win-back`, snapshot)
  if (!targets.length) {
    return okResult('Maya', `tidak ada target win-back baru (${passiveCount} pasif + ${coldCount} cold — semua dalam cooldown/suppression)`, snapshot)
  }

  // AUDIT M5: LEARNING LOOP — dulu Maya amnesiak (office_memory-nya kosong,
  // recall selalu "belum ada memori"). Kini dia evaluasi hasil win-back
  // 30 hari terakhir (lead balik nyatet setelah di-email?) → disimpan ke
  // memori kantor → dibaca lagi run berikutnya via lessonsBlock.
  let wbSent30 = 0, wbReturned30 = 0
  try {
    const since30 = new Date(now - 30 * 86400_000).toISOString()
    const { data: sentActions } = await admin.from('ai_pending_actions')
      .select('action_payload, executed_at')
      .eq('agent_name', 'Maya').eq('action_type', 'SEND_WINBACK_EMAIL')
      .eq('status', 'approved').gte('executed_at', since30).limit(50)
    const byEmail = new Map(profiles.filter(p => p.email).map(p => [(p.email as string).toLowerCase(), p.id]))
    for (const a of (sentActions || []) as Array<{ action_payload: { target_emails?: string[] }; executed_at: string | null }>) {
      for (const em of a.action_payload?.target_emails || []) {
        wbSent30++
        const uid = byEmail.get(String(em).toLowerCase())
        const sentTs = a.executed_at ? new Date(a.executed_at).getTime() : 0
        if (uid && sentTs && (lastActive.get(uid) || 0) > sentTs) wbReturned30++
      }
    }
    if (wbSent30 > 0) {
      const rate = Math.round((wbReturned30 / wbSent30) * 100)
      await officeRemember(admin, 'Maya', 'critic', {
        lesson: `Win-back 30 hari terakhir: ${wbReturned30}/${wbSent30} lead balik nyatet setelah di-email (${rate}%) — ${rate < 20 ? 'angle/CTA perlu variasi: subjek lebih spesifik & CTA makin kecil' : 'pola bekerja, pertahankan gaya hangat + 1 langkah kecil'}`,
        sent: wbSent30, returned: wbReturned30, rate,
      })
    }
  } catch { /* evaluasi opsional — jangan ganggu tugas utama */ }

  const lessons = await officeRecallLessons(admin, 'Maya')
  const ac = await actorCritic('Maya', {
    system: MAYA_SYSTEM + (lessons.length ? `\n\n${lessonsBlock(lessons)}` : ''),
    user: `DATA RIIL: ${activeCount} dari ${totalWithEmail} user aktif 7 hari terakhir (${activeRatio}%). Kandidat win-back hari ini (SATU email per target, urut sesuai daftar):
${targets.map((t, i) => `${i + 1}. ${t.email} — SEGMENT ${t.segment === 'cold'
      ? `COLD: daftar ${t.idleDays} hari lalu, belum pernah nyatet trade sekali pun → CTA bantu upload trade PERTAMA`
      : `PASIF: terakhir nyatet ${t.idleDays} hari lalu → CTA balik ke jurnal`}`).join('\n')}
Email dikirim personal via Resend — greeting netral tanpa nama (dikirim massal).

Tulis 1 email win-back per target.`,
    rubric: MAYA_RUBRIC,
    maxTokens: 1100,
    temperature: 0.8,
    passScore: 7,
    maxRevisions: 1,
  })
  if (!ac) return errResult('Maya', 'LLM tidak tersedia — email win-back tidak dibuat', snapshot)

  const parsed = extractJson<{ emails?: Array<{ subject?: string; body?: string; html_body?: string }>; subject?: string; body?: string; html_body?: string }>(ac.text)
  // Fallback kompatibel: format lama 1 email (tanpa array "emails")
  const emailDrafts = (parsed?.emails?.length ? parsed.emails : (parsed?.subject && parsed?.html_body ? [parsed] : []))
    .filter(e => e?.subject && e?.html_body)
  if (!emailDrafts.length) {
    return errResult('Maya', `JSON email tidak valid (model ${ac.model})`, snapshot)
  }

  // AUDIT M6: SATU row pending PER TARGET — dulu 1 email massal copy sama
  // persis utk semua target; kini tiap target dapat email sesuai segmennya
  // (cold vs pasif beda CTA). Cooldown 'draft' 3 hari dipasang saat draf
  // masuk antrean; cooldown PENUH baru jalan saat terkirim (execute-action).
  let savedCount = 0
  let saveErr = ''
  for (let i = 0; i < Math.min(emailDrafts.length, targets.length); i++) {
    const t = targets[i]
    const d = emailDrafts[i]
    const { error: insErr } = await admin.from('ai_pending_actions').insert({
      agent_name: 'Maya',
      action_type: 'SEND_WINBACK_EMAIL',
      action_payload: {
        target_emails: [t.email],
        subject: clip(d.subject, 150),
        html_body: String(d.html_body),
        body_plain: clip(d.body || '', 1500),
        context: { segment: t.segment, idleDays: t.idleDays, activeCount, passiveCount, coldCount, activeRatio },
      },
      status: 'pending',
    })
    if (insErr) { saveErr = clip(insErr.message, 140); break }
    await kvSet(admin, `winback:${t.email.toLowerCase()}`, JSON.stringify({ phase: 'draft', at: new Date().toISOString() }))
    savedCount++
  }
  if (savedCount === 0) {
    return skipResult('Maya', `draf jadi (critic ${ac.score < 0 ? 'n/a' : `${ac.score}/10`}) tapi gagal disimpan: ${saveErr}`,
      { ...snapshot, subject: clip(emailDrafts[0].subject, 90) })
  }

  await officeRemember(admin, 'Maya', 'critic', {
    lesson: `Draf win-back ${savedCount}/${targets.length} target (critic ${ac.score < 0 ? 'n/a' : `${ac.score}/10`}) — segmen: ${targets.slice(0, savedCount).map(t => t.segment).join(', ')}; subjek pertama "${clip(emailDrafts[0].subject, 60)}"`,
    score: ac.score, saved: savedCount,
  })

  return okResult('Maya', `rasio aktif ${activeRatio}% (${activeCount}/${totalWithEmail}) — ${savedCount} email win-back per-segmen nunggu ACC Bos (${targets.slice(0, savedCount).map(t => `${t.email.split('@')[0]}·${t.segment}`).join(', ')})${emailDrafts.length < targets.length ? ` — ${targets.length - emailDrafts.length} target tanpa draf, diulang run berikutnya` : ''} (critic ${ac.score < 0 ? 'n/a' : `${ac.score}/10`})`,
    { ...snapshot, criticScore: ac.score, winback30d: { sent: wbSent30, returned: wbReturned30 }, subjects: emailDrafts.slice(0, savedCount).map(e => clip(e.subject, 60)) })
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 💼 AGEN 5 — BAGAS (COO · Monetization & Leads)
 * ═══════════════════════════════════════════════════════════════════════════ */

const BAGAS_SYSTEM = `Kamu BAGAS, COO Luxtradee — closer ulung. Kamu menulis email konversi PRO untuk free user PALING AKTIF (sudah ketagihan pakai produk, tinggal ditawarin upgrade).
PRO = analisa AI unlimited dari jurnal mereka (harga Rp49.000/bulan — boleh disebut, jangan hard-sell).

PENYEGMENTASI LEAD:
- Lead COLD (belum pernah lihat penawaran): respect kerajinan dulu, angkat pain point (nyatet manual makan waktu).
- Lead WARM (SUDAH BUKA/KLIK email sebelumnya tapi belum upgrade): dia TERTARIK TAPI RAGU — jualan ulang dari awal itu salah; akui dia sudah lihat penawaran, obati keraguan spesifik (harga? waktu? fitur?), tawarkan bantuan.
- Lead MANTAN PELANGGAN (pernah bayar PRO): angle "kembali" — singgung manfaat yang dia pernah rasakan, bukan pitch dari nol.

GAYA WAJIB: santai khas anak SMC/ICT, respect dulu ke kerajinan mereka, CTA tegas. Maks 130 kata per email.
FORMAT OUTPUT WAJIB JSON MURNI (tanpa markdown fence) — SATU email PER lead, urut sesuai daftar lead di prompt:
{"emails": [{"subject": "...", "personalized_message": "...", "html_body": "<p>...</p>..."}]}`

const BAGAS_RUBRIC = `- Buka dengan apresiasi SPESIFIK (aktivitas lead), bukan "Semoga email ini menemukanmu dengan baik".
- Angle HARUS cocok segmen lead (warm ≠ cold ≠ mantan pelanggan) — lead warm jangan di-pitch dari nol lagi.
- Ada 1 angka konkret pain vs gain (waktu nyatet manual vs analisa otomatis).
- Sebut harga Rp49.000/bulan sekali, natural.
- CTA tunggal yang tegas; maks 130 kata per email.`

async function agentBagas(admin: SupabaseClient, dry: boolean): Promise<AgentResult> {
  // Window trades 30 hari (audit B: segmen mantan-pembayar butuh aktivitas
  // 30 hari; window 7 hari dulu terlalu sempit) + pisah hitungan 7d/30d.
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString()
  const tradeRows = await fetchAllRows<{ user_id: string | null; created_at: string }>(
    (from, to) => admin.from('trades').select('user_id, created_at').gte('created_at', since30).range(from, to),
  )
  const counts7 = new Map<string, number>()
  const counts30 = new Map<string, number>()
  const cutoff7 = Date.now() - 7 * 86400_000
  for (const t of tradeRows) {
    if (!t.user_id) continue
    counts30.set(t.user_id, (counts30.get(t.user_id) || 0) + 1)
    if (new Date(t.created_at).getTime() >= cutoff7) counts7.set(t.user_id, (counts7.get(t.user_id) || 0) + 1)
  }

  const profiles = await fetchAllRows<{ id: string; email: string | null; full_name?: string | null; is_pro?: boolean | null }>(
    (from, to) => admin.from('profiles').select('id, email, full_name, is_pro').range(from, to),
  )

  // AUDIT B (segmen expired-PRO): mantan pembayar = pernah SUCCESS di
  // payment_orders tapi is_pro=false sekarang (downgrade-expired-pro
  // men-null-kan pro_expiry, jadi satu-satunya jejak adalah riwayat bayar).
  // Lead paling hangat: sudah pernah bayar & masih aktif trading.
  const everPaid = new Set<string>()
  try {
    const { data: paidRows } = await admin.from('payment_orders').select('user_id, paid_at')
      .eq('status', 'SUCCESS').order('paid_at', { ascending: false }).limit(300)
    for (const r of (paidRows || []) as Array<{ user_id?: string | null }>) if (r.user_id) everPaid.add(r.user_id)
  } catch { /* tabel opsional */ }

  const hot = profiles
    .filter(p => p.email && !p.is_pro && ((counts7.get(p.id) || 0) > 0 || (everPaid.has(p.id) && (counts30.get(p.id) || 0) > 0)))
    .map(p => ({ id: p.id, email: p.email as string, name: p.full_name || (p.email as string).split('@')[0], trades7d: counts7.get(p.id) || 0, trades30d: counts30.get(p.id) || 0, everPaid: everPaid.has(p.id) }))
    .sort((a, b) => (Number(b.everPaid) - Number(a.everPaid)) || (b.trades7d - a.trades7d))

  // Anti-spam: yang sudah ditawarin (Bagas via ai_pending_actions / COO-CS via
  // ai_pending_tasks) dalam 7 hari terakhir tidak diganggu lagi
  // 🔗 UNIFIKASI COOLDOWN: window + parser dari @/lib/bagas-cooldown (satu
  // sumber kebenaran bareng cron COO & sweep), window ikut executed_at —
  // proposal lama yang di-ACC telat tetap menghitung dari saat email terkirim.
  const sinceCooldown = bagasCooldownSince()
  const contacted = new Set<string>()
  try {
    const { data: recentActions } = await admin.from('ai_pending_actions').select('action_payload')
      .eq('agent_name', 'Bagas').or(bagasCooldownOrExpr(sinceCooldown)).limit(200) // dulu 60 — anti silent truncation
    for (const e of emailsFromActionRows(recentActions || [])) contacted.add(e)
    const { data: recentTasks } = await admin.from('ai_pending_tasks').select('target_user_id,context_data')
      .in('agent_type', ['COO', 'CS']).or(bagasCooldownOrExpr(sinceCooldown)).limit(500) // dulu 120 — anti silent truncation
    for (const r of (recentTasks || []) as Array<{ target_user_id: string | null; context_data?: { email?: unknown } | null }>) {
      if (r.target_user_id) contacted.add(r.target_user_id)
      const em = String(r.context_data?.email ?? '').trim().toLowerCase()
      if (em.includes('@')) contacted.add(em)
    }
  } catch { /* tabel opsional */ }

  // AUDIT B1: sinyal webhook Resend (open/click/bounce) — lead WARM dapat
  // angle beda, alamat bounce DILEWATI. Baca KV dibatasi 10 kandidat teratas
  // (hemat budget subrequest CF Workers).
  const unsubIds = await fetchUnsubUserIds(admin)
  const signalCache = new Map<string, EmailSignal | null>()
  for (const l of hot.slice(0, 10)) signalCache.set(l.id, await readEmailSignal(admin, l.email))
  const sigOf = (id: string): EmailSignal | null => signalCache.get(id) ?? null

  const targets = hot
    .filter(l => !contacted.has(l.email.toLowerCase()) && !contacted.has(l.id)
      && !unsubIds.has(l.id)
      && !sigOf(l.id)?.bounced)
    .slice(0, 2)
  const warmCount = hot.slice(0, 10).filter(l => (sigOf(l.id)?.count || 0) + (sigOf(l.id)?.clicks || 0) > 0).length
  const snapshot = { hotLeads: hot.length, everPaidLeads: hot.filter(l => l.everPaid).length, warmLeads: warmCount, contactedRecently: contacted.size, unsubscribed: unsubIds.size, targets: targets.map(t => t.email) }
  if (dry) return skipResult('Bagas', `dry-run — ${hot.length} hot lead terdeteksi (${warmCount} warm/opened, ${snapshot.everPaidLeads} mantan-pembayar), ${targets.length} kandidat tanpa cooldown/suppression`, snapshot)
  if (!targets.length) return okResult('Bagas', 'tidak ada hot lead baru (semua dalam cooldown/suppression / belum ada free user aktif)', snapshot)

  // AUDIT B3: LEARNING LOOP — dulu Bagas tidak pernah tahu copy-nya
  // men-converting atau tidak. Kini: lead yang di-email 30 hari terakhir,
  // berapa yang kini PRO → masuk memori kantor → recall run berikutnya.
  try {
    const since30Acts = new Date(Date.now() - 30 * 86400_000).toISOString()
    const { data: sentActs } = await admin.from('ai_pending_actions').select('action_payload')
      .eq('agent_name', 'Bagas').eq('action_type', 'SEND_UPGRADE_OFFER').eq('status', 'approved')
      .gte('executed_at', since30Acts).limit(50)
    const contactedEmails = emailsFromActionRows(sentActs || [])
    if (contactedEmails.size) {
      const proEmails = new Set(profiles.filter(p => p.is_pro).map(p => (p.email as string).toLowerCase()))
      let converted = 0
      for (const e of contactedEmails) if (proEmails.has(e)) converted++
      await officeRemember(admin, 'Bagas', 'critic', {
        lesson: `Email konversi 30 hari terakhir: ${converted}/${contactedEmails.size} lead kini PRO (sinyal kasar — upgrade bisa di luar window email) — ${converted === 0 ? 'uji angle beda: buka dengan angka spesifik aktivitas lead, pain nyatet manual vs otomatis' : 'angle bekerja, pertahankan struktur respect→pain→CTA'}`,
        contacted: contactedEmails.size, converted,
      })
    }
  } catch { /* evaluasi opsional */ }

  const lessons = await officeRecallLessons(admin, 'Bagas')
  const risetSintaBagas = await risetSintaBlock(admin)
  const dewiBlockBagas = await insightDewiBlock(admin)
  const ac = await actorCritic('Bagas', {
    system: BAGAS_SYSTEM + (lessons.length ? `\n\n${lessonsBlock(lessons)}` : ''),
    user: `DATA RIIL hot leads (SATU email per lead, urut sesuai daftar — sebut aktivitas lead paling aktif):
${targets.map((t, i) => {
      const sig = sigOf(t.id)
      const segmen = sig && ((sig.count || 0) + (sig.clicks || 0) > 0)
        ? `WARM — SUDAH BUKA email penawaran ${sig.count || 0}x & KLIK ${sig.clicks || 0}x tapi belum upgrade → obati keraguan, JANGAN pitch dari nol`
        : t.everPaid
          ? 'MANTAN PELANGGAN — pernah bayar PRO, masih aktif trading → angle "kembali ke PRO"'
          : 'COLD — belum pernah lihat penawaran → pitch standar respect→pain→CTA'
      return `${i + 1}. ${t.name} (${t.trades7d} trades/7hr, ${t.trades30d} trades/30hr) — ${segmen}`
    }).join('\n')}

Tulis 1 email konversi PRO per lead.${risetSintaBagas}${dewiBlockBagas}`,
    rubric: BAGAS_RUBRIC,
    maxTokens: 1000,
    temperature: 0.8,
    passScore: 7,
    maxRevisions: 1,
  })
  if (!ac) return errResult('Bagas', 'LLM tidak tersedia — email konversi tidak dibuat', snapshot)

  const parsed = extractJson<{ emails?: Array<{ subject?: string; personalized_message?: string; html_body?: string }>; subject?: string; personalized_message?: string; html_body?: string }>(ac.text)
  // Fallback kompatibel: format lama 1 email (tanpa array "emails")
  const emailDrafts = (parsed?.emails?.length ? parsed.emails : (parsed?.subject && parsed?.html_body ? [parsed] : []))
    .filter(e => e?.subject && e?.html_body)
  if (!emailDrafts.length) {
    return errResult('Bagas', `JSON email tidak valid (model ${ac.model})`, snapshot)
  }

  // Kontrak payload SAMA dengan /api/execute-action (SEND_UPGRADE_OFFER) —
  // audit B: SATU row PER lead (dulu 1 email massal utk semua lead dengan
  // stats lead lain; kini tiap lead dapat email sesuai segmennya).
  let savedCount = 0
  let saveErr = ''
  for (let i = 0; i < Math.min(emailDrafts.length, targets.length); i++) {
    const t = targets[i]
    const d = emailDrafts[i]
    const sig = sigOf(t.id)
    const { error: insErr } = await admin.from('ai_pending_actions').insert({
      agent_name: 'Bagas',
      action_type: 'SEND_UPGRADE_OFFER',
      action_payload: {
        target_emails: [t.email],
        subject: clip(d.subject, 150),
        personalized_message: clip(d.personalized_message || d.html_body, 1200),
        html_body: String(d.html_body),
        context: [{ email: t.email, trades7d: t.trades7d, trades30d: t.trades30d, everPaid: t.everPaid, opened: sig?.count || 0, clicked: sig?.clicks || 0 }],
      },
      status: 'pending',
    })
    if (insErr) { saveErr = clip(insErr.message, 140); break }
    savedCount++
  }
  if (savedCount === 0) {
    return skipResult('Bagas', `draf jadi (critic ${ac.score < 0 ? 'n/a' : `${ac.score}/10`}) tapi gagal disimpan: ${saveErr}`,
      { ...snapshot, subject: clip(emailDrafts[0].subject, 90) })
  }

  await officeRemember(admin, 'Bagas', 'critic', {
    lesson: `Draf konversi ${savedCount}/${targets.length} lead (critic ${ac.score < 0 ? 'n/a' : `${ac.score}/10`}) — segmen: ${targets.slice(0, savedCount).map(t => sigOf(t.id) && ((sigOf(t.id)!.count || 0) + (sigOf(t.id)!.clicks || 0) > 0) ? 'warm' : t.everPaid ? 'mantan-pembayar' : 'cold').join(', ')}`,
    score: ac.score, saved: savedCount,
  })

  return okResult('Bagas', `${savedCount} draf email konversi PRO per-segmen siap (${targets.slice(0, savedCount).map(t => `${t.name}: ${t.trades7d} trades/7hr`).join(', ')}) — nunggu ACC Bos`,
    { ...snapshot, criticScore: ac.score, subjects: emailDrafts.slice(0, savedCount).map(e => clip(e.subject, 60)) })
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 💰 AGEN 6 — PUTRI (CFO · Hardcoded Financial Math + Kuota API)
 * MRR = matematika MURNI di kode (bukan LLM — anti halusinasi finansial).
 * ═══════════════════════════════════════════════════════════════════════════ */

async function agentPutri(admin: SupabaseClient, dry: boolean): Promise<AgentResult> {
  // ── MRR: PRO AKTIF = is_pro=true & pro_expiry belum lewat (null = lifetime)
  let proCount = 0, lifetimeCount = 0, expiredCount = 0, freeCount = 0
  const proExpiring: Array<{ email: string; expiry: string; daysLeft: number }> = []
  try {
    const profiles = await fetchAllRows<{ is_pro?: boolean | null; pro_expiry?: string | null; email?: string | null }>(
      (from, to) => admin.from('profiles').select('is_pro, pro_expiry, email').range(from, to),
    )
    const now = Date.now()
    for (const p of profiles) {
      if (!p.is_pro) { freeCount++; continue }
      if (!p.pro_expiry) { proCount++; lifetimeCount++; continue } // lifetime aktif selamanya
      const expTs = new Date(p.pro_expiry).getTime()
      if (expTs > now) {
        proCount++
        // AUDIT P3: early-warning renewal — PRO yang mau jatuh ≤7 hari
        const daysLeft = Math.ceil((expTs - now) / 86400_000)
        if (daysLeft <= 7 && p.email) proExpiring.push({ email: p.email, expiry: p.pro_expiry.slice(0, 10), daysLeft })
        continue
      }
      expiredCount++
    }
    proExpiring.sort((a, b) => a.daysLeft - b.daysLeft)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return errResult('Putri', `gagal hitung profiles: ${clip(msg, 140)}`)
  }

  const priceMonthly = parseInt((await envVal('PRO_MONTHLY_PRICE_IDR')) || '49000', 10) || 49000
  const mrrIdr = proCount * priceMonthly // lifetime TIDAK masuk MRR (one-time) — dilaporkan terpisah

  /* ── AUDIT P1: TREN MRR — dulu Putri amnesiak (snapshot hilang, Bos
     tidak pernah dengar "MRR naik/turun"). Kini snapshot harian ke
     agent_kv → dibandingkan dengan kemarin → tren masuk briefing. */
  const day = wibDateStr()
  const yesterday = wibDateStr(new Date(Date.now() - 86400_000))
  let mrrTrend: { prevMrr: number | null; deltaIdr: number; deltaPct: number; direction: 'naik' | 'turun' | 'flat' | 'baseline-pertama' } = { prevMrr: null, deltaIdr: 0, deltaPct: 0, direction: 'baseline-pertama' }
  try {
    const prevRaw = await kvGet(admin, `putri:mrr:${yesterday}`)
    if (prevRaw) {
      const prev = JSON.parse(prevRaw) as { mrrIdr?: number }
      if (Number.isFinite(prev.mrrIdr)) {
        const prevMrr = prev.mrrIdr as number
        const deltaIdr = mrrIdr - prevMrr
        mrrTrend = { prevMrr, deltaIdr, deltaPct: prevMrr ? Math.round((deltaIdr / prevMrr) * 1000) / 10 : 0, direction: deltaIdr > 0 ? 'naik' : deltaIdr < 0 ? 'turun' : 'flat' }
      }
    }
  } catch { /* snapshot opsional */ }
  if (!dry) await kvSet(admin, `putri:mrr:${day}`, JSON.stringify({ mrrIdr, proCount, at: new Date().toISOString() }))

  // ── Kuota API: LLM hari ini (counter agent_kv kumulatif + run ini) & email 24 jam
  const storedLlm = parseInt((await kvGet(admin, `q:llm:${day}`)) || '0', 10) || 0
  const llmToday = storedLlm + quotaTracker.llmCalls

  const orLimit = parseInt((await envVal('OPENROUTER_DAILY_LIMIT')) || '50', 10) || 50
  const geminiLimit = parseInt((await envVal('GEMINI_DAILY_LIMIT')) || '1500', 10) || 1500
  const resendLimit = parseInt((await envVal('RESEND_DAILY_LIMIT')) || '100', 10) || 100

  let emailsApproved24h = 0
  try {
    const since24 = new Date(Date.now() - 86400_000).toISOString()
    const { count } = await admin
      .from('ai_pending_actions')
      .select('id', { count: 'exact', head: true })
      .in('action_type', ['SEND_WINBACK_EMAIL', 'SEND_UPGRADE_OFFER', 'BROADCAST_MAINTENANCE'])
      .eq('status', 'approved')
      .gte('executed_at', since24)
    emailsApproved24h = count || 0
  } catch { /* tabel opsional */ }

  const pct = (n: number, lim: number) => Math.min(999, Math.round((n / Math.max(1, lim)) * 100))
  const quotas = {
    openrouter: { used: llmToday, limit: orLimit, pct: pct(llmToday, orLimit), note: 'gratis: 50/hari tanpa kredit, 1000/hari dengan saldo ≥$10' },
    gemini: { used: quotaTracker.llmCalls, limit: geminiLimit, pct: pct(quotaTracker.llmCalls, geminiLimit), note: 'gemini dipakai helper ai-llm (fallback route lain)' },
    resend: { used: emailsApproved24h, limit: resendLimit, pct: pct(emailsApproved24h, resendLimit) },
  }
  const risk429 = Object.entries(quotas).filter(([, q]) => q.pct >= 80).map(([k]) => k)

  const data = {
    mrrIdr,
    mrrFormatted: `Rp${mrrIdr.toLocaleString('id-ID')}`,
    priceMonthly,
    proActive: proCount,
    proLifetime: lifetimeCount,
    proExpired: expiredCount,
    freeUsers: freeCount,
    mrrTrend,
    proExpiring,
    quotas,
    risk429,
  }
  if (dry) return skipResult('Putri', `dry-run — MRR est. Rp${mrrIdr.toLocaleString('id-ID')} (${proCount} PRO aktif), kuota LLM hari ini ${llmToday}/${orLimit}`, data)

  const mrrTxt = `Rp${mrrIdr.toLocaleString('id-ID')}`
  const trendTxt = mrrTrend.prevMrr !== null
    ? `, ${mrrTrend.direction} ${Math.abs(mrrTrend.deltaPct)}% vs kemarin`
    : ', baseline pertama'
  const expiringTxt = proExpiring.length ? ` — ⏳ ${proExpiring.length} PRO expiring ≤7 hari (renewal!)` : ''
  const summary = risk429.length
    ? `MRR est. ${mrrTxt} (${proCount} PRO × Rp${priceMonthly.toLocaleString('id-ID')}${trendTxt}${expiringTxt}) — ⚠️ kuota ${risk429.join(', ')} mendekati limit 429!`
    : `MRR est. ${mrrTxt} (${proCount} PRO aktif × Rp${priceMonthly.toLocaleString('id-ID')}, ${lifetimeCount} lifetime${trendTxt}${expiringTxt}) — kuota aman`

  // AUDIT P1: memori kantor — MRR + tren tercatat, dibaca Alexander
  // (dan tampil di panel Memori Kantor) — dulu laporan hilang tiap hari.
  await officeRemember(admin, 'Putri', 'report', {
    lesson: `MRR ${mrrTxt} (${proCount} PRO aktif${trendTxt})${expiredCount ? `; ${expiredCount} expired PRO perlu win-back (segmen mantan-pembayar Bagas)` : ''}${proExpiring.length ? `; ${proExpiring.length} expiring ≤7 hari` : ''}`,
    mrrIdr, proCount, lifetimeCount, expiredCount, trend: mrrTrend.direction, deltaPct: mrrTrend.deltaPct,
    expiringCount: proExpiring.length,
  })

  return okResult('Putri', summary, data)
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 📊 AGEN 7 — DEWI (Data Analyst · Trading Insight)
 * Statistik emosi vs profit dihitung DI KODE (angka riil), LLM hanya narasi.
 * ═══════════════════════════════════════════════════════════════════════════ */

async function agentDewi(admin: SupabaseClient, dry: boolean): Promise<AgentResult> {
  const since14 = new Date(Date.now() - 14 * 86400_000).toISOString()
  const trades = await fetchAllRows<{ emotion?: string | null; profit_loss?: number | null; created_at?: string }>(
    (from, to) => admin.from('trades').select('emotion, profit_loss, created_at').gte('created_at', since14).range(from, to),
  )

  interface EmoAgg { n: number; wins: number; totalPL: number }
  const byEmotion = new Map<string, EmoAgg>()
  // AUDIT D3: distribusi jam entry (WIB) — jam paling untung/paling nyakit
  // jadi bahan topik konten Sinta & rekomendasi disiplin Bos.
  const byHour = new Map<number, { n: number; wins: number; totalPL: number }>()
  let totalPL = 0, wins = 0, analyzed = 0
  for (const t of trades) {
    const pl = Number(t.profit_loss)
    if (!Number.isFinite(pl)) continue
    analyzed++
    totalPL += pl
    if (pl > 0) wins++
    const emo = String(t.emotion || '').trim().toLowerCase() || 'tanpa-emosi'
    const agg = byEmotion.get(emo) || { n: 0, wins: 0, totalPL: 0 }
    agg.n++; agg.totalPL += pl; if (pl > 0) agg.wins++
    byEmotion.set(emo, agg)
    if (t.created_at) {
      const h = (new Date(t.created_at).getUTCHours() + 7) % 24 // WIB
      const ha = byHour.get(h) || { n: 0, wins: 0, totalPL: 0 }
      ha.n++; ha.totalPL += pl; if (pl > 0) ha.wins++
      byHour.set(h, ha)
    }
  }

  const r2 = (n: number) => Math.round(n * 100) / 100
  const emotionStats = [...byEmotion.entries()]
    .map(([emotion, a]) => ({ emotion, trades: a.n, winrate: Math.round((a.wins / a.n) * 100), avgPL: r2(a.totalPL / a.n), totalPL: r2(a.totalPL) }))
    .sort((a, b) => b.totalPL - a.totalPL)

  const meaningful = emotionStats.filter(e => e.trades >= 3)
  const bestEmotion = meaningful[0] || null
  const worstEmotion = meaningful.length > 1 ? meaningful[meaningful.length - 1] : null

  const hourStats = [...byHour.entries()]
    .filter(([, a]) => a.n >= 3)
    .map(([hourWib, a]) => ({ hourWib, trades: a.n, winrate: Math.round((a.wins / a.n) * 100), avgPL: r2(a.totalPL / a.n) }))
    .sort((a, b) => b.avgPL - a.avgPL)
  const bestHour = hourStats[0] || null
  const worstHour = hourStats.length > 1 ? hourStats[hourStats.length - 1] : null

  // AUDIT D3: perbandingan vs 14 hari SEBELUMNYA (dulu cuma snapshot —
  // Bos tidak pernah tahu performanya membaik atau memburuk)
  const since28 = new Date(Date.now() - 28 * 86400_000).toISOString()
  let prevWinrate: number | null = null
  let winrateDelta = 0
  try {
    const prevTrades = await fetchAllRows<{ profit_loss?: number | null }>(
      (from, to) => admin.from('trades').select('profit_loss').gte('created_at', since28).lt('created_at', since14).range(from, to),
    )
    let prevN = 0, prevWins = 0
    for (const t of prevTrades) {
      const pl = Number(t.profit_loss)
      if (!Number.isFinite(pl)) continue
      prevN++; if (pl > 0) prevWins++
    }
    if (prevN >= 3 && analyzed > 0) {
      prevWinrate = Math.round((prevWins / prevN) * 100)
      winrateDelta = Math.round((wins / analyzed) * 100) - prevWinrate
    }
  } catch { /* perbandingan opsional */ }
  const periodDirection = prevWinrate === null ? null : winrateDelta > 0 ? 'membaik' : winrateDelta < 0 ? 'memburuk' : 'sama'

  const stats = {
    tradesAnalyzed: analyzed,
    winrate: analyzed ? Math.round((wins / analyzed) * 100) : 0,
    totalPL: r2(totalPL),
    expectancy: analyzed ? r2(totalPL / analyzed) : 0,
    bestEmotion,
    worstEmotion,
    emotionStats: emotionStats.slice(0, 8),
    period: { prevWinrate, winrateDelta, direction: periodDirection },
    bestHour,
    worstHour,
  }

  if (dry) return skipResult('Dewi', `dry-run — ${analyzed} trades 14 hari teranalisa, winrate ${stats.winrate}%${periodDirection ? ` (${periodDirection} ${Math.abs(winrateDelta)}pp vs 14 hari sebelumnya)` : ''}`, stats)
  if (analyzed === 0) return okResult('Dewi', 'belum ada trade dengan profit_loss valid dalam 14 hari — insight dilewati (jujur, tidak mengarang)', stats)

  // LLM hanya menarasikan angka riil (dilarang menambah/mengubah angka)
  const lessons = await officeRecallLessons(admin, 'Dewi')
  const res = await callAgent('Dewi',
    `Kamu DEWI, Data Analyst Luxtradee. Terjemahkan statistik trading menjadi insight TAJAM 2-3 kalimat + 1 rekomendasi tindakan untuk Bos.
Semua angka SUDAH dihitung sistem — kamu HANYA menarasikan, DILARANG menambah/mengubah angka. Gaya: to-the-point, tanpa basa-basi korporat.
${ANTI_HALUSINASI}
Output JSON murni: {"insight": "...", "recommendation": "..."}`,
    `DATA RIIL (14 hari terakhir, dihitung sistem):
${JSON.stringify(stats, null, 1)}
${lessons.length ? lessonsBlock(lessons) : ''}`,
    { maxTokens: 520, temperature: 0.6 })

  let insight = ''
  let recommendation = ''
  if (res) {
    const parsed = extractJson<{ insight?: string; recommendation?: string }>(res.text)
    insight = clip(parsed?.insight || '', 400)
    recommendation = clip(parsed?.recommendation || '', 300)
  }
  if (!insight) {
    // Fallback deterministik — tetap tajam dari angka riil
    insight = bestEmotion
      ? `Saat emosi "${bestEmotion.emotion}" winrate ${bestEmotion.winrate}% (avg ${bestEmotion.avgPL})${worstEmotion ? `, tapi saat "${worstEmotion.emotion}" cuma ${worstEmotion.winrate}% (avg ${worstEmotion.avgPL})` : ''}.`
      : `Winrate ${stats.winrate}% dari ${analyzed} trade, expectancy ${stats.expectancy}/trade.`
    recommendation = worstEmotion && worstEmotion.avgPL < 0
      ? `Aturan tegas minggu ini: mendeteksi diri sedang "${worstEmotion.emotion}" → jangan entry 30 menit.`
      : 'Lanjutkan disiplin jurnal — data mulai menunjukkan pola.'
  }

  /* AUDIT D1: MEMORI KANTOR — dulu insight Dewi hilang begitu briefing
     selesai (amnesia) & recall lessons-nya selalu kosong. Kini tiap hari
     tersimpan → dibaca lagi Dewi (tren), dan DIPAKAI divisi lain via
     insightDewiBlock (Farhan topik artikel, Bagas angle email, Sinta riset). */
  const periodTxt = periodDirection ? `, ${periodDirection} ${Math.abs(winrateDelta)}pp vs 14 hari sebelumnya` : ''
  await officeRemember(admin, 'Dewi', 'report', {
    lesson: `Statistik 14 hari: winrate ${stats.winrate}%${periodTxt}, P/L ${stats.totalPL}${bestEmotion ? `; emosi terbaik "${bestEmotion.emotion}" ${bestEmotion.winrate}%` : ''}${worstEmotion ? `, terburuk "${worstEmotion.emotion}" ${worstEmotion.winrate}% (avg ${worstEmotion.avgPL})` : ''}${worstHour ? `; jam terburuk ${worstHour.hourWib}:00 WIB (avg ${worstHour.avgPL})` : ''}. ${insight}`,
    insight, recommendation,
    stats: { winrate: stats.winrate, tradesAnalyzed: analyzed },
  })

  return okResult('Dewi', `insight siap dari ${analyzed} trade (winrate ${stats.winrate}%${periodTxt}, P/L total ${stats.totalPL}${worstHour ? `, jam terburuk ${worstHour.hourWib}:00 WIB` : ''}) — dibagikan ke Farhan/Bagas/Sinta`,
    { ...stats, insight, recommendation, aiNarration: !!res })
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 👔 AGEN 8 — ALEXANDER (CEO · Executive Aggregator & Discord Notifier)
 * Jalannya SETELAH 7 agen selesai (fanned-in) — butuh hasil semua orang.
 * ═══════════════════════════════════════════════════════════════════════════ */

const ALEX_SYSTEM = `Kamu ALEXANDER, CEO Luxtradee. Kamu menulis MORNING BRIEFING pagi untuk Bos: TEGAS, SINGKAT, NO-FLUFF — briefing eksekutif beneran, bukan newsletter.
Semua angka SUDAH ada di laporan karyawan (DATA RIIL) — DILARANG menambah/mengubah angka.
Gaya: kalimat pendek, verdict dulu baru alasan. Panggil Bos "Bos".

Output JSON murni:
{"ringkasan": "3-5 kalimat kondisi bisnis hari ini", "next_best_action": {"judul": "...", "alasan": "...", "langkah": "1 langkah konkrit hari ini"}, "mood": "🟢|🟡|🔴"}`

const ICONS: Record<string, string> = {
  Farhan: '🚀', Sinta: '📣', Raka: '🖥️', Maya: '👥', Bagas: '💼', Putri: '💰', Dewi: '📊',
}

function statusIcon(r: AgentResult): string {
  if (r.status === 'ok') return '🟢'
  if (r.status === 'skipped') return '🟡'
  return '🔴'
}

function buildBriefingFallback(results: AgentResult[], nbaHint: string): { ringkasan: string; next_best_action: { judul: string; alasan: string; langkah: string }; mood: string } {
  const okCount = results.filter(r => r.status === 'ok').length
  const failCount = results.filter(r => r.status === 'error').length
  const mood = failCount === 0 ? '🟢' : okCount > results.length / 2 ? '🟡' : '🔴'
  return {
    ringkasan: `${okCount}/${results.length} karyawan menyelesaikan tugas pagi ini${failCount ? `, ${failCount} gagal (cek log master cron)` : ''}. ${results.map(r => `${ICONS[r.agent] || '•'} ${r.agent}: ${r.summary}`).join(' ')}`,
    next_best_action: { judul: nbaHint, alasan: 'Ditentukan otomatis dari prioritas laporan hari ini.', langkah: 'Buka Dashboard Alexander & eksekusi.' },
    mood,
  }
}

async function agentAlexander(
  admin: SupabaseClient,
  results: AgentResult[],
  runMeta: { runId: string; durationMs: number },
  /** Mode gelombang: Alexander jalan di invokasi terpisah — kuota LLM wave sebelumnya diteruskan lewat sini */
  llmSummary?: { calls: number; perAgent: Record<string, number> },
): Promise<AgentResult> {
  const totalLlmCalls = llmSummary?.calls ?? quotaTracker.llmCalls
  const perAgentLlm = llmSummary?.perAgent ?? quotaTracker.perAgent
  const raka = results.find(r => r.agent === 'Raka')
  const p1Alarm = !!(raka?.data && (raka.data as { alarm?: boolean }).alarm)

  // AUDIT A2: ACCOUNTABILITY — baca NBA & mood briefing TERAKHIR dari
  // memori kantor → briefing hari ini bisa ngecek "NBA kemarin dikerjakan?"
  // (dulu briefing amnesiak antar hari).
  let prevBrief: { nba?: string; mood?: string; day?: string } | null = null
  try {
    const { data: prevRows } = await admin.from('office_memory').select('content, run_date')
      .eq('agent_name', 'Alexander').eq('memory_type', 'report')
      .order('created_at', { ascending: false }).limit(1)
    const c = (prevRows?.[0] as { content?: { nba?: string; mood?: string }; run_date?: string } | null)?.content
    if (c?.nba) prevBrief = { nba: c.nba, mood: c.mood, day: (prevRows?.[0] as { run_date?: string }).run_date }
  } catch { /* memori opsional */ }

  // Prioritas Next Best Action (fallback deterministik kalau LLM gagal)
  // AUDIT A1: dulu cuma 3 hint — kini Putri (kuota 429 + renewal) & Maya
  // (win-back) ikut menentukan prioritas hari ini.
  const putriRes = results.find(r => r.agent === 'Putri')
  const putriData = ((putriRes?.data || {}) as { risk429?: string[]; proExpiring?: Array<{ email: string; daysLeft: number }> })
  const mayaRes = results.find(r => r.agent === 'Maya')
  let nbaHint = 'Review antrean ACC di Dashboard Alexander — konten & email siap ditinjau'
  if (p1Alarm) nbaHint = 'PERBAIKI CELAH KEAMANAN P1 SEKARANG — tutup/protect route yang terbuka'
  else if (results.some(r => r.agent === 'Farhan' && r.status === 'error')) nbaHint = 'Cek OPENROUTER_API_KEY & kuota — artikel SEO hari ini gagal dibuat'
  else if (putriData.risk429?.length) nbaHint = `Kuota ${putriData.risk429.join(', ')} hampir limit — isi saldo OpenRouter / kurangi beban LLM hari ini sebelum kantor lumpuh`
  else if ((putriData.proExpiring?.length || 0) > 0) nbaHint = `${putriData.proExpiring!.length} user PRO expiring ≤7 hari — pastikan renewal offer terkirim (revenue paling murah)`
  else if (results.some(r => r.agent === 'Bagas' && r.status === 'ok')) nbaHint = 'ACC email konversi PRO Bagas — hot lead tidak bisa ditunggu lama'
  else if (mayaRes?.status === 'ok' && mayaRes.summary.includes('nunggu ACC')) nbaHint = 'ACC email win-back Maya — user pasif makin lama makin sulit dibalikkan'

  const reportJson = JSON.stringify(
    results.map(r => ({ agent: r.agent, status: r.status, summary: r.summary, data: r.data ? clip(JSON.stringify(r.data), 700) : undefined })),
    null, 1,
  )

  let briefing = buildBriefingFallback(results, nbaHint)
  let aiModel = 'fallback-deterministik'
  const prevNbaLine = prevBrief?.nba
    ? `NBA BRIEFING TERAKHIR (${prevBrief.day || '?'}): "${clip(prevBrief.nba, 140)}" (mood ${prevBrief.mood || '?'}) — cek: sudah dikerjakan atau belum? Kalau masih relevan & belum, prioritaskan lagi; kalau sudah, pilih prioritas baru dari data di atas.\n\n`
    : ''
  const res = await callAgent('Alexander', ALEX_SYSTEM,
    `LAPORAN KARYAWAN (run ${runMeta.runId}, ${Math.round(runMeta.durationMs / 1000)}s, ${totalLlmCalls} panggilan LLM):\n${clip(reportJson, 6500)}\n\n${prevNbaLine}${ANTI_HALUSINASI}`,
    { maxTokens: 650, temperature: 0.5 })
  if (res) {
    const parsed = extractJson<{ ringkasan?: string; next_best_action?: { judul?: string; alasan?: string; langkah?: string }; mood?: string }>(res.text)
    if (parsed?.ringkasan && parsed?.next_best_action?.judul) {
      briefing = {
        ringkasan: clip(parsed.ringkasan, 700),
        next_best_action: {
          judul: clip(parsed.next_best_action.judul, 140),
          alasan: clip(parsed.next_best_action.alasan || '', 300),
          langkah: clip(parsed.next_best_action.langkah || '', 300),
        },
        mood: ['🟢', '🟡', '🔴'].includes(parsed.mood || '') ? (parsed.mood as string) : '🟡',
      }
      aiModel = res.model
    }
  }

  await officeRemember(admin, 'Alexander', 'report', {
    lesson: `Run ${runMeta.runId}: mood ${briefing.mood}, NBA "${briefing.next_best_action.judul}"`,
    mood: briefing.mood, okCount: results.filter(r => r.status === 'ok').length,
    // AUDIT A2: NBA & tanggal disimpan TERSTRUKTUR — dibaca lagi run
    // berikutnya utk accountability ("NBA kemarin dikerjakan belum?")
    nba: briefing.next_best_action.judul,
    day: wibDateStr(),
  })

  // ── Kirim ke Discord (non-kritis — gagal tidak menjatuhkan run) ──
  const lines = results.map(r => `${statusIcon(r)} ${ICONS[r.agent] || '•'} **${r.agent}**: ${clip(r.summary, 140)}`)
  const quotaLine = `🧮 LLM run ini: ${totalLlmCalls} panggilan (${Object.entries(perAgentLlm).map(([k, v]) => `${k} ${v}`).join(', ') || '0'})`
  const header = `👔 **MORNING BRIEFING — Luxtradee AI Workforce**\n📅 ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })} · ${briefing.mood}\n\n${briefing.ringkasan}\n\n`
  const footer = `\n\n🎯 **NEXT BEST ACTION: ${briefing.next_best_action.judul}**\n→ ${briefing.next_best_action.langkah || briefing.next_best_action.alasan}\n\n${quotaLine}`
  const content = clip(header + lines.join('\n') + footer, 1900)

  let discordSent = false
  let discordError = ''
  const sent = await sendDiscordNotification(content)
  discordSent = sent.ok
  if (!sent.ok) discordError = sent.error || 'unknown'

  // Alarm P1 dikirim terpisah biar mencolok di channel.
  // FIX dedupe (7 Nov): Raka kini mengirim alarm LANGSUNG di sweep-nya —
  // Alexander hanya mengirim ulang kalau Raka BELUM kirim (false = Raka
  // coba tapi gagal, Alexander jadi backup; null = Raka belum sempat kirim).
  let alarmSent: boolean | null = null
  if (p1Alarm) {
    const rakaAlarm = (raka!.data as { alarmSentByRaka?: boolean | null; alarmMessage?: string }) || {}
    if (rakaAlarm.alarmSentByRaka === true) {
      alarmSent = null // sudah disiulkan Raka — jangan spam dobel
    } else {
      const alarmMsg = `@here 🚨 **ALARM DARURAT (P1) — RAKA/CTO**\n${clip(rakaAlarm.alarmMessage || 'Celah keamanan terdeteksi', 500)}\n\n👉 Tutup route / set CRON_SECRET sekarang. Detail: run ${runMeta.runId}.`
      const sentAlarm = await sendDiscordNotification(alarmMsg)
      alarmSent = sentAlarm.ok
    }
  }

  return okResult('Alexander', `briefing ${discordSent ? 'terkirim ke Discord' : `GAGAL terkirim (${discordError})`} — mood ${briefing.mood}, NBA: ${briefing.next_best_action.judul}`,
    { briefing, aiModel, discordSent, discordError: discordSent ? undefined : discordError, alarmSent })
}

/* ═════════════════════════════════ ORCHESTRATOR ════════════════════════════ */

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const secret = await envVal('CRON_SECRET') // nama tunggal — sesuai env Bos
  // P0 hardening: FAIL-CLOSED — kalau CRON_SECRET belum diset, endpoint DITOLAK
  // di produksi (dulu: allow dan mengandalkan guard interval → bisa dibakar
  // orang luar). Dev lokal (NODE_ENV=development) tetap boleh untuk testing.
  if (!secret) return process.env.NODE_ENV === 'development'
  // Hanya Bearer header — fallback query param ?secret= dihapus (nyangkut di log).
  const provided = request.headers.get('authorization')?.replace('Bearer ', '') || ''
  return provided === secret
}

async function handleRequest(request: NextRequest) {
  const startedAt = Date.now()
  const runId = `run-${wibDateStr()}-${startedAt.toString(36)}`
  const { searchParams } = new URL(request.url)
  const dry = searchParams.get('dry') === 'true'
  const force = searchParams.get('force') === 'true'
  const subsetRaw = (searchParams.get('agents') || '').toLowerCase()
  const subset = subsetRaw ? new Set(subsetRaw.split(',').map(s => s.trim()).filter(Boolean)) : null

  const admin = await getCronAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Database unavailable (Supabase admin client gagal dibuat)' }, { status: 503 })
  }
  resetQuotaTracker()

  // Guard interval: cegah double-trigger / spam pembakar kuota (bukan dry)
  if (!dry && !force) {
    const lastRun = await kvGet(admin, 'master:lastRun')
    if (lastRun) {
      const minInterval = parseInt((await envVal('MASTER_MIN_INTERVAL_MIN')) || String(DEFAULT_MIN_INTERVAL_MIN), 10) || DEFAULT_MIN_INTERVAL_MIN
      const elapsedMin = (Date.now() - new Date(lastRun).getTime()) / 60_000
      if (elapsedMin < minInterval) {
        return NextResponse.json({
          success: false,
          error: `Run terakhir baru ${Math.round(elapsedMin)} menit lalu (guard ${minInterval} menit). Pakai ?force=true dengan secret kalau memang perlu.`,
        }, { status: 429 })
      }
    }
  }

  // URL sendiri untuk probe RAKA (env dulu, fallback origin request)
  const baseUrl = (await envVal('NEXT_PUBLIC_APP_URL')) || (await envVal('NEXT_PUBLIC_SITE_URL')) || new URL(request.url).origin

  const want = (name: string) => !subset || subset.has(name.toLowerCase())

  // ── 7 PEKERJA → PARALEL, kegagalan satu agen tidak menular (allSettled) ──
  const jobs: Array<{ name: string; fn: () => Promise<AgentResult> }> = []
  if (want('farhan')) jobs.push({ name: 'Farhan', fn: () => agentFarhan(admin, dry).catch(e => errResult('Farhan', e)) })
  if (want('sinta')) jobs.push({ name: 'Sinta', fn: () => agentSinta(admin, dry).catch(e => errResult('Sinta', e)) })
  if (want('raka')) jobs.push({ name: 'Raka', fn: () => agentRaka(admin, baseUrl, dry).catch(e => errResult('Raka', e)) })
  if (want('maya')) jobs.push({ name: 'Maya', fn: () => agentMaya(admin, dry).catch(e => errResult('Maya', e)) })
  if (want('bagas')) jobs.push({ name: 'Bagas', fn: () => agentBagas(admin, dry).catch(e => errResult('Bagas', e)) })
  if (want('putri')) jobs.push({ name: 'Putri', fn: () => agentPutri(admin, dry).catch(e => errResult('Putri', e)) })
  if (want('dewi')) jobs.push({ name: 'Dewi', fn: () => agentDewi(admin, dry).catch(e => errResult('Dewi', e)) })

  const settled = await Promise.allSettled(jobs.map(j => j.fn()))
  const results: AgentResult[] = settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value
    return errResult(jobs[i].name, s.reason) // lapis kedua — seharusnya tak pernah kejadian
  })

  // ── MODE GELUMBANG (wave): simpan hasil wave ini ke agent_kv ──
  // CF Workers gratis = 50 subrequest/invokasi — run penuh 8 agen bisa
  // melampaui batas itu (run 2026-11-02: Farhan & Discord kena "Too many
  // subrequests"). Workflow kini memanggil endpoint ini 3× terpisah
  // (Raka+data → Farhan+Sinta → Alexander); tiap invokasi dapat budget
  // subrequest baru. Blob per hari WIB dipakai Alexander (wave terakhir)
  // untuk fan-in lintas invokasi. Run penuh tanpa ?agents= tetap jalan &
  // ikut menulis blob (berguna untuk rerun Alexander manual).
  if (!dry && results.length > 0) {
    const dayKey = `master:results:${wibDateStr()}`
    let blob: { runId?: string; durationMs?: number; llmCalls?: number; perAgent?: Record<string, number>; agents?: Record<string, AgentResult> } = {}
    try { blob = JSON.parse((await kvGet(admin, dayKey)) || '{}') } catch { blob = {} }
    blob.runId = runId
    blob.durationMs = (blob.durationMs || 0) + (Date.now() - startedAt)
    blob.llmCalls = (blob.llmCalls || 0) + quotaTracker.llmCalls
    blob.perAgent = { ...(blob.perAgent || {}) }
    for (const [k, v] of Object.entries(quotaTracker.perAgent)) blob.perAgent[k] = (blob.perAgent[k] || 0) + v
    blob.agents = { ...(blob.agents || {}) }
    for (const r of results) blob.agents![r.agent] = r
    await kvSet(admin, dayKey, JSON.stringify(blob))
  }

  // ── CEO fanned-in: agregasi SEMUA hasil → briefing → Discord ──
  let ceo: AgentResult | null = null
  if (!dry && want('alexander')) {
    let ceoResults = results
    let ceoMeta = { runId, durationMs: Date.now() - startedAt }
    let ceoLlm = { calls: quotaTracker.llmCalls, perAgent: quotaTracker.perAgent }
    if (results.length === 0) {
      // Wave terakhir: Alexander jalan sendiri — muat hasil wave pekerja dari KV
      let blob: { runId?: string; durationMs?: number; llmCalls?: number; perAgent?: Record<string, number>; agents?: Record<string, AgentResult> } = {}
      try { blob = JSON.parse((await kvGet(admin, `master:results:${wibDateStr()}`)) || '{}') } catch { blob = {} }
      const persisted = Object.values(blob.agents || {})
      if (persisted.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Alexander solo: belum ada hasil pekerja tersimpan hari ini — jalankan wave pekerja dulu, mis. ?agents=raka,maya,bagas,putri,dewi',
        }, { status: 409 })
      }
      ceoResults = persisted
      ceoMeta = { runId: blob.runId || runId, durationMs: blob.durationMs || 0 }
      ceoLlm = { calls: blob.llmCalls || 0, perAgent: blob.perAgent || {} }
    }
    ceo = await agentAlexander(admin, ceoResults, ceoMeta, ceoLlm).catch(e => errResult('Alexander', e))
  }

  const durationMs = Date.now() - startedAt

  // Catat kuota LLM harian (kumulatif lintas run — dibaca Putri run berikutnya)
  if (!dry && quotaTracker.llmCalls > 0) {
    const day = wibDateStr()
    const prev = parseInt((await kvGet(admin, `q:llm:${day}`)) || '0', 10) || 0
    await kvSet(admin, `q:llm:${day}`, String(prev + quotaTracker.llmCalls))
  }
  if (!dry) await kvSet(admin, 'master:lastRun', new Date().toISOString())

  const agents: Record<string, AgentResult> = {}
  for (const r of results) agents[r.agent] = r
  if (ceo) agents.Alexander = ceo

  const hints: string[] = []
  {
    const hasOR = !!(await envVal('OPENROUTER_API_KEY'))
    const hasGroq = !!(await getEnvVar('GROQ_API_KEY', { quiet: true }))
    const hasGemini = !!(await getEnvVar('GEMINI_API_KEY', { quiet: true }))
    if (!hasOR && !hasGroq && !hasGemini) {
      hints.push('Tidak ada API key LLM sama sekali (OPENROUTER/GROQ/GEMINI) — agen konten hanya jalan template/skip. Solusi gratis: console.groq.com (±14.400 req/hari) atau aistudio.google.com (1.500/hari)')
    } else if (!hasOR) {
      hints.push('OPENROUTER_API_KEY belum diset — agen konten jalan via fallback Groq/Gemini')
    }
  }
  if (!(await envVal('DISCORD_BOT')) && !(await envVal('DISCORD_BOT_TOKEN')) && !(await envVal('DISCORD_WEBHOOK_URL'))) {
    hints.push('DISCORD_BOT (token bot + DISCORD_CHANNEL_ID) atau DISCORD_WEBHOOK_URL belum diset — briefing Alexander tidak terkirim')
  } else if ((await envVal('DISCORD_BOT')) && !(await envVal('DISCORD_CHANNEL_ID'))) {
    hints.push('DISCORD_BOT terbaca tapi DISCORD_CHANNEL_ID belum diset — briefing tidak bisa dikirim via bot')
  }
  const rakaRes = agents.Raka
  if (rakaRes?.status === 'ok' && (rakaRes.data as { alarm?: boolean })?.alarm) hints.push('🚨 P1 KEAMANAN TERDETEKSI — cek agents.Raka.p1')

  return NextResponse.json({
    success: results.every(r => r.status !== 'error') && (!ceo || ceo.status === 'ok'),
    runId,
    version: RUN_VERSION,
    dryRun: dry,
    startedAt: new Date(startedAt).toISOString(),
    durationMs,
    llmCalls: quotaTracker.llmCalls,
    agents,
    ceo: ceo?.data || null,
    hints,
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
    console.error('[master-autonomous] Fatal:', clip(msg, 400))
    return NextResponse.json({ success: false, error: clip(msg, 400) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
