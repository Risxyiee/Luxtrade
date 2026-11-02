import { NextRequest, NextResponse } from 'next/server'
import { extractJson, callLLM } from '@/lib/ai-llm'
import { getEnvVar } from '@/lib/cloudflare-bindings'

/**
 * 🧠 POST /api/cron/video-bot — STUDIO VIDEO SINTA (CMO · Marketing & Konten).
 *
 * Ini BUKAN bot — ini meja kerja resmi karyawan Sinta di workforce
 * (Master Autonomous Workforce). Tugas sorenya (shift 20.00 WIB, job
 * "sinta-video" di master-autonomous-cron.yml):
 *   1. Endpoint ini = otak kreatifnya: menyusun SPESIFIKASI video
 *      (skrip 5 scene: teks layar ID, voiceover ID, caption + hashtag)
 *      via LLM. Fallback: spec default yang sudah teruji render.
 *   2. Runner merender video 9:16 via Remotion + voiceover edge-tts.
 *   3. Posting ke TikTok via Content Posting API (token dispenser
 *      /api/tiktok/token — secret tetap di worker).
 *
 * Auth: Bearer CRON_SECRET (fail-closed — pola master-autonomous).
 */

export const dynamic = 'force-dynamic'

interface VideoScene {
  image_prompt: string
  title: string
  sub: string
  vo: string
}

interface VideoSpec {
  topic: string
  caption: string
  hashtags: string[]
  scenes: VideoScene[]
}

const DEFAULT_SPEC: VideoSpec = {
  topic: 'Luxtrade — jurnal trading AI untuk trader XAUUSD',
  caption: 'Masih nebak-nebak harga? Luxtrade: sinyal AI + jurnal otomatis, langsung ke HP kamu. Cek link di bio 👆',
  hashtags: ['trading', 'xauusd', 'tradingindonesia', 'goldtrader', 'luxtrade'],
  scenes: [
    {
      image_prompt:
        'Dramatic dark financial trading chart with glowing golden candlesticks rising, cinematic lighting, luxurious premium fintech aesthetic, deep black background with gold accents, vertical composition, high quality, detailed',
      title: 'MASIH NEBAK-NEBAK?',
      sub: 'banyak trader kalah karena tebak-tebakan',
      vo: 'Harga naik turun, kamu masih nebak-nebak sendiri?',
    },
    {
      image_prompt:
        'Modern smartphone floating showing trading signal push notification, sleek dark premium app interface with gold and green accents, holographic chart elements around, cinematic studio lighting, vertical composition, high quality',
      title: 'LUXTRADE',
      sub: 'sinyal AI langsung ke HP kamu',
      vo: 'Kenalin, Luxtrade. Sinyal trading otomatis, langsung ke HP kamu.',
    },
    {
      image_prompt:
        'Futuristic friendly AI robot assistant analyzing multiple holographic financial screens, dark scene with warm golden glow, cinematic sci-fi style, premium tech aesthetic, vertical composition, high quality, detailed',
      title: '8 AGEN AI',
      sub: 'pantau pasar 24 jam nonstop',
      vo: 'Delapan agen AI pantau pasar dua puluh empat jam, nonstop.',
    },
    {
      image_prompt:
        'Relaxed young trader smiling at night holding smartphone with green profit chart glow on face, luxurious dark room with golden ambient lighting, cinematic photography, vertical composition, high quality',
      title: 'TINGGAL EKSEKUSI',
      sub: 'alert masuk, kamu tinggal eksekusi',
      vo: 'Alert masuk, kamu tinggal eksekusi. Tanpa drama.',
    },
    {
      image_prompt:
        'Elegant luxurious dark background with floating golden particles and soft golden light rays, premium minimal branding backdrop, subtle depth, cinematic, vertical composition, high quality',
      title: 'LUXTRADE',
      sub: 'mulai trading lebih tenang hari ini',
      vo: 'Luxtrade. Trading lebih tenang mulai hari ini. Cek link di bio!',
    },
  ],
}

const SYSTEM_PROMPT = `Kamu SINTA, CMO Luxtradee — spesialis konten TikTok edukasi & psikologi trading XAUUSD untuk trader Indonesia (jurnal trading AI, PRO Rp49.000/bulan).
Bikin skrip video vertikal yang bikin jempol BERHENTI scroll: hook provokatif, isi nyindir kebiasaan buruk trader, tutup dengan CTA.
Durasi ±17 detik, 5 scene × ±3,8 detik.

ATURAN KERAS:
- Scene 1 = HOOK 3 detik: pertanyaan/pain point yang bikin jempol berhenti.
- Bahasa Indonesia santai (seperti trader senior ngobrol), TANPA janji profit pasti / "auto cuan" / klaim hasil — DILARANG menjanjikan keuntungan.
- Setiap scene: image_prompt (EN, deskriptif, tema dark-luxury + gold, tanpa teks dalam gambar), title (ID, MAKS 22 karakter, HURUF BESAR, tanpa tanda baca kecuali ?), sub (ID, maks 42 karakter), vo (ID, maks 120 karakter, dikatakan natural — angka ditulis dengan huruf).
- caption maks 200 karakter, menggoda klik, 1 CTA "cek link di bio".
- 4-5 hashtag relevan trading Indonesia.

FORMAT OUTPUT WAJIB JSON MURNI (tanpa markdown fence):
{"topic":"...","caption":"...","hashtags":["..."],"scenes":[{"image_prompt":"...","title":"...","sub":"...","vo":"..."}]}`

function validSpec(s: VideoSpec | null): s is VideoSpec {
  if (!s || typeof s !== 'object') return false
  if (typeof s.caption !== 'string' || s.caption.length < 10) return false
  if (!Array.isArray(s.hashtags) || s.hashtags.length < 2) return false
  if (!Array.isArray(s.scenes) || s.scenes.length < 3 || s.scenes.length > 6) return false
  return s.scenes.every(
    sc =>
      sc &&
      typeof sc.image_prompt === 'string' && sc.image_prompt.length > 20 &&
      typeof sc.title === 'string' && sc.title.length > 0 && sc.title.length <= 30 &&
      typeof sc.sub === 'string' &&
      typeof sc.vo === 'string' && sc.vo.length > 3,
  )
}

function sanitizeSpec(s: VideoSpec): VideoSpec {
  return {
    topic: String(s.topic || DEFAULT_SPEC.topic).slice(0, 120),
    caption: String(s.caption).slice(0, 900),
    hashtags: s.hashtags.slice(0, 6).map(h => String(h).replace(/^#/, '').replace(/[^A-Za-z0-9_]/g, '')).filter(Boolean),
    scenes: s.scenes.slice(0, 6).map(sc => ({
      image_prompt: String(sc.image_prompt).slice(0, 600),
      title: String(sc.title).slice(0, 30),
      sub: String(sc.sub).slice(0, 60),
      vo: String(sc.vo).slice(0, 160),
    })),
  }
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const secret = (await getEnvVar('CRON_SECRET', { quiet: true })) || process.env.CRON_SECRET || ''
  if (!secret) return process.env.NODE_ENV === 'development'
  const provided = request.headers.get('authorization')?.replace('Bearer ', '') || ''
  return provided === secret
}

async function handle(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { topic?: string }
  const topicHint = (body.topic || '').slice(0, 200)

  const userPrompt =
    `Buat skrip video TikTok baru untuk Luxtradee hari ini.${topicHint ? ` Sudut/tema khusus: ${topicHint}.` : ''}\n` +
    'Variasikan hook-nya dari video sebelumnya — jangan selalu "masih nebak-nebak".'

  let spec: VideoSpec | null = null
  let source = 'default'
  try {
    const res = await callLLM(SYSTEM_PROMPT, userPrompt, 1100)
    if (res?.text) {
      const parsed = extractJson<VideoSpec>(res.text)
      if (validSpec(parsed)) {
        spec = sanitizeSpec(parsed)
        source = 'llm'
      }
    }
  } catch {
    // LLM gagal → spec default
  }

  if (!spec) spec = DEFAULT_SPEC

  const captionFull = `${spec.caption} ${spec.hashtags.map(h => `#${h}`).join(' ')}`.trim()

  return NextResponse.json({
    success: true,
    source,
    spec: { ...spec, caption: captionFull },
    note: 'Render di runner oleh job "sinta-video" (master-autonomous-cron.yml): Remotion 9:16 + edge-tts. Posting: /api/tiktok/token → init FILE_UPLOAD.',
  })
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
