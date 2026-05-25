import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

/**
 * API untuk mengelola integrasi trading spesifik (Update & Delete)
 */

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

/**
 * PATCH - Update integrasi
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch { /* Ignore */ }
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    // Cek apakah integrasi milik user ini
    const { data: existing } = await supabaseAdmin
      .from('trading_integrations')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Update integrasi
    const { data: integration, error } = await supabaseAdmin
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
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch { /* Ignore */ }
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Cek apakah integrasi milik user ini
    const { data: existing } = await supabaseAdmin
      .from('trading_integrations')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Hapus integrasi
    const { error } = await supabaseAdmin
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
