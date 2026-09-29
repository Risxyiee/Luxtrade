import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { edgeCrypto } from '@/lib/edge-crypto'

export const dynamic9 = 'force-dynamic'

/**
 * GET /api/prop-firm — List all prop firm rules for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const result = await createClientForApi(request)
    const supabase = result.supabase

    if (!supabase) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    const { data: rules, error: fetchError } = await supabase
      .from('prop_firm_rules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('[prop-firm GET] Supabase error:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch prop firm rules' },
        { status: 500 }
      )
    }

    return NextResponse.json({ rules: rules ?? [] })
  } catch (err) {
    console.error('[prop-firm GET] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch prop firm rules', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/prop-firm — Create a new prop firm rule
 *
 * Body fields:
 *   firm_name, challenge_size, phase, max_drawdown, max_daily_drawdown,
 *   daily_drawdown_type, profit_target, profit_target_percent,
 *   min_trading_days, profit_split, start_date, account_id
 */
export async function POST(request: NextRequest) {
  try {
    const result = await createClientForApi(request)
    const supabase = result.supabase

    if (!supabase) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    // Use req.text() + JSON.parse() to avoid CF Workers stream consumed error
    const rawBody = await request.text()
    const body = JSON.parse(rawBody)

    // Validate required fields
    if (!body.firm_name) {
      return NextResponse.json(
        { error: 'firm_name is required' },
        { status: 400 }
      )
    }
    if (!body.challenge_size || Number(body.challenge_size) <= 0) {
      return NextResponse.json(
        { error: 'challenge_size must be a positive number' },
        { status: 400 }
      )
    }

    const ruleData = {
      id: edgeCrypto.randomUUID(),
      user_id: user.id,
      firm_name: String(body.firm_name),
      challenge_size: parseFloat(String(body.challenge_size)),
      phase: body.phase ? parseInt(String(body.phase), 10) : 1,
      max_drawdown: body.max_drawdown != null ? parseFloat(String(body.max_drawdown)) : 10,
      max_daily_drawdown: body.max_daily_drawdown != null ? parseFloat(String(body.max_daily_drawdown)) : 5,
      daily_drawdown_type: body.daily_drawdown_type ? String(body.daily_drawdown_type) : 'relative',
      profit_target: body.profit_target != null ? parseFloat(String(body.profit_target)) : null,
      profit_target_percent: body.profit_target_percent != null ? parseFloat(String(body.profit_target_percent)) : 10,
      min_trading_days: body.min_trading_days != null ? parseInt(String(body.min_trading_days), 10) : 4,
      profit_split: body.profit_split != null ? parseFloat(String(body.profit_split)) : 80,
      start_date: body.start_date ? new Date(String(body.start_date)).toISOString() : new Date().toISOString(),
      account_id: body.account_id ? String(body.account_id) : null,
      is_violated: false,
      current_drawdown: 0,
      current_daily_drawdown: 0,
      progress_percent: 0,
      days_traded: 0,
      peak_balance: parseFloat(String(body.challenge_size)),
      current_balance: parseFloat(String(body.challenge_size)),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data: rule, error: insertError } = await supabase
      .from('prop_firm_rules')
      .insert([ruleData])
      .select()
      .single()

    if (insertError) {
      console.error('[prop-firm POST] Insert error:', insertError)

      if (insertError.code === '23503') {
        return NextResponse.json(
          { error: 'Profile not found. Please refresh and try again.' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to create prop firm rule', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ rule }, { status: 201 })
  } catch (err) {
    console.error('[prop-firm POST] Error:', err)
    return NextResponse.json(
      { error: 'Failed to create prop firm rule', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
