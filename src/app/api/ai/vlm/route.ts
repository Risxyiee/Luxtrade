import { NextRequest, NextResponse } from 'next/server'
import { analyzeImageWithZAIVision } from '@/lib/zai-vision'
import { analyzeImageWithOllama } from '@/lib/ollama-vision'
import { createClientForApi } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const { supabase } = createClientForApi(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // Try Ollama first (FREE), then fallback to Z.ai Vision (FREE)
    let analysis: string

    try {
      // Ollama returns object, we'll get notes as text
      const ollamaResult = await analyzeImageWithOllama(
        base64Image,
        image.type,
        question
      )
      analysis = JSON.stringify(ollamaResult)
    } catch (ollamaError) {
      // Ollama failed, trying Z.ai Vision fallback
      const zaiResult = await analyzeImageWithZAIVision(base64Image, question, {})
      analysis = zaiResult.text
    }

    return NextResponse.json({
      success: true,
      response: analysis
    })
  } catch (error: any) {
    // VLM error
    return NextResponse.json(
      { error: error.message || 'Failed to analyze image' },
      { status: 500 }
    )
  }
}