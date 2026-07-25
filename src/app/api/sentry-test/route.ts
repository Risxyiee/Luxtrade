import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

/**
 * TEST ENDPOINT — Temporary, for verifying Sentry integration.
 * DELETE THIS FILE after confirming errors appear in Sentry dashboard.
 *
 * Usage: GET /api/sentry-test
 */
export async function GET() {
  try {
    // Capture a manual message (not an exception)
    Sentry.captureMessage('[LUXTRADE SENTRY TEST] This is a test message from /api/sentry-test', 'info')

    // Throw an error to test exception capture
    throw new Error('[LUXTRADE SENTRY TEST] Intentional test error — please ignore. This confirms Sentry is working.')
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json(
      { message: 'Sentry test error sent. Check your Sentry dashboard.', error: String(error) },
      { status: 500 }
    )
  }
}
