import { NextRequest, NextResponse } from 'next/server'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { getCronAdmin } from '@/lib/cron-supabase'
import { sendAdminNotification } from '@/lib/admin-notify'
import {
  ensureFreshToken,
  postToInstagram,
  validateIgPostInput,
  IG_DAILY_CAP,
} from '@/lib/instagram'

/**
 * ============================================================
 * POST /api/cron/ig-video-post — Sinta (CMO) → Instagram Reels
 * ============================================================
 * Meja posting video karyawan Sinta: video Reels hasil render
 * Remotion (runner GitHub Actions upload MP4-nya ke host publik
 * dulu, mis. litterbox 72 jam) diposting ke IG sebagai REELS via
 * Facebook Page Graph API:
 *   POST /{page-id}/media?media_type=REELS&video_url=&caption=
 *   → poll FINISHED (1–5 menit) → /media_publish?creation_id=
 *
 * ATURAN JADWAL + ACC (permintaan Bos, update Nov 2026):
 *   • "uploud tiap jam 7-8, 1 konten aja sehari, sabtu minggu libur"
 *   • "nunggu saya acc" → DEFAULT MODE = APPROVAL:
 *       runner kirim draft → ai_pending_actions (PUBLISH_IG_REEL) →
 *       Bos ACC di Kantor CEO → Antrean Eksekusi → /api/execute-action
 *       → publish REELS. (Set env IG_AUTO_POST="true" utk mode lama)
 *   • Window posting: 19:00–20:59 WIB (runner jalan 19:10 WIB, Senin–Jumat)
 *   • Cadence: 1x/hari (guard: Reels published terakhir ≥ 20 jam lalu)
 *   • Rotasi platform dikelola runner: Sen/Rab/Jum → IG Reels,
 *     Sel/Kam → TikTok (kalau TikTok gagal/belum approved → fallback IG)
 *   ?force=true → lewati window + cadence (TIDAK melewati ACC)
 *
 * FIX 2026-11-07 "auto post IG error": GitHub Actions sering MENUNDA
 * scheduled runs berjam-jam (run nyata: jadwal 12:10 UTC = 19:10 WIB
 * dieksekusi 19:18 UTC = 02:18 WIB). Dulu: window check di paling atas
 * → video hasil render DIBUANG → antrean kosong terus ("Antrean
 * kosong" di ig-auto-post) → IG tak pernah kebagian konten.
 * Sekarang: window + cadence HANYA membatasi mode AUTO (publish
 * langsung). Mode APPROVAL selalu menyimpan draft — timing ditentukan
 * momen ACC Bos, bukan momen runner jalan.
 *
 * Flow:
 *   1. Auth CRON_SECRET (fail-closed produksi)
 *   2. Validasi input
 *   3. Mode APPROVAL: draft selalu disimpan (window/cadence tidak
 *      membuang konten lagi — catatan lateRunNote bila telat)
 *   4. Mode AUTO: window 19–21 WIB + cadence 20 jam → skipped (honest)
 *   5. ensureFreshToken (token > 55 hari → refresh otomatis 60 hari)
 *   6. Enqueue instagram_posts (media_type REELS, source sinta-video)
 *   7. Publish inline (poll sampai 6 menit). Timeout → row 'publishing'
 *      di-reclaim ig-auto-post (09:00/19:00/20:30 WIB) — tidak hilang.
 *   8. Sukses/gagal → Discord admin (dengan permalink).
 *
 * GET → status cepat: kredensial, Reels terakhir, jadwal berikutnya.
 */
export const dynamic = 'force-dynamic'

/** Jeda minimum antar Reels: 20 jam — konten IG max 1x/hari (Senin–Jumat).
 *  Dulu 44 jam (2 hari sekali); Bos minta harian: "1 konten aja sehari". */
const MIN_GAP_MS = 20 * 60 * 60 * 1000
/** Window jam WIB yang diizinkan: 19 dan 20 (permintaan Bos: jam 19–20). */
const WINDOW_HOURS_WIB = [19, 20]

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const provided = request.headers.get('authorization')?.replace('Bearer ', '')
    || request.headers.get('x-cron-secret') || ''
  const expected = (await getEnvVar('CRON_SECRET')) || process.env.CRON_SECRET
  if (!expected) return process.env.NODE_ENV === 'development'
  return provided === expected
}

/** Jam sekarang dalam WIB (UTC+7), 0–23. */
function wibHourNow(): number {
  return (new Date().getUTCHours() + 7) % 24
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = await getCronAdmin()
  if (!admin) return NextResponse.json({ error: 'Database not available' }, { status: 503 })

  const { data: lastReels } = await admin
    .from('instagram_posts')
    .select('id, caption, status, permalink, published_at, error')
    .eq('media_type', 'REELS')
    .order('created_at', { ascending: false })
    .limit(1)

  const last = lastReels?.[0] ?? null
  const lastMs = last?.published_at ? Date.parse(last.published_at) : null
  const autoPost = (await getEnvVar('IG_AUTO_POST', { quiet: true }).catch(() => null)) === 'true'
    || process.env.IG_AUTO_POST === 'true'
  return NextResponse.json({
    ok: true,
    postMode: autoPost ? 'auto' : 'approval (nunggu ACC Bos — Kantor CEO → Antrean Eksekusi)',
    windowWib: WINDOW_HOURS_WIB,
    wibHourNow: wibHourNow(),
    cadenceHours: Math.round(MIN_GAP_MS / 3_600_000),
    nextEligibleAt: lastMs ? new Date(lastMs + MIN_GAP_MS).toISOString() : null,
    lastReels: last,
  })
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const force = url.searchParams.get('force') === 'true'
  const dry = url.searchParams.get('dry') === 'true'

  const body = await request.json().catch(() => null) as {
    videoUrl?: string
    caption?: string
    template?: string
    hook?: string
  } | null
  const videoUrl = String(body?.videoUrl || '').trim()
  const caption = String(body?.caption || '').trim().slice(0, 2200)

  /* ── 1) Validasi input (paling awal — input jejak ditolak sebelum apa pun) ── */
  const invalid = validateIgPostInput({ mediaType: 'REELS', videoUrl, caption })
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  if (dry) {
    return NextResponse.json({ ok: true, dry: true, message: 'Validasi Reels lolos — tidak disimpan (?dry=true)' })
  }

  const admin = await getCronAdmin()
  if (!admin) return NextResponse.json({ error: 'Database not available' }, { status: 503 })

  /* ── 2) MODE APPROVAL (default — permintaan Bos: "nunggu saya acc") ──
     Draft SELALU disimpan walau runner jalan di luar window / cadence
     (GHA sering telat berjam-jam — dulu video dibuang sia-sia).
     ACC Bos = gerbang timing sesungguhnya. Draft disimpan di
     ai_pending_actions (PUBLISH_IG_REEL), dipublish oleh
     /api/execute-action setelah ACC. */
  const autoPost = (await getEnvVar('IG_AUTO_POST', { quiet: true }).catch(() => null)) === 'true'
    || process.env.IG_AUTO_POST === 'true'
  if (!autoPost) {
    const hour = wibHourNow()
    const offWindow = !force && !WINDOW_HOURS_WIB.includes(hour)
    /* Cap harian tetap dihormati */
    const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: pub24 } = await admin
      .from('instagram_posts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('published_at', since24)
    if ((pub24 ?? 0) >= IG_DAILY_CAP) {
      return NextResponse.json({ ok: true, skipped: `cap harian tercapai (${IG_DAILY_CAP}/24 jam)` })
    }

    /* Jangan dobel draft untuk video yang sama */
    const { data: dup } = await admin
      .from('ai_pending_actions')
      .select('id')
      .eq('action_type', 'PUBLISH_IG_REEL')
      .eq('status', 'pending')
      .contains('action_payload', { videoUrl })
      .limit(1)
    if (dup?.length) {
      return NextResponse.json({
        ok: true,
        awaitingApproval: true,
        skipped: 'draft Reels ini sudah ada di Antrean ACC (tidak diduplikat)',
        actionId: dup[0].id,
      })
    }

    const { data: action, error: actErr } = await admin
      .from('ai_pending_actions')
      .insert({
        agent_name: 'Sinta',
        action_type: 'PUBLISH_IG_REEL',
        action_payload: {
          videoUrl,
          caption,
          template: body?.template || 'reels',
          hook: body?.hook || '',
          renderNote: 'remotion 9:16 + musik latar — ACC Bos → publish REELS',
          requestedWib: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
          ...(offWindow ? { lateRunNote: `Runner jalan di luar window (${hour}:00 WIB, jadwal 19–21 WIB — kemungkinan delay antrean GitHub Actions). Draft tetap disimpan — ACC Bos menentukan momen tayang.` } : {}),
        },
        status: 'pending',
      })
      .select('id')
      .single()
    if (actErr || !action) {
      return NextResponse.json({
        error: `Gagal simpan draft ACC (jalankan migrasi 015_create_ai_pending_actions.sql di Supabase?): ${actErr?.message || '?'}`,
      }, { status: 500 })
    }

    await sendAdminNotification(
      `📸⏳ <b>Sinta: draft Reels siap — menunggu ACC Bos</b>\n` +
      `${caption ? caption.slice(0, 200) + (caption.length > 200 ? '…' : '') + '\n' : ''}` +
      `🎬 Preview: ${videoUrl}\n` +
      `✅ ACC di: Kantor CEO → Antrean Eksekusi\n` +
      `⏰ ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`
    ).catch(() => {})

    return NextResponse.json({
      ok: true,
      awaitingApproval: true,
      mode: 'approval',
      actionId: (action as { id: string }).id,
      ...(offWindow ? { note: `Draft tersimpan walau runner telat (${hour}:00 WIB) — konten tidak hangus. ACC Bos di Kantor CEO → Antrean Eksekusi.` } : {}),
      note2: 'Konten TIDAK diposting sampai Bos ACC (Kantor CEO → Antrean Eksekusi). Set env IG_AUTO_POST=true untuk mode otomatis.',
    })
  }

  /* ── 3) MODE AUTO: window 19–20 WIB + cadence 1x/hari (kecuali force) ── */
  const hourAuto = wibHourNow()
  if (!force && !WINDOW_HOURS_WIB.includes(hourAuto)) {
    return NextResponse.json({
      ok: true,
      skipped: `di luar window posting (${hourAuto}:00 WIB — jadwal 19:00–20:59 WIB)`,
    })
  }
  if (!force) {
    const { data: recent } = await admin
      .from('instagram_posts')
      .select('id, published_at')
      .eq('media_type', 'REELS')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1)
    const lastMs = recent?.[0]?.published_at ? Date.parse(recent[0].published_at) : null
    if (lastMs && Date.now() - lastMs < MIN_GAP_MS) {
      const jamLalu = ((Date.now() - lastMs) / 3_600_000).toFixed(1)
      return NextResponse.json({
        ok: true,
        skipped: `cadence 1x/hari (jeda 20 jam) — Reels terakhir baru ${jamLalu} jam lalu`,
        nextEligibleAt: new Date(lastMs + MIN_GAP_MS).toISOString(),
      })
    }
  }

  try {
    /* ── 4) Token segar (auto-refresh > 55 hari) ── */
    const tok = await ensureFreshToken(admin)
    if (!tok.cfg) {
      return NextResponse.json({
        ok: true,
        skipped: 'FACEBOOK_PAGE_ID / FACEBOOK_PAGE_TOKEN belum diset — fitur IG nonaktif (isi di Cloudflare secrets / .env)',
      })
    }

    /* Cap harian keamanan */
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await admin
      .from('instagram_posts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('published_at', since)
    if ((count ?? 0) >= IG_DAILY_CAP) {
      return NextResponse.json({ ok: true, skipped: `cap harian tercapai (${IG_DAILY_CAP}/24 jam)` })
    }

    /* ── 5) Enqueue (riwayat + retry otomatis oleh ig-auto-post) ── */
    const { data: inserted, error: insErr } = await admin
      .from('instagram_posts')
      .insert({
        media_type: 'REELS',
        video_url: videoUrl,
        caption,
        status: 'pending',
        source: 'sinta-video',
        meta: {
          template: body?.template || 'reels',
          hook: body?.hook || '',
          renderBy: 'sinta (cmo) — remotion 9:16',
          scheduledWib: `${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`,
        },
        scheduled_for: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (insErr || !inserted) {
      return NextResponse.json({
        error: `Gagal simpan antrean (jalankan migrasi 037 + 038 di Supabase?): ${insErr?.message || '?'}`,
      }, { status: 500 })
    }
    const rowId = (inserted as { id: string }).id

    /* ── 6) Publish inline (poll Reels sampai 6 menit) ── */
    await admin
      .from('instagram_posts')
      .update({ status: 'publishing', attempts: 1, error: null })
      .eq('id', rowId)

    const r = await postToInstagram(tok.cfg, { mediaType: 'REELS', videoUrl, caption })

    if (r.ok) {
      await admin
        .from('instagram_posts')
        .update({
          status: 'published',
          ig_post_id: r.postId ?? null,
          permalink: r.permalink ?? null,
          published_at: new Date().toISOString(),
          error: null,
        })
        .eq('id', rowId)

      await sendAdminNotification(
        `📸🎬 <b>Sinta posting Reels ke Instagram</b>\n` +
        `${caption ? caption.slice(0, 220) + (caption.length > 220 ? '…' : '') + '\n' : ''}` +
        (r.permalink ? `🔗 ${r.permalink}\n` : '') +
        `⏰ ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`
      ).catch(() => {})

      return NextResponse.json({
        ok: true,
        posted: true,
        mediaType: 'REELS',
        postId: r.postId,
        permalink: r.permalink,
        tokenRefreshed: tok.refreshed,
      })
    }

    /* Gagal publish → kalau masih bisa di-retry, biarkan ig-auto-post lanjutkan */
    await admin
      .from('instagram_posts')
      .update({ status: 'pending', error: `[stage:${r.stage || '?'}] ${r.error || '?'}`.slice(0, 500) })
      .eq('id', rowId)

    await sendAdminNotification(
      `📸⚠️ <b>Sinta: Reels IG gagal (akan di-retry cron)</b>\n` +
      `Stage: ${r.stage || '?'} — ${r.error || '?'}\n` +
      `⏰ ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`
    ).catch(() => {})

    return NextResponse.json({
      ok: false,
      posted: false,
      stage: r.stage,
      error: r.error,
      queued: true,
      note: 'Baris tetap pending — cron ig-auto-post akan mencoba lagi (09:00/19:00/20:30 WIB)',
    }, { status: 502 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg.slice(0, 200) }, { status: 500 })
  }
}
