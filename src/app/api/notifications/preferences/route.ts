import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { db } from '@/lib/db'

const DEFAULT_PREFERENCES = {
  emailDigest: 'daily' as const,
  tradeAlerts: {
    bigWin: true,
    bigLoss: true,
    streak: true,
    dailyLimit: true,
  },
  thresholds: {
    bigWinAmount: 100,
    bigLossAmount: -100,
    maxDailyLosses: 5,
  },
  inApp: true,
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
    // Column may already exist or race condition — ignore
  }
}

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth(request)
  if (error) return error

  await ensureColumn()

  try {
    const rows: { notification_preferences: unknown }[] = await db.$queryRawUnsafe(
      `SELECT notification_preferences FROM profiles WHERE id = $1`,
      user.id
    )

    const raw = rows[0]?.notification_preferences
    let prefs = raw ? (raw as Record<string, unknown>) : {}

    // Merge with defaults so frontend always gets full shape
    const merged = {
      ...DEFAULT_PREFERENCES,
      ...prefs,
      tradeAlerts: {
        ...DEFAULT_PREFERENCES.tradeAlerts,
        ...(prefs.tradeAlerts as Record<string, unknown> || {}),
      },
      thresholds: {
        ...DEFAULT_PREFERENCES.thresholds,
        ...(prefs.thresholds as Record<string, unknown> || {}),
      },
    }

    return NextResponse.json({ preferences: merged })
  } catch {
    // Column may not be readable yet — return defaults
    return NextResponse.json({ preferences: DEFAULT_PREFERENCES })
  }
}

export async function PUT(request: NextRequest) {
  const { error, user } = await requireAuth(request)
  if (error) return error

  await ensureColumn()

  try {
    const body = await request.json()
    const { emailDigest, tradeAlerts, thresholds, inApp } = body

    // Validate types
    if (emailDigest && !['daily', 'weekly', 'off'].includes(emailDigest)) {
      return NextResponse.json({ error: 'Invalid emailDigest value' }, { status: 400 })
    }

    const preferences: Record<string, unknown> = {}
    if (emailDigest !== undefined) preferences.emailDigest = emailDigest
    if (tradeAlerts !== undefined) {
      preferences.tradeAlerts = {
        bigWin: Boolean(tradeAlerts.bigWin),
        bigLoss: Boolean(tradeAlerts.bigLoss),
        streak: Boolean(tradeAlerts.streak),
        dailyLimit: Boolean(tradeAlerts.dailyLimit),
      }
    }
    if (thresholds !== undefined) {
      preferences.thresholds = {
        bigWinAmount: Number(thresholds.bigWinAmount) || 100,
        bigLossAmount: Number(thresholds.bigLossAmount) || -100,
        maxDailyLosses: Number(thresholds.maxDailyLosses) || 5,
      }
    }
    if (inApp !== undefined) preferences.inApp = Boolean(inApp)

    await db.$executeRawUnsafe(
      `UPDATE profiles SET notification_preferences = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      JSON.stringify(preferences),
      user.id
    )

    return NextResponse.json({ success: true, preferences })
  } catch (err) {
    console.error('Failed to save notification preferences:', err)
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }
}
