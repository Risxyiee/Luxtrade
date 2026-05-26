import { NextRequest, NextResponse } from 'next/server'
import { createZAI } from '@/lib/zai'

let zaiInstance: any = null

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await createZAI()
  }
  return zaiInstance
}

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'tongtong', speed = 1.0, format = 'wav' } = await request.json()

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    // Check text length limit (max 1024 characters)
    if (text.length > 1024) {
      return NextResponse.json(
        { error: 'Text exceeds maximum length of 1024 characters' },
        { status: 400 }
      )
    }

    const zai = await getZAI()

    const response = await zai.audio.tts.create({
      input: text,
      voice,
      speed,
      response_format: format,
      stream: false
    })

    // Get array buffer from Response object
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(new Uint8Array(arrayBuffer))
    
    // Convert to base64 for JSON response
    const base64Audio = buffer.toString('base64')
    const audioDataUrl = `data:audio/${format};base64,${base64Audio}`

    return NextResponse.json({
      success: true,
      audio: audioDataUrl
    })
  } catch (error) {
    console.error('TTS Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    )
  }
}
