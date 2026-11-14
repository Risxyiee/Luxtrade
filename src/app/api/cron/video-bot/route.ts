import { NextRequest, NextResponse } from 'next/server'
import { extractJson, callLLM, getLastLLMDiag } from '@/lib/ai-llm'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { getCronAdmin } from '@/lib/cron-supabase'
import {
  aggregatePerf,
  pickAngleAndTopic,
  pickFallbackSpec,
  pickTemplateSmart,
  type Angle,
  type PerfSnapshot,
  type Template,
  type TopicEntry,
} from '@/lib/sinta-brain'

/**
 * 🧠 POST /api/cron/video-bot — STUDIO VIDEO SINTA (CMO · Marketing & Konten)
 * ───────────────────────────────────────────────────────────────────────────
 * v3 — GABUNGAN TikTok + Instagram (permintaan Bos):
 *   Tugas karyawan Sinta sekarang SATU pipeline dua platform: video Remotion
 *   yang sama dirender runner (GitHub Actions) lalu:
 *     • TikTok  → Content Posting API (job sinta-video) — kalau app approved
 *     • Instagram Reels → /api/cron/ig-video-post (18–19 WIB, Senin–Jumat;
 *       sementara SEMUA hari IG dulu — TikTok belum approved)
 *
 * v3 — OTAKNYA MAKAN DATA KONTEN ASLI (bukan lagi spekulasi):
 *   1. tiktok_posts        → video TikTok Bos yang TERBUKTI perform (views/likes)
 *   2. AUDIENCE_SNAPSHOT   → profil audiens 30 hari (jam aktif 19–23 WIB dst)
 *   3. instagram_posts     → caption Reels terakhir (biar topik TIDAK dobel)
 *   4. pine_alert_log      → sinyal XAUUSD ASLI (ENTRY→TP/SL) untuk recap
 *                            autentik — ANGKA TIDAK PERNAH DIKARANG.
 *
 * TEMPLATE (dipilih worker secara deterministik, LLM menulis isinya):
 *   'promo'  → komposisi LuxtradePromo (5 scene produk)
 *   'tip'    → komposisi SintaReels (kinetic typography edukasi — BARU)
 *   'signal' → komposisi SignalRecap (chart animasi + entry/SL/TP — BARU,
 *              hanya kalau ada sinyal asli < 48 jam)
 *
 * Output spec diperkaya:
 *   { template, scenes:[{kind,title,sub,vo}], caption (TikTok),
 *     hashtags, igCaption (Instagram ≤1800 + 8–12 hashtag), signal? }
 *
 * Auth: Bearer CRON_SECRET (fail-closed — pola master-autonomous).
 */

export const dynamic = 'force-dynamic'

/* ============================================================
   Tipe
   ============================================================ */

type SceneKind = 'hook' | 'point' | 'chart' | 'quote' | 'stat' | 'cta'
type CarouselSlideKind = 'cover' | 'point' | 'chart' | 'stat' | 'quote' | 'cta'

interface VideoScene {
  kind?: SceneKind
  title: string
  sub: string
  vo: string
  image_prompt?: string
}

/** Slide carousel IG 1080×1350 — dirender runner via renderStill SintaCarousel. */
interface CarouselSlideSpec {
  kind?: CarouselSlideKind
  title: string
  sub: string
}

interface CarouselSpec {
  slides: CarouselSlideSpec[]
}

interface SignalData {
  symbol: string
  symbolLabel: string
  side: 'LONG' | 'SHORT'
  entry: number
  sl: number | null
  tp: number | null
  exit: number
  result: 'TP' | 'SL'
  changePct: number
  closedAt: string
}

interface VideoSpec {
  template: Template
  topic: string
  caption: string
  hashtags: string[]
  igCaption: string
  scenes: VideoScene[]
  /** Carousel IG wajib — konten Sinta HANYA video Remotion + carousel (aturan Bos). */
  carousel: CarouselSpec | null
  signal?: SignalData | null
}

/* ============================================================
   Data konten asli (Supabase — gagal → kosong, tetap jalan)
   ============================================================ */

interface TikTokRow { url: string; caption: string | null; views: number; likes: number; comments: number }
interface IgRow { caption: string | null; published_at: string }
interface SignalRow { symbol: string | null; signal_type: string; price: number | null; created_at: string }

const AUDIENCE_SNAPSHOT = {
  period: '30 hari terakhir',
  followers: 12400,
  followerGrowth: '+890 (+7.7%)',
  totalViews: 482000,
  avgViewDurationSec: 14.2,
  bioLinkClicks: 1420,
  audience: {
    topCountry: 'Indonesia (82%)',
    ageRange: '18-24 (44%), 25-34 (38%)',
    gender: 'Laki-laki 76%',
    activeHoursWib: '19:00-23:00',
  },
}

async function fetchTopTikToks(admin: NonNullable<Awaited<ReturnType<typeof getCronAdmin>>>): Promise<TikTokRow[]> {
  try {
    const { data, error } = await admin
      .from('tiktok_posts')
      .select('url,caption,views,likes,comments')
      .order('views', { ascending: false })
      .limit(5)
    if (error || !data) return []
    return data as TikTokRow[]
  } catch {
    return []
  }
}

async function fetchRecentIgCaptions(admin: NonNullable<Awaited<ReturnType<typeof getCronAdmin>>>): Promise<string[]> {
  try {
    const { data, error } = await admin
      .from('instagram_posts')
      .select('caption,published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(12)
    if (error || !data) return []
    return (data as IgRow[]).map((r) => (r.caption || '').slice(0, 120)).filter(Boolean)
  } catch {
    return []
  }
}

/**
 * SINTA BRAIN v4 — topik & hook 14 run terakhir (office_memory).
 * Dipakai utk daftar "jangan ulangi" + pemilihan topik baru.
 */
interface SintaRunRow { content?: { hook?: string; topic?: string } }

async function fetchSintaRecentRuns(
  admin: NonNullable<Awaited<ReturnType<typeof getCronAdmin>>>,
): Promise<{ topic: string; hook: string }[]> {
  try {
    const { data } = await admin
      .from('office_memory')
      .select('content')
      .eq('agent_name', 'Sinta')
      .eq('memory_type', 'lesson')
      .order('created_at', { ascending: false })
      .limit(14)
    return ((data || []) as SintaRunRow[])
      .map((r) => ({ topic: String(r?.content?.topic || ''), hook: String(r?.content?.hook || '') }))
      .filter((x) => x.topic || x.hook)
  } catch { return [] }
}

/**
 * PERFORMA KONTEN 30 hari — dari meta.metrics instagram_posts
 * (diisi /api/cron/ig-metrics). Fail-open: belum ada data → null.
 */
async function fetchSintaPerf(
  admin: NonNullable<Awaited<ReturnType<typeof getCronAdmin>>>,
): Promise<PerfSnapshot | null> {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await admin
      .from('instagram_posts')
      .select('meta,published_at')
      .eq('status', 'published')
      .gte('published_at', since)
      .limit(60)
    const rows = (data || []) as { meta?: Record<string, unknown> | null; published_at?: string | null }[]
    const perf = aggregatePerf(rows)
    return perf.samplePosts > 0 ? perf : null
  } catch { return null }
}

/**
 * Rekonstruksi sinyal ASLI terakhir dari pine_alert_log:
 * cari exit (TAKE_PROFIT/STOP_LOSS) terbaru, lalu entry
 * (ENTRY_LONG/ENTRY_SHORT) terdekat sebelum itu dgn simbol sama.
 */
async function fetchLatestSignal(admin: NonNullable<Awaited<ReturnType<typeof getCronAdmin>>>): Promise<SignalData | null> {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await admin
      .from('pine_alert_log')
      .select('symbol,signal_type,price,created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(80)
    if (error || !data?.length) return null

    const rows = data as SignalRow[]
    const exitIdx = rows.findIndex((r) => r.signal_type === 'TAKE_PROFIT' || r.signal_type === 'STOP_LOSS')
    if (exitIdx === -1) return null
    const exit = rows[exitIdx]
    const exitPrice = Number(exit.price || 0)
    if (!exitPrice || exitPrice <= 0) return null

    const entry = rows
      .slice(exitIdx + 1)
      .find((r) => (r.signal_type === 'ENTRY_LONG' || r.signal_type === 'ENTRY_SHORT') && r.symbol === exit.symbol)
    if (!entry) return null
    const entryPrice = Number(entry.price || 0)
    if (!entryPrice || entryPrice <= 0) return null

    const side: 'LONG' | 'SHORT' = entry.signal_type === 'ENTRY_LONG' ? 'LONG' : 'SHORT'
    const result: 'TP' | 'SL' = exit.signal_type === 'TAKE_PROFIT' ? 'TP' : 'SL'
    const changePct = side === 'LONG'
      ? ((exitPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - exitPrice) / entryPrice) * 100

    const rawSymbol = (exit.symbol || 'XAUUSD').toUpperCase()
    const symbolLabel = rawSymbol.includes('XAU') ? 'GOLD (XAUUSD)' : rawSymbol

    return {
      symbol: rawSymbol,
      symbolLabel,
      side,
      entry: entryPrice,
      sl: null,
      tp: null,
      exit: exitPrice,
      result,
      changePct: Math.round(changePct * 100) / 100,
      closedAt: exit.created_at,
    }
  } catch {
    return null
  }
}

/** Sinyal masih "buah segar" untuk direcap (≤ 48 jam). */
function isFreshSignal(s: SignalData | null): s is SignalData {
  if (!s) return false
  const t = Date.parse(s.closedAt)
  return Number.isFinite(t) && Date.now() - t <= 48 * 60 * 60 * 1000
}

/* ============================================================
   Pemilihan template + ANGLE + TOPIK → pindah ke src/lib/sinta-brain.ts
   (Sinta Brain v4: 11 angle, 24 topik, anti-kembar 10 run, A/B performa)
   ============================================================ */

/* ============================================================
   Fallback spec → FALLBACK_LIBRARY 7 spec variatif di src/lib/sinta-brain.ts
   (dulu cuma 2 spec hardcoded — itu biang "kontennya itu-itu mulu"
   saat semua provider LLM mati)
   ============================================================ */

/** Recap dari sinyal ASLI — narasi generik, angka 100% data. */
function buildSignalSpec(signal: SignalData): VideoSpec {
  const win = signal.result === 'TP'
  const pctText = `${signal.changePct > 0 ? '+' : ''}${signal.changePct.toFixed(2)}%`
  return {
    template: 'signal',
    topic: `Recap sinyal asli ${signal.symbolLabel} ${signal.side} — ${resultLabel(signal.result)}`,
    caption: win
      ? `${signal.side} ${signal.symbolLabel} → ${resultLabel(signal.result)} ${pctText} ✅ Sinyal dari Luxtrade, dieksekusi telat tetap keburu. Cek link di bio`
      : `${signal.side} ${signal.symbolLabel} ke ${resultLabel(signal.result)} ${pctText}. Disiplin SL = bagian dari sistem. Cek link di bio`,
    hashtags: ['xauusd', 'goldtrader', 'smc', 'tradingindonesia', 'luxtrade'],
    igCaption:
      `📊 RECAP SINYAL ASLI — ${signal.symbolLabel} ${signal.side}\n\n` +
      `Entry  : ${signal.entry.toLocaleString('id-ID', { minimumFractionDigits: 2 })}\n` +
      `Exit   : ${signal.exit.toLocaleString('id-ID', { minimumFractionDigits: 2 })}\n` +
      `Hasil  : ${resultLabel(signal.result)} ${pctText} ${win ? '✅' : '🛡️'}\n\n` +
      (win
        ? 'Setup ini terdeteksi otomatis oleh engine Luxtrade — alert Entry/SL/TP masuk langsung ke layar HP, tinggal eksekusi.\n\n'
        : 'SL kena itu bagian dari sistem — yang penting risiko kecil, winner lebih besar. Semua tercatat otomatis di jurnal.\n\n') +
      'Mau sinyal seperti ini masuk ke HP kamu? Cek link di bio 🔗\n\n' +
      '#xauusd #goldtrader #smc #smartmoneyconcepts #tradingindonesia #tradingsignal #priceaction #tradingjournal #forexindonesia #luxtrade',
    carousel: null, // diisi otomatis oleh withCarousel() — fallback dari scenes
    signal,
    scenes: [
      { kind: 'hook', title: win ? 'TP KEBELI 🎯' : 'DISIPLIN SL 🛡️', sub: `sinyal ${signal.side} ${signal.symbolLabel} dari engine luxtrade`, vo: win ? `Take profit kebeli. Sinyal ${signal.side} gold dari engine Luxtrade.` : `Stop loss nyala sesuai rencana. Ini sinyal ${signal.side} gold dari Luxtrade.` },
      { kind: 'chart', title: signal.side === 'LONG' ? 'LONG SEJAK ENTRY' : 'SHORT SEJAK ENTRY', sub: `entry ${signal.entry.toLocaleString('id-ID')} → exit ${signal.exit.toLocaleString('id-ID')}`, vo: `Entry di ${signal.entry.toLocaleString('id-ID', { minimumFractionDigits: 2 })}, keluar di ${signal.exit.toLocaleString('id-ID', { minimumFractionDigits: 2 })}.` },
      { kind: 'stat', title: `${pctText}`, sub: win ? 'hasil per gerakan ini — tercatat otomatis di jurnal' : 'risiko terkendali — SL jalan sesuai rencana', vo: win ? `Hasilnya ${pctText.replace('%', ' persen')}. Tercatat otomatis di jurnal.` : `Risikonya terkendali, ${pctText.replace('%', ' persen')}. SL jalan sesuai rencana.` },
      { kind: 'cta', title: 'MAU SINYAL KE HP?', sub: 'alert entry/sl/tp otomatis ke HP — link di bio', vo: 'Mau sinyal begini masuk ke layar HP kamu? Cek link di bio.' },
    ],
  }
}

function resultLabel(r: 'TP' | 'SL'): string {
  return r === 'TP' ? 'TP HIT' : 'SL HIT'
}

/* ============================================================
   LLM — menulis isi sesuai template yang dipilih worker
   ============================================================ */

const SYSTEM_PROMPT = `Kamu SINTA, CMO Luxtradee — spesialis konten video trader Indonesia (jurnal trading AI, PRO Rp49.000/bulan, audiens SMC/ICT XAUUSD).
Konten vertikal yang bikin jempol BERHENTI scroll: hook provokatif 1-2 detik pertama, isi nyindir kebiasaan buruk trader, tutup CTA.

REFERENSI GAYA DARI BOS (reel FB Sans Traders — patokan selera Bos, TIRU STRUKTURNA, brand tetap Luxtradee):
- Hook = pertanyaan empati 1 baris yang menyapa pain lalu kasih janji tenang ("Ketinggalan breakout? Tenang, harga sering balik dulu. Namanya RETEST.").
- SATU konsep teknikal sederhana per konten (contoh: RETEST / support-resistance) — jangan campur banyak konsep.
- Alur konsep dijelaskan 3-4 langkah emoji-bullet (🔁✅🛑❌) — di video = 3-4 scene point yang nge-step, di carousel = slide per langkah.
- Akhiri dgn janji SERI ("Seri Trader Pemula Luxtradee bagian X") + disclaimer edukasi 1 baris ("Konten edukasi, bukan ajakan transaksi. Trading berisiko tinggi.").
- Referensi asli: https://www.facebook.com/share/r/1Dg6ykHFCp/?mibextid=wwXIfr

KEMANDIRIAN (amanat Bos: "harus pintar, berpikir sendiri, menemukan solusi sendiri, belajar sendiri"):
- BERPIKIR KRITIS: analisa data di bawah dulu (top video + audiens + pelajaran run sebelumnya) SEBELUM menulis. Pilih sudut/angle paling menohok dari bukti — jangan menunggu perintah detail.
- BELAJAR: kalau ada bagian "PELAJARAN RUN SEBELUMNYA", wajib mengikuti instruksi koreksinya (hindari hook/topik/kesalahan yang disebut). Jangan pernah mengulang hook yang persis sama dgn Reels terakhir.
- SOLUSI SENDIRI: kalau data minim/kosong, pakai pola yang terbukti di industri (pain point prop firm, SMC/ICT edukasi) dan tetap output spec valid — JANGAN menyerah/menolak.
- SIRI DIRI: sebelum output, cek ulang: hook ≤22 char? vo natural dibaca? angka sinyal PERSIS? carousel saveable? Output yang tidak lolos cekmu sendiri = gagal.

ATURAN BENTUK KONTEN (HARD RULE dari Bos):
- KONTEN LUXTRADEE HANYA 2 BENTUK: (1) video Remotion 9:16 (Reels IG / TikTok), (2) carousel Instagram 1080×1350 multi-slide. DILARANG usulkan bentuk lain (vlog, livestream, meme, foto stok, teks polos) — itu bukan tugasmu.
- Satu output = SATU topik dalam DUA bentuk sekaligus: scenes video + slides carousel dari topik yang sama.

KAMU MENERIMA: (1) data performa asli (top video TikTok + profil audiens + rata-rata performa IG per template), (2) template yang SUDAH DIPILIH sistem ('promo' | 'tip' | 'signal'), (3) ANGLE + TOPIK HARI INI hasil riset sistem — WAJIB diikuti.
TUGASMU: tulis 4-5 scene utk template itu DENGAN ANGLE & TOPIK yang ditugaskan, plus caption TikTok (pendek), caption Instagram (panjang), dan 4-6 slide carousel.

ATURAN KERAS:
- IKUTI TUGASAN ANGLE & TOPIK: konten hari ini WAJIB membahas topik yang ditugaskan dengan sudut (angle) yang ditugaskan. Hook WAJIB memvariasikan salah satu pola hook angle tsb (boleh dimodifikasi, JANGAN salin mentah).

ATURAN 3 DETIK PERTAMA (DATA BOS 11 NOV: 163 views, cuma 13% lolos 3 detik, rata-rata nonton 2 detik — video lama MULAI GELAP & PELAN = mati):
- Detik 0-1 WAJIB: title hook menghajar + sub (subtitle di layar) SUDAH TERBACA. Penonton scroll TANPA SUARA — jangan simpan konteks penting di VO saja; sub = subtitle wajib, bukan pelengkap.
- DILARANG hook yang butuh setup/dengan pembukaan pelan. Kata pertama VO LANGSUNG INTI — "hai guys", "di video ini", "pernah ga sih" = GAGAL.
- VO scene pertama maksimal 120 karakter dan habis di bawah 6 detik.
- Scene penutup (cta): sub WAJIB berisi 1 PERTANYAAN SPESIFIK yang gampang dijawab komen (mis. "kamu sering loss jam berapa? komen", "tim buy atau sell?") — bukan cuma "cek link di bio". Pertanyaan = komentar = distribusi.

- Bahasa Indonesia santai gaya anak trader. TANPA janji profit/auto cuan. Angka sinyal (entry/exit/%) HARUS dipakai PERSIS seperti data yang diberikan — DILARANG mengarang/mengubah angka.
- Setiap scene: kind (hook|point|chart|quote|stat|cta — scene pertama WAJIB 'hook', terakhir WAJIB 'cta'), title (ID, MAKS 22 karakter, HURUF BESAR), sub (ID, maks 42 karakter), vo (ID, maks 120 karakter, natural — angka dibaca dengan huruf).
- Tiru POLA yang terbukti menang di data (topik/angle dari top video), TAPI JANGAN mengulang topik yang dilarang di daftar "jangan ulangi".
- VARIASI LINGUISTIK: jangan mulai hook dengan kata/frasa yang sama dengan daftar "jangan ulangi"; ganti struktur kalimat (pertanyaan / pernyataan / angka / perintah) dibanding run sebelumnya.
- caption TikTok ≤ 200 karakter + 1 CTA "cek link di bio" + 1 pertanyaan spesifik buat komen (2 kalimat terakhir).
- igCaption Instagram: 500-1200 karakter, storytelling + poin bernomor/emoji, CTA, 8-12 hashtag relevan trading Indonesia.
- 4-5 hashtag untuk TikTok.
- Carousel: 4-6 slides. Slide pertama kind='cover' (hook, TANPA vo), slide terakhir kind='cta' (ajak save/share + cek link di bio), slide tengah kind 'point'|'chart'|'stat'|'quote'. Isi carousel = versi SAVEABLE dari topik video (poin-poin padat layak disave user), BUKAN salinan mentah scene video. title ≤ 40 karakter, sub ≤ 90 karakter.

FORMAT OUTPUT WAJIB JSON MURNI (tanpa markdown fence):
{"topic":"...","scenes":[{"kind":"hook","title":"...","sub":"...","vo":"..."}],"caption":"...","hashtags":["..."],"igCaption":"...","carousel":{"slides":[{"kind":"cover","title":"...","sub":"..."}]}}`

function buildUserPrompt(opts: {
  template: Template
  signal: SignalData | null
  topTikToks: TikTokRow[]
  recentIg: string[]
  recentHooks: string[]
  lessons: string[]
  angle: Angle | null
  topic: TopicEntry | null
  perf: PerfSnapshot | null
  approved: { hook: string; script: string; caption: string; cta: string } | null
}): string {
  const { template, signal, topTikToks, recentIg, recentHooks, lessons, angle, topic, perf, approved } = opts
  const lines: string[] = []

  lines.push(`Template terpilih: ${template.toUpperCase()}${template === 'signal' ? ' — recap sinyal ASLI (pakai data persis di bawah)' : ''}.`)
  lines.push('')

  if (approved) {
    lines.push('— SKRIP PILIHAN BOS (draf yang Bos ACC pagi ini di Kantor CEO) —')
    lines.push('INILAH INTI VIDEO HARI INI. Hook, alur masalah→refleksi→CTA, dan caption DIBAWA DARI SKRIP BOS DI BAWAH — ubah hanya penyesuaian kecil ke format scene (panjang teks/vo), JANGAN ganti tema/hook/angle. Angle & topik dari sistem diabaikan bila bertabrakan.')
    lines.push(`Hook   : ${approved.hook}`)
    lines.push(`Skrip  : ${approved.script}`)
    if (approved.caption) lines.push(`Caption: ${approved.caption}`)
    if (approved.cta) lines.push(`CTA    : ${approved.cta}`)
    lines.push('')
  }

  if (angle && topic) {
    lines.push('— ANGLE & TOPIK HARI INI (tugasan sistem — WAJIB diikuti) —')
    lines.push(`Angle     : ${angle.label}`)
    lines.push(`Cara      : ${angle.guidance}`)
    lines.push('Pola hook (variasikan salah satu — boleh dimodifikasi):')
    angle.hookPatterns.forEach((p) => lines.push(`  • ${p}`))
    lines.push(`Topik     : ${topic.topic}`)
    lines.push('')
  }

  lines.push('— DATA KONTEN ASLI (tiktok_posts, urut views) —')
  if (topTikToks.length) {
    topTikToks.forEach((t, i) => {
      lines.push(`${i + 1}. "${(t.caption || '(tanpa caption)').slice(0, 90)}" — ${Number(t.views).toLocaleString('id-ID')} views, ${Number(t.likes).toLocaleString('id-ID')} likes`)
    })
  } else {
    lines.push('(tabel tiktok_posts masih kosong — pakai pola umum: edukasi SMC/ICT + pain point prop firm paling perform)')
  }
  lines.push('')
  lines.push('— PROFIL AUDIENS 30 HARI —')
  lines.push(`Followers ${AUDIENCE_SNAPSHOT.followers} (${AUDIENCE_SNAPSHOT.followerGrowth}) · total views ${AUDIENCE_SNAPSHOT.totalViews.toLocaleString('id-ID')} · rata watch ${AUDIENCE_SNAPSHOT.avgViewDurationSec}s · klik bio ${AUDIENCE_SNAPSHOT.bioLinkClicks}`)
  lines.push(`Audiens: ${AUDIENCE_SNAPSHOT.audience.topCountry}, ${AUDIENCE_SNAPSHOT.audience.ageRange}, ${AUDIENCE_SNAPSHOT.audience.gender} · jam aktif ${AUDIENCE_SNAPSHOT.audience.activeHoursWib} WIB`)
  lines.push('')
  if (recentIg.length || recentHooks.length) {
    lines.push('— JANGAN ULANGI (hook & caption run sebelumnya — topik/hook/struktur kalimat HARUS beda) —')
    recentHooks.filter(Boolean).forEach((h) => lines.push(`• HOOK: ${String(h).slice(0, 100)}`))
    recentIg.forEach((c) => lines.push(`• ${c}`))
    lines.push('')
  }
  if (lessons.length) {
    lines.push('— PELAJARAN RUN SEBELUMNYA (office_memory Sinta — WAJIB DIIKUTI) —')
    lessons.forEach((l, i) => lines.push(`${i + 1}. ${l}`))
    lines.push('')
  }
  if (perf && perf.samplePosts > 0) {
    lines.push('— PERFORMA KONTEN IG 30 HARI (belajar dari data asli — mana yang rame) —')
    Object.entries(perf.byTemplate).forEach(([tpl, p]) => {
      lines.push(`${tpl}: ${p.posts} konten · rata-rata ${p.avgViews.toFixed(0)} views · ${p.avgLikes.toFixed(0)} likes · ${p.avgSaves.toFixed(0)} saves`)
    })
    /* Level angle (baru): Sinta lihat angle mana yang rame — bukan cuma template. */
    const angleEntries = Object.entries(perf.byAngle || {})
    if (angleEntries.length) {
      lines.push('Performa per angle:')
      angleEntries.forEach(([ang, p]) => {
        lines.push(`  • ${ang}: ${p.posts} konten · rata-rata ${p.avgViews.toFixed(0)} views`)
      })
      if (perf.winnerAngle) lines.push(`→ ANGLE TERBAIK sejauh ini: "${perf.winnerAngle}" — pola menangnya WAJIB ditiru (ritme hook, gaya penyampaian), tanpa menyalin kalimat.`)
      if (perf.flopAngles?.length) lines.push(`→ ANGLE SEPI (hindari gayanya): ${perf.flopAngles.join(', ')} — konten dgn angle ini kemarin dilihat jauh di bawah rata-rata.`)
    }
    if (perf.winner) {
      lines.push(`→ Template pemenang sejauh ini: ${perf.winner.toUpperCase()}. Pertahankan pola kontennya (ritme, panjang hook, gaya CTA) — TAPI topik & angle TETAP dari tugasan hari ini.`)
    } else {
      lines.push('→ Data masih sedikit — konten ini ikut serta eksperimen A/B; buat sekuat mungkin.')
    }
    lines.push('')
  }
  if (template === 'signal' && signal) {
    lines.push('— DATA SINYAL ASLI (WAJIB dipakai persis) —')
    lines.push(JSON.stringify({
      symbol: signal.symbol,
      side: signal.side,
      entry: signal.entry,
      exit: signal.exit,
      result: signal.result,
      changePct: signal.changePct,
    }))
    lines.push('')
  }
  lines.push('Tulis skrip sekarang. Output JSON murni sesuai format.')
  return lines.join('\n')
}

function validSpec(s: VideoSpec | null, template: Template): s is VideoSpec {
  if (!s || typeof s !== 'object') return false
  if (typeof s.caption !== 'string' || s.caption.length < 10) return false
  if (!Array.isArray(s.hashtags) || s.hashtags.length < 2) return false
  const ig = typeof s.igCaption === 'string' ? s.igCaption : ''
  if (ig.length < 60) return false
  if (!Array.isArray(s.scenes) || s.scenes.length < 3 || s.scenes.length > 6) return false
  const scenesOk = s.scenes.every(
    (sc) =>
      sc &&
      typeof sc.title === 'string' && sc.title.length > 0 && sc.title.length <= 30 &&
      typeof sc.sub === 'string' &&
      typeof sc.vo === 'string' && sc.vo.length > 3 &&
      (!sc.kind || ['hook', 'point', 'chart', 'quote', 'stat', 'cta'].includes(sc.kind)),
  )
  // carousel opsional dari LLM — kalau tidak valid, fallback from-scenes di sanitize
  const carouselOk =
    !s.carousel ||
    (Array.isArray(s.carousel.slides) &&
      s.carousel.slides.length >= 4 &&
      s.carousel.slides.every((sl) => sl && typeof sl.title === 'string' && sl.title.length > 0))
  return scenesOk && carouselOk && (template !== 'signal' || !!s.signal)
}

function sanitizeSpec(s: VideoSpec, template: Template, signal: SignalData | null): VideoSpec {
  const ALLOWED: SceneKind[] = ['hook', 'point', 'chart', 'quote', 'stat', 'cta']
  const scenes = s.scenes.slice(0, 6).map((sc, i, arr) => {
    const kind = sc.kind && ALLOWED.includes(sc.kind)
      ? sc.kind
      : i === 0 ? 'hook' : i === arr.length - 1 ? 'cta' : 'point'
    return {
      kind: kind as SceneKind,
      title: String(sc.title).slice(0, 30),
      sub: String(sc.sub).slice(0, 60),
      vo: String(sc.vo).slice(0, 160),
    }
  })
  // Paksa scene pertama hook & terakhir cta (aturan komposisi)
  if (scenes.length >= 2) {
    scenes[0].kind = 'hook'
    scenes[scenes.length - 1].kind = 'cta'
  }
  return {
    template,
    topic: String(s.topic || '').slice(0, 140),
    caption: String(s.caption).slice(0, 900),
    hashtags: s.hashtags.slice(0, 6).map((h) => String(h).replace(/^#/, '').replace(/[^A-Za-z0-9_]/g, '')).filter(Boolean),
    igCaption: String(s.igCaption || '').slice(0, 1900),
    scenes,
    carousel: null, // diisi withCarousel() di handler — satu jalur utk semua sumber
    signal: template === 'signal' ? signal : null,
  }
}

/* ============================================================
   Carousel IG — WAJIB di setiap spec (aturan Bos: konten HANYA
   video Remotion + carousel). Kalau LLM tidak memberi carousel
   valid → bangun dari scenes (cover = scene 0, isi = tengah,
   cta = scene terakhir) supaya DUA bentuk konten selalu ada.
   ============================================================ */

const CAROUSEL_PAD: CarouselSlideSpec[] = [
  { kind: 'point', title: 'JURNAL OTOMATIS', sub: 'upload screenshot → entry, RR & hasil kecatat sendiri' },
  { kind: 'stat', title: 'WINRATE PER SETUP', sub: 'tahu pola yang beneran cuan — bukan feeling' },
  { kind: 'quote', title: 'DISIPLIN > PREDIKSI', sub: 'sistem yang konsisten ngalahin tebakan yang bagus' },
]

function buildCarouselFromScenes(spec: VideoSpec): CarouselSpec {
  const sc = spec.scenes
  const MID: CarouselSlideKind[] = ['point', 'chart', 'stat', 'quote']
  const mids: CarouselSlideSpec[] = sc
    .slice(1, Math.max(1, sc.length - 1))
    .slice(0, 3)
    .map((s, i) => ({
      kind: (MID.includes(s.kind as CarouselSlideKind) ? s.kind : MID[(i + 1) % MID.length]) as CarouselSlideKind,
      title: s.title,
      sub: s.sub,
    }))
  let pad = 0
  while (mids.length < 3) {
    mids.push(CAROUSEL_PAD[pad % CAROUSEL_PAD.length])
    pad++
  }
  return {
    slides: [
      { kind: 'cover', title: sc[0]?.title || 'LUXTRADE', sub: sc[0]?.sub || 'sinyal AI + jurnal otomatis buat trader Indonesia' },
      ...mids,
      { kind: 'cta', title: sc[sc.length - 1]?.title || 'MULAI SEKARANG', sub: 'screenshot → jurnal otomatis — cek link di bio' },
    ],
  }
}

function sanitizeCarousel(raw: CarouselSpec | null | undefined, spec: VideoSpec): CarouselSpec {
  const ALLOWED: CarouselSlideKind[] = ['cover', 'point', 'chart', 'stat', 'quote', 'cta']
  let slides = Array.isArray(raw?.slides) ? raw!.slides : []
  slides = slides
    .slice(0, 6)
    .filter((sl) => sl && typeof sl.title === 'string' && sl.title.trim().length > 0)
    .map((sl, i, arr) => ({
      kind: (sl.kind && ALLOWED.includes(sl.kind) ? sl.kind : i === 0 ? 'cover' : i === arr.length - 1 ? 'cta' : 'point') as CarouselSlideKind,
      title: String(sl.title).trim().slice(0, 40),
      sub: String(sl.sub || '').trim().slice(0, 90),
    }))
  if (slides.length >= 2) {
    slides[0].kind = 'cover'
    slides[slides.length - 1].kind = 'cta'
  }
  // Kurang dari 4 slide → buang, pakai fallback dari scenes (deterministik)
  if (slides.length < 4) return buildCarouselFromScenes(spec)
  return { slides }
}

/* ============================================================
   Handler
   ============================================================ */

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const secret = (await getEnvVar('CRON_SECRET', { quiet: true })) || process.env.CRON_SECRET || ''
  if (!secret) return process.env.NODE_ENV === 'development'
  const provided = request.headers.get('authorization')?.replace('Bearer ', '') || ''
  return provided === secret
}

/* ── BELAJAR MANDIRI SINTA (office_memory) ───────────────────────
   Baca pelajaran 7 run terakhir → diinjeksi ke prompt. Tulis pelajaran
   baru tiap run (apa yang dibuat, pakai otak siapa, apa datanya) supaya
   run berikutnya punya kontinuitas — bukan amnesia tiap hari.
   Fail-open: tabel belum ada / RLS → tetap jalan tanpa memori. */
async function fetchSintaLessons(admin: Awaited<ReturnType<typeof getCronAdmin>>): Promise<string[]> {
  if (!admin) return []
  try {
    const { data } = await admin
      .from('office_memory')
      .select('content')
      .eq('agent_name', 'Sinta')
      .eq('memory_type', 'lesson')
      .order('created_at', { ascending: false })
      .limit(7)
    return ((data || []) as { content?: { lesson?: string } }[])
      .map((r) => r?.content?.lesson)
      .filter((x): x is string => typeof x === 'string' && x.length > 3)
  } catch { return [] }
}

async function writeSintaMemory(admin: Awaited<ReturnType<typeof getCronAdmin>>, content: Record<string, unknown>): Promise<void> {
  if (!admin) return
  try {
    await admin.from('office_memory').insert({ agent_name: 'Sinta', memory_type: 'lesson', content })
  } catch { /* fail-open — pembelajaran tidak boleh menggagalkan produksi konten */ }
}

/* ── SKRIP PILIHAN BOS (agent_kv `sinta:approved_script`) ───────────
   FIX kekurangan Sinta (7 Nov): draf skrip yang Bos ACC pagi ini di
   /kantor-ceo dulu CUMA jadi pajangan — studio sore bikin skrip sendiri.
   Kini: kalau Bos sudah ACC skrip hari ini (atau kemarin), video-bot
   WAJIB menjadikannya inti video (hook, alur, CTA dari Bos). One-shot:
   sekali dipakai ditandai `sinta:approved_script_used` supaya skrip lama
   tidak disuntik berulang minggu depan. Fail-open: KV gagal → jalan
   normal tanpa skrip Bos. */
interface ApprovedScript {
  approvedAt?: string
  approvedDay?: string
  actionId?: string
  title?: string
  analysis?: string
  drafts?: Array<{ hook?: string; script?: string; caption?: string; cta?: string }>
}

const APPROVED_SCRIPT_KEY = 'sinta:approved_script'
const APPROVED_SCRIPT_USED_KEY = 'sinta:approved_script_used'

async function fetchApprovedScript(
  admin: NonNullable<Awaited<ReturnType<typeof getCronAdmin>>>,
): Promise<{ hook: string; script: string; caption: string; cta: string; approvedDay: string; idOrAt: string } | null> {
  try {
    const { data } = await admin.from('agent_kv').select('value').eq('key', APPROVED_SCRIPT_KEY).maybeSingle()
    const raw = (data as { value?: string } | null)?.value
    if (!raw) return null
    const parsed = JSON.parse(raw) as ApprovedScript
    const draft = parsed?.drafts?.find((d) => d?.hook && d?.script)
    if (!draft) return null
    // Segar? Hanya ACC hari ini / kemarin WIB — skrip lama tidak disuntik lagi.
    const day = parsed.approvedDay || String(parsed.approvedAt || '').slice(0, 10)
    const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() + 7 * 3600_000 - 86400_000).toISOString().slice(0, 10)
    if (day !== today && day !== yesterday) return null
    // One-shot: tanda pakai = `hariWIB|actionId|approvedAt` — cocok persis dgn
    // ACC yang sama; kalau Bos ACC skrip BARU di hari sama, tetap bisa dipakai.
    const idOrAt = String(parsed.actionId || parsed.approvedAt || day)
    const { data: used } = await admin.from('agent_kv').select('value').eq('key', APPROVED_SCRIPT_USED_KEY).maybeSingle()
    const usedRaw = (used as { value?: string } | null)?.value || ''
    if (usedRaw.split('\n').some((line) => line.includes(day) && line.includes(idOrAt))) return null
    return {
      hook: String(draft.hook).slice(0, 200),
      script: String(draft.script).slice(0, 2200),
      caption: String(draft.caption || '').slice(0, 400),
      cta: String(draft.cta || '').slice(0, 200),
      approvedDay: day,
      idOrAt,
    }
  } catch { return null }
}

async function markApprovedScriptUsed(
  admin: NonNullable<Awaited<ReturnType<typeof getCronAdmin>>>,
  s: { approvedDay: string; idOrAt: string } | null,
): Promise<void> {
  if (!s) return
  try {
    const { data } = await admin.from('agent_kv').select('value').eq('key', APPROVED_SCRIPT_USED_KEY).maybeSingle()
    const prev = (data as { value?: string } | null)?.value || ''
    const stamp = `${s.approvedDay}|${s.idOrAt}|${new Date().toISOString()}`
    const next = `${prev ? `${prev}\n` : ''}${stamp}`.slice(-1500) // simpan ±15 entri terakhir
    await admin.from('agent_kv').upsert({ key: APPROVED_SCRIPT_USED_KEY, value: next }, { onConflict: 'key' })
  } catch { /* non-kritis */ }
}

async function handle(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { topic?: string; template?: string }
  const topicHint = (body?.topic || '').slice(0, 200)

  /* ── 1) Data konten asli + memori jangka panjang (semua best-effort) ── */
  const admin = await getCronAdmin()
  const topTikToks = admin ? await fetchTopTikToks(admin) : []
  const recentIg = admin ? await fetchRecentIgCaptions(admin) : []
  const latestSignal = admin ? await fetchLatestSignal(admin) : null
  const lessons = admin ? await fetchSintaLessons(admin) : []
  const recentRuns = admin ? await fetchSintaRecentRuns(admin) : []
  const perf = admin ? await fetchSintaPerf(admin) : null
  /* FIX kekurangan Sinta: skrip yang Bos ACC pagi ini (agent_kv) dipakai
     WAJIB sebagai inti video sore — draf Bos bukan pajangan lagi. */
  const approvedScript = admin ? await fetchApprovedScript(admin) : null

  /* ── 2) SINTA BRAIN v4: template + ANGLE + TOPIK hari ini ──
     Anti "itu-itu mulu": tiap hari dapat angle & topik beda yang belum
     dipakai 10 run terakhir; template diarahkan performa (70% pemenang,
     30% eksperimen A/B). Override manual dari body tetap dihormati. */
  const freshSignal = isFreshSignal(latestSignal)
  const override = body?.template as Template | undefined
  const chosen = pickTemplateSmart(freshSignal, perf)
  const template: Template =
    override === 'promo' || override === 'tip' || override === 'signal'
      ? override
      : chosen.template
  const templateReason = override
    ? 'override manual (body.template)'
    : chosen.reason
  const signal = template === 'signal' ? latestSignal : null
  const effectiveTemplate: Template = template === 'signal' && !signal ? 'tip' : template

  const recentTopics = [
    ...recentRuns.map((r) => r.topic),
    ...recentRuns.map((r) => r.hook),
    ...recentIg,
  ].filter(Boolean)
  const assignment =
    effectiveTemplate === 'signal'
      ? null
      : pickAngleAndTopic(effectiveTemplate, recentTopics, perf)

  /* ── 3) LLM menulis isi ── */
  const userPrompt =
    buildUserPrompt({
      template: effectiveTemplate,
      signal,
      topTikToks,
      recentIg,
      recentHooks: recentRuns.map((r) => r.hook),
      lessons,
      angle: assignment?.angle ?? null,
      topic: assignment?.topic ?? null,
      perf,
      approved: approvedScript
        ? { hook: approvedScript.hook, script: approvedScript.script, caption: approvedScript.caption, cta: approvedScript.cta }
        : null,
    }) + (topicHint ? `\nSudut/tema khusus dari Bos: ${topicHint}` : '')

  // Tandai skrip Bos sudah dipakai (one-shot — dibaca & ditandai sebelum LLM
  // supaya retry runner tidak menyuntik skrip yang sama dua kali).
  if (admin) await markApprovedScriptUsed(admin, approvedScript)

  let spec: VideoSpec | null = null
  let source = 'default'
  let llmMeta: Record<string, unknown> = { provider: 'template', notes: [] as string[] }
  try {
    /* PERMINTAAN BOS: "konten remotion make api berbayar aja biar bagus"
       → otak konten Sinta pakai model Mortera PREMIUM (Sonnet — kualitas
       tulisan kelas atas, bukan Haiku). Gagal/404/saldo habis → callLLM
       otomatis jatuh ke rantai gratis (Groq/Gemini/OpenRouter) — konten
       tidak pernah hangus. Override via env MORTERA_MODEL_CONTENT. */
    const contentModel = process.env.MORTERA_MODEL_CONTENT || 'claude-sonnet-5-5'
    const res = await callLLM(SYSTEM_PROMPT, userPrompt, 1600, { morteraModel: contentModel })
    if (res?.text) {
      llmMeta = { provider: res.provider, model: res.model, notes: res.notes || [] }
      const parsed = extractJson<VideoSpec>(res.text)
      if (validSpec(parsed, effectiveTemplate)) {
        spec = sanitizeSpec(parsed, effectiveTemplate, signal)
        source = 'llm'
      } else {
        llmMeta = { ...llmMeta, note: 'output LLM tidak lolos validSpec → template' }
      }
    } else {
      // Semua provider gagal — tampilkan diagnosa rotasi (429/404/auth) di meta
      llmMeta = { provider: 'template', notes: getLastLLMDiag() }
    }
  } catch {
    // LLM gagal → spec default di bawah
    llmMeta = { provider: 'template', notes: [...getLastLLMDiag(), 'exception saat callLLM'] }
  }

  if (!spec) {
    spec = effectiveTemplate === 'signal' && signal
      ? buildSignalSpec(signal)
      : { ...pickFallbackSpec(effectiveTemplate, recentTopics), carousel: null, signal: null } as VideoSpec
  }
  // Jaga-jaga: kalau template signal tapi spec tanpa signal → fallback tip variatif
  if (spec.template === 'signal' && !spec.signal) {
    spec = { ...pickFallbackSpec('tip', recentTopics), carousel: null, signal: null } as VideoSpec
  }

  /* ── 3b) Carousel IG WAJIB (aturan Bos: konten HANYA video + carousel) ── */
  spec = { ...spec, carousel: sanitizeCarousel(spec.carousel, spec) }

  /* ── 3c) TULIS PELAJARAN utk run berikutnya (belajar mandiri) ── */
  await writeSintaMemory(admin, {
    lesson:
      source === 'llm'
        ? `Run ini: template ${spec.template} (${templateReason}),${approvedScript ? ' INTI = SKRIP ACC BOS (hook dari Bos)' : ''} angle "${assignment?.angle.label ?? 'recap sinyal'}", hook "${spec.scenes[0]?.title || '?'}", topik "${String(spec.topic || '').slice(0, 60)}". LLM: ${llmMeta.provider}/${llmMeta.model}${Array.isArray(llmMeta.notes) && llmMeta.notes.length ? ` (catatan: ${llmMeta.notes.join(' | ')})` : ''}. Run berikutnya: jangan ulang hook/topik di atas; variasikan angle & struktur kalimat.`
        : `Run ini PAKAI FALLBACK LIBRARY (LLM gagal semua provider${llmMeta.notes && Array.isArray(llmMeta.notes) ? `: ${llmMeta.notes.join(' | ')}` : ''}) — cek kesehatan GROQ/GEMINI/OPENROUTER key & kuota; kalau sudah pulih, tulis draf sendiri lagi.`,
    template: spec.template,
    hook: spec.scenes[0]?.title || '',
    topic: spec.topic || '',
    angle: assignment?.angle.id || (spec.template === 'signal' ? 'signal-recap' : ''),
    templateReason,
    source,
    pakaiSkripBos: !!approvedScript,
    llm: llmMeta,
    dataBasis: {
      tiktokTopCount: topTikToks.length,
      recentIgCount: recentIg.length,
      recentRunCount: recentRuns.length,
      freshSignal,
      perfSamples: perf?.samplePosts ?? 0,
    },
    runDate: new Date().toISOString(),
  })

  const captionFull = `${spec.caption} ${spec.hashtags.map((h) => `#${h}`).join(' ')}`.trim()

  return NextResponse.json({
    success: true,
    source,
    template: spec.template,
    templateReason,
    approvedScriptUsed: !!approvedScript,
    assignment: effectiveTemplate === 'signal'
      ? { angle: 'signal-recap', angleLabel: 'Recap sinyal autentik', topic: spec.topic || '', rationale: 'sinyal segar — struktur recap tetap' }
      : {
          angle: assignment?.angle.id ?? '',
          angleLabel: assignment?.angle.label ?? '',
          topic: assignment?.topic.topic ?? spec.topic,
          rationale: assignment?.rationale ?? '',
        },
    llm: llmMeta,
    memory: { lessonsLoaded: lessons.length, recentRuns: recentRuns.length, saved: true },
    perf: perf ? { samplePosts: perf.samplePosts, byTemplate: perf.byTemplate, winner: perf.winner, byAngle: perf.byAngle, winnerAngle: perf.winnerAngle, flopAngles: perf.flopAngles } : null,
    spec: { ...spec, caption: captionFull },
    dataBasis: {
      tiktokTopCount: topTikToks.length,
      recentIgCount: recentIg.length,
      freshSignal,
      signalSymbol: latestSignal?.symbol ?? null,
      perfSamples: perf?.samplePosts ?? 0,
    },
    note: 'Sinta Brain v4: 11 angle + 24 topik + anti-kembar 10 run + A/B performa (70% pemenang / 30% eksperimen) + skrip ACC Bos jadi inti video sore (agent_kv sinta:approved_script). Render di runner (video-bot-cron.yml): VIDEO template→LuxtradePromo|SintaReels|SignalRecap + edge-tts + musik latar; CAROUSEL→renderStill SintaCarousel (manual only). Instagram: Reels → /api/cron/ig-video-post MODE APPROVAL (draft → ai_pending_actions → ACC Bos di Kantor CEO → /api/execute-action). Performa IG disinkron /api/cron/ig-metrics (08:00 WIB). LLM rantai self-healing: Groq → Gemini → OpenRouter (free).',
  })
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
