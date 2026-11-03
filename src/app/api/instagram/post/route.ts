import { NextRequest, NextResponse } from 'next/server'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { requireAdmin } from '@/lib/admin-auth'
import { getCronAdmin } from '@/lib/cron-supabase'
import {
  ensureFreshToken,
  postToInstagram,
  validateIgPostInput,
  IG_CAPTION_MAX,
  IG_DAILY_CAP,
} from '@/lib/instagram'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * ============================================================
 * /api/instagram/post — Kelola antrean auto-post IG (admin)
 * ============================================================
 * GET  (admin)  → 50 antrean terakhir + status token (usia/sisa hari)
 * POST (admin ATAU Bearer CRON_SECRET utk otomasi):
 *        body { mediaType?: 'IMAGE'|'REELS', imageUrl?, videoUrl?,
 *               caption?, scheduledFor?(ISO), publishNow? }
 *        ?dry=true → validasi saja tanpa menyimpan
 *      → validasi input (IMAGE: https jpg/png ≤8MB · REELS: https mp4,
 *        caption ≤2200 char)
 *      → simpan baris 'pending' (dipublish cron ig-auto-post)
 *      → publishNow=true → posting langsung di request ini (Reels:
 *        poll sampai 6 menit).
 *
 * Auth: requireAdmin (session + ADMIN_EMAILS/profiles.role) ATAU
 *       header Authorization: Bearer <CRON_SECRET> untuk pipeline otomatis.
 */
export const dynamic = 'force-dynamic'



async function isCronAuthorized(request: NextRequest): Promise<boolean> {
  const provided = request.headers.get('authorization')?.replace('Bearer ', '')
    || request.headers.get('x-cron-secret') || ''
  if (!provided) return false
  const expected = (await getEnvVar('CRON_SECRET')) || process.env.CRON_SECRET
  return !!expected && provided === expected
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  const admin = await getCronAdmin()
  if (!admin) return NextResponse.json({ error: 'Database not available' }, { status: 503 })

  const [{ data: rows, error }, cfg] = await Promise.all([
    admin
      .from('instagram_posts')
      .select('id, media_type, image_url, video_url, caption, status, ig_post_id, permalink, error, attempts, scheduled_for, published_at, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    getIgConfig(admin),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ageMs = cfg?.issuedAt ? Date.now() - cfg.issuedAt : null
  return NextResponse.json({
    posts: rows ?? [],
    token: cfg
      ? {
          source: cfg.tokenSource,
          ageDays: ageMs != null ? Math.floor(ageMs / 86_400_000) : null,
          daysLeft: ageMs != null ? Math.max(0, 60 - Math.floor(ageMs / 86_400_000)) : null,
          expiresAt: cfg.expiresAt ? new Date(cfg.expiresAt).toISOString() : null,
        }
      : null,
    limits: { captionMax: IG_CAPTION_MAX, dailyCap: IG_DAILY_CAP },
  })
}

export async function POST(request: NextRequest) {
  /* Admin session ATAU cron secret (otomasi luar dashboard) */
  const adminAuth = await requireAdmin(request)
  if (adminAuth.error) {
    if (!(await isCronAuthorized(request))) return adminAuth.error
  }

  const admin: SupabaseClient | null = await getCronAdmin()
  if (!admin) return NextResponse.json({ error: 'Database not available' }, { status: 503 })

  const body = await request.json().catch(() => null) as {
    mediaType?: string
    imageUrl?: string
    videoUrl?: string
    caption?: string
    scheduledFor?: string
    publishNow?: boolean
  } | null
  const mediaType = body?.mediaType === 'REELS' ? 'REELS' : 'IMAGE'
  const imageUrl = String(body?.imageUrl || '').trim()
  const videoUrl = String(body?.videoUrl || '').trim()
  const caption = String(body?.caption || '').trim()
  const dry = new URL(request.url).searchParams.get('dry') === 'true'

  if (mediaType === 'REELS' && !videoUrl) {
    return NextResponse.json({ error: 'videoUrl wajib diisi untuk REELS' }, { status: 400 })
  }
  if (mediaType === 'IMAGE' && !imageUrl) {
    return NextResponse.json({ error: 'imageUrl wajib diisi' }, { status: 400 })
  }
  const invalid = validateIgPostInput({ mediaType, imageUrl, videoUrl, caption })
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  let scheduledFor = new Date().toISOString()
  if (body?.scheduledFor) {
    const t = Date.parse(body.scheduledFor)
    if (!Number.isFinite(t)) {
      return NextResponse.json({ error: 'scheduledFor bukan tanggal ISO yang valid' }, { status: 400 })
    }
    scheduledFor = new Date(t).toISOString()
  }

  if (dry) {
    return NextResponse.json({ ok: true, dry: true, message: 'Validasi lolos — tidak disimpan (?dry=true)' })
  }

  const { data: inserted, error: insErr } = await admin
    .from('instagram_posts')
    .insert({
      media_type: mediaType,
      image_url: mediaType === 'IMAGE' ? imageUrl : null,
      video_url: mediaType === 'REELS' ? videoUrl : null,
      caption,
      status: 'pending',
      source: 'manual',
      scheduled_for: scheduledFor,
    })
    .select('id, media_type, image_url, video_url, caption, status, scheduled_for, created_at')
    .single()
  if (insErr || !inserted) {
    return NextResponse.json({ error: `Gagal simpan antrean (jalankan migrasi 037 + 038?): ${insErr?.message || '?'}` }, { status: 500 })
  }

  /* publishNow → coba posting sekarang juga (tanpa nunggu cron) */
  if (body?.publishNow) {
    const tok = await ensureFreshToken(admin)
    if (!tok.cfg) {
      return NextResponse.json({ ok: true, post: inserted, publishNow: false, reason: 'FACEBOOK_PAGE_ID / FACEBOOK_PAGE_TOKEN belum diset' })
    }
    const r = await postToInstagram(tok.cfg, {
      mediaType,
      imageUrl: mediaType === 'IMAGE' ? imageUrl : undefined,
      videoUrl: mediaType === 'REELS' ? videoUrl : undefined,
      caption: caption || undefined,
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
        .eq('id', (inserted as any).id)
      return NextResponse.json({ ok: true, post: inserted, publishNow: true, postId: r.postId, permalink: r.permalink })
    }
    await admin
      .from('instagram_posts')
      .update({ status: 'pending', error: `[stage:${r.stage || '?'}] ${r.error || '?'}`.slice(0, 500) })
      .eq('id', (inserted as any).id)
    return NextResponse.json({ ok: true, post: inserted, publishNow: false, error: r.error })
  }

  return NextResponse.json({ ok: true, post: inserted })
}
