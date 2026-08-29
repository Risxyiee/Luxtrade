import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { readPhotoMetadata } from '@/lib/photo-metadata'
import path from 'path'

/**
 * Match photo metadata with trade history
 * Returns trades that match the photo's timestamp
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [Photo-Trade Match] Starting photo-trade matching...')

    // Authenticate user
    const authUser = await getAuthUser(request)
    if (!authUser) {
      console.log('❌ [Photo-Trade Match] Unauthorized')
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    // User authenticated

    // Get JSON body
    const body = await request.json()
    const { fileName, accountId, toleranceMinutes = 5 } = body

    if (!fileName) {
      console.log('❌ [Photo-Trade Match] No fileName provided')
      return NextResponse.json(
        {
          error: 'fileName is required',
          warning: 'Make sure the photo has EXIF DateTime data'
        },
        { status: 400 }
      )
    }

    // Build file path
    const uploadDir = path.join(process.cwd(), 'upload')
    const filePath = path.join(uploadDir, fileName)

    console.log(`📸 [Photo-Trade Match] Reading photo: ${filePath}`)

    // Read photo metadata
    const metadata = await readPhotoMetadata(filePath)

    if (!metadata.originalDateTime) {
      console.log('❌ [Photo-Trade Match] No datetime found in EXIF')
      return NextResponse.json(
        {
          error: 'Could not extract datetime from photo',
          warning: 'Make sure the photo has EXIF DateTime data'
        },
        { status: 400 }
      )
    }

    const photoTime = metadata.indonesiaDateTime || metadata.originalDateTime
    console.log(`🕐 [Photo-Trade Match] Photo time: ${photoTime.toISOString()}`)

    // Calculate time range (± tolerance minutes)
    const toleranceMs = toleranceMinutes * 60 * 1000
    const startTime = new Date(photoTime.getTime() - toleranceMs)
    const endTime = new Date(photoTime.getTime() + toleranceMs)

    console.log(`📅 [Photo-Trade Match] Time range: ${startTime.toISOString()} to ${endTime.toISOString()}`)
    console.log(`⏱️ [Photo-Trade Match] Tolerance: ±${toleranceMinutes} minutes`)

    // Query trades within time range
    let query = `
      SELECT
        id,
        account_id,
        symbol,
        type,
        open_price,
        close_price,
        lot_size,
        profit_loss,
        open_time,
        close_time,
        session,
        setup_type,
        emotion,
        notes,
        screenshot_url
      FROM trades
      WHERE user_id = $1
        AND (
          (open_time >= $2::timestamp AND open_time <= $3::timestamp) OR
          (close_time >= $2::timestamp AND close_time <= $3::timestamp)
        )
      ORDER BY
        ABS(EXTRACT(EPOCH FROM open_time - $4::timestamp)) +
        ABS(EXTRACT(EPOCH FROM close_time - $4::timestamp)) ASC
      LIMIT 10
    `

    const params = [
      authUser.id,
      startTime.toISOString(),
      endTime.toISOString(),
      photoTime.toISOString()
    ]

    // Add account filter if provided
    if (accountId) {
      query = query.replace('WHERE user_id = $1', 'WHERE user_id = $1 AND account_id = $2')
      params.unshift(accountId) // Add accountId to beginning
    }

    console.log('🔍 [Photo-Trade Match] Querying trades...')

    // Execute query using Prisma
    const { db } = await import('@/lib/db')

    const trades = await db.$queryRawUnsafe(query, ...params)

    console.log(`📊 [Photo-Trade Match] Found ${trades.length} matching trades`)

    // Calculate match score for each trade
    const scoredTrades = (trades as any[]).map((trade: any) => {
      const openDiff = Math.abs(new Date(trade.open_time).getTime() - photoTime.getTime())
      const closeDiff = Math.abs(new Date(trade.close_time).getTime() - photoTime.getTime())
      const minDiff = Math.min(openDiff, closeDiff)
      const matchScore = 100 - (minDiff / (toleranceMs * 2) * 100)

      return {
        ...trade,
        matchScore: Math.max(0, Math.round(matchScore)),
        openDiffMinutes: Math.round(openDiff / (1000 * 60)),
        closeDiffMinutes: Math.round(closeDiff / (1000 * 60)),
        bestMatch: minDiff === openDiff ? 'open' : 'close'
      }
    })

    // Sort by match score
    scoredTrades.sort((a, b) => b.matchScore - a.matchScore)

    // Build response
    const result: any = {
      success: true,
      photo: {
        fileName: fileName,
        originalTime: metadata.originalDateTime?.toISOString(),
        originalTimeFormatted: metadata.originalDateTime?.toLocaleString(),
        indonesiaTime: metadata.indonesiaDateTime?.toISOString(),
        indonesiaTimeFormatted: metadata.indonesiaDateTime?.toLocaleString(),
        timezone: metadata.indonesiaTimezone || metadata.originalTimezone,
        isInIndonesia: !!metadata.indonesiaDateTime
      },
      search: {
        timeRange: {
          start: startTime.toISOString(),
          end: endTime.toISOString()
        },
        toleranceMinutes: toleranceMinutes
      },
      matches: scoredTrades
    }

    // Determine best match
    if (scoredTrades.length > 0 && scoredTrades[0].matchScore >= 50) {
      result.bestMatch = scoredTrades[0]
      result.message = `Found ${scoredTrades.length} trade(s) matching photo time. Best match: ${scoredTrades[0].symbol} (${scoredTrades[0].type}) with ${scoredTrades[0].matchScore}% confidence`
    } else if (scoredTrades.length > 0) {
      result.message = `Found ${scoredTrades.length} trade(s) but with low confidence. Consider expanding the time tolerance.`
    } else {
      result.message = 'No trades found matching the photo time. Make sure you have trades recorded in this time period.'
    }

    console.log('✅ [Photo-Trade Match] Matching completed')

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [Photo-Trade Match] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to match photo with trades',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Get all photos for a user with matched trades
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // List uploaded files
    const { readdir } = await import('fs/promises')
    const uploadDir = path.join(process.cwd(), 'upload')
    let files: string[] = []

    try {
      files = await readdir(uploadDir)
    } catch {
      files = []
    }

    return NextResponse.json({
      success: true,
      files: files.sort()
    })

  } catch (error) {
    console.error('❌ [Photo-Trade Match] Error listing files:', error)
    return NextResponse.json(
      {
        error: 'Failed to list files',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}