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

    const zai = await getZAI()

    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: question },
            { type: 'image_url', image_url: { url: `data:${image.type};base64,${base64Image}` } }
          ]
        }
      ],
      thinking: { type: 'disabled' }
    })

    const analysis = response.choices?.[0]?.message?.content || 'No analysis generated'

    return NextResponse.json({
      success: true,
      response: analysis
    })
  } catch (error) {
    console.error('VLM Error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze image' },
      { status: 500 }
    )
  }
}
