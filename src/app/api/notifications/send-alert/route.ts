import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'

// In-memory rate limit: max 3 alert emails per user per day
const alertCounts = new Map<string, { count: number; date: string }>()

const MAX_DAILY_ALERTS = 3

function isRateLimited(userId: string): boolean {
  const today = new Date().toISOString().split('T')[0]
  const entry = alertCounts.get(userId)

  if (!entry || entry.date !== today) {
    alertCounts.set(userId, { count: 1, date: today })
    return false
  }

  if (entry.count >= MAX_DAILY_ALERTS) {
    return true
  }

  entry.count++
  return false
}

async function ensureColumn() {
  try {
    await db.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'profiles' AND column_name = 'notification_preferences'
        ) THEN
          ALTER TABLE profiles ADD COLUMN notification_preferences JSONB DEFAULT '{}'::jsonb;
        END IF;
      END $$;
    `)
  } catch {
    // Ignore
  }
}

interface AlertRequestBody {
  type: 'big_win' | 'big_loss' | 'streak' | 'daily_limit'
  data: {
    amount?: number
    symbol?: string
    streakCount?: number
    lossCount?: number
    totalPL?: number
    tradeCount?: number
  }
}

function buildEmailHtml(type: string, data: AlertRequestBody['data']): string {
  const colors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    big_win: { bg: '#052e16', text: '#22c55e', border: '#16a34a', icon: '📈' },
    big_loss: { bg: '#450a0a', text: '#ef4444', border: '#dc2626', icon: '📉' },
    streak: { bg: '#451a03', text: '#f59e0b', border: '#d97706', icon: '🔥' },
    daily_limit: { bg: '#451a03', text: '#f97316', border: '#ea580c', icon: '🛑' },
  }

  const c = colors[type] || colors.streak

  let title = ''
  let body = ''

  switch (type) {
    case 'big_win':
      title = 'Big Win Alert'
      body = `
        <tr><td style="padding: 8px 0; color: #e2e8f0;">Kamu mendapatkan profit besar hari ini!</td></tr>
        ${data.symbol ? `<tr><td style="padding: 4px 0; color: #94a3b8;">Symbol: <strong style="color: #e2e8f0;">${data.symbol}</strong></td></tr>` : ''}
        ${data.amount !== undefined ? `<tr><td style="padding: 4px 0; color: #94a3b8;">Profit: <strong style="color: #22c55e;">+$${data.amount.toFixed(2)}</strong></td></tr>` : ''}
        ${data.totalPL !== undefined ? `<tr><td style="padding: 4px 0; color: #94a3b8;">Total P/L Hari Ini: <strong style="color: #22c55e;">+$${data.totalPL.toFixed(2)}</strong></td></tr>` : ''}
        ${data.tradeCount !== undefined ? `<tr><td style="padding: 4px 0; color: #94a3b8;">Jumlah Trade: <strong style="color: #e2e8f0;">${data.tradeCount}</strong></td></tr>` : ''}
      `
      break
    case 'big_loss':
      title = 'Big Loss Alert'
      body = `
        <tr><td style="padding: 8px 0; color: #e2e8f0;">Kamu mengalami kerugian besar hari ini.</td></tr>
        ${data.symbol ? `<tr><td style="padding: 4px 0; color: #94a3b8;">Symbol: <strong style="color: #e2e8f0;">${data.symbol}</strong></td></tr>` : ''}
        ${data.amount !== undefined ? `<tr><td style="padding: 4px 0; color: #94a3b8;">Loss: <strong style="color: #ef4444;">$${data.amount.toFixed(2)}</strong></td></tr>` : ''}
        ${data.totalPL !== undefined ? `<tr><td style="padding: 4px 0; color: #94a3b8;">Total P/L Hari Ini: <strong style="color: #ef4444;">$${data.totalPL.toFixed(2)}</strong></td></tr>` : ''}
        <tr><td style="padding: 12px 0 4px; color: #f87171;">Pertimbangkan untuk review strategi trading kamu.</td></tr>
      `
      break
    case 'streak':
      title = data.streakCount && data.streakCount >= 0 ? 'Win Streak Alert' : 'Loss Streak Alert'
      const isWin = (data.streakCount ?? 0) >= 0
      body = `
        <tr><td style="padding: 8px 0; color: #e2e8f0;">Kamu sedang dalam ${isWin ? 'winning' : 'losing'} streak!</td></tr>
        ${data.streakCount !== undefined ? `<tr><td style="padding: 4px 0; color: #94a3b8;">Streak: <strong style="color: ${isWin ? '#22c55e' : '#ef4444'};">${Math.abs(data.streakCount)} trade berturut-turut</strong></td></tr>` : ''}
        ${data.totalPL !== undefined ? `<tr><td style="padding: 4px 0; color: #94a3b8;">P/L Streak: <strong style="color: ${isWin ? '#22c55e' : '#ef4444'};">$${data.totalPL.toFixed(2)}</strong></td></tr>` : ''}
        ${!isWin ? '<tr><td style="padding: 12px 0 4px; color: #f87171;">Pertimbangkan untuk berhenti sejenak dan evaluasi.</td></tr>' : '<tr><td style="padding: 12px 0 4px; color: #22c55e;">Keep up the great work!</td></tr>'}
      `
      break
    case 'daily_limit':
      title = 'Daily Loss Limit Alert'
      body = `
        <tr><td style="padding: 8px 0; color: #e2e8f0;">Kamu sudah mencapai batas rugi harian.</td></tr>
        ${data.lossCount !== undefined ? `<tr><td style="padding: 4px 0; color: #94a3b8;">Trade Rugi Hari Ini: <strong style="color: #ef4444;">${data.lossCount}</strong></td></tr>` : ''}
        ${data.totalPL !== undefined ? `<tr><td style="padding: 4px 0; color: #94a3b8;">Total P/L Hari Ini: <strong style="color: #ef4444;">$${data.totalPL.toFixed(2)}</strong></td></tr>` : ''}
        <tr><td style="padding: 12px 0 4px; color: #f87171;">Disarankan untuk berhenti trading hari ini dan kembali besok.</td></tr>
      `
      break
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #080b12; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #0a0c14; border: 1px solid ${c.border}33; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 24px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: center;">
              <div style="font-size: 24px; margin-bottom: 8px;">${c.icon}</div>
              <h1 style="margin: 0; color: ${c.text}; font-size: 18px; font-weight: 700;">${title}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 20px 24px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${body}
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.05); text-align: center;">
              <p style="margin: 0; color: #4b5563; font-size: 12px;">LuxTrade Trading Journal</p>
              <p style="margin: 4px 0 0; color: #374151; font-size: 11px;">Email alert ini dikirim berdasarkan pengaturan notifikasi kamu.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth(request)
  if (error) return error

  // Rate limit check
  if (isRateLimited(user.id)) {
    return NextResponse.json({ error: 'Daily alert limit reached (max 3/day)' }, { status: 429 })
  }

  const body: AlertRequestBody = await request.json()
  const { type, data } = body

  // Validate type
  if (!['big_win', 'big_loss', 'streak', 'daily_limit'].includes(type)) {
    return NextResponse.json({ error: 'Invalid alert type' }, { status: 400 })
  }

  // Fetch user preferences
  await ensureColumn()

  let emailDigest = 'daily'
  let tradeAlerts = { bigWin: true, bigLoss: true, streak: true, dailyLimit: true }
  let userEmail: string | null = null

  try {
    const rows: { notification_preferences: unknown; email: string | null }[] = await db.$queryRawUnsafe(
      `SELECT notification_preferences, email FROM profiles WHERE id = $1`,
      user.id
    )

    if (rows.length > 0) {
      userEmail = rows[0].email
      const prefs = rows[0].notification_preferences as Record<string, unknown> | null
      if (prefs) {
        emailDigest = (prefs.emailDigest as string) || 'daily'
        tradeAlerts = {
          bigWin: Boolean((prefs.tradeAlerts as Record<string, unknown>)?.bigWin ?? true),
          bigLoss: Boolean((prefs.tradeAlerts as Record<string, unknown>)?.bigLoss ?? true),
          streak: Boolean((prefs.tradeAlerts as Record<string, unknown>)?.streak ?? true),
          dailyLimit: Boolean((prefs.tradeAlerts as Record<string, unknown>)?.dailyLimit ?? true),
        }
      }
    }
  } catch {
    // Use defaults
  }

  // Check if email digest is off
  if (emailDigest === 'off') {
    return NextResponse.json({ success: false, reason: 'Email digest is off' })
  }

  // Check if this specific alert type is enabled
  const alertKeyMap: Record<string, keyof typeof tradeAlerts> = {
    big_win: 'bigWin',
    big_loss: 'bigLoss',
    streak: 'streak',
    daily_limit: 'dailyLimit',
  }

  if (!tradeAlerts[alertKeyMap[type]]) {
    return NextResponse.json({ success: false, reason: `${type} alerts are disabled` })
  }

  // Need user email to send
  if (!userEmail) {
    userEmail = user.email
  }

  if (!userEmail) {
    return NextResponse.json({ error: 'No email address found' }, { status: 400 })
  }

  // Build and send email
  const html = buildEmailHtml(type, data)
  const subjectMap: Record<string, string> = {
    big_win: 'LuxTrade - Big Win Alert',
    big_loss: 'LuxTrade - Big Loss Alert',
    streak: 'LuxTrade - Streak Alert',
    daily_limit: 'LuxTrade - Daily Loss Limit Alert',
  }

  const result = await sendEmail({
    to: userEmail,
    subject: subjectMap[type],
    html,
  })

  if (result.success) {
    return NextResponse.json({ success: true, type })
  } else {
    return NextResponse.json({ error: 'Failed to send alert email', details: result.error }, { status: 500 })
  }
}
