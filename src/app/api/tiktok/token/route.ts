import { NextRequest, NextResponse } from 'next/server'
import { getTiktokAccessToken } from '@/lib/tiktok'
import { getEnvVar } from '@/lib/cloudflare-bindings'

/**
 * 🎫 POST /api/tiktok/token — dispenser access token TikTok untuk tugas
 * karyawan Sinta (CMO) di Master Autonomous Workforce: job "sinta-video"
 * merender & memposting video TikTok harian dari runner GitHub Actions.
 * Worker yang pegang secret TikTok; runner hanya butuh CRON_SECRET yang
 * sudah ada. Secret TikTok TIDAK PERNAH keluar.
 *
 * Auth: Bearer CRON_SECRET (fail-closed — pola master-autonomous).
 */
export const dynamic = 'force-dynamic'

async function handle(request: NextRequest) {
  const secret = (await getEnvVar('CRON_SECRET', { quiet: true })) || process.env.CRON_SECRET || ''
  if (!secret) {
    // Fail-closed: tanpa CRON_SECRET, hanya dev lokal yang boleh
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ success: false, error: 'CRON_SECRET belum diset di server' }, { status: 503 })
    }
  } else {
    const provided = request.headers.get('authorization')?.replace('Bearer ', '') || ''
    if (provided !== secret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
  }

  const result = await getTiktokAccessToken()
  if (!result.ok || !result.token) {
    return NextResponse.json({ success: false, error: result.error || 'token tidak tersedia' }, { status: 503 })
  }

  return NextResponse.json({
    success: true,
    access_token: result.token.accessToken,
    expires_in: result.token.expiresIn ?? null,
    refresh_rotated: result.token.rotated,
    source: result.token.source,
    warning: result.warning,
  })
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
