import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { readPhotoMetadata } from '@/lib/photo-metadata'
import path from 'path'
import { readdir } from 'fs/promises'

/**
 * Batch match multiple photos with trade history
 * Ideal for matching 5 photos with trading history
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [Batch Photo Match] Starting batch photo-trade matching...')

    // Authenticate user
    const { supabase } = createClientForApi(request)
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    // User authenticated

    // Get JSON body
    const body = await request.json()
    const { fileNames, accountId, toleranceMinutes = 5 } = body

    if (!fileNames || !Array.isArray(fileNames) || fileNames.length === 0) {
      return NextResponse.json(
        { error: 'fileNames is required (array of filenames)' },
        { status: 400 }
      )
    }

    console.log(`📸 [Batch Photo Match] Processing ${fileNames.length} photos`)

    const results: any[] = []
    const uploadDir = path.join(process.cwd(), 'upload')

    // Process each photo
    for (const fileName of fileNames) {
      try {
        console.log(`\n📸 [Batch Photo Match] Processing: ${fileName}`)

        // Read photo metadata
        const filePath = path.join(uploadDir, fileName)
        const metadata = await readPhotoMetadata(filePath)

        if (!metadata.originalDateTime) {
          console.log(`⚠️ [Batch Photo Match] No datetime in: ${fileName}`)
          results.push({
            fileName: fileName,
            success: false,
            error: 'No EXIF datetime found',
            metadata: {
              hasOriginalTime: !!metadata.originalDateTime,
              hasIndonesiaTime: !!metadata.indonesiaDateTime
            }
          })
          continue
        }

        const photoTime = metadata.indonesiaDateTime || metadata.originalDateTime
        console.log(`🕐 [Batch Photo Match] Photo time: ${photoTime.toISOString()}`)

        // Calculate time range
        const toleranceMs = toleranceMinutes * 60 * 1000
        const startTime = new Date(photoTime.getTime() - toleranceMs)
        const endTime = new Date(photoTime.getTime() + toleranceMs)

        // Query trades
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
            notes
          FROM trades
          WHERE user_id = $1
            AND (
              (open_time >= $2::timestamp AND open_time <= $3::timestamp) OR
              (close_time >= $2::timestamp AND close_time <= $3::timestamp)
            )
          ORDER BY
            ABS(EXTRACT(EPOCH FROM open_time - $4::timestamp)) +
            ABS(EXTRACT(EPOCH FROM close_time - $4::timestamp)) ASC
          LIMIT 5
        `

        const params = [
          user.id,
          startTime.toISOString(),
          endTime.toISOString(),
          photoTime.toISOString()
        ]

        if (accountId) {
          query = query.replace('WHERE user_id = $1', 'WHERE user_id = $1 AND account_id = $2')
          params.unshift(accountId)
        }

        // Execute query
        const { db } = await import('@/lib/db')
        const trades = await db.$queryRawUnsafe(query, ...params)

        console.log(`📊 [Batch Photo Match] Found ${trades.length} trades for ${fileName}`)

        // Calculate match scores
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

        scoredTrades.sort((a, b) => b.matchScore - a.matchScore)

        results.push({
          fileName: fileName,
          success: true,
          photo: {
            originalTime: metadata.originalDateTime?.toISOString(),
            indonesiaTime: metadata.indonesiaDateTime?.toISOString(),
            timezone: metadata.indonesiaTimezone || metadata.originalTimezone,
            isInIndonesia: !!metadata.indonesiaDateTime
          },
          matches: scoredTrades,
          bestMatch: scoredTrades.length > 0 && scoredTrades[0].matchScore >= 50 ? scoredTrades[0] : null
        })

      } catch (error) {
        console.error(`❌ [Batch Photo Match] Error processing ${fileName}:`, error)
        results.push({
          fileName: fileName,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Build summary
    const successful = results.filter(r => r.success)
    const withMatches = results.filter(r => r.success && r.matches.length > 0)
    const highConfidence = results.filter(r => r.bestMatch !== null)

    console.log(`✅ [Batch Photo Match] Batch completed: ${successful.length}/${fileNames.length} processed, ${withMatches.length} with matches`)

    return NextResponse.json({
      success: true,
      summary: {
        total: fileNames.length,
        processed: successful.length,
        withMatches: withMatches.length,
        highConfidence: highConfidence.length
      },
      results: results
    })

  } catch (error) {
    console.error('❌ [Batch Photo Match] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to batch match photos with trades',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Get list of uploaded photos for batch processing
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { supabase } = createClientForApi(request)
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // List uploaded files
    const uploadDir = path.join(process.cwd(), 'upload')
    let files: string[] = []

    try {
      files = await readdir(uploadDir)
    } catch {
      files = []
    }

    // Get metadata for each file
    const fileDetails = []
    for (const fileName of files) {
      try {
        const filePath = path.join(uploadDir, fileName)
        const { stat } = await import('fs/promises')
        const stats = await stat(filePath)

        fileDetails.push({
          name: fileName,
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime
        })
      } catch {
        // Skip files that can't be read
      }
    }

    return NextResponse.json({
      success: true,
      files: fileDetails.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    })

  } catch (error) {
    console.error('❌ [Batch Photo Match] Error listing files:', error)
    return NextResponse.json(
      {
        error: 'Failed to list files',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}