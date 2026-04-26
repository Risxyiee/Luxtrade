import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '7d' // 7d, 30d, 90d

    const days = range === '90d' ? 90 : range === '30d' ? 30 : 7
    const since = new Date()
    since.setDate(since.getDate() - days)

    // Get all visits in range
    const visits = await db.pageVisit.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    })

    // Total page views
    const totalPageViews = visits.length

    // Unique visitors (by IP)
    const uniqueIPs = new Set(visits.map(v => v.ip))
    const uniqueVisitors = uniqueIPs.size

    // Today's stats
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayVisits = visits.filter(v => v.createdAt >= todayStart)
    const todayPageViews = todayVisits.length
    const todayUniqueVisitors = new Set(todayVisits.map(v => v.ip)).size

    // Yesterday stats
    const yesterdayStart = new Date()
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    yesterdayStart.setHours(0, 0, 0, 0)
    const yesterdayEnd = new Date()
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1)
    yesterdayEnd.setHours(23, 59, 59, 999)
    const yesterdayVisits = visits.filter(v => v.createdAt >= yesterdayStart && v.createdAt <= yesterdayEnd)
    const yesterdayPageViews = yesterdayVisits.length

    // Daily chart data
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
