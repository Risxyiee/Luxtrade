import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseClient } from '@/lib/supabase/server-client'

/**
 * API untuk mengelola integrasi trading spesifik (Update & Delete)
 */

// Initialize Supabase Admin Client (lazy)
let _supabaseAdmin: SupabaseClient | null = null
function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Missing Supabase env vars')
    _supabaseAdmin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  }
  return _supabaseAdmin
}

/**
 * PATCH - Update integrasi
 */
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const supabase = await createSupabaseClient(req)

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    // Cek apakah integrasi milik user ini
    const { data: existing } = await getSupabaseAdmin()
      .from('trading_integrations')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Update integrasi
    const { data: integration, error } = await getSupabaseAdmin()
      .from('trading_integrations')
      .update({
        name: body.name ?? existing.name,
        status: body.status ?? existing.status,
        sync_settings: body.sync_settings ?? existing.sync_settings,
        investor_password: body.investor_password ?? existing.investor_password,
        last_sync: body.last_sync ?? existing.last_sync,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Integration updated successfully',
      integration
    })
  } catch (error: any) {
    console.error('[INTEGRATIONS PATCH] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Hapus integrasi
 */
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const supabase = await createSupabaseClient(req)

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Cek apakah integrasi milik user ini
    const { data: existing } = await getSupabaseAdmin()
      .from('trading_integrations')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Hapus integrasi
    const { error } = await getSupabaseAdmin()
      .from('trading_integrations')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Integration deleted successfully'
    })
  } catch (error: any) {
    console.error('[INTEGRATIONS DELETE] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
