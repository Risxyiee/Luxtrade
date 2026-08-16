import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'

/**
 * GET|POST /api/cron/downgrade-expired-pro
 *
 * Cron job: checks all PRO users whose subscription has expired and downgrades them to FREE.
 * Runs daily at 03:00 WIB via Vercel Cron (vercel.json).
 *
 * Smart downgrade logic:
 * - Finds PRO users with expired pro_expiry / subscription_until
 * - Marks their user_subscriptions as 'expired'
 * - Only downgrades profile if NO other active subscription exists
 * - Syncs Supabase Auth metadata
 * - Protected by CRON_SECRET (consistent with other cron endpoints)
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handleRequest(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === 'true'

  // Auth check: require CRON_SECRET (consistent with daily-reminder, re-engage, weekly-summary)
  const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!force && process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isDatabaseAvailable()) {
    return NextResponse.json({ message: 'DB not available', downgraded: 0 })
  }

  // Ensure tables exist
  try {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS user_subscriptions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, plan TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(), end_date TIMESTAMPTZ, promo_code_id TEXT, discount_percent DOUBLE PRECISION NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
  } catch {}

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

  const userIds = expiredUsers.map((u: any) => u.id)

  // 1. Mark expired user_subscriptions as 'expired'
  await db.$executeRawUnsafe(`
    UPDATE user_subscriptions
    SET status = 'expired', updated_at = NOW()
    WHERE user_id = ANY($1)
      AND status = 'active'
      AND end_date < NOW();
  `, userIds)

  // 2. Downgrade profiles — but only if they have NO other active subscription
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
      AND pro_expiry < NOW()
      AND id NOT IN (
        SELECT user_id FROM user_subscriptions
        WHERE status = 'active' AND (promo_code_id IS NULL OR end_date >= NOW())
      );
  `, userIds)

  // 3. Sync Supabase Auth metadata (non-critical)
  try {
    const { getAdminAuth } = await import('@/lib/supabase-admin-alt')
    const authAdmin = getAdminAuth()
    if (authAdmin) {
      for (const uid of userIds) {
        try {
          const { data: { user: authUser } } = await authAdmin.getUserById(uid)
          const currentMeta = authUser?.user_metadata || {}
          await authAdmin.updateUserById(uid, {
            user_metadata: {
              ...currentMeta,
              is_pro: false,
              subscription_status: 'expired',
              subscription_until: null,
              updated_at: new Date().toISOString()
            }
          })
        } catch {
          // skip individual failures
        }
      }
    }
  } catch {
    // non-critical
  }

  // Log (PII redacted — only log user ID, not email)
  for (const u of expiredUsers) {
    console.log(`⬇️ [cron/downgrade] user=${u.id} downgraded from PRO → FREE (expired ${u.pro_expiry})`)
  }

  return NextResponse.json({
    message: `Downgraded ${expiredUsers.length} expired PRO user(s)`,
    downgraded: expiredUsers.length,
    users: expiredUsers.map((u: any) => ({ id: u.id, email: u.email, name: u.full_name }))
  })
}

export async function GET(request: NextRequest) {
  try {
    return await handleRequest(request)
  } catch (error: any) {
    console.error('[cron/downgrade-expired-pro] Error:', error)
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handleRequest(request)
  } catch (error: any) {
    console.error('[cron/downgrade-expired-pro] Error:', error)
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
  }
}