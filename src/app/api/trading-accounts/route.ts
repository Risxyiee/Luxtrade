import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Fungsi pembantu mengambil token auth dari cookie Next.js secara dinamis
function getAuthTokenFromCookies() {
  const cookieStore = cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  if (!supabaseUrl) return null
  
  try {
    const hostname = new URL(supabaseUrl).hostname.split('.')[0]
    const supabaseCookieName = `sb-${hostname}-auth-token`
    const cookieData = cookieStore.get(supabaseCookieName)?.value
    if (!cookieData) return null
    
    const parsed = JSON.parse(cookieData)
    return parsed?.access_token || parsed?.[0]?.access_token || cookieData
  } catch {
    return null
  }
}

// GET: Mengambil semua akun trading milik user yang sedang login
export async function GET() {
  const accessToken = getAuthTokenFromCookies()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  try {
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Sesi login tidak ditemukan.' },
        { status: 401 }
      )
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Sesi kedaluwarsa.' },
        { status: 401 }
      )
    }

    const { data: accounts, error: dbError } = await supabase
      .from('trading_accounts')
      .select('*')
      .eq('user_id', user.id)

    if (dbError) throw dbError

    return NextResponse.json({ success: true, data: accounts })
  } catch (error: any) {
    console.error('[trading-accounts] GET error:', error.message)
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: error.message },
      { status: 500 }
    )
  }
}
