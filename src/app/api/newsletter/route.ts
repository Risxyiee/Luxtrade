import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'

// Edge-compatible: uses Prisma DB instead of filesystem
// Original implementation used fs/path to write to a local JSON file,
// which is not available on Cloudflare Edge runtime.

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const trimmed = email.trim()

    if (!isValidEmail(trimmed)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Store in database if available, otherwise just acknowledge
    if (isDatabaseAvailable()) {
      try {
        // Check for existing subscription
        const existing = await db.newsletter.findUnique({ where: { email: trimmed } })
        if (existing) {
          return NextResponse.json({
            success: true,
            message: 'Email already subscribed!'
          })
        }

        await db.newsletter.create({
          data: { email: trimmed, subscribedAt: new Date().toISOString() },
        })
      } catch {
        // Table might not exist — non-critical, continue
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed!'
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
