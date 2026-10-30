import { NextRequest, NextResponse } from 'next/server'
import { createAdminClientAsync } from '@/lib/supabase/admin'
import { sendPushToUser, type PushPayload } from '@/lib/web-push'
import { isUserPro } from '@/lib/pro-check'
import { requireAdmin } from '@/lib/admin-auth'
import { getEnvVar } from '@/lib/cloudflare-bindings'

/**
 * P0 HARDENING: dulu endpoint ini TERBUKA — siapapun bisa broadcast push
 * ke RIBUAN user sekaligus (vektor spam/phishing massal). Sekarang hanya:
 *   1. Cron/internal service dengan Bearer CRON_SECRET (dipakai
 *      /api/cron/econ-calendar-notify), atau
 *   2. Admin panel (session Bos).
 * Fail-closed di produksi kalau CRON_SECRET tidak diset. Dev lokal tetap
 * terbuka untuk testing.
 */
async function isCronOrAdmin(req: NextRequest): Promise<boolean> {
  let secret = ''
  try { secret = (await getEnvVar('CRON_SECRET', { quiet: true })) || '' } catch { /* abaikan */ }
  secret = secret || process.env.CRON_SECRET || ''
  if (!secret) return process.env.NODE_ENV === 'development'
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  if (provided && provided === secret) return true
  const { error } = await requireAdmin(req)
  return !error
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isCronOrAdmin(req))) {
      return NextResponse.json({ error: 'Unauthorized — push send-batch khusus cron (CRON_SECRET) atau admin' }, { status: 401 })
    }

    const body = await req.json()
    const { userIds, title, body: messageBody, icon, badge, url, tag, type } = body

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !title || !messageBody) {
      return NextResponse.json({ error: 'Missing required fields (userIds[], title, body)' }, { status: 400 })
    }

    // Limit batch size
    if (userIds.length > 1000) {
      return NextResponse.json({ error: 'Batch too large, max 1000 users' }, { status: 400 })
    }

    // Filter to only Pro users — skip non-Pro silently
    const proChecks = await Promise.all(
      userIds.map(async (uid: string) => ({
        uid,
        isPro: await isUserPro(uid),
      }))
    )
    const proUserIds = proChecks.filter(c => c.isPro).map(c => c.uid)
    const skippedCount = userIds.length - proUserIds.length

    if (proUserIds.length === 0) {
      return NextResponse.json({
        sent: 0,
        skipped: skippedCount,
        message: 'No Pro users found — push notifications require Pro',
      })
    }

    const adminClient = await createAdminClientAsync()
    if (!adminClient) {
      console.error('[push/send-batch] Supabase admin client unavailable')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Get all subscriptions for Pro users only
    const { data: subscriptions, error: subErr } = await adminClient
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id')
      .in('user_id', proUserIds)

    if (subErr) {
      console.error('[push/send-batch] Fetch subscriptions failed:', subErr.message)
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, skipped: skippedCount, message: 'No subscriptions found for Pro users' })
    }

    const payload: PushPayload = {
      title,
      body: messageBody,
      icon: icon || '/icon-192x192.png',
      badge: badge || '/icon-72x72.png',
      url: url || '/',
      tag: tag || 'broadcast',
      type: type || 'general',
    }

    // Group by user to track per-user stats
    const byUser = new Map<string, Array<{ endpoint: string; p256dh: string; auth: string }>>()
    for (const sub of subscriptions) {
      const arr = byUser.get(sub.user_id) || []
      arr.push({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth })
      byUser.set(sub.user_id, arr)
    }

    let totalSent = 0
    const allExpired: string[] = []

    // Send in parallel batches (max 50 concurrent)
    const entries = Array.from(byUser.entries())
    for (let i = 0; i < entries.length; i += 50) {
      const batch = entries.slice(i, i + 50)
      const results = await Promise.allSettled(
        batch.map(async ([, subs]) => sendPushToUser(subs, payload))
      )
      for (const r of results) {
        if (r.status === 'fulfilled') {
          totalSent += r.value.sent
          allExpired.push(...r.value.expired)
        }
      }
    }

    // Clean up expired
    if (allExpired.length > 0) {
      await adminClient
        .from('push_subscriptions')
        .delete()
        .in('endpoint', allExpired)
    }

    return NextResponse.json({
      sent: totalSent,
      expired: allExpired.length,
      totalSubscriptions: subscriptions.length,
      totalUsers: byUser.size,
      skippedNonPro: skippedCount,
    })
  } catch (error: any) {
    console.error('[push/send-batch] Error:', error.message)
    return NextResponse.json({ error: 'Failed to send batch push' }, { status: 500 })
  }
}
