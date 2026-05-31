#!/usr/bin/env bun
/**
 * Test Photo Upload & Metadata Analysis
 * Usage: bun run scripts/test-photo-upload.ts <path-to-image>
 */

import FormData from 'form-data'
import fs from 'fs'
import path from 'path'

const API_BASE = 'http://localhost:3000'

async function testPhotoUpload(imagePath: string) {
  console.log('='.repeat(60))
  console.log('📸 Photo Upload & Metadata Analysis Test')
  console.log('='.repeat(60))
  console.log('')

  // Check if file exists
  if (!fs.existsSync(imagePath)) {
    console.error('❌ File not found:', imagePath)
    console.log('')
    console.log('Usage: bun run scripts/test-photo-upload.ts <path-to-image>')
    console.log('')
    console.log('Example: bun run scripts/test-photo-upload.ts /path/to/IMG_6255.jpeg')
    process.exit(1)
  }

  console.log('📷 File:', imagePath)
  console.log('📏 Size:', fs.statSync(imagePath).size, 'bytes')
  console.log('')

  // Step 1: Upload file
  console.log('📤 Step 1: Uploading file...')
  try {
    const formData = new FormData()
    formData.append('file', fs.createReadStream(imagePath), {
      filename: path.basename(imagePath),
      contentType: 'image/jpeg'
    })

    const uploadResponse = await fetch(`${API_BASE}/api/file-upload`, {
      method: 'POST',
      body: formData as any
    })

    const uploadResult = await uploadResponse.json()

    if (!uploadResponse.ok) {
      console.error('❌ Upload failed:', uploadResult.error)
      process.exit(1)
    }

    console.log('✅ Upload successful!')
    console.log('   File name:', uploadResult.file.name)
    console.log('   File path:', uploadResult.file.path)
    console.log('')

    // Step 2: Read metadata
    console.log('📋 Step 2: Reading photo metadata...')
    const metadataResponse = await fetch(`${API_BASE}/api/photo-metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: uploadResult.file.name
      })
    })

    const metadataResult = await metadataResponse.json()

    if (!metadataResponse.ok) {
      console.error('❌ Metadata analysis failed:', metadataResult.error)
      process.exit(1)
    }

    console.log('✅ Metadata analysis completed!')
    console.log('')
    console.log('─'.repeat(60))
    console.log('📊 RESULTS')
    console.log('─'.repeat(60))
    console.log('')

    // Display results
    console.log('📁 File:', metadataResult.fileName)
    console.log('')

    if (metadataResult.originalDateTime) {
      console.log('🕐 Original DateTime:')
      console.log('   ISO:', metadataResult.originalDateTime)
      console.log('   Formatted:', metadataResult.originalDateTimeFormatted)
      console.log('')
    }

    if (metadataResult.timezoneOffset !== undefined) {
      console.log('🌍 Original Timezone:')
      console.log('   Name:', metadataResult.timezoneName)
      console.log('   Offset: UTC' + (metadataResult.timezoneOffset >= 0 ? '+' : '') + metadataResult.timezoneOffset)
      console.log('')
    }

    if (metadataResult.gpsCoordinates) {
      console.log('📍 GPS Coordinates:')
      console.log('   Location:', metadataResult.location)
      console.log('')
    }

    console.log('🇮🇩 Indonesia Status:')
    console.log('   In Indonesia:', metadataResult.isInIndonesia ? '✅ YES' : '❌ NO')

    if (metadataResult.isInIndonesia && metadataResult.indonesiaDateTime) {
      console.log('   Timezone:', metadataResult.indonesiaTimezone)
      console.log('   Indonesia Time:', metadataResult.indonesiaDateTimeFormatted)
      console.log('   Time Only:', metadataResult.indonesiaTimeFormatted)
      console.log('')
      console.log('📝 Message:', metadataResult.message)
    } else if (!metadataResult.isInIndonesia) {
      console.log('')
      console.log('📝 Message:', metadataResult.message)
    }

    if (metadataResult.warning) {
      console.log('')
      console.log('⚠️  Warning:', metadataResult.warning)
    }

    console.log('')
    console.log('='.repeat(60))
    console.log('✅ Test completed successfully!')
    console.log('='.repeat(60))

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Get file path from command line
const imagePath = process.argv[2]

if (!imagePath) {
  console.log('❌ No file path provided')
  console.log('')
  console.log('Usage: bun run scripts/test-photo-upload.ts <path-to-image>')
  console.log('')
  console.log('Example: bun run scripts/test-photo-upload.ts /path/to/IMG_6255.jpeg')
  process.exit(1)
}

testPhotoUpload(imagePath)