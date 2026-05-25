import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

/**
 * API untuk mengelola integrasi trading pihak ketiga
 * User bisa menambahkan kredensial Account ID, Investor Password, Broker Server
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
 * GET - Mendapatkan semua integrasi milik user
 */
export async function GET(req: Request) {
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

    // Ambil semua integrasi user
    const { data: integrations, error } = await supabaseAdmin
      .from('trading_integrations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      integrations: integrations || []
    })
  } catch (error: any) {
    console.error('[INTEGRATIONS GET] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST - Menambahkan integrasi baru
 */
export async function POST(req: Request) {
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

    // Validasi input
    const { name, provider, account_id, investor_password, broker_server, account_type } = body

    if (!name || !provider || !account_id || !investor_password || !broker_server) {
      return NextResponse.json(
        { error: 'Missing required fields: name, provider, account_id, investor_password, broker_server' },
        { status: 400 }
      )
    }

    // Validasi provider
    const validProviders = ['fxblue', 'myfxbook', 'custom']
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      )
    }

    // Cek quota user
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan, pro_expiry')
      .eq('id', user.id)
      .single()

    const isPro = profile?.plan === 'PRO' &&
                  profile?.pro_expiry &&
                  new Date(profile.pro_expiry) > new Date()

    // Hitung jumlah integrasi yang sudah ada
    const { count: currentCount } = await supabaseAdmin
      .from('trading_integrations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const maxIntegrations = isPro ? 50 : 1

    if (currentCount && currentCount >= maxIntegrations) {
      return NextResponse.json(
        {
          error: 'Quota exceeded',
          message: `Maximum ${maxIntegrations} integration${maxIntegrations > 1 ? 's' : ''} allowed. Upgrade to PRO for unlimited integrations.`,
          current: currentCount,
          max: maxIntegrations
        },
        { status: 403 }
      )
    }

    // Generate webhook URL untuk user
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/api/webhook/trading?source=${provider}`

    // Insert integrasi baru
    const { data: integration, error } = await supabaseAdmin
      .from('trading_integrations')
      .insert({
        user_id: user.id,
        name,
        provider,
        account_id,
        investor_password, // Akan dienkripsi di database (gunakan pgcrypto di production)
        broker_server,
        account_type: account_type || 'MT5',
        status: 'active',
        webhook_url: webhookUrl,
        last_sync: null,
        sync_settings: body.sync_settings || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Integration added successfully',
      integration,
      webhook_url: webhookUrl
    })
  } catch (error: any) {
    console.error('[INTEGRATIONS POST] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
