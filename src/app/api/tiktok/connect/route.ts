import { NextRequest, NextResponse } from 'next/server'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { createTiktokOAuthState } from '@/lib/tiktok'

/**
 * 🔗 GET /api/tiktok/connect?key=<CRON_SECRET> — mulai OAuth TikTok.
 *
 * Dipakai Bos untuk (re-)authorize aplikasi:
 *   - pertama kali sebelum token ada
 *   - ≤ 180 hari sekali saat refresh token kedaluwarsa (policy TikTok Des 2026)
 *
 * Flow: halaman ini 302 → TikTok consent → callback /api/tiktok/callback →
 * refresh token disimpan TERENKRIPSI di Supabase agent_kv (worker yang pegang,
 * bukan GitHub/runner).
 *
 * Redirect URI harus sama persis dengan yang terdaftar di TikTok Developer
 * Portal → Luxtradee → Login Kit → Redirect URI. Default:
 *   https://luxtradee.web.id/api/tiktok/callback
 */

export const dynamic = 'force-dynamic'

async function resolveEnv(name: string): Promise<string> {
  try {
    const v = await getEnvVar(name, { quiet: true })
    return (v || process.env[name] || '').trim()
  } catch {
    return (process.env[name] || '').trim()
  }
}

function htmlPage(title: string, body: string, status = 200): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;background:#0b0b10;color:#f5f5f5;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}
  .card{max-width:560px;background:#14141e;border:1px solid #2a2a3a;border-radius:16px;padding:32px;box-shadow:0 8px 40px rgba(0,0,0,.5)}
  h1{font-size:20px;margin:0 0 12px;color:#f5c842} p{line-height:1.6;color:#c9c9d4;font-size:14px} code{background:#1e1e2c;padding:2px 6px;border-radius:6px;font-size:12px;color:#f5c842;word-break:break-all}
</style></head>
<body><div class="card"><h1>${title}</h1>${body}</div></body></html>`
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function GET(request: NextRequest) {
  // Auth ringan: hanya Bos yang tahu CRON_SECRET boleh memicu connect
  const cronSecret = await resolveEnv('CRON_SECRET')
  const url = new URL(request.url)
  const key = url.searchParams.get('key') || request.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!cronSecret || key !== cronSecret) {
    return htmlPage(
      'Akses ditolak 🔒',
      '<p>Tambahkan <code>?key=CRON_SECRET</code> di akhir URL (secret yang sama dengan yang dipakai cron). ' +
        'Nilai ini hanya kamu yang tahu — asisten tidak pernah melihatnya.</p>',
      401,
    )
  }

  const clientKey = await resolveEnv('TIKTOK_CLIENT_KEY')
  if (!clientKey) {
    return htmlPage(
      'Belum dikonfigurasi ⚙️',
      '<p>Secret <code>TIKTOK_CLIENT_KEY</code> belum dipasang di Cloudflare.</p>' +
        '<p>Jalankan: <code>npx wrangler secret put TIKTOK_CLIENT_KEY</code> (dan CLIENT_SECRET + REFRESH_TOKEN), lalu coba lagi.</p>',
      503,
    )
  }

  // Redirect URI WAJIB identik dengan yang terdaftar di portal developer
  const base =
    (await resolveEnv('TIKTOK_REDIRECT_URI_BASE')) ||
    (await resolveEnv('NEXT_PUBLIC_APP_URL')) ||
    (await resolveEnv('NEXT_PUBLIC_SITE_URL')) ||
    url.origin
  const redirectUri = `${base.replace(/\/+$/, '')}/api/tiktok/callback`
  const scope = (await resolveEnv('TIKTOK_SCOPES')) || 'user.info.basic,video.upload,video.publish'
  const state = await createTiktokOAuthState()

  const authorize = new URL('https://www.tiktok.com/v2/auth/authorize/')
  authorize.searchParams.set('client_key', clientKey)
  authorize.searchParams.set('scope', scope)
  authorize.searchParams.set('response_type', 'code')
  authorize.searchParams.set('redirect_uri', redirectUri)
  authorize.searchParams.set('state', state)

  return NextResponse.redirect(authorize.toString(), { status: 302 })
}
