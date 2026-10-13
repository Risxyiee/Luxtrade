import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const results = {
    timestamp: new Date().toISOString(),
    env: {},
    prisma: {} as any,
    supabase: {} as any,
    database: {} as any
  }

  try {
    // 1. Check environment variables
    results.env = {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL ? '✓ SET (Length: ' + process.env.DATABASE_URL.length + ')' : '✗ NOT SET',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ SET' : '✗ NOT SET',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ SET (Length: ' + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ')' : '✗ NOT SET',
    }

    // 2. Test Prisma connection
    try {
      console.log('📊 Testing Prisma connection...')
      results.prisma.status = 'Testing...'

      const userCount = await db.user.count()
      results.prisma.status = '✓ Connected'
      results.prisma.userCount = userCount

      // Try a simple query
      const testUser = await db.user.findFirst({
        select: { id: true, email: true }
      })
      results.prisma.canQuery = testUser ? '✓ Yes' : '✗ No users'
      results.prisma.sampleUser = testUser ? { id: testUser.id, email: testUser.email } : null

      // Test UserSubscription table
      const subCount = await db.userSubscription.count()
      results.prisma.subscriptionCount = subCount
      results.prisma.tables = ['User', 'UserSubscription']

    } catch (prismaError: any) {
      console.error('❌ Prisma error:', prismaError)
      results.prisma.status = '✗ Failed'
      results.prisma.error = {
        message: prismaError?.message || String(prismaError),
        name: prismaError?.name || 'UnknownError',
        code: prismaError?.code,
        meta: prismaError?.meta,
      }
    }

    // 3. Test Supabase Admin
    try {
      console.log('🔐 Testing Supabase Admin...')
      results.supabase.status = 'Testing...'

      if (!supabaseAdmin) {
        results.supabase.status = '✗ Not initialized'
        results.supabase.error = 'SUPABASE_SERVICE_ROLE_KEY not set'
      } else {
        results.supabase.status = '✓ Initialized'

        const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()

        if (authError) {
          results.supabase.status = '✗ Failed to fetch users'
          results.supabase.error = {
            message: authError?.message || String(authError),
            name: authError?.name || 'UnknownError',
          }
        } else {
          results.supabase.status = '✓ Connected'
          results.supabase.userCount = authUsers?.users?.length || 0
          results.supabase.users = authUsers?.users?.map((u: any) => ({
            id: u.id,
            email: u.email,
            name: u.user_metadata?.display_name || u.user_metadata?.name || 'N/A'
          })) || []
        }
      }
    } catch (supabaseError: any) {
      console.error('❌ Supabase error:', supabaseError)
      results.supabase.status = '✗ Failed'
      results.supabase.error = {
        message: supabaseError?.message || String(supabaseError),
        name: supabaseError?.name || 'UnknownError',
        stack: supabaseError?.stack,
      }
    }

    // 4. Summary
    results.database.summary = {
      prismaOk: results.prisma.status?.includes('Connected') || false,
      supabaseOk: results.supabase.status?.includes('Connected') || false,
      allOk: (results.prisma.status?.includes('Connected') || false) && (results.supabase.status?.includes('Connected') || false),
      prismaUsers: results.prisma.userCount || 0,
      supabaseUsers: results.supabase.userCount || 0,
      syncNeeded: (results.supabase.userCount || 0) > (results.prisma.userCount || 0)
    }

    return NextResponse.json({
      success: true,
      ...results
    })

  } catch (error: any) {
    console.error('❌ Debug endpoint error:', error)

    return NextResponse.json({
      success: false,
      error: 'Debug failed',
      details: {
        message: error?.message || String(error),
        name: error?.name || 'UnknownError',
        stack: error?.stack,
      },
      partialResults: results
    }, { status: 500 })
  }
}
