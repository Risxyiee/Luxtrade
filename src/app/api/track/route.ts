import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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
const recentVisits = new Map<string, number>()
const RATE_LIMIT_MS = 5 * 60 * 1000

// Auto-create table if not exists (for production deploy)
async function ensureTable() {
  try {
    await db.pageVisit.count()
  } catch {
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PageVisit" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "path" TEXT NOT NULL DEFAULT '',
          "referrer" TEXT NOT NULL DEFAULT '',
          "device" TEXT NOT NULL DEFAULT '',
          "browser" TEXT NOT NULL DEFAULT '',
          "os" TEXT NOT NULL DEFAULT '',
          "country" TEXT NOT NULL DEFAULT '',
          "ip" TEXT NOT NULL DEFAULT '',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `)
      console.log('PageVisit table auto-created (track)')
    } catch (e) {
      console.error('Failed to create PageVisit table:', e)
    }
  }
}

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
    const lastVisit = recentVisits.get(cacheKey)
    if (lastVisit && Date.now() - lastVisit < RATE_LIMIT_MS) {
      return NextResponse.json({ ok: true, rateLimited: true })
    }
    recentVisits.set(cacheKey, Date.now())

    // Clean up old entries
    if (recentVisits.size > 1000) {
      const now = Date.now()
      for (const [key, time] of recentVisits.entries()) {
        if (now - time > RATE_LIMIT_MS) recentVisits.delete(key)
      }
    }

    await ensureTable()

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
    return NextResponse.json({ ok: true }) // Silent fail - never break the page
  }
}
