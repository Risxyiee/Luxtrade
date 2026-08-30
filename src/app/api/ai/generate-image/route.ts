export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'
import { generateImageWithZAI } from '@/lib/zai-image'
import { createClientForApi } from '@/lib/supabase/server'
import { isUserPro } from '@/lib/pro-check'

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const { supabase } = createClientForApi(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pro = await isUserPro(user.id)
    if (!pro) {
      return NextResponse.json({
        error: 'Fitur ini hanya untuk pengguna PRO. Upgrade ke PRO untuk akses!',
        code: 'PRO_REQUIRED',
        requiresUpgrade: true
      }, { status: 403 })
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
    console.error('[AI /generate-image] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate image' },
      { status: 500 }
    )
  }
}