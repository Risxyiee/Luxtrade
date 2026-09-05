import { NextRequest, NextResponse } from 'next/server'
import { geminiVision } from '@/lib/gemini'
import { createClientForApi } from '@/lib/supabase/server'
import { isUserPro } from '@/lib/pro-check'
import { rateLimitByUser } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const result = await createClientForApi(request)
    const supabase = result.supabase
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rl = rateLimitByUser('vlm', user.id, {
      maxRequests: 10,
      windowMs: 60 * 1000,
      message: 'Terlalu banyak permintaan AI Vision. Tunggu 1 menit.',
    })
    if (rl) return rl

    const pro = await isUserPro(user.id)
    if (!pro) {
      return NextResponse.json({
        error: 'AI Vision adalah fitur PRO. Upgrade ke PRO untuk menggunakan fitur ini!',
        code: 'PRO_REQUIRED',
        requiresUpgrade: true
      }, { status: 403 })
    }

    const formData = await request.formData()
    const image = formData.get('image') as File
    const question = formData.get('question') as string || 'Describe this image in detail'

    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 })
    }

    const bytes = await image.arrayBuffer()
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(bytes)))
    const mimeType = image.type || 'image/jpeg'

    const text = await geminiVision(question, base64Image, mimeType, {
      maxTokens: 4096,
    })

    return NextResponse.json({
      success: true,
      response: text,
      provider: 'gemini',
    })
  } catch (error: any) {
    console.error('[AI /vlm] Error:', error)
    return NextResponse.json({ error: 'Failed to analyze image' }, { status: 500 })
  }
}
