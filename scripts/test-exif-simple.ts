#!/usr/bin/env bun
/**
 * Simple EXIF reader test
 */
import ExifReader from 'exifreader'
import { readFile } from 'fs/promises'

async function testEXIF(filePath: string) {
  console.log('='.repeat(60))
  console.log('📸 Reading EXIF from:', filePath)
  console.log('='.repeat(60))
  console.log('')

  try {
    // Read file
    const buffer = await readFile(filePath)

    // Parse EXIF
    const tags = ExifReader.load(buffer)

    console.log('📋 Available EXIF Tags:')
    console.log('')

    const importantTags = [
      'DateTimeOriginal',
      'DateTime',
      'CreateDate',
      'ModifyDate',
      'GPSLatitude',
      'GPSLongitude',
      'GPSDateStamp',
      'GPSTimeStamp',
      'Orientation'
    ]

    let hasDateTime = false
    let hasGPS = false

    // Print all tags
    for (const [key, value] of Object.entries(tags)) {
      const isImportant = importantTags.includes(key)

      if (isImportant) {
        console.log(`⭐ ${key}:`, JSON.stringify(value, null, 2))
      } else {
        console.log(`  ${key}:`, typeof value === 'object' ? JSON.stringify(value) : String(value))
      }

      if (key.includes('Date') || key.includes('Time')) {
        hasDateTime = true
      }
      if (key.includes('GPS')) {
        hasGPS = true
      }
    }

    console.log('')
    console.log('─'.repeat(60))
    console.log('📊 SUMMARY')
    console.log('─'.repeat(60))
    console.log('')
    console.log('Has DateTime:', hasDateTime ? '✅ YES' : '❌ NO')
    console.log('Has GPS:', hasGPS ? '✅ YES' : '❌ NO')
    console.log('Total Tags:', Object.keys(tags).length)
    console.log('')

    if (!hasDateTime) {
      console.log('⚠️  This photo does not have EXIF DateTime data')
      console.log('   Possible reasons:')
      console.log('   1. This is a screenshot (screenshots don\'t have EXIF)')
      console.log('   2. Photo was edited (EXIF may have been removed)')
      console.log('   3. Photo was saved from an app that strips EXIF')
      console.log('')
      console.log('💡 Solution: Use original photo from camera, not screenshot')
    }

    if (!hasGPS) {
      console.log('⚠️  This photo does not have GPS data')
      console.log('   Timezone cannot be auto-detected')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  }

  console.log('')
  console.log('='.repeat(60))
}

const filePath = process.argv[2] || '/home/z/my-project/upload/IMG_6255.jpeg'
testEXIF(filePath)