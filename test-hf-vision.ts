/**
 * Test Hugging Face Vision API for Trading Screenshot Analysis
 * This will test if the FREE Hugging Face Vision can properly analyze trading screenshots
 */

import { analyzeImageWithHuggingFace } from './src/lib/huggingface-vision'
import * as fs from 'fs'
import * as path from 'path'

// Test prompt for trading screenshots
const TRADING_PROMPT = `Analyze this trading screenshot. Extract ALL trading data and return ONLY valid JSON (no markdown, no code blocks, no explanation). The JSON must have this exact structure:

{
  "trade": {
    "symbol": "XAUUSD",
    "type": "BUY",
    "open_price": 4503.38,
    "close_price": 4533.40,
    "stop_loss": 4480.00,
    "take_profit": 4560.00,
    "lot_size": 0.1,
    "profit_loss": 300.20,
    "open_time": "2026-05-22T17:13:16Z",
    "close_time": "2026-05-25T01:15:00Z",
    "swap": 0,
    "commission": 0,
    "order_id": "",
    "platform": "MT5"
  },
  "journal": {
    "title": "XAUUSD Buy - Profit $300.20",
    "content": "Detailed journal entry in English describing the trade setup, entry reason, exit reason, risk management, emotional state, and lessons learned. Write 3-5 sentences.",
    "mood": "confident",
    "market_condition": "trending_up",
    "tags": ["gold", "breakout", "tp_hit"],
    "setup_type": "breakout",
    "risk_reward_ratio": 2.5
  },
  "raw_analysis": "Brief description of what was seen in the screenshot"
}

Rules:
- Convert date format YYYY.MM.DD HH:MM:SS to ISO 8601 (YYYY-MM-DDTHH:MM:SSZ)
- Determine session from open_time hour: 0-7=Asia, 8-15=London, 16-23=New York
- mood must be one of: confident, calm, excited, anxious, fearful, greedy, frustrated, regretful, neutral
- market_condition must be one of: trending_up, trending_down, ranging, volatile, breakout, reversal
- tags should be 2-5 relevant lowercase tags
- setup_type: breakout, pullback, reversal, range, scalping, swing
- risk_reward_ratio: calculate as (potential profit / potential loss) or estimate
- If stop_loss or take_profit not visible, set to 0
- profit_loss should be negative for losing trades
- Return ONLY the JSON, no other text`

async function testHuggingFaceVision() {
  console.log('🧪 Testing Hugging Face Vision API for Trading Screenshot Analysis')
  console.log('=' .repeat(70))

  try {
    // Read token from .env
    const envPath = path.join(process.cwd(), '.env')
    const envContent = fs.readFileSync(envPath, 'utf-8')
    const match = envContent.match(/HUGGING_FACE_API_TOKEN=([^\s\n]+)/)

    if (!match || !match[1]) {
      console.error('❌ HUGGING_FACE_API_TOKEN not found in .env file')
      process.exit(1)
    }

    console.log(`✅ Token found: ${match[1].substring(0, 10)}...`)
    console.log()

    // For now, let's test with a simple base64 image placeholder
    // In real usage, you would upload a trading screenshot
    console.log('⚠️  Note: This is a connectivity test.')
    console.log('⚠️  To test with real trading screenshot, provide an image path or base64.')
    console.log()
    console.log('Usage: bun run test-hf-vision.ts <path-to-image>')
    console.log()

    // If image path provided as argument, use it
    const args = process.argv.slice(2)
    if (args.length > 0) {
      const imagePath = args[0]
      console.log(`📷 Loading image: ${imagePath}`)

      if (!fs.existsSync(imagePath)) {
        console.error(`❌ Image not found: ${imagePath}`)
        process.exit(1)
      }

      const imageBuffer = fs.readFileSync(imagePath)
      const base64Image = imageBuffer.toString('base64')

      console.log(`📊 Image size: ${imageBuffer.length} bytes`)
      console.log()
      console.log('🤖 Analyzing with Hugging Face Vision...')

      const result = await analyzeImageWithHuggingFace(base64Image, TRADING_PROMPT, {
        timeout: 60000,
        maxRetries: 3
      })

      console.log()
      console.log('✅ Analysis completed!')
      console.log('='.repeat(70))
      console.log()
      console.log('📋 Raw Response:')
      console.log(result.text)
      console.log()
      console.log('='.repeat(70))

      // Try to parse as JSON
      try {
        const jsonStart = result.text.indexOf('{')
        const jsonEnd = result.text.lastIndexOf('}')

        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          const jsonStr = result.text.substring(jsonStart, jsonEnd + 1)
          const parsed = JSON.parse(jsonStr)

          console.log()
          console.log('✅ Parsed JSON successfully!')
          console.log()
          console.log('📊 Trade Data:')
          console.log(JSON.stringify(parsed.trade, null, 2))
          console.log()
          console.log('📝 Journal Data:')
          console.log(JSON.stringify(parsed.journal, null, 2))
        }
      } catch (parseError) {
        console.warn('⚠️  Could not parse response as JSON')
      }
    } else {
      console.log('ℹ️  No image provided. Test completed with connectivity check only.')
      console.log('ℹ️  To test with a real screenshot, run:')
      console.log('   bun run test-hf-vision.ts /path/to/trading-screenshot.png')
    }

  } catch (error: any) {
    console.error()
    console.error('❌ Test Failed:')
    console.error('   ', error.message)
    if (error.stack) {
      console.error()
      console.error('Stack trace:')
      console.error(error.stack)
    }
    process.exit(1)
  }
}

testHuggingFaceVision()