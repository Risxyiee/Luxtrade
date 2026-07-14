import { NextResponse } from 'next/server'
import { db, isDatabaseAvailable, ensureSchema } from '@/lib/db'

/**
 * GET /api/cron/downgrade-expired-pro
 * Cron job: checks all PRO users whose pro_expiry has passed and downgrades them to FREE.
 * Called by system cron or Vercel Cron.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    if (!isDatabaseAvailable()) {
      return NextResponse.json({ message: 'DB not available', downgraded: 0 })
    }

    await ensureSchema()

    // Find all PRO users whose expiry has passed
    const expiredUsers: any[] = await db.$queryRawUnsafe(`
      SELECT id, email, full_name, pro_expiry, subscription_until
      FROM profiles
      WHERE plan = 'PRO'
        AND is_pro = true
        AND pro_expiry IS NOT NULL
        AND pro_expiry < NOW()
    `)

    if (!expiredUsers || expiredUsers.length === 0) {
      return NextResponse.json({ message: 'No expired PRO users', downgraded: 0 })
    }

    // Downgrade all expired users
    const userIds = expiredUsers.map((u: any) => u.id)

    await db.$executeRawUnsafe(`
      UPDATE profiles
      SET
        plan = 'FREE',
        is_pro = false,
        subscription_until = NULL,
        pro_expiry = NULL,
        updated_at = NOW()
      WHERE id = ANY($1)
        AND plan = 'PRO'
        AND is_pro = true
        AND pro_expiry IS NOT NULL
        AND pro_expiry < NOW();
    `, userIds)

    // Also expire their subscriptions
    await db.$executeRawUnsafe(`
      UPDATE user_subscriptions
      SET status = 'expired', updated_at = NOW()
      WHERE user_id = ANY($1)
        AND status = 'active'
        AND end_date < NOW();
    `, userIds)

    // Log
    for (const u of expiredUsers) {
      console.log(`⬇️ [cron/downgrade] ${u.email || u.id} downgraded from PRO → FREE (expired ${u.pro_expiry})`)
    }

    return NextResponse.json({
      message: `Downgraded ${expiredUsers.length} expired PRO user(s)`,
      downgraded: expiredUsers.length,
      users: expiredUsers.map((u: any) => ({ id: u.id, email: u.email, name: u.full_name }))
    })
  } catch (error: any) {
    console.error('[cron/downgrade-expired-pro] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Also support POST for manual trigger
export async function POST() {
  return GET()
}