/**
 * Test Hugging Face Vision API Connection
 */
async function testHuggingFaceConnection() {
  console.log('🧪 Testing Hugging Face Vision API connection...')

  // Test 1: Check if environment variable is set
  const apiKey = process.env.HUGGING_FACE_API_TOKEN

  if (!apiKey) {
    console.error('❌ HUGGING_FACE_API_TOKEN is not set!')
    console.log('💡 Please add it to your .env file:')
    console.log('   HUGGING_FACE_API_TOKEN=hf_...')
    return false
  }

  console.log('✅ HUGGING_FACE_API_TOKEN is set')
  console.log('🔑 Token (first 10 chars):', apiKey.substring(0, 10) + '...')

  // Test 2: Check token validity by making a simple API call
  try {
    console.log('📡 Testing API connection...')

    const response = await fetch('https://api-inference.huggingface.co/models/Qwen/Qwen2-VL-2B-Instruct', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10000),
    })

    if (response.ok || response.status === 404) {
      console.log('✅ API connection successful!')
      console.log(`📊 Status: ${response.status}`)
      return true
    } else if (response.status === 401) {
      console.error('❌ Invalid API token!')
      console.log('💡 Please check your Hugging Face API token')
      return false
    } else {
      console.error(`❌ Unexpected status: ${response.status}`)
      const errorText = await response.text()
      console.log('Error:', errorText)
      return false
    }
  } catch (error: any) {
    console.error('❌ Connection error:', error.message)
    return false
  }
}

// Run test
testHuggingFaceConnection()
  .then(success => {
    if (success) {
      console.log('\n🎉 Hugging Face Vision API is ready to use!')
      console.log('✨ Screenshot journal feature will now use FREE Hugging Face Vision')
    } else {
      console.log('\n❌ Hugging Face setup failed')
      console.log('💡 Please check the error messages above')
    }
    process.exit(success ? 0 : 1)
  })
  .catch(error => {
    console.error('❌ Test failed:', error)
    process.exit(1)
  })