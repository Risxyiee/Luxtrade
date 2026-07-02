import { NextRequest, NextResponse } from 'next/server'
import { generateImageWithZAI } from '@/lib/zai-image'
import { createClientForApi } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const { supabase } = createClientForApi(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
    // Image generation error
    return NextResponse.json(
      { error: error.message || 'Failed to generate image' },
      { status: 500 }
    )
  }
}