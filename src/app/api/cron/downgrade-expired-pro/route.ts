import { NextRequest, NextResponse } from 'next/server'
import { getCronAdmin, fetchAllRows, isMissingTableError } from '@/lib/cron-supabase'
import { getEnvVar } from '@/lib/cloudflare-bindings'

/**
 * GET|POST /api/cron/downgrade-expired-pro
 *
 * Cron job: checks all PRO users whose subscription has expired and downgrades them to FREE.
 * Runs daily at 03:00 WIB via Cloudflare Workers cron trigger (wrangler.toml).
 *
 * Uses Supabase REST (Prisma cannot run on CF Workers — its engine calls
 * fs.readdir which unenv throws on).
 *
 * Smart downgrade logic:
 * - Finds PRO users with expired pro_expiry
 * - Marks their user_subscriptions as 'expired'
 * - Only downgrades profile if NO other active subscription exists
 * - Syncs Supabase Auth metadata
 * - Protected by CRON_SECRET (consistent with other cron endpoints)
 */
export const dynamic = 'force-dynamic'

async function handleRequest(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === 'true'

  // Auth check (getEnvVar reads CF bindings/secrets reliably on Workers)
  const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '')
  const expectedSecret = (await getEnvVar('CRON_SECRET')) || process.env.CRON_SECRET
  if (!force && expectedSecret && cronSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = await getCronAdmin()
  if (!admin) {
    return NextResponse.json({ message: 'DB not available', downgraded: 0 })
  }

  const nowIso = new Date().toISOString()

  // Find all PRO users whose expiry has passed
  const expiredUsers: any[] = await fetchAllRows<any>((from, to) =>
    admin.from('profiles')
      .select('id, email, full_name, pro_expiry')
      .eq('plan', 'PRO')
      .eq('is_pro', true)
      .not('pro_expiry', 'is', null)
      .lt('pro_expiry', nowIso)
      .range(from, to)
  )

  if (!expiredUsers || expiredUsers.length === 0) {
    return NextResponse.json({ message: 'No expired PRO users', downgraded: 0 })
  }

  const userIds = expiredUsers.map((u: any) => u.id)

  // 1. Mark expired user_subscriptions as 'expired'
  {
    const { error } = await admin.from('user_subscriptions')
      .update({ status: 'expired', updated_at: nowIso })
      .in('user_id', userIds)
      .eq('status', 'active')
      .lt('end_date', nowIso)
    if (error && !isMissingTableError(error)) {
      console.warn('[cron/downgrade] subscriptions update failed:', error.message)
    }
  }

  // 2. Downgrade profiles — but only if they have NO other active subscription.
  //    Fetch each user's active subscriptions, apply the promo/end_date condition in JS.
  const protectedIds = new Set<string>()
  try {
    const activeSubs = await fetchAllRows<any>((from, to) =>
      admin.from('user_subscriptions')
        .select('user_id, promo_code_id, end_date')
        .in('user_id', userIds)
        .eq('status', 'active')
        .range(from, to)
    )
    activeSubs.forEach((s: any) => {
      // Mirror SQL: promo_code_id IS NULL OR end_date >= NOW()
      if (s.promo_code_id == null || (s.end_date && new Date(s.end_date) >= new Date(nowIso))) {
        protectedIds.add(s.user_id)
      }
    })
  } catch (err: any) {
    if (!isMissingTableError(err)) {
      console.warn('[cron/downgrade] active subs query failed:', err.message)
    }
  }
  const downgradableIds = userIds.filter((id: string) => !protectedIds.has(id))

  if (downgradableIds.length > 0) {
    const { error } = await admin.from('profiles')
      .update({
        plan: 'FREE',
        is_pro: false,
        subscription_until: null,
        pro_expiry: null,
        updated_at: nowIso,
      })
      .in('id', downgradableIds)
      .eq('plan', 'PRO')
      .eq('is_pro', true)
      .not('pro_expiry', 'is', null)
      .lt('pro_expiry', nowIso)
    if (error) {
      console.error('[cron/downgrade] profiles downgrade failed:', error.message)
      return NextResponse.json({ error: 'Downgrade failed: ' + error.message }, { status: 500 })
    }
  }

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