import { NextRequest, NextResponse } from 'next/server'
import { generateImageWithZAI } from '@/lib/zai-image'

export async function POST(request: NextRequest) {
  try {
    const { prompt, size = '1024x1024' } = await request.json()

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    const imageUrl = await generateImageWithZAI(prompt, { size })

    return NextResponse.json({
      success: true,
      image: imageUrl
    })
  } catch (error: any) {
    console.error('Image Generation Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate image' },
      { status: 500 }
    )
  }
}