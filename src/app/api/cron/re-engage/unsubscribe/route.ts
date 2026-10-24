import { NextRequest, NextResponse } from 'next/server'
import { getCronAdmin, isMissingTableError } from '@/lib/cron-supabase'

/**
 * GET /api/cron/re-engage/unsubscribe?uid=xxx
 * Unsubscribe page: marks user as unsubscribed from re-engagement emails.
 * Uses Supabase REST (Prisma cannot run on CF Workers).
 */
export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const uid = searchParams.get('uid')

  if (!uid) {
    return NextResponse.json({ error: 'Missing uid parameter' }, { status: 400 })
  }

  const admin = await getCronAdmin()
  if (!admin) {
    return new Response(getUnsubHtml('not_found'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  try {
    const nowIso = new Date().toISOString()

    // Check if user exists in re_engagement_emails (table may be missing — degrade)
    let rowExists = false
    let alreadyUnsubscribed = false
    try {
      const { data } = await admin
        .from('re_engagement_emails')
        .select('user_id, unsubscribed')
        .eq('user_id', uid)
        .limit(1)
      rowExists = !!data && data.length > 0
      alreadyUnsubscribed = rowExists && !!(data![0] as any).unsubscribed
    } catch (err: any) {
      if (!isMissingTableError(err)) console.warn('[re-engage/unsub] check failed:', err.message)
    }

    if (rowExists && !alreadyUnsubscribed) {
      const { error } = await admin
        .from('re_engagement_emails')
        .update({ unsubscribed: true, unsubscribed_at: nowIso })
        .eq('user_id', uid)
      if (error && !isMissingTableError(error)) {
        console.warn('[re-engage/unsub] update failed:', error.message)
      }
    } else if (!rowExists) {
      // User hasn't received any re-engagement email — insert sentinel row
      const { error } = await admin.from('re_engagement_emails').upsert(
        {
          user_id: uid,
          email: 'unsubscribed',
          email_type: 'none',
          sent_at: nowIso,
          unsubscribed: true,
          unsubscribed_at: nowIso,
        },
        { onConflict: 'user_id' }
      )
      if (error && !isMissingTableError(error)) {
        console.warn('[re-engage/unsub] sentinel insert failed:', error.message)
      }
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
      body: 'Kamu sudah tidak akan menerima email re-engagement dari LuxTradee lagi.',
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
  <title>Unsubscribe - LuxTradee</title>
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
    <a href="${SITE_URL}">← Kembali ke LuxTradee</a>
  </div>
</body>
</html>`
}
