import { NextResponse } from 'next/server'

const DEPRECATED_RESPONSE = {
  error: 'DEPRECATED',
  message: 'Subscription plan management has been removed. Use /api/admin/activate to manage user subscriptions.',
}

export async function GET() {
  return NextResponse.json(DEPRECATED_RESPONSE, { status: 410 })
}

export async function POST() {
  return NextResponse.json(DEPRECATED_RESPONSE, { status: 410 })
}