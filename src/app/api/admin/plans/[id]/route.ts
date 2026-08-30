import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

const DEPRECATED_RESPONSE = {
  error: 'DEPRECATED',
  message: 'Subscription plan CRUD has been removed. Plans are now managed via PRICING config and /api/admin/activate.'
}

// PUT update a subscription plan — DEPRECATED
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin(request)
  if (error) return error

  return NextResponse.json(DEPRECATED_RESPONSE, { status: 410 })
}

// DELETE a subscription plan — DEPRECATED
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin(request)
  if (error) return error

  return NextResponse.json(DEPRECATED_RESPONSE, { status: 410 })
}