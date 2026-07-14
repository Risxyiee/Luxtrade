import { NextRequest, NextResponse } from 'next/server'
import { analyzeImageWithZAIVision } from '@/lib/zai-vision'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing Z.ai Vision...')

    const testBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const testPrompt = 'Apa ini?'

    const result = await analyzeImageWithZAIVision(testBase64, testPrompt)

    return NextResponse.json({
      success: true,
      result: result.text,
      length: result.text.length
    })
  } catch (error: any) {
    console.error('❌ Test error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}