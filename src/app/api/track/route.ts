import { NextRequest, NextResponse } from 'next/server'
import { analyticsData, cleanupOldVisits } from '@/lib/analytics-memory'

function detectDevice(ua: string): string {
  if (!ua) return 'Unknown'
  if (/Mobile|Android.*Mobile|iPhone|iPod/.test(ua)) return 'Mobile'
  if (/iPad|Android(?!.*Mobile)|Tablet/.test(ua)) return 'Tablet'
  return 'Desktop'
}

function detectBrowser(ua: string): string {
  if (!ua) return 'Unknown'
  if (/Edg\//.test(ua)) return 'Edge'
  if (/OPR|Opera/.test(ua)) return 'Opera'
  if (/Chrome/.test(ua)) return 'Chrome'
  if (/Safari/.test(ua)) return 'Safari'
  if (/Firefox/.test(ua)) return 'Firefox'
  return 'Other'
}

function detectOS(ua: string): string {
  if (!ua) return 'Unknown'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Mac OS X/.test(ua)) return 'macOS'
  if (/Linux/.test(ua)) return 'Linux'
  if (/Android/.test(ua)) return 'Android'
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS'
  return 'Other'
}

// Rate limit: only record once per IP per page per 5 minutes
const recentVisitsCache = new Map<string, number>()
const RATE_LIMIT_MS = 5 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { path, referrer, userAgent } = body

    if (!path) {
      return NextResponse.json({ ok: true })
    }

    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'direct'

    // Rate limit check
    const cacheKey = `${ip}:${path}`
    const lastVisit = recentVisitsCache.get(cacheKey)
    if (lastVisit && Date.now() - lastVisit < RATE_LIMIT_MS) {
      return NextResponse.json({ ok: true, rateLimited: true })
    }
    recentVisitsCache.set(cacheKey, Date.now())

    // Clean up old entries
    if (recentVisitsCache.size > 1000) {
      const now = Date.now()
      for (const [key, time] of recentVisitsCache.entries()) {
        if (now - time > RATE_LIMIT_MS) recentVisitsCache.delete(key)
      }
    }

    const ua = userAgent || ''
    const device = detectDevice(ua)
    const browser = detectBrowser(ua)
    const os = detectOS(ua)

    // Update in-memory analytics (no database required)
    analyticsData.pageViews++
    analyticsData.uniqueVisitors.add(ip)
    analyticsData.deviceStats[device as keyof typeof analyticsData.deviceStats]++
    analyticsData.browserStats[browser as keyof typeof analyticsData.browserStats]++
    analyticsData.osStats[os as keyof typeof analyticsData.osStats]++

    // Track top pages
    const currentCount = analyticsData.topPages.get(path) || 0
    analyticsData.topPages.set(path, currentCount + 1)

    // Store visit in recent visits for analytics traffic endpoint
    analyticsData.recentVisits.push({
      path,
      referrer: referrer || null,
      device,
      browser,
      os,
      ip,
      createdAt: new Date(),
    })

    // Cleanup old visits periodically
    cleanupOldVisits()

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Track error:', error)
    return NextResponse.json({ ok: true }) // Silent fail - never break the page
  }
}
