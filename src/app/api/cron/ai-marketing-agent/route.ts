import { NextRequest, NextResponse } from 'next/server'
import { getCronAdmin, isMissingTableError } from '@/lib/cron-supabase'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { callLLM, extractJson, getLLMProviderName } from '@/lib/ai-llm'
import { sendTelegramNotification } from '@/lib/telegram'

/**
 * GET /api/cron/ai-marketing-agent
 *
 * 🤖 Karyawan AI — Content Marketer (Human-in-the-Loop)
 *
 * Flow:
 *   1. Ambil snapshot performa audiens TikTok (saat ini: data statis/dummy
 *      — nanti tinggal ganti sumber ke API analytics asli)
 *   2. LLM menganalisa pola konten yang menang di audiens tersebut
 *   3. LLM membuat 3 ide konten TikTok (edukasi trading + promosi Luxtradee)
 *      Format per ide: { hook, script, caption, cta }
 *   4. Simpan draf ke `ai_pending_tasks` status 'pending' (1 baris per run,
 *      idempotent — tidak dobel jika cron jalan 2x di hari yang sama)
 *   5. Notif Telegram ke owner
 *
 * Auth: Bearer CRON_SECRET (skip jika secret belum diset — konsisten
 * dengan route cron lain). Params: ?dry=true untuk preview tanpa menulis DB.
 */

export const dynamic = 'force-dynamic'

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization')?.replace('Bearer ', '')
  const cronSecret = (await getEnvVar('CRON_SECRET')) || process.env.CRON_SECRET
  // P0 hardening: FAIL-CLOSED — tanpa secret, DITOLAK di produksi (dulu: allow).
  if (!cronSecret) return process.env.NODE_ENV === 'development'
  return authHeader === cronSecret
}

// ─── Snapshot audiens TikTok (DUMMY/STATIS — sumber analytics asli menyusul) ──
// Nanti diganti dengan fetch ke TikTok API / sheet manual admin.
const AUDIENCE_SNAPSHOT = {
  period: '30 hari terakhir',
  followers: 12400,
  followerGrowth: '+890 (+7.7%)',
  totalViews: 482000,
  avgViewDurationSec: 14.2,
  profileVisits: 6100,
  bioLinkClicks: 1420,
  audience: {
    topCountry: 'Indonesia (82%)',
    ageRange: '18-24 (44%), 25-34 (38%)',
    gender: 'Laki-laki 76%',
    activeHoursWib: '19:00-23:00',
  },
  topVideos: [
    { topic: 'Cara mark liquidity SMC di XAUUSD', views: 98000, retentionPct: 58, likes: 7400 },
    { topic: 'Kena stop loss terus? Cek ini (ICT killzone)', views: 74500, retentionPct: 52, likes: 5900 },
    { topic: 'Prop firm: jangan do ini biar nggak kena breach', views: 61000, retentionPct: 49, likes: 4300 },
    { topic: 'Journaling 5 detik pakai screenshot (Luxtradee)', views: 38500, retentionPct: 61, likes: 3200 },
    { topic: 'Mental trap trader pemula: revenge trading', views: 27200, retentionPct: 41, likes: 1900 },
  ],
  worstVideo: { topic: 'Vlog harian trader', views: 4100, retentionPct: 18 },
}

// ─── AI prompts ────────────────────────────────────────────────────────────
const MKT_SYSTEM_PROMPT = `Kamu adalah Content Marketer senior untuk Luxtradee — aplikasi trading journal berbasis screenshot (auto-extract entry, RR, setup, hasil) yang populer di kalangan trader SMC/ICT Indonesia.

Tugasmu: analisa data performa audiens TikTok, lalu buat 3 ide konten TikTok baru yang punya peluang viral tinggi berdasarkan pola yang TERBUKTI menang di data.

Aturan konten:
- Campuran: minimal 2 ide edukasi trading (SMC/ICT/prop firm) yang di dalamnya dijahit promosi Luxtradee secara natural, 1 ide boleh promosi lebih langsung
- Bahasa Indonesia kasual gaya anak trader, hook harus bikin berhenti scroll di 1-2 detik pertama
- Script ditulis untuk video 30-60 detik, format narasi siap baca (bukan poin-poin kosong)
- Sebut fitur Luxtradee yang relevan: upload screenshot auto-journal, tracking RR & winrate, guard prop firm (daily drawdown alert)

Format output WAJIB JSON murni (tanpa markdown fence):
{
  "analysis": "2-4 kalimat analisa: pola apa yang bikin video top perform (topik, retention, jam aktif), dan apa yang harus dihindari",
  "ideas": [
    { "hook": "...", "script": "...", "caption": "... (dengan 2-4 hashtag)", "cta": "..." },
    { "hook": "...", "script": "...", "caption": "...", "cta": "..." },
    { "hook": "...", "script": "...", "caption": "...", "cta": "..." }
  ]
}`

function buildMktUserPrompt(snapshot: typeof AUDIENCE_SNAPSHOT): string {
  return `Data performa audiens TikTok 30 hari terakhir:

- Followers: ${snapshot.followers} (${snapshot.followerGrowth})
- Total views: ${snapshot.totalViews} | rata-rata watch: ${snapshot.avgViewDurationSec}s
- Profile visits: ${snapshot.profileVisits} | klik link di bio: ${snapshot.bioLinkClicks}
- Audiens: ${snapshot.audience.topCountry}, usia ${snapshot.audience.ageRange}, ${snapshot.audience.gender}
- Jam aktif: ${snapshot.audience.activeHoursWib}

Video TOP perform:
${snapshot.topVideos.map((v, i) => `${i + 1}. "${v.topic}" — ${v.views.toLocaleString('id-ID')} views, retensi ${v.retentionPct}%, ${v.likes.toLocaleString('id-ID')} likes`).join('\n')}

Video TERBURUK: "${snapshot.worstVideo.topic}" — ${snapshot.worstVideo.views.toLocaleString('id-ID')} views, retensi ${snapshot.worstVideo.retentionPct}%

Analisa datanya, lalu buat 3 ide konten baru. Output JSON murni sesuai format.`
}

/** Fallback template jika LLM tidak tersedia. */
function buildTemplateOutput() {
  return {
    analysis:
      'Konten edukasi SMC/ICT dengan retensi di atas 50% mendominasi (liquidity & killzone). Video yang menyentuh pain point prop firm (breach/stop loss) juga kuat. Video non-edukasi (vlog) performanya jauh di bawah — hindari. Jam terbaik posting: 19:00-23:00 WIB. Menariknya, video journaling screenshot punya retensi tertinggi (61%) meski views sedang — sinyal kuat untuk konten produk.',
    ideas: [
      {
        hook: 'Kamu mark liquidity, tapi sell side liquidity-nya aja nggak nemu? Ini salahnya.',
        script:
          'Banyak trader SMC cuma fokus cari SSL/BSL, tapi lupa satu hal: liquidity di atas equal highs sering dipakai buat sweep dulu sebelum price turun. Tunjukkan chart XAUUSD, garis equal highs, tunjukkan sweep, lalu reaksi jual. Pesan: jangan entry sebelum sweep selesai. Tutup dengan: biar nggak telat baca struktur, catat setiap setup kamu — cukup screenshot, Luxtradee auto-jurnal.',
        caption: 'Sweep dulu, baru gerak. SMC basic yang sering kelewat 📉 #smc #smartmoneyconcepts #xauusd #tradingindonesia',
        cta: 'Upload screenshot trade terakhirmu ke Luxtradee — lihat pola setup yang paling sering kamu ambil.',
      },
      {
        hook: 'Prop firm breach bukan karena skill, tapi karena lupa cek angka ini.',
        script:
          '90% breach daily drawdown terjadi karena trader nggak realtime tahu berapa sisa loss limit hari itu. Ceritakan skenario: floating -1.8% saat limit -2%, panik di news. Solusi: alert otomatis sebelum kena. Tutup dengan: Luxtradee punya prop firm guard yang ngingatin daily drawdown kamu sebelum breach.',
        caption: 'Breach $50k account gara-gara lupa cek dashboard 💀 #propfirm #ftmo #tradingjournal #discipline',
        cta: 'Aktifkan Prop Firm Guard di Luxtradee — daily drawdown alert realtime.',
      },
      {
        hook: 'Journaling itu 5 detik aja. Serius.',
        script:
          'Kebanyakan trader males journaling karena bayanginnya ribet: open spreadsheet, isi entry, exit, RR... Padahal di Luxtradee: upload screenshot → sistem baca semua otomatis → journal rapi + statistik winrate per setup. Tunjukkan demo layar 15 detik: screenshot masuk, data ter-extract. Tutup: mulai hari ini, 1 trade = 1 screenshot.',
        caption: '1 trade = 1 screenshot. Udah. 📸 #tradingjournal #smc #ict #tradingindonesia',
        cta: 'Coba upload 1 screenshot sekarang di luxtradee.web.id — gratis.',
      },
    ],
  }
}

interface TikTokIdea {
  hook: string
  script: string
  caption: string
  cta: string
}

async function generateMarketingContent(): Promise<{ analysis: string; ideas: TikTokIdea[]; provider: string; model?: string }> {
  const llm = await callLLM(MKT_SYSTEM_PROMPT, buildMktUserPrompt(AUDIENCE_SNAPSHOT), 1400)

  if (llm) {
    const parsed = extractJson<{ analysis?: string; ideas?: TikTokIdea[] }>(llm.text)
    if (parsed?.ideas && Array.isArray(parsed.ideas) && parsed.ideas.length > 0) {
      // Sanitasi + batasi 3 ide
      const ideas = parsed.ideas.slice(0, 3).map(i => ({
        hook: String(i.hook || '').substring(0, 200),
        script: String(i.script || '').substring(0, 2500),
        caption: String(i.caption || '').substring(0, 300),
        cta: String(i.cta || '').substring(0, 300),
      }))
      return {
        analysis: String(parsed.analysis || '').substring(0, 1200) || 'Analisa tidak tersedia.',
        ideas,
        provider: llm.provider,
        model: llm.model,
      }
    }
    console.warn('[ai-marketing-agent] LLM response format invalid — using template fallback')
  }
  const tpl = buildTemplateOutput()
  return { ...tpl, provider: 'template' }
}

// ─── Main handler ───────────────────────────────────────────────────────────
async function handleRequest(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dry = searchParams.get('dry') === 'true'

  const admin = await getCronAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Database unavailable (Supabase admin client gagal dibuat)' }, { status: 503 })
  }

  // 0. Guard: tabel harus sudah dibuat
  const tableCheck = await admin.from('ai_pending_tasks').select('id').limit(1)
  if (tableCheck.error) {
    if (isMissingTableError(tableCheck.error)) {
      return NextResponse.json({
        success: false,
        error: 'Tabel ai_pending_tasks belum ada di Supabase — jalankan supabase-migrations/011_create_ai_pending_tasks.sql dulu',
      }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'DB check failed: ' + tableCheck.error.message }, { status: 500 })
  }

  // 1. Idempotensi harian: kalau hari ini sudah ada task MARKETING, skip
  const startOfTodayUtc = new Date()
  startOfTodayUtc.setUTCHours(0, 0, 0, 0)
  const { data: existingToday } = await admin
    .from('ai_pending_tasks')
    .select('id')
    .eq('agent_type', 'MARKETING')
    .gte('created_at', startOfTodayUtc.toISOString())
    .limit(1)

  if (existingToday && existingToday.length > 0) {
    return NextResponse.json({
      success: true,
      created: 0,
      message: 'Task MARKETING hari ini sudah ada — skip (idempotent harian)',
    })
  }

  // 2. LLM: analisa audiens + 3 ide konten
  const provider = await getLLMProviderName()
  const content = await generateMarketingContent()

  if (dry) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      llmProvider: provider,
      analysis: content.analysis,
      ideas: content.ideas.map(i => ({ hook: i.hook, cta: i.cta })),
    })
  }

  // 3. Simpan draf ke antrean approval
  const { data: inserted, error: insertErr } = await admin
    .from('ai_pending_tasks')
    .insert({
      agent_type: 'MARKETING',
      target_user_id: null,
      context_data: {
        audienceSnapshot: AUDIENCE_SNAPSHOT,
        generatedForDate: new Date().toISOString().split('T')[0],
      },
      generated_content: {
        analysis: content.analysis,
        ideas: content.ideas,
        provider: content.provider,
        model: content.model,
        generatedAt: new Date().toISOString(),
      },
      status: 'pending',
    })
    .select('id')

  if (insertErr) {
    return NextResponse.json({ success: false, error: 'Gagal insert draft: ' + insertErr.message }, { status: 500 })
  }

  // 4. Notif Telegram ke owner
  const ideaList = content.ideas.map((i, idx) => `${idx + 1}. ${i.hook}`).join('\n')
  await sendTelegramNotification(
    `🤖 <b>AI Marketing Agent</b>\n\n🎬 ${content.ideas.length} ide konten TikTok siap (status: PENDING)\nProvider LLM: <b>${content.provider}</b>\n\n💡 Ide:\n${ideaList}\n\n👉 Review & approve di: ${process.env.NEXT_PUBLIC_APP_URL || 'https://luxtradee.web.id'}/admin/ai-staff`
  )

  return NextResponse.json({
    success: true,
    created: inserted?.length ?? 1,
    llmProvider: content.provider,
    analysis: content.analysis,
    ideas: content.ideas.map(i => i.hook),
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
    console.error('[ai-marketing-agent] Fatal:', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
