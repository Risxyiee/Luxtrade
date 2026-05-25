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
    const { message, history } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const zai = await getZAI()

    // Build messages array with system prompt
    const messages = [
      {
        role: 'assistant',
        content: 'You are a helpful and friendly AI assistant. Respond clearly and concisely.'
      },
      ...(history || []).map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ]

    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' }
    })

    const response = completion.choices?.[0]?.message?.content || 'No response generated'

    return NextResponse.json({ response })
  } catch (error) {
    console.error('LLM Error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    )
  }
}
