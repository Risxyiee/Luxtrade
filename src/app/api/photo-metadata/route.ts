import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { readPhotoMetadata, formatDateIndo, formatTimeIndo, INDONESIA_TIMEZONES } from '@/lib/photo-metadata'
import path from 'path'

/**
 * Read photo metadata and convert timezone to Indonesia
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📸 [Photo Metadata] Starting metadata analysis...')

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
    const { fileName } = body

    if (!fileName) {
      return NextResponse.json(
        { error: 'fileName is required' },
        { status: 400 }
      )
    }

    // Build file path
    const uploadDir = path.join(process.cwd(), 'upload')
    const filePath = path.join(uploadDir, fileName)

    console.log(`📷 [Photo Metadata] Reading: ${filePath}`)

    // Read metadata
    const metadata = await readPhotoMetadata(filePath)

    if (process.env.NODE_ENV === 'development') {
      console.log('📋 [Photo Metadata] Raw metadata:', JSON.stringify(metadata, null, 2))
    }

    // Format output
    const result: any = {
      fileName: fileName,
      success: true
    }

    if (metadata.originalDateTime) {
      result.originalDateTime = metadata.originalDateTime.toISOString()
      result.originalDateTimeFormatted = metadata.originalDateTime.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    }

    if (metadata.timezoneOffset !== undefined) {
      result.timezoneOffset = metadata.timezoneOffset
      result.timezoneName = metadata.originalTimezone || `UTC${metadata.timezoneOffset >= 0 ? '+' : ''}${metadata.timezoneOffset}`
    }

    if (metadata.gpsCoordinates) {
      result.gpsCoordinates = metadata.gpsCoordinates
      result.location = `Lat: ${metadata.gpsCoordinates.latitude.toFixed(6)}, Lon: ${metadata.gpsCoordinates.longitude.toFixed(6)}`
    }

    // Check if photo is from Indonesia
    const isInIndonesia = !!metadata.indonesiaDateTime

    if (isInIndonesia) {
      result.isInIndonesia = true
      result.indonesiaTimezone = metadata.indonesiaTimezone || 'WIB'

      if (metadata.indonesiaDateTime) {
        result.indonesiaDateTime = metadata.indonesiaDateTime.toISOString()
        result.indonesiaDateTimeFormatted = formatDateIndo(
          metadata.indonesiaDateTime,
          metadata.indonesiaTimezone || 'WIB'
        )
        result.indonesiaTimeFormatted = formatTimeIndo(
          metadata.indonesiaDateTime,
          metadata.indonesiaTimezone || 'WIB'
        )
      }

      result.message = `Photo taken in Indonesia (${metadata.indonesiaTimezone || 'WIB'}). Time converted from ${metadata.originalTimezone || 'UTC'} to Indonesia timezone.`
    } else {
      result.isInIndonesia = false
      result.message = 'Photo taken outside Indonesia. Original time preserved.'
    }

    if (!metadata.originalDateTime) {
      result.warning = 'Could not detect original photo datetime from EXIF data'
    }

    console.log('✅ [Photo Metadata] Analysis completed')

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [Photo Metadata] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to read photo metadata',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}