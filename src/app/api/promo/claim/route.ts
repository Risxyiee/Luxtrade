export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/promo/claim
 * Redirects to /api/promo/apply with the same body.
 * Kept for backward compatibility — all logic is in /api/promo/apply
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const code = body.code || body.promoCode

  // Forward to the main apply endpoint
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/promo/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': request.headers.get('Cookie') || '',
    },
    body: JSON.stringify({ promoCode: code })
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}