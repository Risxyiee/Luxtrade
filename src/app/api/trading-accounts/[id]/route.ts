import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const VALID_STATUSES = ['CONNECTED', 'DISCONNECTED', 'PENDING', 'ERROR'] as const

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

// PATCH: Update status/metaapi_id akun trading tertentu
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const accessToken = getAuthTokenFromCookies()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  try {
    if (!accessToken) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const accountId = params.id
    let body: { metaapi_account_id?: string; status?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Bad Request', message: 'Body tidak valid' }, { status: 400 })
    }

    const { metaapi_account_id, status } = body
    if (!metaapi_account_id && !status) return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 })
    if (status && !VALID_STATUSES.includes(status as any)) return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 })

    const { data: account, error: findError } = await supabase.from('trading_accounts').select('user_id').eq('id', accountId).maybeSingle()
    if (findError) throw findError
    if (!account) return NextResponse.json({ success: false, error: 'Not Found' }, { status: 404 })
    if (account.user_id !== user.id) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    const updates: Record<string, string> = {}
    if (metaapi_account_id) updates.metaapi_account_id = metaapi_account_id
    if (status) updates.status = status

    const { data: updatedAccount, error: updateError } = await supabase.from('trading_accounts').update(updates).eq('id', accountId).select().single()
    if (updateError) throw updateError

    return NextResponse.json({ success: true, data: updatedAccount })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Server Error', message: error.message }, { status: 500 })
  }
}

// DELETE: Hapus akun trading tertentu
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const accessToken = getAuthTokenFromCookies()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  try {
    if (!accessToken) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const accountId = params.id
    const { data: account, error: findError } = await supabase.from('trading_accounts').select('user_id').eq('id', accountId).maybeSingle()
    if (findError) throw findError
    if (!account) return NextResponse.json({ success: false, error: 'Not Found' }, { status: 404 })
    if (account.user_id !== user.id) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    const { error: deleteError } = await supabase.from('trading_accounts').delete().eq('id', accountId).eq('user_id', user.id)
    if (deleteError) throw deleteError

    return NextResponse.json({ success: true, message: 'Akun trading berhasil dihapus.' })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Server Error', message: error.message }, { status: 500 })
  }
}
