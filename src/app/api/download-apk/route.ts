import { NextRequest, NextResponse } from 'next/server'

/**
 * APK Download API Route
 *
 * The APK file has been removed from the repository.
 * Returns 404 with a message indicating the APK is no longer available.
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: 'APK file is no longer available for direct download. Please use the PWA version at luxtradee.web.id instead.' },
    { status: 404 }
  )
}
