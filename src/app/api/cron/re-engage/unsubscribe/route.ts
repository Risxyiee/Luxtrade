export const runtime = "edge"
import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'

/**
 * GET /api/cron/re-engage/unsubscribe?uid=xxx
 * Unsubscribe page: marks user as unsubscribed from re-engagement emails.
 * Shows a simple HTML confirmation page.
 */
export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const uid = searchParams.get('uid')

  if (!uid) {
    return NextResponse.json({ error: 'Missing uid parameter' }, { status: 400 })
  }

  if (!isDatabaseAvailable()) {
    return new Response(getUnsubHtml('not_found'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  try {
    // Check if user exists in re_engagement_emails
    const existing: any[] = await db.$queryRawUnsafe(`
      SELECT user_id, unsubscribed FROM public.re_engagement_emails
      WHERE user_id = $1
    `, uid)

    if (!existing || existing.length === 0) {
      // User hasn't received any re-engagement email — still mark them as unsubscribed
      await db.$executeRawUnsafe(`
        INSERT INTO public.re_engagement_emails (user_id, email, email_type, sent_at, unsubscribed, unsubscribed_at)
        VALUES ($1, 'unsubscribed', 'none', NOW(), true, NOW())
        ON CONFLICT (user_id) DO UPDATE SET unsubscribed = true, unsubscribed_at = NOW();
      `, uid)
    } else if (!existing[0].unsubscribed) {
      await db.$executeRawUnsafe(`
        UPDATE public.re_engagement_emails
        SET unsubscribed = true, unsubscribed_at = NOW()
        WHERE user_id = $1;
      `, uid)
    }

    return new Response(getUnsubHtml('success'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    return new Response(getUnsubHtml('error'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}

function getUnsubHtml(status: 'success' | 'error' | 'not_found') {
  const messages = {
    success: {
      title: 'Berhasil Unsubscribe ✅',
      body: 'Kamu sudah tidak akan menerima email re-engagement dari LuxTrade lagi.',
    },
    not_found: {
      title: 'Tidak Ditemukan',
      body: 'Tidak ada catatan email untuk akun ini.',
    },
    error: {
      title: 'Terjadi Kesalahan',
      body: 'Gagal memproses permintaan. Coba lagi nanti.',
    },
  }

  const msg = messages[status]

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe - LuxTrade</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f7; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .card { background: #fff; border-radius: 16px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.04); max-width: 440px; width: 100%; padding: 48px 32px; text-align: center; }
    h1 { font-size: 20px; color: #1a1a2e; margin-bottom: 12px; }
    p { color: #4a4a68; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
    a { color: #f59e0b; text-decoration: none; font-weight: 600; font-size: 14px; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${msg.title}</h1>
    <p>${msg.body}</p>
    <a href="${SITE_URL}">← Kembali ke LuxTrade</a>
  </div>
</body>
</html>`
}
