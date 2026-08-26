import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://klxkdrfsfcoankbaoejn.supabase.co'

export async function GET(request: NextRequest) {
  try {
    // Try to get admin client with different methods
    const methods = {
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      altKey1: process.env.SERVICE_ROLE_KEY,
      altKey2: process.env.SUPABASE_ADMIN_KEY,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    }

    let adminClient = null
    let methodUsed = 'none'

    // Method 1: SUPABASE_SERVICE_ROLE_KEY
    if (methods.serviceRoleKey && methods.serviceRoleKey !== 'undefined' && methods.serviceRoleKey.trim() !== '') {
      adminClient = createClient(supabaseUrl, methods.serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
      methodUsed = 'SUPABASE_SERVICE_ROLE_KEY'
    }
    // Method 2: SERVICE_ROLE_KEY
    else if (methods.altKey1 && methods.altKey1 !== 'undefined' && methods.altKey1.trim() !== '') {
      adminClient = createClient(supabaseUrl, methods.altKey1, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
      methodUsed = 'SERVICE_ROLE_KEY'
    }
    // Method 3: SUPABASE_ADMIN_KEY
    else if (methods.altKey2 && methods.altKey2 !== 'undefined' && methods.altKey2.trim() !== '') {
      adminClient = createClient(supabaseUrl, methods.altKey2, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
      methodUsed = 'SUPABASE_ADMIN_KEY'
    }
    // Method 4: Anon key (fallback)
    else if (methods.anonKey && methods.anonKey !== 'undefined' && methods.anonKey.trim() !== '') {
      adminClient = createClient(supabaseUrl, methods.anonKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
      methodUsed = 'ANON_KEY (fallback)'
    }

    if (!adminClient) {
      return NextResponse.json({
        success: false,
        error: 'No valid Supabase credentials found',
        methodsAvailable: Object.keys(methods).filter(k => methods[k as keyof typeof methods] && methods[k as keyof typeof methods] !== 'undefined')
      })
    }

    // Test listing users
    let listUsersResult = 'not_tested'
    let usersCount = 0

    try {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 5 })
      if (error) {
        listUsersResult = 'FAILED: ' + error.message
      } else {
        listUsersResult = 'SUCCESS'
        usersCount = users?.length || 0
      }
    } catch (err: any) {
      listUsersResult = 'EXCEPTION: ' + err.message
    }

    return NextResponse.json({
      success: true,
      methodUsed,
      methodsAvailable: Object.keys(methods).filter(k => methods[k as keyof typeof methods] && methods[k as keyof typeof methods] !== 'undefined'),
      tests: {
        listUsers: listUsersResult,
        usersCount
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
