/**
 * Test Screenshot Journal API with Z.ai Vision
 */

const fs = require('fs')
const path = require('path')

// Read image
const imagePath = path.join(__dirname, 'upload/IMG_6202.png')
const imageBuffer = fs.readFileSync(imagePath)
const base64Image = imageBuffer.toString('base64')

console.log('🧪 Testing Screenshot Journal API...')
console.log(`📷 Image: ${imagePath}`)
console.log(`📊 Size: ${imageBuffer.length} bytes`)
console.log()

// Prepare request body
const requestBody = JSON.stringify({
  imageBase64: base64Image,
  mimeType: 'image/png'
})

console.log('📤 Sending request to /api/screenshot-journal...')
console.log()

// Use fetch to call the API
fetch('http://localhost:3000/api/screenshot-journal', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: requestBody
})
  .then(response => response.json())
  .then(data => {
    console.log('✅ Response received:')
    console.log(JSON.stringify(data, null, 2))
  })
  .catch(error => {
    console.error('❌ Error:', error.message)
  })