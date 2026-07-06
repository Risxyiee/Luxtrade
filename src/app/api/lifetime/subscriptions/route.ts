import { NextRequest, NextResponse } from 'next/server'

const DEPRECATED_RESPONSE = {
  error: 'DEPRECATED',
  message: 'Lifetime subscriptions are now managed via /api/admin/activate. Use planType: \'PRO_LIFETIME\'.'
}

// GET check slot availability — DEPRECATED
export async function GET(request: NextRequest) {
  return NextResponse.json(DEPRECATED_RESPONSE, { status: 410 })
}

// POST create a Lifetime subscription — DEPRECATED
export async function POST(request: NextRequest) {
  return NextResponse.json(DEPRECATED_RESPONSE, { status: 410 })
}