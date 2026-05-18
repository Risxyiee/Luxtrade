import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // ─── 1. PARSE BODY DULU (sebelum try-catch auth agar error parsing juga tertangkap JSON) ───
  let body: {
    tradingAccountId?: string
    accountNumber?: string
    password?: string
    brokerServer?: string
    platform?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Bad Request', message: 'Body request tidak valid atau bukan JSON.' },
      { status: 400 }
    )
  }

  const { tradingAccountId, accountNumber, password, brokerServer, platform } = body

  // ─── 2. VALIDASI INPUT ───
  if (!accountNumber || !password || !brokerServer || !platform) {
    return NextResponse.json(
      {
        success: false,
        error: 'Bad Request',
        message: 'Field accountNumber, password, brokerServer, dan platform wajib diisi.',
      },
      { status: 400 }
    )
  }

  // ─── 3. INISIALISASI SUPABASE ROUTE HANDLER CLIENT (baca cookies session Next.js) ───
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  let insertedAccountId: string | null = null

  try {
    // ─── 4. VERIFIKASI SESI USER ───
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'Sesi login tidak ditemukan atau sudah kedaluwarsa. Silakan login kembali.',
        },
        { status: 401 }
      )
    }

    // ─── 5. CEK DUPLIKAT AKUN ───
    const { data: existingAccount } = await supabase
      .from('trading_accounts')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('account_number', accountNumber)
      .maybeSingle()

    if (existingAccount) {
      return NextResponse.json(
        {
          success: false,
          error: 'Duplicate Account',
          message: `Akun trading dengan nomor ${accountNumber} sudah terdaftar (status: ${existingAccount.status}).`,
        },
        { status: 409 }
      )
    }

    // ─── 6. INSERT KE DATABASE DULU (dengan status PENDING) ───
    const { data: newAccount, error: insertError } = await supabase
      .from('trading_accounts')
      .insert({
        user_id: user.id,
        account_number: accountNumber,
        broker_server: brokerServer,
        platform: platform.toUpperCase(),
        metaapi_account_id: null, // Akan diisi setelah MetaApi berhasil
        status: 'PENDING',
      })
      .select()
      .single()

    if (insertError || !newAccount) {
      throw new Error(
        `Gagal menyimpan akun ke database: ${insertError?.message || 'Unknown DB error'}`
      )
    }

    // Simpan ID untuk rollback jika MetaApi gagal
    insertedAccountId = newAccount.id

    // ─── 7. HANDSHAKE KE METAAPI ───
    const metaApiToken = process.env.METAAPI_TOKEN

    if (!metaApiToken) {
      throw new Error('METAAPI_TOKEN tidak dikonfigurasi di environment variables.')
    }

    const metaApiResponse = await fetch('https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'auth-token': metaApiToken,
      },
      body: JSON.stringify({
        login: accountNumber,
        password: password,
        server: brokerServer,
        platform: platform.toLowerCase(),
        name: `Luxtrade-${accountNumber}`,
        application: 'MetaApi',
        magic: 0,
        quoteStreamingIntervalInSeconds: 2.5,
        reliability: 'high',
      }),
    })

    if (!metaApiResponse.ok) {
      const errText = await metaApiResponse.text()
      throw new Error(`MetaApi menolak koneksi (${metaApiResponse.status}): ${errText}`)
    }

    const metaApiData = await metaApiResponse.json()
    const metaApiAccountId: string = metaApiData.id

    if (!metaApiAccountId) {
      throw new Error('MetaApi tidak mengembalikan account ID yang valid.')
    }

    // ─── 8. UPDATE DATABASE DENGAN METAAPI ACCOUNT ID & STATUS CONNECTED ───
    const { error: updateError } = await supabase
      .from('trading_accounts')
      .update({
        metaapi_account_id: metaApiAccountId,
        status: 'CONNECTED',
      })
      .eq('id', insertedAccountId)

    if (updateError) {
      // MetaApi berhasil tapi update DB gagal — log saja, jangan rollback
      console.error('[metaapi/connect] Gagal update status ke CONNECTED:', updateError.message)
    }

    return NextResponse.json({
      success: true,
      message: 'Akun trading berhasil dihubungkan ke MetaApi!',
      data: {
        id: insertedAccountId,
        metaapi_account_id: metaApiAccountId,
        account_number: accountNumber,
        status: 'CONNECTED',
      },
    })
  } catch (error: any) {
    console.error('[metaapi/connect] Error:', error.message)

    // ─── ROLLBACK: Hapus baris yang sudah diinsert jika MetaApi atau proses sesudahnya gagal ───
    if (insertedAccountId) {
      const { error: rollbackError } = await supabase
        .from('trading_accounts')
        .delete()
        .eq('id', insertedAccountId)

      if (rollbackError) {
        console.error('[metaapi/connect] Rollback gagal:', rollbackError.message)
      } else {
        console.warn('[metaapi/connect] Rollback berhasil — baris DB dihapus:', insertedAccountId)
      }
    }

    // Selalu kembalikan JSON yang valid — TIDAK PERNAH teks mentah (mencegah error #310)
    return NextResponse.json(
      {
        success: false,
        error: 'MetaApi Connection Failed',
        message: error.message || 'Terjadi kesalahan saat menghubungkan akun trading.',
      },
      { status: 500 }
    )
  }
}
