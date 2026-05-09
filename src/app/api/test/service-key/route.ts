import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const results: { step: string; status: string; details?: any }[] = []

  try {
    // Step 1: Check environment variables
    results.push({
      step: '1. Environment Variables',
      status: 'info',
      details: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET',
        SERVICE_ROLE_KEY_LENGTH: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
        SERVICE_ROLE_KEY_START: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...' || 'N/A'
      }
    })

    // Step 2: Check supabaseAdmin initialization
    if (!supabaseAdmin) {
      results.push({
        step: '2. Supabase Admin Client',
        status: 'FAILED',
        details: 'supabaseAdmin is null - SERVICE_ROLE_KEY not configured'
      })
      return NextResponse.json({ success: false, results })
    }

    results.push({
      step: '2. Supabase Admin Client',
      status: 'OK',
      details: 'supabaseAdmin initialized successfully'
    })

    // Step 3: Test Supabase Auth API with service role
    results.push({
      step: '3. Test Supabase Auth Admin API',
      status: 'testing...'
    })

    const { data, error } = await supabaseAdmin.auth.admin.listUsers()

    if (error) {
      results[2].status = 'FAILED'
      results[2].details = {
        error: String(error),
        errorName: error.name,
        errorMessage: error.message,
        errorStatus: error.status
      }
      return NextResponse.json({ success: false, results })
    }

    results[2].status = 'OK'
    results[2].details = {
      userCount: data?.users?.length || 0,
      users: data?.users?.map(u => ({
        id: u.id,
        email: u.email,
        name: u.user_metadata?.full_name || u.user_metadata?.display_name || u.user_metadata?.name || 'N/A'
      })) || []
    }

    return NextResponse.json({
      success: true,
      message: 'Service Role Key is working correctly',
      results
    })

  } catch (error) {
    results.push({
      step: 'ERROR',
      status: 'FAILED',
      details: {
        error: String(error),
        errorMessage: error instanceof Error ? error.message : 'Unknown',
        errorStack: error instanceof Error ? error.stack : undefined
      }
    })

    return NextResponse.json({
      success: false,
      results,
      error: String(error)
    }, { status: 500 })
  }
}
