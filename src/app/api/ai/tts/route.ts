import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const { supabase } = createClientForApi(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { text, voice = 'alloy', speed = 1.0, format = 'mp3' } = await request.json()

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    // Check text length limit (max 4096 characters for OpenAI TTS)
    if (text.length > 4096) {
      return NextResponse.json(
        { error: 'Text exceeds maximum length of 4096 characters' },
        { status: 400 }
      )
    }

    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Create AbortController with 60s timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: voice,
          speed: speed
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        // OpenAI TTS API error

        if (response.status === 401) {
          return NextResponse.json({ error: 'Invalid OpenAI API key' }, { status: 401 })
        } else if (response.status === 429) {
          return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
        } else {
          return NextResponse.json(
            { error: `TTS API error: ${response.status}` },
            { status: 500 }
          )
        }
      }

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
    } catch (error: any) {
      clearTimeout(timeoutId)

      if (error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'TTS request timeout' },
          { status: 504 }
        )
      }

      throw error
    }
  } catch (error: any) {
    // TTS error
    return NextResponse.json(
      { error: error.message || 'Failed to generate speech' },
      { status: 500 }
    )
  }
}