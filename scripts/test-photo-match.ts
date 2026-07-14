#!/usr/bin/env bun
/**
 * Test reading photo metadata and matching with trades
 */
import { readPhotoMetadata } from '../src/lib/photo-metadata'
import { db } from '../src/lib/db'

async function testPhotoMatch(fileName: string) {
  console.log('='.repeat(60))
  console.log('📸 Testing Photo: ' + fileName)
  console.log('='.repeat(60))
  console.log('')

  // Step 1: Read photo metadata
  console.log('📋 Step 1: Reading photo metadata...')
  const metadata = await readPhotoMetadata(`/home/z/my-project/upload/${fileName}`)

  console.log('')
  console.log('─'.repeat(60))
  console.log('📊 PHOTO METADATA')
  console.log('─'.repeat(60))
  console.log('')

  if (metadata.originalDateTime) {
    console.log('🕐 Original DateTime:', metadata.originalDateTime.toISOString())
    console.log('   Formatted:', metadata.originalDateTime.toLocaleString('id-ID'))
  } else {
    console.log('❌ No original datetime found in EXIF')
  }

  if (metadata.indonesiaDateTime) {
    console.log('')
    console.log('🇮🇩 Indonesia DateTime:', metadata.indonesiaDateTime.toISOString())
    console.log('   Formatted:', metadata.indonesiaDateTime.toLocaleString('id-ID'))
    console.log('   Timezone:', metadata.indonesiaTimezone)
    console.log('   Is in Indonesia:', metadata.isInIndonesia)
  }

  if (metadata.gpsCoordinates) {
    console.log('')
    console.log('📍 GPS Coordinates:')
    console.log('   Latitude:', metadata.gpsCoordinates.latitude)
    console.log('   Longitude:', metadata.gpsCoordinates.longitude)
  }

  if (metadata.originalTimezone) {
    console.log('')
    console.log('🌍 Original Timezone:', metadata.originalTimezone)
  }

  if (metadata.timezoneOffset !== undefined) {
    console.log('   Timezone Offset: UTC' + (metadata.timezoneOffset >= 0 ? '+' : '') + metadata.timezoneOffset)
  }

  // Step 2: Match with trades
  console.log('')
  console.log('')
  console.log('─'.repeat(60))
  console.log('🔍 Step 2: Matching with trades...')
  console.log('─'.repeat(60))
  console.log('')

  if (!metadata.originalDateTime && !metadata.indonesiaDateTime) {
    console.log('❌ Cannot match: No datetime found in photo')
    console.log('')
    console.log('='.repeat(60))
    console.log('❌ Test Failed')
    console.log('='.repeat(60))
    return
  }

  const photoTime = metadata.indonesiaDateTime || metadata.originalDateTime
  console.log('🕐 Photo Time:', photoTime.toISOString())

  // Calculate time range (±5 minutes)
  const toleranceMinutes = 5
  const toleranceMs = toleranceMinutes * 60 * 1000
  const startTime = new Date(photoTime.getTime() - toleranceMs)
  const endTime = new Date(photoTime.getTime() + toleranceMs)

  console.log('📅 Search Range:')
  console.log('   Start:', startTime.toISOString())
  console.log('   End:', endTime.toISOString())
  console.log('   Tolerance: ±' + toleranceMinutes + ' minutes')
  console.log('')

  // Query trades
  console.log('🔍 Querying trades...')

  const query = `
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
    WHERE (
      (open_time >= $1 AND open_time <= $2) OR
      (close_time >= $1 AND close_time <= $2)
    )
    ORDER BY
      ABS(EXTRACT(EPOCH FROM open_time - $3)) +
      ABS(EXTRACT(EPOCH FROM close_time - $3)) ASC
    LIMIT 10
  `

  const trades = await db.$queryRawUnsafe(query,
    startTime.toISOString(),
    endTime.toISOString(),
    photoTime.toISOString()
  )

  console.log('📊 Found', trades.length, 'trade(s) in range')
  console.log('')

  if (trades.length === 0) {
    console.log('❌ No trades found matching photo time')
    console.log('')
    console.log('💡 Try:')
    console.log('   - Increase tolerance (e.g., ±10 or ±15 minutes)')
    console.log('   - Check if trades exist in database')
    console.log('   - Verify photo EXIF datetime is correct')
  } else {
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

    console.log('─'.repeat(60))
    console.log('🎯 MATCH RESULTS')
    console.log('─'.repeat(60))
    console.log('')

    scoredTrades.forEach((trade, index) => {
      const score = trade.matchScore
      const emoji = score >= 90 ? '🟢' : score >= 50 ? '🟡' : '🔴'
      const isBest = index === 0

      console.log(`${emoji} Match #${index + 1} ${isBest ? '← BEST' : ''}`)
      console.log('   Score:', score + '%')
      console.log('   Symbol:', trade.symbol, '| Type:', trade.type)
      console.log('   Entry:', trade.open_price, '→ Exit:', trade.close_price)
      console.log('   P/L:', trade.profit_loss)
      console.log('   Open Time:', new Date(trade.open_time).toLocaleString('id-ID'))
      console.log('   Close Time:', new Date(trade.close_time).toLocaleString('id-ID'))
      console.log('   Time Diff: Open ±' + trade.openDiffMinutes + 'min | Close ±' + trade.closeDiffMinutes + 'min')
      console.log('   Best Match:', trade.bestMatch)
      if (trade.notes) console.log('   Notes:', trade.notes)
      console.log('')
    })

    if (scoredTrades[0].matchScore >= 50) {
      console.log('✅ Best Match Found!')
      console.log('   Confidence:', scoredTrades[0].matchScore + '%')
      console.log('   Trade:', scoredTrades[0].symbol, scoredTrades[0].type)
    }
  }

  console.log('')
  console.log('='.repeat(60))
  console.log('✅ Test Completed')
  console.log('='.repeat(60))
}

// Run test
const fileName = process.argv[2] || 'IMG_6255.jpeg'
testPhotoMatch(fileName)
  .catch(error => {
    console.error('❌ Test failed:', error)
    process.exit(1)
  })