import { NextRequest, NextResponse } from 'next/server'
import { chatWithOpenAI } from '@/lib/openai-vision'

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Build messages array with system prompt
    const messages = [
      {
        role: 'system' as const,
        content: 'You are a helpful and friendly AI assistant. Respond clearly and concisely.'
      },
      ...(history || []).map((msg: any) => ({
        role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: msg.content
      })),
      {
        role: 'user' as const,
        content: message
      }
    ]

    const response = await chatWithOpenAI(messages, 'gpt-4o', 0.7)

    return NextResponse.json({ response })
  } catch (error: any) {
    console.error('Chat Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process chat message' },
      { status: 500 }
    )
  }
}