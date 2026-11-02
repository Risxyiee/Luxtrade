import { NextRequest, NextResponse } from 'next/server'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { exchangeTiktokAuthCode, saveTiktokOAuthTokens, verifyTiktokOAuthState } from '@/lib/tiktok'

/**
 * 🎯 GET /api/tiktok/callback?code=...&state=... — penerima OAuth TikTok.
 *
 * Dipanggil TikTok setelah Bos menyetujui consent di /api/tiktok/connect.
 * Tukar code → token, lalu:
 *   - refresh_token  → disimpan TERENKRIPSI (AES-GCM) di Supabase agent_kv
 *   - access_token   → disimpan sebagai cache terenkripsi juga
 *
 * Setelah ini shift sore Sinta (job "sinta-video" di Master Autonomous
 * Workforce) otomatis pakai token baru —
 * TIDAK perlu pasang ulang secret apa pun. Ini juga jalur re-auth resmi
 * ketika refresh token kedaluwarsa (policy TikTok: 180 hari per 1 Des 2026).
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
  .card{max-width:600px;background:#14141e;border:1px solid #2a2a3a;border-radius:16px;padding:32px;box-shadow:0 8px 40px rgba(0,0,0,.5)}
  h1{font-size:20px;margin:0 0 12px;color:#f5c842} p{line-height:1.6;color:#c9c9d4;font-size:14px} code{background:#1e1e2c;padding:2px 6px;border-radius:6px;font-size:12px;color:#f5c842;word-break:break-all}
  .ok{color:#4ade80;font-size:40px;margin-bottom:8px} .fail{color:#f87171;font-size:40px;margin-bottom:8px}
</style></head>
<body><div class="card"><h1>${title}</h1>${body}</div></body></html>`
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const err = url.searchParams.get('error')
  const errDesc = url.searchParams.get('error_description')

  // ── TikTok mengembalikan error (user tolak / scope tidak disetujui) ──
  if (err) {
    return htmlPage(
      'Authorization dibatalkan ❌',
      `<p>TikTok mengembalikan: <code>${err}</code>${errDesc ? ` — ${errDesc}` : ''}</p>` +
        '<p>Buka kembali <code>/api/tiktok/connect?key=...</code> dan setujui semua permission yang diminta.</p>',
      400,
    )
  }

  // ── CSRF state (HMAC stateless, 10 menit) ──
  if (!(await verifyTiktokOAuthState(state))) {
    return htmlPage(
      'State tidak valid 🔒',
      '<p>State OAuth kedaluwarsa atau tidak cocok. Coba lagi dari <code>/api/tiktok/connect?key=...</code> ' +
        '(halaman ini harus dibuka ≤ 10 menit sebelum menyetujui consent).</p>',
      400,
    )
  }

  if (!code) {
    return htmlPage('Code tidak ada ❓', '<p>TikTok tidak mengirim <code>code</code>. Ulangi connect.</p>', 400)
  }

  // ── Tukar code → token ──
  const base =
    (await resolveEnv('TIKTOK_REDIRECT_URI_BASE')) ||
    (await resolveEnv('NEXT_PUBLIC_APP_URL')) ||
    (await resolveEnv('NEXT_PUBLIC_SITE_URL')) ||
    url.origin
  const redirectUri = `${base.replace(/\/+$/, '')}/api/tiktok/callback`

  const res = await exchangeTiktokAuthCode(code, redirectUri)
  if (!res.ok || !res.accessToken || !res.refreshToken) {
    return htmlPage(
      'Gagal tukar token ❌',
      `<p><code>${res.error || 'unknown'}</code></p>` +
        '<p>Kemungkinan: redirect_uri tidak identik dengan portal developer, code sudah dipakai, ' +
        'atau CLIENT_KEY/SECRET salah. Periksa lalu ulangi connect.</p>',
      502,
    )
  }

  const saved = await saveTiktokOAuthTokens(res.accessToken, res.refreshToken, res.expiresIn)
  if (!saved) {
    return htmlPage(
      'Token diterima tapi gagal disimpan ⚠️',
      '<p>Penyimpanan terenkripsi (Supabase agent_kv) tidak tersedia. Token belum aktif untuk bot.</p>' +
        '<p>Coba ulangi connect beberapa saat lagi, atau pasang refresh token manual via ' +
        '<code>npx wrangler secret put TIKTOK_REFRESH_TOKEN</code>.</p>',
      500,
    )
  }

  const jam = Math.round((res.expiresIn || 7200) / 3600)
  return htmlPage(
    'TikTok terhubung ✅',
    `<div class="ok">✔</div>` +
      `<p>Refresh token baru tersimpan terenkripsi di server Luxtradee. Bot video siap dipakai.</p>` +
      `<p>Access token aktif ± <strong>${jam} jam</strong> dan akan di-refresh otomatis sebelum tiap posting. ` +
      `Sesuai policy TikTok (per 1 Des 2026): refresh token berlaku <strong>180 hari</strong> — kalau bot gagal posting ` +
      `karena token kedaluwarsa, buka lagi <code>/api/tiktok/connect?key=...</code> ini untuk menyambung ulang (±1 menit).</p>` +
      `<p>Mode sandbox: hasil posting muncul sebagai video <strong>privat (SELF_ONLY)</strong> di akun TikTok terhubung.</p>`,
  )
}
