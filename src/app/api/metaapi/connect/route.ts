import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Gagal memverifikasi akun Anda di server' },
        { status: 401 }
      )
    }

    // Ambil data body request
    const body = await request.json()
    const { tradingAccountId, accountNumber, password, brokerServer, platform } = body

    // 🔴 PROTEKSI KRUSIAL: Jangan biarkan insert data ke database berjalan jika validasi di atas gagal!
    // Jalankan logic MetaApi & Rollback lo di sini...
    
    return NextResponse.json({ success: true, message: 'Koneksi MetaApi Berhasil!' })

  } catch (error: any) {
    return NextResponse.json(
      { error: 'MetaApi Error', message: error.message },
      { status: 500 }
    )
  }
}
