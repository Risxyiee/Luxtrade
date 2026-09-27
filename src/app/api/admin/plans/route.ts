import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

const DEPRECATED_RESPONSE = {
  error: 'DEPRECATED',
  message: 'Subscription plan CRUD has been removed. Plans are now managed via PRICING config and /api/admin/activate.'
}

// GET all subscription plans — DEPRECATED
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request)
  if (error) return error

  return NextResponse.json(DEPRECATED_RESPONSE, { status: 410 })
}

// POST create a new subscription plan — DEPRECATED
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin(request)
  if (error) return error

  return NextResponse.json(DEPRECATED_RESPONSE, { status: 410 })
}