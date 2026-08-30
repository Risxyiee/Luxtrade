export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'
import { createZAI } from '@/lib/zai'
import { createClientForApi } from '@/lib/supabase/server'
import { isUserPro } from '@/lib/pro-check'

// In-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const RATE_LIMIT_MAX = 10 // 10 chat requests per minute

function checkRateLimit(identifier: string): boolean {
  const now = Date.now()
  let entry = rateLimitMap.get(identifier)
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS }
    rateLimitMap.set(identifier, entry)
  }
  entry.count++
  return entry.count <= RATE_LIMIT_MAX
}

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

    // Rate limit by user ID
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a minute.' },
        { status: 429 }
      )
    }

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

    // Use ZAI (FREE SDK)
    const zai = await createZAI()
    const response = await zai.chat.completions.create({
      model: 'glm-4.6',
      messages: messages
    })

    return NextResponse.json({
      success: true,
      response: response.choices?.[0]?.message?.content || ''
    })
  } catch (error: any) {
    console.error('[AI /chat] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    )
  }
}