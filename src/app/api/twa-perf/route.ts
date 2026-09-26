import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/twa-perf
 * Receives TWA/WebView performance metrics for monitoring.
 * Logs them for analysis — can be extended to store in DB or send to analytics.
 */
export async function POST(req: NextRequest) {
  try {
    const metrics = await req.json()

    // Validate required fields
    if (!metrics || typeof metrics !== 'object') {
      return NextResponse.json({ error: 'Invalid metrics payload' }, { status: 400 })
    }

    // Log metrics for monitoring
    const timestamp = new Date().toISOString()
    console.log(`[twa-perf] ${timestamp}`, JSON.stringify({
      // Common TWA performance metrics
      pageLoadTime: metrics.pageLoadTime,
      firstContentfulPaint: metrics.firstContentfulPaint,
      largestContentfulPaint: metrics.largestContentfulPaint,
      timeToInteractive: metrics.timeToInteractive,
      domContentLoaded: metrics.domContentLoaded,
      // Custom metrics
      dashboardLoadTime: metrics.dashboardLoadTime,
      apiCallDuration: metrics.apiCallDuration,
      swReadyTime: metrics.swReadyTime,
      // Context
      url: metrics.url,
      userAgent: metrics.userAgent,
      connectionType: metrics.connectionType,
      isTWA: metrics.isTWA,
      timestamp,
    }))

    return NextResponse.json({ ok: true, timestamp })
  } catch (error: any) {
    console.error('[twa-perf] Error:', error.message)
    return NextResponse.json({ error: 'Failed to process metrics' }, { status: 500 })
  }
}
