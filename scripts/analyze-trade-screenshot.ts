import { analyzeImageWithOllama } from '../src/lib/ollama-vision'
import { analyzeImageWithZAIVision } from '../src/lib/zai-vision'
import fs from 'fs'
import path from 'path'

const IMAGE_PATH = '/home/z/my-project/upload/IMG_6523.jpeg'

async function analyzeTradeScreenshot() {
  console.log('📷 Reading screenshot...')

  // Read image and convert to base64
  const imageBuffer = fs.readFileSync(IMAGE_PATH)
  const base64Image = imageBuffer.toString('base64')

  console.log(`📊 Image size: ${(base64Image.length * 0.75 / 1024).toFixed(2)} KB`)

  // Prompt khusus untuk membaca trade
  const prompt = `Analyze this trading screenshot carefully. Extract ALL trading information and return ONLY valid JSON in this exact format:

{
  "type": "screenshot_type",
  "is_table": true/false,
  "data": {
    "symbol": "XAUUSD",
    "trades": [
      {
        "symbol": "XAUUSD",
        "type": "BUY/SELL",
        "open_price": 4500.00,
        "close_price": 4510.00,
        "profit_loss": 100.00,
        "lot_size": 0.1,
        "time": "2025.01.15 10:30:00"
      }
    ]
  },
  "summary": "Brief description"
}

Important:
- If it's a single trade detail, set is_table: false
- If it's a history table, extract ALL rows and set is_table: true
- Convert MT5 date format (YYYY.MM.DD HH:MM:SS) to proper format
- Extract symbol, type, prices, profit, lot, time
- Return ONLY the JSON, no other text`

  // Try Ollama first (FREE)
  try {
    console.log('🔄 Analyzing with Ollama (FREE)...')

    const ollamaResult = await analyzeImageWithOllama(
      base64Image,
      'image/jpeg',
      prompt
    )

    console.log('✅ Ollama Analysis Result:')
    console.log(JSON.stringify(ollamaResult, null, 2))

    return ollamaResult
  } catch (ollamaError: any) {
    console.log('⚠️ Ollama failed:', ollamaError.message)
    console.log('🔄 Trying Z.ai Vision (FREE)...')

    try {
      const zaiResult = await analyzeImageWithZAIVision(base64Image, prompt, {})

      console.log('✅ Z.ai Vision Result:')
      console.log(zaiResult.text)

      return zaiResult.text
    } catch (zaiError: any) {
      console.error('❌ Z.ai Vision also failed:', zaiError.message)
      throw zaiError
    }
  }
}

// Run analysis
analyzeTradeScreenshot()
  .then(result => {
    console.log('\n✅ Analysis complete!')
  })
  .catch(error => {
    console.error('\n❌ Analysis failed:', error)
    process.exit(1)
  })