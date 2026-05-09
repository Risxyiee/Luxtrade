import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  return NextResponse.json({ status: 'ok', message: 'Auth API is working' })
}

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()
  
  console.log('🧪 TEST LOGIN ===============')
  console.log('📧 Email:', email)
  
  if (!email || !password) {
    return NextResponse.json({ error: 'Email dan password diperlukan' }, { status: 400 })
  }
  
  try {
    // Get the Supabase client
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    console.log('📊 Supabase Response:')
    console.log('- hasUser:', !!data?.user)
    console.log('- hasSession:', !!data?.session)
    console.log('- error:', signInError)
    
    if (signInError) {
      console.log('❌ Login Error Details:')
      console.log('  message:', signInError.message)
      console.log('  status:', signInError.status)
      return NextResponse.json({
        success: false,
        error: signInError.message,
        errorDetails: {
          message: signInError.message,
          status: signInError.status,
          name: signInError.name
        }
      }, { status: 400 })
    }
    
    if (data.session && data.user) {
      console.log('✅ LOGIN SUCCESS!')
      console.log('  User ID:', data.user.id)
      console.log('  Email:', data.user.email)
      return NextResponse.json({
        success: true,
        message: 'Login berhasil',
        user: {
          id: data.user.id,
          email: data.user.email,
          email_confirmed: data.user.email_confirmed_at ? true : false
        }
      })
    }
    
    return NextResponse.json({
      success: false,
      error: 'Tidak ada session yang dikembalikan'
    })
    
  } catch (err) {
    console.error('❌ Exception:', err)
    return NextResponse.json({
      success: false,
      error: 'Server error: ' + (err instanceof Error ? err.message : 'Unknown error')
    }, { status: 500 })
  }
}
