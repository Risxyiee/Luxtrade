import { NextResponse } from 'next/server'

const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtseGtkcmZzZmNvYW5rYmFvZWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAwNTQwMjksImV4cCI6MjA0NTYzMDAyOX0.DkCkO4z3D9Yk_2VZQ_M4pC0eJ8xwJ-5D8x_7kK9F4w8'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://klxkdrfsfcoankbaoejn.supabase.co'
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY

  return NextResponse.json({
    url,
    anonKey: anonKey,
    isConfigured: true
  })
}
