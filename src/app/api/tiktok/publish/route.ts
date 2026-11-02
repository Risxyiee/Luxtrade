import { NextRequest, NextResponse } from 'next/server'
import { getEnvVar, getSelfFetch } from '@/lib/cloudflare-bindings'
import {
  getTiktokAccessToken,
  initVideoUpload,
  uploadVideoChunk,
  fetchPublishStatus,
} from '@/lib/tiktok'

/**
 * 📤 POST /api/tiktok/publish — posting video ke TikTok via Content Posting API.
 *
 * Body JSON (semua opsional):
 *   { "videoUrl": "/videos/luxtrade-promo-1.mp4",   // path sendiri ATAU URL publik
 *     "title": "caption + hashtag",
 *     "privacyLevel": "SELF_ONLY",                   // sandbox wajib SELF_ONLY
 *     "draft": false }
 *
 * Default: video promosi bundel /videos/luxtrade-promo-1.mp4.
 * Alur: ambil token fresh (refresh otomatis) → fetch file video →
 *       init FILE_UPLOAD → upload per chunk (Content-Range) → status.
 *
 * Auth: Bearer CRON_SECRET (fail-closed — pola master-autonomous).
 */
export const dynamic = 'force-dynamic'

const CHUNK_SIZE = 8_000_000 // 8 MB — di bawah batas 64 MB per chunk TikTok

function clip(s: unknown, n: number): string {
  const t = String(s ?? '')
  return t.length <= n ? t : t.slice(0, n) + '…'
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

  const body = (await request.json().catch(() => ({}))) as {
    videoUrl?: string
    title?: string
    privacyLevel?: string
    draft?: boolean
  }

  const videoPath = (body.videoUrl || '/videos/luxtrade-promo-1.mp4').trim()
  const title = (body.title || 'Luxtrade — jurnal trading AI untuk trader XAUUSD').trim()
  const privacyLevel = body.privacyLevel || 'SELF_ONLY'

  // ── 1. Ambil file video (path sendiri → self service binding dulu, anti-522) ──
  const base = (
    (await getEnvVar('NEXT_PUBLIC_APP_URL', { quiet: true })) ||
    (await getEnvVar('NEXT_PUBLIC_SITE_URL', { quiet: true })) ||
    new URL(request.url).origin
  ).replace(/\/+$/, '')

  let fetchFn: typeof fetch = fetch
  let videoUrl = videoPath
  let viaSelf = false
  if (videoPath.startsWith('/')) {
    const selfFetch = await getSelfFetch()
    if (selfFetch) {
      fetchFn = selfFetch as typeof fetch
      viaSelf = true
    }
    videoUrl = `${base}${videoPath}`
  }

  let videoRes: Response
  try {
    videoRes = await fetchFn(videoUrl, { signal: AbortSignal.timeout(120_000) })
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, error: `Gagal mengambil file video (${clip(e, 160)}) — URL: ${videoUrl}` },
      { status: 502 },
    )
  }
  if (!videoRes.ok) {
    return NextResponse.json(
      { success: false, error: `File video HTTP ${videoRes.status} — URL: ${videoUrl}`, viaSelf },
      { status: 502 },
    )
  }
  const videoBytes = new Uint8Array(await videoRes.arrayBuffer())
  const videoSize = videoBytes.byteLength
  if (videoSize < 1024) {
    return NextResponse.json({ success: false, error: `File video terlalu kecil (${videoSize} bytes)` }, { status: 400 })
  }
  if (videoSize > 100 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: 'Video > 100 MB — kegedean untuk diproses worker' }, { status: 413 })
  }

  // ── 2. Token fresh (refresh otomatis bila perlu) ──
  const tok = await getTiktokAccessToken()
  if (!tok.ok || !tok.token) {
    return NextResponse.json({ success: false, error: tok.error || 'token tidak tersedia' }, { status: 503 })
  }
  let accessToken = tok.token.accessToken

  // ── 3. Init upload (retry 1× kalau token kedaluwarsa) ──
  const chunkCount = Math.max(1, Math.ceil(videoSize / CHUNK_SIZE))
  let init = await initVideoUpload({
    accessToken,
    videoSize,
    chunkSize: CHUNK_SIZE,
    title,
    privacyLevel,
    draft: body.draft,
  })
  if (!init.ok && (init.error?.includes('access_token') || init.httpStatus === 401)) {
    const retry = await getTiktokAccessToken()
    if (retry.ok && retry.token) {
      accessToken = retry.token.accessToken
      init = await initVideoUpload({
        accessToken,
        videoSize,
        chunkSize: CHUNK_SIZE,
        title,
        privacyLevel,
        draft: body.draft,
      })
    }
  }
  if (!init.ok || !init.uploadUrl) {
    return NextResponse.json(
      {
        success: false,
        error: `Init upload TikTok gagal: ${init.error || 'tanpa upload_url'}`,
        hint: 'Cek scope video.upload + video.publish di token & status sandbox app.',
      },
      { status: 502 },
    )
  }

  // ── 4. Upload chunk berurutan (Content-Range) ──
  const chunkResults: number[] = []
  for (let start = 0; start < videoSize; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE, videoSize)
    const chunk = videoBytes.subarray(start, end)
    const up = await uploadVideoChunk({ uploadUrl: init.uploadUrl, chunk, start, totalSize: videoSize })
    chunkResults.push(up.status)
    if (!up.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Upload chunk gagal pada byte ${start}-${end - 1}: ${up.error || `HTTP ${up.status}`}`,
          publishId: init.publishId,
          chunkResults,
        },
        { status: 502 },
      )
    }
  }

  // ── 5. Status awal publikasi ──
  let status: string | undefined
  let failReason: string | undefined
  if (init.publishId) {
    const st = await fetchPublishStatus(accessToken, init.publishId)
    status = st.status
    failReason = st.failReason
  }

  return NextResponse.json({
    success: true,
    publishId: init.publishId,
    status: status || 'PROCESSING',
    failReason,
    videoSize,
    chunkCount,
    chunkResults,
    viaSelf,
    privacyLevel,
    title: clip(title, 120),
    note:
      privacyLevel === 'SELF_ONLY'
        ? 'Postingan privat (SELF_ONLY) — mode sandbox TikTok. Terlihat hanya di akun terhubung.'
        : undefined,
  })
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
