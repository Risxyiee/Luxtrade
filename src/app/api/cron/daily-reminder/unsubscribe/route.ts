import { NextRequest, NextResponse } from 'next/server'
import { getCronAdmin, isMissingTableError } from '@/lib/cron-supabase'

/**
 * GET /api/cron/daily-reminder/unsubscribe?uid=xxx
 * Unsubscribe page: marks user as unsubscribed from daily reminder emails.
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
    const todayStr = nowIso.slice(0, 10)

    // Mark ALL existing daily_reminder_logs for this user as unsubscribed
    const { error: updateErr } = await admin
      .from('daily_reminder_logs')
      .update({ unsubscribed: true, unsubscribed_at: nowIso })
      .eq('user_id', uid)

    if (updateErr && !isMissingTableError(updateErr)) {
      console.warn('[daily-reminder/unsub] update failed:', updateErr.message)
    }

    // Insert sentinel row so future queries skip this user
    const { error: insertErr } = await admin
      .from('daily_reminder_logs')
      .upsert(
        { user_id: uid, email: 'unsubscribed', sent_date: todayStr, unsubscribed: true, unsubscribed_at: nowIso },
        { onConflict: 'user_id,sent_date', ignoreDuplicates: true }
      )

    if (insertErr && !isMissingTableError(insertErr)) {
      console.warn('[daily-reminder/unsub] sentinel insert failed:', insertErr.message)
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
      body: 'Kamu sudah tidak akan menerima daily reminder dari LuxTradee lagi.',
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
  <title>Unsubscribe Daily Reminder - LuxTradee</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f7; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .card { background: #fff; border-radius: 16px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.04); max-width: 440px; width: 100%; padding: 48px 32px; text-align: center; }
    h1 { font-size: 20px; color: #1a1a2e; margin-bottom: 12px; }
    p { color: #4a4a68; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
    a { color: #f97316; text-decoration: none; font-weight: 600; font-size: 14px; }
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
