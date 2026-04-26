import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Simple device detection
function detectDevice(ua: string): string {
  if (!ua) return 'Unknown'
  if (/Mobile|Android.*Mobile|iPhone|iPod/.test(ua)) return 'Mobile'
  if (/iPad|Android(?!.*Mobile)|Tablet/.test(ua)) return 'Tablet'
  return 'Desktop'
}

// Simple browser detection
function detectBrowser(ua: string): string {
  if (!ua) return 'Unknown'
  if (/Edg\//.test(ua)) return 'Edge'
  if (/OPR|Opera/.test(ua)) return 'Opera'
  if (/Chrome/.test(ua)) return 'Chrome'
  if (/Safari/.test(ua)) return 'Safari'
  if (/Firefox/.test(ua)) return 'Firefox'
  return 'Other'
}

// Simple OS detection
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
const recentVisits = new Map<string, number>()
const RATE_LIMIT_MS = 5 * 60 * 1000 // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { path, referrer, userAgent, screenWidth } = body

    if (!path) {
      return NextResponse.json({ ok: true })
    }

    // Get IP
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'direct'

    // Rate limit check
    const cacheKey = `${ip}:${path}`
    const lastVisit = recentVisits.get(cacheKey)
    if (lastVisit && Date.now() - lastVisit < RATE_LIMIT_MS) {
      return NextResponse.json({ ok: true, rateLimited: true })
    }
    recentVisits.set(cacheKey, Date.now())

    // Clean up old entries every 1000 requests
    if (recentVisits.size > 1000) {
      const now = Date.now()
      for (const [key, time] of recentVisits.entries()) {
        if (now - time > RATE_LIMIT_MS) recentVisits.delete(key)
      }
    }

    const ua = userAgent || ''

    await db.pageVisit.create({
      data: {
        path: path.substring(0, 500),
        referrer: referrer ? referrer.substring(0, 500) : '',
        device: detectDevice(ua),
        browser: detectBrowser(ua),
        os: detectOS(ua),
        ip: ip.substring(0, 45),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Track error:', error)
    return NextResponse.json({ ok: true }) // Silent fail
  }
}
