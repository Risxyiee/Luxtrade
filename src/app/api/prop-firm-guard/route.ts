import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

/**
 * /api/prop-firm-guard
 *
 * GET    — List user's challenges
 * POST   — Create new challenge
 * PATCH  — Update challenge (phase, alert settings, etc.)
 * DELETE — Deactivate challenge
 */

/** Transform snake_case DB row to camelCase for frontend */
function toCamelCase(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    tradingAccountId: row.trading_account_id,
    firmName: row.firm_name,
    challengePhase: row.challenge_phase,
    accountSize: row.account_size,
    maxDailyLoss: row.max_daily_loss,
    maxTotalDD: row.max_total_dd,
    profitTarget: row.profit_target,
    currentBalance: row.current_balance,
    dailyPL: row.daily_pl,
    totalPL: row.total_pl,
    currentDailyDD: row.current_daily_dd,
    currentTotalDD: row.current_total_dd,
    currentProgress: row.current_progress,
    alertAtPercent: row.alert_at_percent,
    lastAlertAt: row.last_alert_at,
    isBreached: row.is_breached,
    breachReason: row.breach_reason,
    breachedAt: row.breached_at,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── GET ───────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user || response) return response

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  try {
    const { data, error } = await admin
      .from('prop_firm_challenges')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[prop-firm-guard] GET query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const challenges = (data || []).map(toCamelCase)
    return NextResponse.json({ challenges })
  } catch (error: any) {
    console.error('[prop-firm-guard] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ─── POST ──────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user || response) return response

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const {
      firmName,
      challengePhase,
      accountSize,
      maxDailyLoss,
      maxTotalDD,
      profitTarget,
      tradingAccountId,
      alertAtPercent,
    } = body

    // Validate required fields
    if (!firmName || !accountSize) {
      return NextResponse.json(
        { error: 'firmName and accountSize are required' },
        { status: 400 }
      )
    }

    // Validate firm name
    const validFirms = ['FTMO', 'MFF', 'TFT', 'FundedNext', 'SurgeTrader', 'Custom']
    if (!validFirms.includes(firmName)) {
      return NextResponse.json(
        { error: `Invalid firm name. Must be one of: ${validFirms.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate phase
    const validPhases = ['phase1', 'phase2', 'funded']
    const phase = challengePhase || 'phase1'
    if (!validPhases.includes(phase)) {
      return NextResponse.json(
        { error: `Invalid phase. Must be one of: ${validPhases.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate account size
    if (typeof accountSize !== 'number' || accountSize <= 0) {
      return NextResponse.json(
        { error: 'accountSize must be a positive number' },
        { status: 400 }
      )
    }

    // Validate DD limits
    if (typeof maxDailyLoss !== 'number' || maxDailyLoss <= 0) {
      return NextResponse.json(
        { error: 'maxDailyLoss must be a positive number' },
        { status: 400 }
      )
    }
    if (typeof maxTotalDD !== 'number' || maxTotalDD <= 0) {
      return NextResponse.json(
        { error: 'maxTotalDD must be a positive number' },
        { status: 400 }
      )
    }
    if (typeof profitTarget !== 'number' || profitTarget <= 0) {
      return NextResponse.json(
        { error: 'profitTarget must be a positive number' },
        { status: 400 }
      )
    }

    // Check max challenges per user (limit: 10)
    const { count, error: countError } = await admin
      .from('prop_firm_challenges')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (countError) {
      console.error('[prop-firm-guard] POST count error:', countError)
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }

    if ((count || 0) >= 10) {
      return NextResponse.json(
        { error: 'Maximum 10 active challenges per user' },
        { status: 400 }
      )
    }

    const { data, error: insertError } = await admin
      .from('prop_firm_challenges')
      .insert({
        user_id: user.id,
        firm_name: firmName,
        challenge_phase: phase,
        account_size: accountSize,
        max_daily_loss: maxDailyLoss,
        max_total_dd: maxTotalDD,
        profit_target: profitTarget,
        trading_account_id: tradingAccountId || null,
        alert_at_percent: alertAtPercent || 40,
        current_balance: accountSize,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[prop-firm-guard] POST insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const challenge = toCamelCase(data)
    return NextResponse.json({ challenge }, { status: 201 })
  } catch (error: any) {
    console.error('[prop-firm-guard] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ─── PATCH ─────────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user || response) return response

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Challenge id is required' }, { status: 400 })
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await admin
      .from('prop_firm_challenges')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      console.error('[prop-firm-guard] PATCH fetch error:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    // Build safe update data (snake_case for DB)
    const data: any = {}

    if (updates.challengePhase) {
      const validPhases = ['phase1', 'phase2', 'funded']
      if (!validPhases.includes(updates.challengePhase)) {
        return NextResponse.json({ error: 'Invalid phase' }, { status: 400 })
      }
      data.challenge_phase = updates.challengePhase
    }

    if (updates.alertAtPercent !== undefined) {
      if (typeof updates.alertAtPercent !== 'number' || updates.alertAtPercent < 10 || updates.alertAtPercent > 90) {
        return NextResponse.json({ error: 'alertAtPercent must be between 10 and 90' }, { status: 400 })
      }
      data.alert_at_percent = updates.alertAtPercent
    }

    if (updates.maxDailyLoss !== undefined) {
      data.max_daily_loss = updates.maxDailyLoss
    }

    if (updates.maxTotalDD !== undefined) {
      data.max_total_dd = updates.maxTotalDD
    }

    if (updates.profitTarget !== undefined) {
      data.profit_target = updates.profitTarget
    }

    if (updates.tradingAccountId !== undefined) {
      data.trading_account_id = updates.tradingAccountId || null
    }

    if (updates.firmName !== undefined) {
      data.firm_name = updates.firmName
    }

    if (updates.accountSize !== undefined) {
      data.account_size = updates.accountSize
    }

    if (updates.isActive !== undefined) {
      data.is_active = updates.isActive
    }

    // Allow resetting breach
    if (updates.resetBreach === true) {
      data.is_breached = false
      data.breach_reason = null
      data.breached_at = null
    }

    const { data: updated, error: updateError } = await admin
      .from('prop_firm_challenges')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('[prop-firm-guard] PATCH update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const challenge = toCamelCase(updated)
    return NextResponse.json({ challenge })
  } catch (error: any) {
    console.error('[prop-firm-guard] PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ─── DELETE ────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user || response) return response

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Challenge id is required' }, { status: 400 })
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await admin
      .from('prop_firm_challenges')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      console.error('[prop-firm-guard] DELETE fetch error:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    // Soft delete (deactivate)
    const { error: updateError } = await admin
      .from('prop_firm_challenges')
      .update({ is_active: false })
      .eq('id', id)

    if (updateError) {
      console.error('[prop-firm-guard] DELETE update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[prop-firm-guard] DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
