import { NextRequest, NextResponse } from 'next/server'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { getCronAdmin } from '@/lib/cron-supabase'
import { sendAdminNotification } from '@/lib/admin-notify'
import {
  ensureFreshToken,
  postToInstagram,
  validateIgPostInput,
  IG_DAILY_CAP,
  IG_CAROUSEL_MAX,
  IG_CAROUSEL_MIN,
} from '@/lib/instagram'

/**
 * ============================================================
 * POST /api/cron/ig-carousel-post — Sinta (CMO) → Carousel IG
 * ============================================================
 * Meja posting CAROUSEL karyawan Sinta (aturan Bos: konten
 * HANYA video Remotion + carousel). Slide PNG 1080×1350 hasil
 * renderStill komposisi SintaCarousel di runner (GitHub Actions)
 * diupload ke host publik dulu, lalu dikirim ke sini:
 *
 *   1) per foto : POST /{page-id}/media?image_url=&is_carousel_item=true
 *   2) induk    : POST /{page-id}/media?media_type=CAROUSEL
 *                 &children=id1,id2,...&caption=
 *   3) publish  : POST /{page-id}/media_publish?creation_id=
 *   (lihat src/lib/instagram.ts → createCarouselContainer)
 *
 * ATURAN JADWAL (sama dengan Reels, permintaan Bos):
 *   • Window posting: 19:00–20:59 WIB
 *   • Cadence: 2 hari sekali (guard 44 jam khusus CAROUSEL —
 *     feed IG dapat Reels & carousel bergantian, bukan spam)
 *   ?force=true → lewati window + cadence (untuk tes manual)
 *   ?dry=true   → validasi saja, tidak simpan/posting
 *
 * Flow:
 *   1. Auth CRON_SECRET (fail-closed produksi)
 *   2. Window + cadence check → skipped (honest, bukan error)
 *   3. ensureFreshToken (token > 55 hari → refresh otomatis 60 hari)
 *   4. Validasi imageUrls (2–10, https .jpg/.png, caption ≤ 2200)
 *   5. Enqueue instagram_posts (media_type CAROUSEL, meta.image_urls,
 *      source sinta-carousel) → riwayat + retry oleh ig-auto-post
 *   6. Publish inline (poll sampai 3 menit). Timeout → row
 *      'publishing' di-reclaim ig-auto-post — tidak hilang.
 *   7. Sukses/gagal → Discord admin (dengan permalink).
 *
 * GET → status cepat: kredensial, carousel terakhir, jadwal.
 */
export const dynamic = 'force-dynamic'

/** Jeda minimum antar carousel: 44 jam ≈ "2 hari sekali". */
const MIN_GAP_MS = 44 * 60 * 60 * 1000
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

  const { data: lastCarousel } = await admin
    .from('instagram_posts')
    .select('id, caption, status, permalink, published_at, error, meta')
    .eq('media_type', 'CAROUSEL')
    .order('created_at', { ascending: false })
    .limit(1)

  const last = lastCarousel?.[0] ?? null
  const lastMs = last?.published_at ? Date.parse(last.published_at) : null
  const meta = (last?.meta ?? {}) as { image_urls?: string[] }
  return NextResponse.json({
    ok: true,
    windowWib: WINDOW_HOURS_WIB,
    wibHourNow: wibHourNow(),
    cadenceHours: Math.round(MIN_GAP_MS / 3_600_000),
    slideLimits: { min: IG_CAROUSEL_MIN, max: IG_CAROUSEL_MAX },
    nextEligibleAt: lastMs ? new Date(lastMs + MIN_GAP_MS).toISOString() : null,
    lastCarousel: last
      ? { ...last, meta: { slideCount: meta.image_urls?.length ?? 0 } } // jangan bocorkan URL mentah
      : null,
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
    imageUrls?: string[]
    caption?: string
    slides?: Array<{ kind?: string; title?: string; sub?: string }>
  } | null
  const imageUrls = (Array.isArray(body?.imageUrls) ? body!.imageUrls : [])
    .map((u) => String(u || '').trim())
    .filter(Boolean)
  const caption = String(body?.caption || '').trim().slice(0, 2200)

  /* ── 1) Window 19–20 WIB (kecuali force/dry) ── */
  const hour = wibHourNow()
  if (!force && !dry && !WINDOW_HOURS_WIB.includes(hour)) {
    return NextResponse.json({
      ok: true,
      skipped: `di luar window posting (${hour}:00 WIB — jadwal 19:00–20:59 WIB)`,
    })
  }

  /* ── 2) Validasi input (carousel 2–10 foto https .jpg/.png) ── */
  const invalid = validateIgPostInput({ mediaType: 'CAROUSEL', imageUrls, caption })
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  if (dry) {
    return NextResponse.json({
      ok: true,
      dry: true,
      slides: imageUrls.length,
      message: `Validasi carousel ${imageUrls.length} slide lolos — tidak disimpan (?dry=true)`,
    })
  }

  const admin = await getCronAdmin()
  if (!admin) return NextResponse.json({ error: 'Database not available' }, { status: 503 })

  /* ── 3) Cadence 2 hari sekali (guard khusus CAROUSEL, kecuali force) ── */
  if (!force) {
    const { data: recent } = await admin
      .from('instagram_posts')
      .select('id, published_at')
      .eq('media_type', 'CAROUSEL')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1)
    const lastMs = recent?.[0]?.published_at ? Date.parse(recent[0].published_at) : null
    if (lastMs && Date.now() - lastMs < MIN_GAP_MS) {
      const jamLalu = ((Date.now() - lastMs) / 3_600_000).toFixed(1)
      return NextResponse.json({
        ok: true,
        skipped: `cadence 2 hari sekali — carousel terakhir baru ${jamLalu} jam lalu`,
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
        media_type: 'CAROUSEL',
        image_url: null,
        video_url: null,
        caption,
        status: 'pending',
        source: 'sinta-carousel',
        meta: {
          image_urls: imageUrls,
          slideCount: imageUrls.length,
          slides: (body?.slides || []).slice(0, IG_CAROUSEL_MAX),
          renderBy: 'sinta (cmo) — remotion carousel 1080x1350',
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

    /* ── 6) Publish inline (carousel: poll sampai 3 menit) ── */
    await admin
      .from('instagram_posts')
      .update({ status: 'publishing', attempts: 1, error: null })
      .eq('id', rowId)

    const r = await postToInstagram(tok.cfg, { mediaType: 'CAROUSEL', imageUrls, caption })

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
        `📸🖼️ <b>Sinta posting carousel ${imageUrls.length} slide ke Instagram</b>\n` +
        `${caption ? caption.slice(0, 220) + (caption.length > 220 ? '…' : '') + '\n' : ''}` +
        (r.permalink ? `🔗 ${r.permalink}\n` : '') +
        `⏰ ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`
      ).catch(() => {})

      return NextResponse.json({
        ok: true,
        posted: true,
        mediaType: 'CAROUSEL',
        slides: r.carouselItems ?? imageUrls.length,
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
      `📸⚠️ <b>Sinta: carousel IG gagal (akan di-retry cron)</b>\n` +
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
