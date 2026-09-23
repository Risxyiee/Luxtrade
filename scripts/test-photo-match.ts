#!/usr/bin/env bun
/**
 * Test reading photo metadata and matching with trades
 * NOTE: photo-metadata module no longer exists in src/lib
 * This script is preserved for reference but requires that module to be reimplemented.
 */

async function testPhotoMatch(fileName: string) {
  console.log('='.repeat(60))
  console.log('📸 Testing Photo: ' + fileName)
  console.log('='.repeat(60))
  console.log('')
  console.log('⚠️ This script requires the photo-metadata module which is not currently available.')
  console.log('Please reimplement the module or use an EXIF library directly.')
}

// Run test
const fileName = process.argv[2] || 'IMG_6255.jpeg'
testPhotoMatch(fileName)
  .catch(error => {
    console.error('❌ Test failed:', error)
    process.exit(1)
  })
