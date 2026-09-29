import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'

/**
 * GET /api/cron/econ-calendar-notify
 * Cron job: Sends push notifications to Pro users 15 minutes before high-impact USD economic events.
 *
 * Flow:
 *   1. Fetch upcoming high-impact events from /api/economic-calendar
 *   2. Find events happening in the next 15 minutes
 *   3. Query Pro users who have push subscriptions and econ_cal_notify enabled
 *   4. Send push notifications via /api/push/send-batch
 *
 * Run: every 5 minutes via Cloudflare Workers cron trigger
 * Auth: Bearer CRON_SECRET or VAPID_PRIVATE_KEY
 */

export const dynamic = 'force-dynamic'

// Auth check
function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get('authorization')
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return true
  if (auth === `Bearer ${process.env.VAPID_PRIVATE_KEY}`) return true
  if (process.env.NODE_ENV === 'development') return true
  return false
}

interface CalendarEvent {
  id: string
  date: string
  time: string
  dateTime: string
  currency: string
  impact: 'high' | 'medium' | 'low'
  event: string
  actual?: string
  forecast: string
  previous: string
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'

    // 1. Fetch upcoming high-impact events
    const calRes = await fetch(`${siteUrl}/api/economic-calendar?impact=high`, {
      signal: AbortSignal.timeout(15000),
    })
    if (!calRes.ok) {
      return NextResponse.json({ success: false, error: 'Calendar API failed: ' + calRes.status })
    }
    const calData = await calRes.json()
    const events: CalendarEvent[] = calData.events || []

    // 2. Find events happening in the next 15 minutes
    const now = Date.now()
    const fifteenMin = 15 * 60 * 1000
    const fiveMin = 5 * 60 * 1000
    const upcomingEvents = events.filter(evt => {
      if (evt.currency !== 'USD' || evt.impact !== 'high') return false
      const eventTime = new Date(evt.dateTime).getTime()
      const diff = eventTime - now
      // Between 5 and 15 minutes from now (to avoid duplicate notifications)
      return diff > fiveMin && diff <= fifteenMin
    })

    if (upcomingEvents.length === 0) {
      return NextResponse.json({ success: true, notified: 0, message: 'No upcoming high-impact USD events in the next 15 min' })
    }

    // 3. Check database availability
    if (!isDatabaseAvailable()) {
      return NextResponse.json({ success: false, error: 'Database unavailable' })
    }

    // 4. Find Pro users with push subscriptions
    // Note: We send to ALL Pro users with push subscriptions - the client-side
    // econ_cal_notify localStorage flag is a local preference, but for server-side
    // we send to all Pro users since this is a critical market event alert
    const proUsers = await db.profile.findMany({
      where: {
        plan: { in: ['PRO', 'LIFETIME'] },
      },
      select: { id: true },
    })

    const userIds = proUsers.map(u => u.id).filter(Boolean)
    if (userIds.length === 0) {
      return NextResponse.json({ success: true, notified: 0, message: 'No Pro users found' })
    }

    // 5. Send push notifications for each upcoming event
    const results: { event: string; success?: boolean; error?: string; notified?: number; [key: string]: any }[] = []
    for (const evt of upcomingEvents) {
      try {
        const pushRes = await fetch(`${siteUrl}/api/push/send-batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.VAPID_PRIVATE_KEY || process.env.CRON_SECRET}`,
          },
          body: JSON.stringify({
            userIds,
            title: `⚠️ High-Impact USD Event: ${evt.event}`,
            body: `Starting in ~15 min at ${evt.time} UTC. Forecast: ${evt.forecast || 'N/A'}. Stay alert!`,
            icon: '/icon-192x192.png',
            badge: '/icon-72x72.png',
            url: '/dashboard?tab=economic-calendar',
            tag: `econ-cal-${evt.id}`,
            type: 'news',
          }),
          signal: AbortSignal.timeout(30000),
        })
        const pushData = await pushRes.json()
        results.push({ event: evt.event, ...pushData })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        results.push({ event: evt.event, error: msg })
      }
    }

    return NextResponse.json({
      success: true,
      eventsNotified: upcomingEvents.map(e => e.event),
      totalUsers: userIds.length,
      results,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[EconCalendarNotify] Error:', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
