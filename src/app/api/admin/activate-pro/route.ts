import { NextRequest, NextResponse } from 'next/server'

const ADMIN_EMAIL = 'luxtradee@gmail.com'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { adminEmail, userId, months } = body

    // Verify admin
    if (adminEmail !== ADMIN_EMAIL) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

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
    const { searchParams } = new URL(request.url)
    const adminEmail = searchParams.get('adminEmail')
    const userId = searchParams.get('userId')

    // Verify admin
    if (adminEmail !== ADMIN_EMAIL) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

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
