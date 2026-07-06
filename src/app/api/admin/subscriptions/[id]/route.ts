import { NextResponse } from 'next/server'

const DEPRECATED_RESPONSE = {
  error: 'DEPRECATED',
  message: 'Subscription plan management has been removed. Use /api/admin/activate to manage user subscriptions.',
}

export async function PUT() {
  return NextResponse.json(DEPRECATED_RESPONSE, { status: 410 })
}

export async function DELETE() {
  return NextResponse.json(DEPRECATED_RESPONSE, { status: 410 })
}