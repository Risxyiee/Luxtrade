import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

let zaiInstance: any = null

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, size = '1024x1024' } = await request.json()

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    const zai = await getZAI()

    const response = await zai.images.generations.create({
      prompt,
      size
    })

    const imageBase64 = response.data?.[0]?.base64

    if (!imageBase64) {
      throw new Error('No image data in response')
    }

    // Return base64 image data URL
    const imageDataUrl = `data:image/png;base64,${imageBase64}`

    return NextResponse.json({
      success: true,
      image: imageDataUrl
    })
  } catch (error) {
    console.error('Image Generation Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate image' },
      { status: 500 }
    )
  }
}
