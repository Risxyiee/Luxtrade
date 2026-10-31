import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCronAdmin, fetchAllRows, isMissingTableError } from '@/lib/cron-supabase'
import { extractJson } from '@/lib/ai-llm'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { sendDiscordNotification } from '@/lib/discord'
import { bagasCooldownSince, bagasCooldownOrExpr, emailsFromActionRows } from '@/lib/bagas-cooldown'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏢 MASTER AUTONOMOUS CRON — "Fully Autonomous AI Workforce" (8 Karyawan)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * SATU endpoint, DELAPAN agen:
 *
 *   🚀 FARHAN   (Growth Hacker) — riset keyword → artikel SEO 600+ kata
 *               (Actor-Critic) → AUTO-TERBIT di tabel blog_posts (tabel
 *               "posts" milik /blog — target eksekusi resmi di sistem)
 *   📣 SINTA    (CMO)          — analisis angle TikTok (belajar dari
 *               tiktok_posts views tertinggi) → 3 draf skrip provokatif
 *               (Actor-Critic) → draf nunggu ACC Bos
 *   🖥️ RAKA     (CTO)          — security sweep black-box: ping route
 *               kritis (jurnal trades, AI vision, CS chat, debug, cron) →
 *               P1 = alarm darurat → Alexander kirim @here ke Discord
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

const RUN_VERSION = 'master-autonomous@1'
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
    console.warn(`[master:${agentTag}] OPENROUTER_API_KEY kosong — LLM dilewati, pakai fallback`)
    return null
  }
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
  },
): Promise<ActorCriticResult | null> {
  const passScore = params.passScore ?? 7
  const maxRevisions = params.maxRevisions ?? 1
  const trail: string[] = []

  const first = await callAgent(agentTag, params.system, params.user, {
    maxTokens: params.maxTokens, temperature: params.temperature,
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
- 1 CTA halus ke Luxtradee (jurnal trading AI) di paragraf akhir. Jangan hard-sell.

FORMAT OUTPUT WAJIB JSON MURNI (tanpa markdown fence):
{"title": "...", "meta_description": "...", "html_body": "<h2>...</h2><p>...</p>..."}

html_body: HTML murni — hanya tag <h2>, <h3>, <p>, <ul>, <li>, <strong>. TANPA <html>/<body>/<h1>. Minimal 600 kata.`

const FARHAN_RUBRIC = `- Panjang: hitung kata body — di bawah 600 kata = otomatis nilai 5.
- Struktur SEO: judul mengandung keyword, H2/H3 rapi, pembuka langsung to-the-point.
- Kepercayaan: ada angka/skenario nyata XAUUSD, bukan basa-basi generik.
- Gaya: terbaca seperti manusia (bukan template AI), CTA natural.`

interface FarhanKeyword { keyword: string; angle: string }

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

  // ── Fase 1: riset keyword tren harian ──
  const avoidList = existingTitles.slice(0, 15).map(t => clip(t, 90)).join(' | ') || '(kosong)'
  const kwRes = await callAgent('Farhan',
    'Kamu riset keyword SEO harian untuk niche trading emas/XAUUSD & prop firm (audiens Indonesia). Cari topik yang SEDANG dicari orang, bukan topik usang.',
    `Tanggal run: ${wibDateStr()}.
JUDUL YANG SUDAH TERBIT (JANGAN diulang topiknya): ${avoidList}
${lessonsBlock(lessons)}

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
  const ac = await actorCritic('Farhan', {
    system: FARHAN_SYSTEM + (lessons.length ? `\n\n${lessonsBlock(lessons)}` : ''),
    user: `Tulis artikel SEO hari ini.

KEYWORD UTAMA: ${chosen.keyword}
ANGLE: ${chosen.angle}
KEYWORD CADANGAN (boleh diselipkan natural): ${keywords.slice(1, 3).map(k => k.keyword).join(' ; ') || '-'}

TARGET: minimal 650 kata (aman di atas batas 600), sasar trader Indonesia yang mau pegang konsistensi.`,
    rubric: FARHAN_RUBRIC,
    maxTokens: 2600,
    temperature: 0.75,
    passScore: 7,
    maxRevisions: 1,
  })
  if (!ac) {
    return errResult('Farhan', 'LLM tidak tersedia (OPENROUTER_API_KEY kosong / semua model gagal) — artikel tidak dibuat')
  }

  const parsedArt = extractJson<{ title?: string; meta_description?: string; html_body?: string }>(ac.text)
  const title = clip(parsedArt?.title || chosen.keyword, 200)
  const html = String(parsedArt?.html_body || '').trim()
  const meta = clip(parsedArt?.meta_description || chosen.angle, 300)

  // Hitung kata riil (strip tag HTML)
  const wordCount = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
  const passLen = wordCount >= 600

  await officeRemember(admin, 'Farhan', 'critic', {
    lesson: ac.score >= 7 && passLen
      ? `Artikel "${clip(title, 60)}" lolos critic ${ac.score}/10 (${wordCount} kata) — gaya & struktur dipertahankan`
      : `Artikel "${clip(title, 60)}" hanya ${ac.score < 0 ? 'tanpa nilai' : `${ac.score}/10`} & ${wordCount} kata — catatan: ${clip(ac.trail.join(' | '), 180)}; besok perbaiki`,
    score: ac.score, revisions: ac.revisions, wordCount, model: ac.model,
  })

  if (!html || !passLen) {
    return {
      agent: 'Farhan', status: 'error',
      summary: `draf hanya ${wordCount} kata (<600 wajib) — TIDAK diterbitkan (hindari konten tipis di mata Google)`,
      data: { title, keyword: chosen.keyword, wordCount, criticScore: ac.score, trail: ac.trail },
    }
  }
  if (!tableReady) {
    return skipResult('Farhan', `artikel siap (${wordCount} kata) tapi tabel blog_posts belum ada — jalankan supabase-migrations/015_create_ai_pending_actions.sql`,
      { title, keyword: chosen.keyword, wordCount, html_body: html, meta_description: meta })
  }

  // ── Fase 3: AUTO-TERBIT (dedup judul) ──
  const { data: dup } = await admin.from('blog_posts').select('id').ilike('title', title).limit(1)
  if (dup && dup.length > 0) {
    return skipResult('Farhan', 'artikel dengan judul serupa sudah ada — dilewati (dedup)', { title })
  }
  const { error: insErr } = await admin.from('blog_posts').insert({
    title,
    content_body: html,
    author: 'Farhan (Growth Hacker — AI Agent)',
    status: 'published',
  })
  if (insErr) {
    return errResult('Farhan', `insert blog_posts gagal: ${insErr.message}`, { title, wordCount })
  }

  return okResult('Farhan', `artikel SEO TERBIT: "${clip(title, 70)}" (${wordCount} kata, critic ${ac.score < 0 ? 'n/a' : `${ac.score}/10`}, ${ac.revisions} revisi)`,
    { title, keyword: chosen.keyword, wordCount, meta_description: meta, criticScore: ac.score, revisions: ac.revisions, model: ac.model, published: true })
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 📣 AGEN 2 — SINTA (CMO · Social & Content Factory)
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

async function agentSinta(admin: SupabaseClient, dry: boolean): Promise<AgentResult> {
  // Data riil: 5 konten TikTok dengan views tertinggi (pola yang TERBUKTI FYP)
  const topRefs: Array<{ caption: string; views: number }> = []
  try {
    const { data, error } = await admin.from('tiktok_posts').select('caption, views').order('views', { ascending: false }).limit(5)
    if (!error && data) {
      for (const r of (data as Array<{ caption: string | null; views: number }>)) {
        topRefs.push({ caption: clip(r.caption || '(tanpa caption)', 120), views: r.views || 0 })
      }
    }
  } catch { /* tabel opsional — Sinta tetap jalan */ }

  if (dry) {
    return skipResult('Sinta', `dry-run — LLM & simpan draf dilewati (${topRefs.length} referensi TikTok terbaca)`, { topRefs })
  }

  const lessons = await officeRecallLessons(admin, 'Sinta')
  const refBlock = topRefs.length
    ? `DATA RIIL — 5 KONTEN TIKTOK VIEWS TERTINGGI (pelajari polanya, tiru yang works):\n${topRefs.map((r, i) => `${i + 1}. [${r.views.toLocaleString('id-ID')} views] ${r.caption}`).join('\n')}`
    : '(belum ada referensi TikTok tersimpan — andalkan intuisi pasar)'

  const ac = await actorCritic('Sinta', {
    system: SINTA_SYSTEM + (lessons.length ? `\n\n${lessonsBlock(lessons)}` : ''),
    user: `${refBlock}

Bikin 3 draf skrip TikTok dengan 3 ANGLE BERBEDA, tema: edukasi/psikologi trading XAUUSD.`,
    rubric: SINTA_RUBRIC,
    maxTokens: 1600,
    temperature: 0.9,
    passScore: 7,
    maxRevisions: 1,
  })
  if (!ac) return errResult('Sinta', 'LLM tidak tersedia — draf TikTok tidak dibuat')

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
        note: 'Draf siap pakai — posting manual ke TikTok (integrasi posting TikTok otomatis belum tersedia).',
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
    return skipResult('Sinta', `3 draf dibuat (critic ${ac.score < 0 ? 'n/a' : `${ac.score}/10`}) tapi GAGAL disimpan: ${saveNote}`,
      { drafts, criticScore: ac.score })
  }
  return okResult('Sinta', `3 draf skrip TikTok tersimpan & nunggu ACC Bos (critic ${ac.score < 0 ? 'n/a' : `${ac.score}/10`}, ${ac.revisions} revisi)`,
    { angles: drafts.map(d => clip(d.hook, 80)), criticScore: ac.score, revisions: ac.revisions })
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 🖥️ AGEN 3 — RAKA (CTO · Security Sweep & Uptime Watchdog)
 * 100% deterministik (TANPA LLM): ping route kritis → klasifikasi P1/P2 →
 * alarm darurat disiapkan untuk Alexander (Discord @here).
 * ═══════════════════════════════════════════════════════════════════════════ */

type ProbeClass = 'public' | 'protected' | 'sensitive' | 'cron'
interface ProbeDef { path: string; method: 'GET' | 'POST'; cls: ProbeClass; label: string }
interface ProbeFinding { path: string; method: string; label: string; status: number | null; verdict: 'ok' | 'P1' | 'P2' | 'info'; note: string }

const RAKA_PROBES: ProbeDef[] = [
  { path: '/', method: 'GET', cls: 'public', label: 'Landing page (uptime)' },
  { path: '/blog', method: 'GET', cls: 'public', label: 'Blog (uptime + SEO)' },
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

async function agentRaka(admin: SupabaseClient, baseUrl: string, dry: boolean): Promise<AgentResult> {
  const base = baseUrl.replace(/\/+$/, '')

  const probeOne = async (p: ProbeDef): Promise<ProbeFinding> => {
    const baseF: ProbeFinding = { path: p.path, method: p.method, label: p.label, status: null, verdict: 'info', note: '' }
    let status: number | null = null
    let netErr = ''
    try {
      const res = await fetch(`${base}${p.path}`, {
        method: p.method,
        headers: { 'Content-Type': 'application/json' },
        body: p.method === 'POST' ? '{}' : undefined,
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
      })
      status = res.status
      // Status cukup — body TIDAK di-log (jangan bocorkan isi env/secret ke log)
      await res.text().catch(() => '')
    } catch (e: unknown) {
      netErr = clip(e instanceof Error ? e.message : String(e), 80)
    }

    if (status === null) {
      return { ...baseF, verdict: p.cls === 'public' ? 'P1' : 'info', note: netErr || 'tidak terjangkau' }
    }
    if (p.cls === 'public') {
      if (status >= 500) return { ...baseF, status, verdict: 'P2', note: `HTTP ${status} — endpoint publik error` }
      if (status < 400) return { ...baseF, status, verdict: 'ok', note: `HTTP ${status}` }
      return { ...baseF, status, verdict: 'P2', note: `HTTP ${status} — endpoint publik tidak sehat` }
    }
    if (p.cls === 'cron') {
      if (status === 401 || status === 403) return { ...baseF, status, verdict: 'ok', note: `HTTP ${status} — terlindungi secret` }
      return { ...baseF, status, verdict: 'P2', note: `HTTP ${status} — route cron TIDAK ber-auth (set CRON_SECRET!)` }
    }
    // protected & sensitive: 2xx TANPA auth = celah terbuka
    if (status >= 200 && status < 300) {
      return { ...baseF, status, verdict: 'P1', note: `HTTP 2xx TANPA auth — ${p.cls === 'sensitive' ? 'route sensitif TERBUKA' : 'route user TERBUKA'}!` }
    }
    if (status >= 500) return { ...baseF, status, verdict: 'P2', note: `HTTP ${status} — server error` }
    // 400/401/403/404/405/429 = tertutup / validasi jalan
    return { ...baseF, status, verdict: 'ok', note: `HTTP ${status} — tertutup` }
  }

  // Dry-run tetap boleh probe (read-only & murah) — Bos bisa uji sweep kapan pun
  const settled = await Promise.allSettled(RAKA_PROBES.map(probeOne))
  const findings: ProbeFinding[] = []
  for (const s of settled) if (s.status === 'fulfilled') findings.push(s.value)

  const p1 = findings.filter(x => x.verdict === 'P1')
  const p2 = findings.filter(x => x.verdict === 'P2')
  const alarm = p1.length > 0

  const data = {
    baseUrl: base,
    totalProbes: findings.length,
    okCount: findings.filter(x => x.verdict === 'ok').length,
    p1,
    p2,
    findings,
    alarm,
    alarmMessage: alarm ? `🚨 P1: ${p1.map(x => `${x.method} ${x.path} (${x.note})`).join(' ; ')}` : '',
  }

  if (!dry) {
    await officeRemember(admin, 'Raka', 'security', {
      lesson: alarm
        ? `P1 BELUM DIPASTIKAN BERES: ${p1.map(x => x.path).join(', ')} — cek ulang run berikutnya`
        : `Sweep bersih (${findings.length} probe, P2: ${p2.length})`,
      p1Count: p1.length, p2Count: p2.length, baseUrl: base,
    })
  }

  const summary = alarm
    ? `ALARM P1! ${p1.length} celah terbuka: ${p1.map(x => x.path).join(', ')}`
    : `sweep selesai — ${findings.length} route dicek, 0 P1, ${p2.length} peringatan`

  return okResult('Raka', summary, data)
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 👥 AGEN 4 — MAYA (CSO · Onboarding & Churn Rescue)
 * ═══════════════════════════════════════════════════════════════════════════ */

const MAYA_SYSTEM = `Kamu MAYA, CSO Luxtradee yang jaga retensi. Kamu menulis email win-back untuk trader yang mulai pasif (belum nyatet trade 2-8 minggu).
TUJUAN: bikin dia balik LAGI nyatet trade — bukan menekan. Empati dulu, baru ajakan ringan 1 langkah kecil (upload 1 jurnal / buka dashboard).

GAYA WAJIB: hangat, personal, singkat (maks 120 kata body), tanpa guilt-trip berlebihan, 1 CTA jelas.
FORMAT OUTPUT WAJIB JSON MURNI (tanpa markdown fence):
{"subject": "...", "body": "...", "html_body": "<p>...</p>..."}`

const MAYA_RUBRIC = `- Tidak terdengar seperti blast mass-production (jangan "Kami menyadari..." kaku).
- Ada 1 insight nyata kenapa trader berhenti nyatet (malu SL banyak, sibuk, lupa) — empatik.
- CTA 1 langkah kecil & spesifik (bukan "kunjungi website kami" generik).
- Maks 120 kata; subjek <60 karakter & tidak clickbait palsu.`

async function agentMaya(admin: SupabaseClient, dry: boolean): Promise<AgentResult> {
  // Data riil: profil + waktu aktivitas terakhir tiap user
  const profiles = await fetchAllRows<{ id: string; email: string | null }>(
    (from, to) => admin.from('profiles').select('id, email').range(from, to),
  )
  const since60 = new Date(Date.now() - 60 * 86400_000).toISOString()
  const tradeRows = await fetchAllRows<{ user_id: string | null; created_at: string }>(
    (from, to) => admin.from('trades').select('user_id, created_at').gte('created_at', since60).range(from, to),
  )
  const lastActive = new Map<string, number>()
  for (const t of tradeRows) {
    if (!t.user_id) continue
    const ts = new Date(t.created_at).getTime()
    if (!lastActive.has(t.user_id) || ts > (lastActive.get(t.user_id) || 0)) lastActive.set(t.user_id, ts)
  }

  const now = Date.now()
  const D7 = 7 * 86400_000
  const D60 = 60 * 86400_000
  let activeCount = 0
  const passiveUsers: Array<{ id: string; email: string; idleDays: number }> = []
  for (const p of profiles) {
    if (!p.email) continue
    const last = lastActive.get(p.id) || 0
    if (last && now - last < D7) activeCount++
    const idleDays = last ? Math.floor((now - last) / 86400_000) : -1
    if (idleDays >= 14 && now - last < D60) passiveUsers.push({ id: p.id, email: p.email, idleDays })
  }
  const totalWithEmail = profiles.filter(p => p.email).length
  const passiveCount = passiveUsers.length
  const activeRatio = totalWithEmail ? Math.round((activeCount / totalWithEmail) * 100) : 0

  // Cooldown anti-spam: yang baru di-winback 14 hari terakhir tidak diganggu
  const targets: typeof passiveUsers = []
  for (const u of [...passiveUsers].sort((a, b) => b.idleDays - a.idleDays)) {
    const lastWb = await kvGet(admin, `winback:${u.email.toLowerCase()}`)
    if (lastWb && now - new Date(lastWb).getTime() < 14 * 86400_000) continue
    targets.push(u)
    if (targets.length >= 2) break
  }

  const snapshot = { totalUsers: totalWithEmail, activeCount, passiveCount, activeRatio, targets: targets.map(t => t.email) }
  if (dry) return skipResult('Maya', `dry-run — snapshot: ${activeCount}/${totalWithEmail} aktif (7 hari), ${passiveCount} pasif 14-60 hari, ${targets.length} kandidat win-back`, snapshot)
  if (!targets.length) {
    return okResult('Maya', `tidak ada target win-back baru (${passiveCount} pasif, semua dalam cooldown / tidak ada pasif)`, snapshot)
  }

  const lessons = await officeRecallLessons(admin, 'Maya')
  const ac = await actorCritic('Maya', {
    system: MAYA_SYSTEM + (lessons.length ? `\n\n${lessonsBlock(lessons)}` : ''),
    user: `DATA RIIL: ${activeCount} dari ${totalWithEmail} user aktif 7 hari terakhir (${activeRatio}%). Ada ${passiveCount} user pasif (2-8 minggu tidak nyatet).
Email ini dikirim personal via Resend ke ${targets.length} trader pasif — greeting netral tanpa nama (dikirim massal).

Tulis 1 email win-back.`,
    rubric: MAYA_RUBRIC,
    maxTokens: 700,
    temperature: 0.8,
    passScore: 7,
    maxRevisions: 1,
  })
  if (!ac) return errResult('Maya', 'LLM tidak tersedia — email win-back tidak dibuat', snapshot)

  const parsed = extractJson<{ subject?: string; body?: string; html_body?: string }>(ac.text)
  if (!parsed?.subject || !parsed?.html_body) {
    return errResult('Maya', `JSON email tidak valid (model ${ac.model})`, snapshot)
  }

  // Kontrak payload SAMA dengan /api/execute-action (SEND_WINBACK_EMAIL)
  const { error: insErr } = await admin.from('ai_pending_actions').insert({
    agent_name: 'Maya',
    action_type: 'SEND_WINBACK_EMAIL',
    action_payload: {
      target_emails: targets.map(t => t.email),
      subject: clip(parsed.subject, 150),
      html_body: String(parsed.html_body),
      body_plain: clip(parsed.body || '', 1500),
      context: { activeCount, passiveCount, activeRatio, idleDays: targets.map(t => t.idleDays) },
    },
    status: 'pending',
  })
  if (insErr) {
    return skipResult('Maya', `draf jadi (critic ${ac.score < 0 ? 'n/a' : `${ac.score}/10`}) tapi gagal disimpan: ${clip(insErr.message, 140)}`,
      { ...snapshot, subject: parsed.subject })
  }
  for (const t of targets) await kvSet(admin, `winback:${t.email.toLowerCase()}`, new Date().toISOString())

  return okResult('Maya', `rasio aktif ${activeRatio}% (${activeCount}/${totalWithEmail}) — ${targets.length} email win-back nunggu ACC Bos (critic ${ac.score < 0 ? 'n/a' : `${ac.score}/10`})`,
    { ...snapshot, criticScore: ac.score, subject: clip(parsed.subject, 90) })
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 💼 AGEN 5 — BAGAS (COO · Monetization & Leads)
 * ═══════════════════════════════════════════════════════════════════════════ */

const BAGAS_SYSTEM = `Kamu BAGAS, COO Luxtradee — closer ulung. Kamu menulis email konversi PRO untuk free user PALING AKTIF (sudah ketagihan pakai produk, tinggal ditawarin upgrade).
PRO = analisa AI unlimited dari jurnal mereka (harga Rp49.000/bulan — boleh disebut, jangan hard-sell).

GAYA WAJIB: santai khas anak SMC/ICT, respect dulu ke kerajinan mereka, angkat pain point (nyatet manual makan waktu), CTA tegas. Maks 130 kata body.
FORMAT OUTPUT WAJIB JSON MURNI (tanpa markdown fence):
{"subject": "...", "personalized_message": "...", "html_body": "<p>...</p>..."}`

const BAGAS_RUBRIC = `- Buka dengan apresiasi SPESIFIK (aktivitas tinggi), bukan "Semoga email ini menemukanmu dengan baik".
- Ada 1 angka konkret pain vs gain (waktu nyatet manual vs analisa otomatis).
- Sebut harga Rp49.000/bulan sekali, natural.
- CTA tunggal yang tegas; maks 130 kata.`

async function agentBagas(admin: SupabaseClient, dry: boolean): Promise<AgentResult> {
  const since7 = new Date(Date.now() - 7 * 86400_000).toISOString()
  const tradeRows = await fetchAllRows<{ user_id: string | null }>(
    (from, to) => admin.from('trades').select('user_id').gte('created_at', since7).range(from, to),
  )
  const counts = new Map<string, number>()
  for (const t of tradeRows) if (t.user_id) counts.set(t.user_id, (counts.get(t.user_id) || 0) + 1)

  const profiles = await fetchAllRows<{ id: string; email: string | null; full_name?: string | null; is_pro?: boolean | null }>(
    (from, to) => admin.from('profiles').select('id, email, full_name, is_pro').range(from, to),
  )
  const hot = profiles
    .filter(p => p.email && !p.is_pro && (counts.get(p.id) || 0) > 0)
    .map(p => ({ id: p.id, email: p.email as string, name: p.full_name || (p.email as string).split('@')[0], trades7d: counts.get(p.id) || 0 }))
    .sort((a, b) => b.trades7d - a.trades7d)

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

  const targets = hot.filter(l => !contacted.has(l.email.toLowerCase()) && !contacted.has(l.id)).slice(0, 2)
  const snapshot = { hotLeads: hot.length, contactedRecently: contacted.size, targets: targets.map(t => t.email) }
  if (dry) return skipResult('Bagas', `dry-run — ${hot.length} hot lead terdeteksi, ${targets.length} kandidat tanpa cooldown`, snapshot)
  if (!targets.length) return okResult('Bagas', 'tidak ada hot lead baru (semua dalam cooldown / belum ada free user aktif)', snapshot)

  const lessons = await officeRecallLessons(admin, 'Bagas')
  const ac = await actorCritic('Bagas', {
    system: BAGAS_SYSTEM + (lessons.length ? `\n\n${lessonsBlock(lessons)}` : ''),
    user: `DATA RIIL hot leads (1 email personal per lead via Resend — sebut aktivitas lead paling aktif): ${targets.map(t => `${t.name} (${t.trades7d} trades/7hr)`).join(', ')}.

Tulis 1 email konversi PRO.`,
    rubric: BAGAS_RUBRIC,
    maxTokens: 750,
    temperature: 0.8,
    passScore: 7,
    maxRevisions: 1,
  })
  if (!ac) return errResult('Bagas', 'LLM tidak tersedia — email konversi tidak dibuat', snapshot)

  const parsed = extractJson<{ subject?: string; personalized_message?: string; html_body?: string }>(ac.text)
  if (!parsed?.subject || !parsed?.html_body) {
    return errResult('Bagas', `JSON email tidak valid (model ${ac.model})`, snapshot)
  }

  // Kontrak payload SAMA dengan /api/execute-action (SEND_UPGRADE_OFFER)
  const { error: insErr } = await admin.from('ai_pending_actions').insert({
    agent_name: 'Bagas',
    action_type: 'SEND_UPGRADE_OFFER',
    action_payload: {
      target_emails: targets.map(t => t.email),
      subject: clip(parsed.subject, 150),
      personalized_message: clip(parsed.personalized_message || parsed.html_body, 1200),
      html_body: String(parsed.html_body),
      context: targets.map(t => ({ email: t.email, trades7d: t.trades7d })),
    },
    status: 'pending',
  })
  if (insErr) {
    return skipResult('Bagas', `draf jadi (critic ${ac.score < 0 ? 'n/a' : `${ac.score}/10`}) tapi gagal disimpan: ${clip(insErr.message, 140)}`,
      { ...snapshot, subject: parsed.subject })
  }

  return okResult('Bagas', `${targets.length} draf email konversi PRO siap (${targets.map(t => `${t.name}: ${t.trades7d} trades/7hr`).join(', ')}) — nunggu ACC Bos`,
    { ...snapshot, criticScore: ac.score, subject: clip(parsed.subject, 90) })
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 💰 AGEN 6 — PUTRI (CFO · Hardcoded Financial Math + Kuota API)
 * MRR = matematika MURNI di kode (bukan LLM — anti halusinasi finansial).
 * ═══════════════════════════════════════════════════════════════════════════ */

async function agentPutri(admin: SupabaseClient, dry: boolean): Promise<AgentResult> {
  // ── MRR: PRO AKTIF = is_pro=true & pro_expiry belum lewat (null = lifetime)
  let proCount = 0, lifetimeCount = 0, expiredCount = 0, freeCount = 0
  try {
    const profiles = await fetchAllRows<{ is_pro?: boolean | null; pro_expiry?: string | null }>(
      (from, to) => admin.from('profiles').select('is_pro, pro_expiry').range(from, to),
    )
    const now = Date.now()
    for (const p of profiles) {
      if (!p.is_pro) { freeCount++; continue }
      if (!p.pro_expiry) { proCount++; lifetimeCount++; continue } // lifetime aktif selamanya
      if (new Date(p.pro_expiry).getTime() > now) { proCount++; continue }
      expiredCount++
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return errResult('Putri', `gagal hitung profiles: ${clip(msg, 140)}`)
  }

  const priceMonthly = parseInt((await envVal('PRO_MONTHLY_PRICE_IDR')) || '49000', 10) || 49000
  const mrrIdr = proCount * priceMonthly // lifetime TIDAK masuk MRR (one-time) — dilaporkan terpisah

  // ── Kuota API: LLM hari ini (counter agent_kv kumulatif + run ini) & email 24 jam
  const day = wibDateStr()
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
    quotas,
    risk429,
  }
  if (dry) return skipResult('Putri', `dry-run — MRR est. Rp${mrrIdr.toLocaleString('id-ID')} (${proCount} PRO aktif), kuota LLM hari ini ${llmToday}/${orLimit}`, data)

  const mrrTxt = `Rp${mrrIdr.toLocaleString('id-ID')}`
  const summary = risk429.length
    ? `MRR est. ${mrrTxt} (${proCount} PRO × Rp${priceMonthly.toLocaleString('id-ID')}) — ⚠️ kuota ${risk429.join(', ')} mendekati limit 429!`
    : `MRR est. ${mrrTxt} (${proCount} PRO aktif × Rp${priceMonthly.toLocaleString('id-ID')}, ${lifetimeCount} lifetime) — kuota aman`
  return okResult('Putri', summary, data)
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 📊 AGEN 7 — DEWI (Data Analyst · Trading Insight)
 * Statistik emosi vs profit dihitung DI KODE (angka riil), LLM hanya narasi.
 * ═══════════════════════════════════════════════════════════════════════════ */

async function agentDewi(admin: SupabaseClient, dry: boolean): Promise<AgentResult> {
  const since14 = new Date(Date.now() - 14 * 86400_000).toISOString()
  const trades = await fetchAllRows<{ emotion?: string | null; profit_loss?: number | null }>(
    (from, to) => admin.from('trades').select('emotion, profit_loss').gte('created_at', since14).range(from, to),
  )

  interface EmoAgg { n: number; wins: number; totalPL: number }
  const byEmotion = new Map<string, EmoAgg>()
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
  }

  const r2 = (n: number) => Math.round(n * 100) / 100
  const emotionStats = [...byEmotion.entries()]
    .map(([emotion, a]) => ({ emotion, trades: a.n, winrate: Math.round((a.wins / a.n) * 100), avgPL: r2(a.totalPL / a.n), totalPL: r2(a.totalPL) }))
    .sort((a, b) => b.totalPL - a.totalPL)

  const meaningful = emotionStats.filter(e => e.trades >= 3)
  const bestEmotion = meaningful[0] || null
  const worstEmotion = meaningful.length > 1 ? meaningful[meaningful.length - 1] : null

  const stats = {
    tradesAnalyzed: analyzed,
    winrate: analyzed ? Math.round((wins / analyzed) * 100) : 0,
    totalPL: r2(totalPL),
    expectancy: analyzed ? r2(totalPL / analyzed) : 0,
    bestEmotion,
    worstEmotion,
    emotionStats: emotionStats.slice(0, 8),
  }

  if (dry) return skipResult('Dewi', `dry-run — ${analyzed} trades 14 hari teranalisa, winrate ${stats.winrate}%`, stats)
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
    { maxTokens: 420, temperature: 0.6 })

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

  return okResult('Dewi', `insight siap dari ${analyzed} trade (winrate ${stats.winrate}%, P/L total ${stats.totalPL})`,
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

async function agentAlexander(admin: SupabaseClient, results: AgentResult[], runMeta: { runId: string; durationMs: number }): Promise<AgentResult> {
  const raka = results.find(r => r.agent === 'Raka')
  const p1Alarm = !!(raka?.data && (raka.data as { alarm?: boolean }).alarm)

  // Prioritas Next Best Action (fallback deterministik kalau LLM gagal)
  let nbaHint = 'Review antrean ACC di Dashboard Alexander — konten & email siap ditinjau'
  if (p1Alarm) nbaHint = 'PERBAIKI CELAH KEAMANAN P1 SEKARANG — tutup/protect route yang terbuka'
  else if (results.some(r => r.agent === 'Farhan' && r.status === 'error')) nbaHint = 'Cek OPENROUTER_API_KEY & kuota — artikel SEO hari ini gagal dibuat'
  else if (results.some(r => r.agent === 'Bagas' && r.status === 'ok')) nbaHint = 'ACC email konversi PRO Bagas — hot lead tidak bisa ditunggu lama'

  const reportJson = JSON.stringify(
    results.map(r => ({ agent: r.agent, status: r.status, summary: r.summary, data: r.data ? clip(JSON.stringify(r.data), 700) : undefined })),
    null, 1,
  )

  let briefing = buildBriefingFallback(results, nbaHint)
  let aiModel = 'fallback-deterministik'
  const res = await callAgent('Alexander', ALEX_SYSTEM,
    `LAPORAN KARYAWAN (run ${runMeta.runId}, ${Math.round(runMeta.durationMs / 1000)}s, ${quotaTracker.llmCalls} panggilan LLM):\n${clip(reportJson, 6500)}\n\n${ANTI_HALUSINASI}`,
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
  })

  // ── Kirim ke Discord (non-kritis — gagal tidak menjatuhkan run) ──
  const lines = results.map(r => `${statusIcon(r)} ${ICONS[r.agent] || '•'} **${r.agent}**: ${clip(r.summary, 140)}`)
  const quotaLine = `🧮 LLM run ini: ${quotaTracker.llmCalls} panggilan (${Object.entries(quotaTracker.perAgent).map(([k, v]) => `${k} ${v}`).join(', ') || '0'})`
  const header = `👔 **MORNING BRIEFING — Luxtradee AI Workforce**\n📅 ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })} · ${briefing.mood}\n\n${briefing.ringkasan}\n\n`
  const footer = `\n\n🎯 **NEXT BEST ACTION: ${briefing.next_best_action.judul}**\n→ ${briefing.next_best_action.langkah || briefing.next_best_action.alasan}\n\n${quotaLine}`
  const content = clip(header + lines.join('\n') + footer, 1900)

  let discordSent = false
  let discordError = ''
  const sent = await sendDiscordNotification(content)
  discordSent = sent.ok
  if (!sent.ok) discordError = sent.error || 'unknown'

  // Alarm P1 dikirim terpisah biar mencolok di channel
  let alarmSent: boolean | null = null
  if (p1Alarm) {
    const alarmMsg = `@here 🚨 **ALARM DARURAT (P1) — RAKA/CTO**\n${clip((raka!.data as { alarmMessage?: string }).alarmMessage || 'Celah keamanan terdeteksi', 500)}\n\n👉 Tutup route / set CRON_SECRET sekarang. Detail: run ${runMeta.runId}.`
    const sentAlarm = await sendDiscordNotification(alarmMsg)
    alarmSent = sentAlarm.ok
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

  // ── CEO fanned-in: agregasi SEMUA hasil → briefing → Discord ──
  let ceo: AgentResult | null = null
  if (!dry && want('alexander') && results.length > 0) {
    ceo = await agentAlexander(admin, results, { runId, durationMs: Date.now() - startedAt }).catch(e => errResult('Alexander', e))
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
  if (!(await envVal('OPENROUTER_API_KEY'))) hints.push('OPENROUTER_API_KEY belum diset — semua agen konten hanya jalan template/skip')
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
