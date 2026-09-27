import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/track - Analytics and telemetry tracking endpoint
 *
 * This endpoint handles frontend telemetry/analytics data.
 * It silently logs tracking data without blocking user experience.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Extract tracking data
    const {
      event,
      userId,
      sessionId,
      page,
      action,
      metadata = {},
      timestamp = new Date().toISOString()
    } = body

    // Derive event name: explicit event > action > page > 'page_view'
    // This makes the endpoint resilient to clients that send action/page without event
    const eventName = event || action || (page ? `view_${page}` : null) || 'page_view'

    // Log tracking data (in production, this would go to analytics service)
    // Using console.info for analytics logs to distinguish from regular logs
    console.info(`[Track] ${eventName}`, {
      userId,
      sessionId,
      page,
      action,
      metadata,
      timestamp
    })

    // For now, silently acknowledge the tracking event
    return NextResponse.json({
      success: true,
      tracked: true,
      event: eventName,
      timestamp
    })

  } catch (error: any) {
    // Silently fail to avoid blocking user experience
    // Log at debug level only
    if (process.env.NODE_ENV === 'development') {
      console.debug('[Track] Silent failure:', error.message)
    }

    // Always return success to avoid breaking frontend
    return NextResponse.json({
      success: true,
      tracked: false,
      message: 'Tracking acknowledged (silently failed)'
    })
  }
}

/**
 * GET /api/track - Get tracking status (optional)
 */
export async function GET() {
  return NextResponse.json({
    status: 'operational',
    version: '1.0.0',
    message: 'Tracking endpoint is available'
  })
}