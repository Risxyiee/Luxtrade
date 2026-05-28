import { NextRequest, NextResponse } from 'next/server'
import { analyzeImageWithOpenAI } from '@/lib/openai-vision'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const image = formData.get('image') as File
    const question = formData.get('question') as string || 'Describe this image in detail'

    if (!image) {
      return NextResponse.json(
        { error: 'Image is required' },
        { status: 400 }
      )
    }

    // Convert image to base64
    const bytes = await image.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = buffer.toString('base64')

    const analysis = await analyzeImageWithOpenAI(
      base64Image,
      image.type,
      question,
      'gpt-4o'
    )

    return NextResponse.json({
      success: true,
      response: analysis
    })
  } catch (error: any) {
    console.error('VLM Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to analyze image' },
      { status: 500 }
    )
  }
}