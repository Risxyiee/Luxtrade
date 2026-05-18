import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    // KUNCI UTAMA: Bikin client server-side yang bisa ngebaca cookie otomatis
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // Ambil user dengan aman
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      // Pastikan return JSON yang valid, BUKAN teks biasa biar gak memicu eror #310
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Sesi login tidak ditemukan atau kedaluwarsa' },
        { status: 401 }
      )
    }

    // Jalankan query database lo di bawah sini menggunakan instance 'supabase' tadi
    const { data: accounts, error: dbError } = await supabase
      .from('trading_accounts')
      .select('*')
      .eq('user_id', user.id)

    if (dbError) throw dbError

    return NextResponse.json({ success: true, data: accounts })

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    )
  }
}
