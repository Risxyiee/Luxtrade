import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  console.log('🔍 Test DB API called')

  try {
    // Very simple test - just try to count users
    console.log('Attempting to count users...')
    const count = await db.user.count()

    console.log('Success! User count:', count)

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      userCount: count,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Database error:', error)

    return NextResponse.json({
      success: false,
      error: 'Database connection failed',
      details: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      fullError: String(error)
    }, { status: 500 })
  }
}
