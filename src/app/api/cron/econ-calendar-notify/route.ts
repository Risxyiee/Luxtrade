import { NextRequest, NextResponse } from 'next/server'
import { getCronAdmin, fetchAllRows } from '@/lib/cron-supabase'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { pushToUsers } from '@/lib/push-notify'

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
async function isAuthorized(request: NextRequest): Promise<boolean> {
  const auth = request.headers.get('authorization')
  // getEnvVar reads CF bindings/secrets reliably on Workers
  const cronSecret = (await getEnvVar('CRON_SECRET')) || process.env.CRON_SECRET
  const vapidKey = (await getEnvVar('VAPID_PRIVATE_KEY')) || process.env.VAPID_PRIVATE_KEY
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true
  if (vapidKey && auth === `Bearer ${vapidKey}`) return true
  // P0 hardening: FAIL-CLOSED — tanpa secret terkonfigurasi, DITOLAK di produksi
  // (dulu: allow "supaya scheduled handler jalan" → endpoint terbuka buat umum).
  if (!cronSecret && !vapidKey) return process.env.NODE_ENV === 'development'
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
  if (!(await isAuthorized(request))) {
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
    // Jendela (1 min .. 15 min]: cron jalan tiap 15 menit, jadi tiap event
    // jatuh di tepat satu jendela. Threshold lama 5 menit MEMBUANG event
    // di menit ke-16..20 setelah tick sebelumnya (diff < 5 saat tick berikut).
    const oneMin = 60 * 1000
    const upcomingEvents = events.filter(evt => {
      if (evt.currency !== 'USD' || evt.impact !== 'high') return false
      const eventTime = new Date(evt.dateTime).getTime()
      const diff = eventTime - now
      // Between 1 and 15 minutes from now (dedupe antar-tick via window)
      return diff > oneMin && diff <= fifteenMin
    })

    if (upcomingEvents.length === 0) {
      return NextResponse.json({ success: true, notified: 0, message: 'No upcoming high-impact USD events in the next 15 min' })
    }

    // 3. Check database availability (Supabase admin — Prisma cannot run on CF Workers)
    const admin = await getCronAdmin()
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Database unavailable' })
    }

    // 4. Find Pro users with push subscriptions + match currency watchlist
    const proUsers = await fetchAllRows<any>((from, to) =>
      admin.from('profiles')
        .select('id')
        .in('plan', ['PRO', 'LIFETIME'])
        .range(from, to)
    )

    const userIds = proUsers.map(u => u.id).filter(Boolean)
    if (userIds.length === 0) {
      return NextResponse.json({ success: true, notified: 0, message: 'No Pro users found' })
    }

    // Currency matching: user peduli event jika mata uangnya ada di watchlist
    // (EURUSD → EUR+USD; XAUUSD → XAU+USD). Tanpa watchlist → USD saja
    // (USD high-impact menggerakkan semua pair utama & gold).
    const watchRows = await fetchAllRows<any>((from, to) =>
      admin.from('watchlist')
        .select('user_id,symbol')
        .in('user_id', userIds)
        .range(from, to)
    )
    const currByUser = new Map<string, Set<string>>()
    for (const row of watchRows || []) {
      const uid = row?.user_id
      const sym = String(row?.symbol || '').toUpperCase().replace(/[^A-Z]/g, '')
      if (!uid || sym.length < 6) continue
      const set = currByUser.get(uid) ?? new Set<string>()
      set.add(sym.slice(0, 3))
      set.add(sym.slice(3, 6))
      currByUser.set(uid, set)
    }

    // 5. Push langsung via pushToUsers (satu pintu — TANPA self-fetch ke
    // send-batch): otomatis masuk feed in-app Bell + hygiene endpoint mati.
    const results: { event: string; targets?: number; pushSent?: number; error?: string; message?: string }[] = []
    for (const evt of upcomingEvents) {
      try {
        const targets = userIds.filter(uid => {
          const cur = currByUser.get(uid)
          if (!cur || cur.size === 0) return evt.currency === 'USD'
          return cur.has(evt.currency)
        })
        if (targets.length === 0) {
          results.push({ event: evt.event, message: 'no watchlist match for ' + evt.currency })
          continue
        }

        const sent = await pushToUsers(
          admin,
          targets,
          {
            title: `⚠️ High-Impact ${evt.currency} Event: ${evt.event}`,
            body: `Starting in ~15 min at ${evt.time} UTC. Forecast: ${evt.forecast || 'N/A'}. Stay alert!`,
            icon: '/icon-192x192.png',
            badge: '/icon-72x72.png',
            url: '/dashboard?tab=economic-calendar',
            tag: `econ-cal-${evt.id}`,
            type: 'news',
            urgency: 'high',
          },
          { delayMs: 30 }
        )
        const pushSent = sent.filter(r => r.sent > 0).length
        results.push({ event: evt.event, targets: targets.length, pushSent })
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
