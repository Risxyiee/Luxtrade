import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { db } from '@/lib/db'

export async function GET() {
  const steps: Array<{ step: string; status: string; details?: any }> = []

  try {
    // Step 1: Check environment variables
    steps.push({
      step: '1. Check Environment Variables',
      status: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'OK' : 'FAILED',
      details: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET',
        DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET'
      }
    })

    // Step 2: Check supabaseAdmin client
    if (!supabaseAdmin) {
      steps.push({
        step: '2. Initialize Supabase Admin Client',
        status: 'FAILED',
        details: 'supabaseAdmin is null or undefined'
      })
      return NextResponse.json({ steps, error: 'supabaseAdmin client not available' }, { status: 500 })
    }

    steps.push({
      step: '2. Initialize Supabase Admin Client',
      status: 'OK',
      details: 'supabaseAdmin client initialized successfully'
    })

    // Step 3: Test database connection
    steps.push({
      step: '3. Test Prisma Database Connection',
      status: 'CONNECTING'
    })

    const prismaUserCount = await db.user.count()
    steps[2].status = 'OK'
    steps[2].details = { userCount: prismaUserCount }

    // Step 4: Test Supabase Auth connection
    steps.push({
      step: '4. Test Supabase Auth Connection',
      status: 'CONNECTING'
    })

    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()

    if (authError) {
      steps[3].status = 'FAILED'
      steps[3].details = {
        error: String(authError),
        errorName: authError.name,
        errorMessage: authError.message
      }
      return NextResponse.json({ steps, error: 'Failed to connect to Supabase Auth' }, { status: 500 })
    }

    steps[3].status = 'OK'
    steps[3].details = {
      authUserCount: authUsers?.users?.length || 0,
      users: authUsers?.users?.map(u => ({
        id: u.id,
        email: u.email,
        displayName: u.user_metadata?.display_name || 'N/A'
      })) || []
    }

    // Step 5: Final comparison
    steps.push({
      step: '5. Compare Users',
      status: 'OK',
      details: {
        supabaseAuthUsers: authUsers?.users?.length || 0,
        prismaUsers: prismaUserCount,
        syncNeeded: (authUsers?.users?.length || 0) > prismaUserCount,
        usersToSync: (authUsers?.users?.length || 0) - prismaUserCount
      }
    })

    return NextResponse.json({
      success: true,
      message: 'All checks passed',
      steps
    })

  } catch (error) {
    steps.push({
      step: 'ERROR',
      status: 'FAILED',
      details: {
        error: String(error),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      }
    })

    return NextResponse.json({
      steps,
      error: 'Debug failed',
      details: String(error)
    }, { status: 500 })
  }
}
