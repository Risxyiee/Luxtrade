import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const VALID_STATUSES = ['CONNECTED', 'DISCONNECTED', 'PENDING', 'ERROR'] as const

// PATCH: Update trading account
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Sesi login tidak ditemukan atau sudah kedaluwarsa.' },
        { status: 401 }
      )
    }

    const accountId = params.id

    let body: { metaapi_account_id?: string; status?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Bad Request', message: 'Body request tidak valid.' },
        { status: 400 }
      )
    }

    const { metaapi_account_id, status } = body

    if (!metaapi_account_id && !status) {
      return NextResponse.json(
        {
          success: false,
          error: 'No fields to update',
          message: 'Sertakan minimal satu field: metaapi_account_id atau status.',
          valid_fields: ['metaapi_account_id', 'status'],
        },
        { status: 400 }
      )
    }

    if (status && !VALID_STATUSES.includes(status as any)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid status',
          message: `Status tidak valid. Gunakan salah satu dari: ${VALID_STATUSES.join(', ')}.`,
        },
        { status: 400 }
      )
    }

    // Verifikasi kepemilikan akun
    const { data: account, error: findError } = await supabase
      .from('trading_accounts')
      .select('user_id')
      .eq('id', accountId)
      .maybeSingle()

    if (findError) throw findError

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Not Found', message: 'Akun trading tidak ditemukan.' },
        { status: 404 }
      )
    }

    if (account.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden', message: 'Kamu hanya bisa mengubah akun milikmu sendiri.' },
        { status: 403 }
      )
    }

    const updates: Record<string, string> = {}
    if (metaapi_account_id) updates.metaapi_account_id = metaapi_account_id
    if (status) updates.status = status

    const { data: updatedAccount, error: updateError } = await supabase
      .from('trading_accounts')
      .update(updates)
      .eq('id', accountId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ success: true, data: updatedAccount })
  } catch (error) {
    console.error('[trading-accounts/[id]] PATCH error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Terjadi kesalahan pada server.',
      },
      { status: 500 }
    )
  }
}

// DELETE: Delete trading account
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Sesi login tidak ditemukan atau sudah kedaluwarsa.' },
        { status: 401 }
      )
    }

    const accountId = params.id

    const { data: account, error: findError } = await supabase
      .from('trading_accounts')
      .select('user_id')
      .eq('id', accountId)
      .maybeSingle()

    if (findError) throw findError

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Not Found', message: 'Akun trading tidak ditemukan.' },
        { status: 404 }
      )
    }

    if (account.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden', message: 'Kamu hanya bisa menghapus akun milikmu sendiri.' },
        { status: 403 }
      )
    }

    const { error: deleteError } = await supabase
      .from('trading_accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', user.id)

    if (deleteError) throw deleteError

    return NextResponse.json({
      success: true,
      message: 'Akun trading berhasil dihapus.',
    })
  } catch (error) {
    console.error('[trading-accounts/[id]] DELETE error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Terjadi kesalahan pada server.',
      },
      { status: 500 }
    )
  }
}
