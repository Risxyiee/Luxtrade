import { NextRequest, NextResponse } from 'next/server'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { getCronAdmin } from '@/lib/cron-supabase'
import { sendAdminNotification } from '@/lib/admin-notify'
import {
  ensureFreshToken,
  postToInstagram,
  checkMediaUrlAlive,
  IG_DAILY_CAP,
  type IgConfig,
} from '@/lib/instagram'

/**
 * ============================================================
 * GET/POST /api/cron/ig-auto-post — Auto-post Instagram
 * ============================================================
 * Antrean tabel `instagram_posts` (migrasi 037 + 038):
 *   pending → publishing → published (ig_post_id, permalink)
 *                        ↘ failed (error, attempts ≥ 3)
 *   media_type: 'IMAGE' (image_url) | 'REELS' (video_url .mp4 —
 *   hasil render Remotion Sinta) | 'CAROUSEL' (meta.image_urls —
 *   slide PNG 1080×1350 renderStill SintaCarousel, diupload ke
 *   host publik) — semua diupload ke host publik dulu.
 *
 * Langkah per tick:
 *   1. ensureFreshToken — token > 55 hari → refresh otomatis
 *      (fb_exchange_token, simpan ig_token_state); gagal refresh
 *      TIDAK menggagalkan posting (token lama mungkin masih hidup).
 *   2. Cap keamanan: maks 25 post published / 24 jam (limit IG API).
 *   3. Reclaim baris 'publishing' menggantung > 30 menit (Reels
 *      butuh proses server IG 1–5 menit) → pending.
 *   4. Klaim maks N baris 'pending' (scheduled_for ≤ now, N default 2,
 *      maks 5 via ?max=) → postToInstagram (media → poll → media_publish;
 *      Reels poll sampai 6 menit, carousel 3 menit).
 *   5. Sukses → published + permalink. Gagal → attempts<3 balik pending,
 *      else failed permanen. Ringkasan gagal → Discord admin.
 *
 * Auth: Bearer/x-cron-secret = CRON_SECRET (fail-closed di produksi).
 * Cron: GitHub Actions instagram-cron.yml — 09:00 & 19:00 & 20:30 WIB
 *      (20:30 = jaring pengaman Reels yang diproses dari 19:10).
 * Param: ?max=3 | ?dry=true (tampilkan antrean tanpa posting)
 */
export const dynamic = 'force-dynamic'

const MAX_PER_RUN = 5
const DEFAULT_PER_RUN = 2
/** Reels butuh 1–5 menit proses IG → hang lebih lama sebelum di-reclaim. */
const STALE_PUBLISHING_MS = 30 * 60 * 1000
const MAX_ATTEMPTS = 3

interface QueueRow {
  id: string
  media_type?: string | null
  image_url: string | null
  video_url: string | null
  caption: string | null
  attempts: number
  meta?: { image_urls?: string[] } | null
}

export async function GET(request: NextRequest) {
  return handle(request)
}
export async function POST(request: NextRequest) {
  return handle(request)
}

async function handle(request: NextRequest) {
  /* ── Auth cron (sama pola daily-reminder — fail-closed produksi) ── */
  const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '')
    || request.headers.get('x-cron-secret') || ''
  const expectedSecret = (await getEnvVar('CRON_SECRET')) || process.env.CRON_SECRET
  if (!expectedSecret) {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'CRON_SECRET not configured — endpoint disabled (fail-closed)' }, { status: 403 })
    }
  } else if (cronSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = await getCronAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Database not available', posted: 0 })
  }

  const url = new URL(request.url)
  const dry = url.searchParams.get('dry') === 'true'
  const maxPosts = Math.min(
    Math.max(parseInt(url.searchParams.get('max') || '', 10) || DEFAULT_PER_RUN, 1),
    MAX_PER_RUN
  )

  try {
    /* ── 1) Token segar (auto-refresh > 55 hari) ── */
    const tok = await ensureFreshToken(admin)
    if (!tok.cfg) {
      return NextResponse.json({ ok: true, skipped: 'FACEBOOK_PAGE_ID / FACEBOOK_PAGE_TOKEN belum diset — fitur IG nonaktif', posted: 0 })
    }
    const cfg: IgConfig = tok.cfg

    /* ── 2) Cap harian 25 post / 24 jam ── */
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await admin
      .from('instagram_posts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('published_at', since)
    if ((count ?? 0) >= IG_DAILY_CAP) {
      return NextResponse.json({ ok: true, skipped: `cap harian tercapai (${IG_DAILY_CAP} post/24 jam)`, posted: 0 })
    }

    /* ── 3) Reclaim 'publishing' menggantung (> 30 menit, Reels lama) ── */
    const staleBefore = new Date(Date.now() - STALE_PUBLISHING_MS).toISOString()
    await admin
      .from('instagram_posts')
      .update({ status: 'pending', error: 'reclaimed: publishing menggantung >30 menit' })
      .eq('status', 'publishing')
      .lt('updated_at', staleBefore)

    /* ── dry mode: lihat antrean saja ── */
    if (dry) {
      const { data } = await admin
        .from('instagram_posts')
        .select('id, media_type, image_url, video_url, caption, status, attempts, scheduled_for, created_at')
        .in('status', ['pending', 'publishing'])
        .order('created_at', { ascending: true })
        .limit(20)
      return NextResponse.json({ ok: true, dry: true, tokenSource: cfg.tokenSource, tokenRefreshed: tok.refreshed, queue: data ?? [] })
    }

    /* ── 4) Klaim antrean pending ── */
    const { data: due, error: qErr } = await admin
      .from('instagram_posts')
      .select('id, media_type, image_url, video_url, caption, attempts, meta')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(maxPosts)
    if (qErr) {
      return NextResponse.json({ error: `Gagal baca antrean: ${qErr.message}`, posted: 0 }, { status: 500 })
    }
    const rows = (due ?? []) as QueueRow[]
    if (!rows.length) {
      return NextResponse.json({ ok: true, posted: 0, message: 'Antrean kosong' })
    }

    /* ── 5) Posting satu per satu ── */
    const results: Array<{ id: string; ok: boolean; postId?: string; permalink?: string; mediaType?: string; error?: string }> = []
    let failures = 0

    for (const row of rows) {
      // Klaim atomik: hanya baris yang masih 'pending' yang jadi 'publishing'
      const claimed = await admin
        .from('instagram_posts')
        .update({ status: 'publishing', attempts: (row.attempts || 0) + 1, error: null })
        .eq('id', row.id)
        .eq('status', 'pending')
        .select('id')
      if (!claimed.data?.length) continue // baris diambil isolate lain

      /* CAROUSEL → kumpulkan URL slide dari meta.image_urls
         (fallback: image_url tunggal, kompatibilitas data lama) */
      const isCarousel = row.media_type === 'CAROUSEL'
      const carouselUrls = isCarousel
        ? (row.meta?.image_urls?.length
            ? row.meta.image_urls.map((u) => String(u))
            : row.image_url ? [row.image_url] : [])
        : []
      if (isCarousel && carouselUrls.length < 2) {
        // Slide hilang (host publik 72 jam kedaluwarsa dsb) → gagal permanen
        await admin
          .from('instagram_posts')
          .update({
            status: 'failed',
            error: 'carousel butuh ≥2 URL slide — meta.image_urls kosong/tidak valid (upload runner kedaluwarsa?)',
          })
          .eq('id', row.id)
        failures++
        results.push({ id: row.id, ok: false, error: 'slide carousel hilang dari meta' })
        continue
      }

      /* Pre-flight: URL media masih hidup? Host media ber-TTL (KV 3 hari,
         litterbox 72 jam) bisa kedaluwarsa saat baris lama di antrean →
         IG cuma balik 2207082 "Media upload has failed" yang misterius.
         4xx = media hilang permanen → failed dgn pesan jelas (retry percuma).
         Jaringan/5xx = pulih sendiri → kembali pending (tidak buang attempts). */
      const preflightUrl = isCarousel
        ? carouselUrls[0]
        : row.media_type === 'REELS' ? (row.video_url || '') : (row.image_url || '')
      if (preflightUrl) {
        const alive = await checkMediaUrlAlive(preflightUrl)
        if (!alive.alive) {
          if (alive.status >= 400 && alive.status < 500) {
            await admin
              .from('instagram_posts')
              .update({
                status: 'failed',
                error: `media tidak bisa diambil (${alive.error}) — file kedaluwarsa/hilang dari host. Render ulang lalu antre ulang.`,
              })
              .eq('id', row.id)
            failures++
            results.push({ id: row.id, ok: false, error: `media mati (${alive.error}) — render ulang dulu` })
            continue
          }
          // Status 0 / 5xx — sementara: balik pending, cron berikutnya coba lagi
          await admin
            .from('instagram_posts')
            .update({ status: 'pending', error: `host media sementara tidak bisa diakses (${alive.error || 'HTTP ' + alive.status}) — dicoba lagi cron berikutnya` })
            .eq('id', row.id)
          results.push({ id: row.id, ok: false, error: `host media sementara gagal (${alive.error || alive.status}) — dijadwalkan ulang` })
          continue
        }
      }

      const r = await postToInstagram(cfg, {
        mediaType: isCarousel ? 'CAROUSEL' : row.media_type === 'REELS' ? 'REELS' : 'IMAGE',
        imageUrl: isCarousel ? undefined : (row.image_url || undefined),
        videoUrl: isCarousel ? undefined : (row.video_url || undefined),
        imageUrls: isCarousel ? carouselUrls : undefined,
        caption: row.caption || undefined,
      })

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
          .eq('id', row.id)
        results.push({ id: row.id, ok: true, postId: r.postId, permalink: r.permalink, mediaType: r.mediaType })
      } else {
        const giveUp = (row.attempts || 0) + 1 >= MAX_ATTEMPTS
        await admin
          .from('instagram_posts')
          .update({
            status: giveUp ? 'failed' : 'pending',
            error: `[stage:${r.stage || '?'}] ${r.error || 'tidak diketahui'}`.slice(0, 500),
          })
          .eq('id', row.id)
        failures++
        results.push({ id: row.id, ok: false, error: r.error })
      }
    }

    /* ── 6) Lapor gagal ke admin (Discord, best-effort) ── */
    if (failures > 0) {
      const detail = results
        .filter((x) => !x.ok)
        .map((x) => `• ${x.id.slice(0, 8)}… — ${x.error}`)
        .join('\n')
      await sendAdminNotification(
        `📸❌ <b>Instagram auto-post: ${failures} gagal</b>\n${detail}\n\n⏰ ${new Date().toLocaleString('id-ID')}`
      ).catch(() => {})
    }

    return NextResponse.json({
      ok: true,
      posted: results.filter((r) => r.ok).length,
      failed: failures,
      tokenRefreshed: tok.refreshed,
      tokenRefreshError: tok.refreshError,
      results,
    })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 200), posted: 0 }, { status: 500 })
  }
}
