import { NextResponse } from 'next/server'

export async function GET() {
  // This endpoint shows which environment variables are actually being read
  // Helps debug configuration issues

  const envInfo = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    variables: {
      NEXT_PUBLIC_SUPABASE_URL: {
        exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        value: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET',
        length: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
        preview: process.env.NEXT_PUBLIC_SUPABASE_URL
          ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 20)}...`
          : 'NOT SET'
      },
      NEXT_PUBLIC_SUPABASE_ANON_KEY: {
        exists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        length: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
        preview: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...`
          : 'NOT SET'
      },
      SUPABASE_SERVICE_ROLE_KEY: {
        exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
        preview: process.env.SUPABASE_SERVICE_ROLE_KEY
          ? `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`
          : 'NOT SET'
      },
      DATABASE_URL: {
        exists: !!process.env.DATABASE_URL,
        length: process.env.DATABASE_URL?.length || 0,
        preview: process.env.DATABASE_URL
          ? `${process.env.DATABASE_URL.substring(0, 30)}...`
          : 'NOT SET'
      }
    },
    validation: {
      supabaseUrlValid: false,
      reason: ''
    }
  }

  // Validate supabaseUrl
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl) {
    const isValid = supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://')
    envInfo.validation.supabaseUrlValid = isValid
    envInfo.validation.reason = isValid
      ? 'URL starts with http:// or https://'
      : `Invalid URL: "${supabaseUrl}" - Must start with http:// or https://`
  } else {
    envInfo.validation.supabaseUrlValid = false
    envInfo.validation.reason = 'NEXT_PUBLIC_SUPABASE_URL is not set'
  }

  return NextResponse.json(envInfo)
}
