import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debugging database connection...')

    // Test 1: Check if database URL is set
    const dbUrl = process.env.DATABASE_URL
    console.log('DATABASE_URL:', dbUrl ? '✓ SET' : '✗ NOT SET')

    if (!dbUrl) {
      return NextResponse.json({
        success: false,
        error: 'DATABASE_URL not set',
        databaseUrl: 'NOT SET'
      }, { status: 500 })
    }

    // Test 2: Try to query database
    console.log('📊 Querying User table...')
    const userCount = await db.user.count()
    console.log(`✅ User table OK: ${userCount} users`)

    // Test 3: Check UserSubscription table
    console.log('📊 Querying UserSubscription table...')
    const subCount = await db.userSubscription.count()
    console.log(`✅ UserSubscription table OK: ${subCount} subscriptions`)

    // Test 4: Try to get all users
    console.log('📋 Fetching all users...')
    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    })
    console.log(`✅ Found ${users.length} users`)

    return NextResponse.json({
      success: true,
      databaseUrl: '✓ SET',
      userCount,
      subscriptionCount: subCount,
      sampleUsers: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.createdAt
      }))
    })
  } catch (error) {
    console.error('❌ Database debug error:', error)

    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'UnknownError',
      stack: error instanceof Error ? error.stack : undefined,
    }

    return NextResponse.json({
      success: false,
      error: 'Database connection failed',
      databaseUrl: process.env.DATABASE_URL ? '✓ SET' : '✗ NOT SET',
      errorDetails
    }, { status: 500 })
  }
}
