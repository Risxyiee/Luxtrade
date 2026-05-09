import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// Auto-create table if not exists (for production deploy)
async function ensureTable() {
  try {
    await db.pageVisit.count()
  } catch {
    // Table doesn't exist, run migration
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
      console.log('PageVisit table auto-created')
    } catch (e) {
      console.error('Failed to create PageVisit table:', e)
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureTable()

    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '7d'

    const days = range === '90d' ? 90 : range === '30d' ? 30 : 7
    const since = new Date()
    since.setDate(since.getDate() - days)

    let visits: Array<{
      id: string
      path: string
      referrer: string
      device: string
      browser: string
      os: string
      country: string
      ip: string
      createdAt: Date
    }>

    try {
      visits = await db.pageVisit.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
      })
    } catch {
      visits = []
    }

    const totalPageViews = visits.length

    const uniqueIPs = new Set(visits.map(v => v.ip))
    const uniqueVisitors = uniqueIPs.size

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayVisits = visits.filter(v => v.createdAt >= todayStart)
    const todayPageViews = todayVisits.length
    const todayUniqueVisitors = new Set(todayVisits.map(v => v.ip)).size

    const yesterdayStart = new Date()
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    yesterdayStart.setHours(0, 0, 0, 0)
    const yesterdayEnd = new Date()
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1)
    yesterdayEnd.setHours(23, 59, 59, 999)
    const yesterdayVisits = visits.filter(v => v.createdAt >= yesterdayStart && v.createdAt <= yesterdayEnd)
    const yesterdayPageViews = yesterdayVisits.length

    // Daily chart
    const dailyMap = new Map<string, { views: number; unique: Set<string> }>()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      dailyMap.set(key, { views: 0, unique: new Set() })
    }
    visits.forEach(v => {
      const day = v.createdAt.toISOString().split('T')[0]
      const entry = dailyMap.get(day)
      if (entry) {
        entry.views++
        entry.unique.add(v.ip)
      }
    })
    const dailyChart = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      views: data.views,
      unique: data.unique.size,
    }))

    // Top pages
    const pageMap = new Map<string, number>()
    visits.forEach(v => {
      const path = v.path || '/'
      pageMap.set(path, (pageMap.get(path) || 0) + 1)
    })
    const topPages = Array.from(pageMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }))

    // Device breakdown
    const deviceMap: Record<string, number> = {}
    visits.forEach(v => {
      const d = v.device || 'Unknown'
      deviceMap[d] = (deviceMap[d] || 0) + 1
    })
    const devices = Object.entries(deviceMap).sort((a, b) => b[1] - a[1])

    // Browser breakdown
    const browserMap: Record<string, number> = {}
    visits.forEach(v => {
      const b = v.browser || 'Unknown'
      browserMap[b] = (browserMap[b] || 0) + 1
    })
    const browsers = Object.entries(browserMap).sort((a, b) => b[1] - a[1])

    // OS breakdown
    const osMap: Record<string, number> = {}
    visits.forEach(v => {
      const o = v.os || 'Unknown'
      osMap[o] = (osMap[o] || 0) + 1
    })
    const os = Object.entries(osMap).sort((a, b) => b[1] - a[1])

    // Referrer breakdown
    const referrerMap: Record<string, number> = {}
    visits.forEach(v => {
      let ref = v.referrer || 'Direct'
      if (!ref || ref === '') ref = 'Direct'
      try {
        const url = new URL(ref)
        ref = url.hostname.replace('www.', '')
      } catch {
        ref = 'Direct'
      }
      referrerMap[ref] = (referrerMap[ref] || 0) + 1
    })
    const referrers = Object.entries(referrerMap).sort((a, b) => b[1] - a[1]).slice(0, 10)

    // Growth vs yesterday
    const growthPercent = yesterdayPageViews > 0
      ? Math.round(((todayPageViews - yesterdayPageViews) / yesterdayPageViews) * 100)
      : todayPageViews > 0 ? 100 : 0

    return NextResponse.json({
      totalPageViews,
      uniqueVisitors,
      todayPageViews,
      todayUniqueVisitors,
      yesterdayPageViews,
      growthPercent,
      dailyChart,
      topPages,
      devices,
      browsers,
      os,
      referrers,
    })
  } catch (error) {
    console.error('Traffic analytics error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
