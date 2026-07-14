import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'

/**
 * Voice Transcription API
 * Converts audio to text for journal entries
 */

export async function POST(req: Request) {
  try {
    // Auth check
    const { supabase } = createClientForApi(req as NextRequest)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { audio } = await req.json()

    if (!audio) {
      return NextResponse.json(
        { error: 'Audio data is required' },
        { status: 400 }
      )
    }

    // Note: In production, integrate with ASR skill or external service
    // For now, return a placeholder response
    return NextResponse.json({
      success: true,
      transcription: "Voice transcription would be processed here",
      text: "Voice transcription would be processed here",
      note: "Integrate with ASR skill or external service for actual transcription"
    })
  } catch (error: any) {
    // Voice transcribe error
    return NextResponse.json(
      { error: error.message || 'Failed to transcribe audio' },
      { status: 500 }
    )
  }
}
