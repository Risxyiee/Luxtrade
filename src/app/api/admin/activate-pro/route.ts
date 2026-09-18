import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const body = await request.json()
    const { userId, months } = body

    // This endpoint is deprecated - use /api/admin/users instead
    return NextResponse.json({
      success: false,
      error: 'This endpoint is deprecated. Please use /api/admin/users instead.',
    })
  } catch (error) {
    console.error('Error in deprecated activate-pro:', error)
    return NextResponse.json(
      { success: false, error: 'This endpoint is deprecated' },
      { status: 400 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // This endpoint is deprecated - use /api/admin/users instead
    return NextResponse.json({
      success: false,
      error: 'This endpoint is deprecated. Please use /api/admin/users instead.',
    })
  } catch (error) {
    console.error('Error in deprecated activate-pro:', error)
    return NextResponse.json(
      { success: false, error: 'This endpoint is deprecated' },
      { status: 400 }
    )
  }
}