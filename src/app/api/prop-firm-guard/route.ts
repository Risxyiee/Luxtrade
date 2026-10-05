import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getSupabaseAdminAsync } from '@/lib/supabase-admin-alt'

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
    consistencyRule: row.consistency_rule || 0,
    bestDayPL: row.best_day_pl || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── GET ───────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user || response) return response

  const admin = await getSupabaseAdminAsync()
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  try {
    // Select only columns that are guaranteed to exist in the DB
    // Newer columns (consistency_rule, best_day_pl) may not exist if migration hasn't run
    const selectColumns = 'id,user_id,trading_account_id,firm_name,challenge_phase,account_size,max_daily_loss,max_total_dd,profit_target,current_balance,daily_pl,total_pl,current_daily_dd,current_total_dd,current_progress,alert_at_percent,last_alert_at,is_breached,breach_reason,breached_at,is_active,consistency_rule,best_day_pl,created_at,updated_at'

    let { data, error } = await admin
      .from('prop_firm_challenges')
      .select(selectColumns)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    // If select fails due to missing columns (PGRST204), retry with minimal columns
    if (error && (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('Could not find the'))) {
      console.warn('[prop-firm-guard] GET: some columns not found, retrying with minimal columns:', error.message)
      const minimalCols = 'id,user_id,trading_account_id,firm_name,challenge_phase,account_size,max_daily_loss,max_total_dd,profit_target,current_balance,daily_pl,total_pl,current_daily_dd,current_total_dd,current_progress,alert_at_percent,last_alert_at,is_breached,breach_reason,breached_at,is_active,created_at,updated_at'
      const retry = await admin
        .from('prop_firm_challenges')
        .select(minimalCols)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      data = retry.data
      error = retry.error
    }

    if (error) {
      // Gracefully handle missing table (migration not yet applied) or permission denied (RLS not configured)
      if (
        error.message?.includes('Could not find the table') ||
        error.code === '42P01' ||
        error.code === '42501' ||
        error.message?.includes('permission denied')
      ) {
        console.warn('[prop-firm-guard] Table prop_firm_challenges not accessible:', error.code, error.message)
        return NextResponse.json({ challenges: [] })
      }
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

  const admin = await getSupabaseAdminAsync()
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
      consistencyRule,
      bestDayPL,
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
    if (!validFirms.includes(firmName) && firmName.length < 2) {
      return NextResponse.json(
        { error: 'firmName must be at least 2 characters' },
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
      // Gracefully handle missing table
      if (countError.message?.includes('Could not find the table') || countError.code === '42P01' || countError.code === '42501' || countError.message?.includes('permission denied')) {
        return NextResponse.json({ error: 'Prop Firm feature is not yet available. Please try again later.' }, { status: 503 })
      }
      console.error('[prop-firm-guard] POST count error:', countError)
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }

    if ((count || 0) >= 10) {
      return NextResponse.json(
        { error: 'Maximum 10 active challenges per user' },
        { status: 400 }
      )
    }

    // Try insert with new columns first; if they don't exist yet, retry without them
    const insertWithNewCols = {
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
      consistency_rule: consistencyRule || 0,
      best_day_pl: bestDayPL || 0,
    }

    const insertWithoutNewCols = {
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
    }

    let { data, error: insertError } = await admin
      .from('prop_firm_challenges')
      .insert(insertWithNewCols)
      .select()
      .single()

    // If insert failed due to missing columns, retry without them
    const missingColumnPatterns = [
      'consistency_rule', 'best_day_pl', 'current_balance',
      'daily_pl', 'total_pl', 'current_daily_dd', 'current_total_dd', 'current_progress',
    ]
    if (insertError && (insertError.code === '42703' || missingColumnPatterns.some((col) => insertError.message?.includes(col)))) {
      console.warn('[prop-firm-guard] POST: some columns not found, retrying without optional columns')
      const retryResult = await admin
        .from('prop_firm_challenges')
        .insert(insertWithoutNewCols)
        .select()
        .single()
      data = retryResult.data
      insertError = retryResult.error
    }

    if (insertError) {
      if (insertError.message?.includes('Could not find the table') || insertError.code === '42P01' || insertError.code === '42501' || insertError.message?.includes('permission denied')) {
        return NextResponse.json({ error: 'Prop Firm feature is not yet available. Please try again later.' }, { status: 503 })
      }
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

  const admin = await getSupabaseAdminAsync()
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Challenge id is required' }, { status: 400 })
    }

    // Verify ownership — use minimal column set to avoid PGRST204 errors
    const { data: existing, error: fetchError } = await admin
      .from('prop_firm_challenges')
      .select('id,user_id,account_size,max_daily_loss,max_total_dd,profit_target,daily_pl,total_pl,current_balance')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      // If missing column error, try with just id and user_id
      if (fetchError.code === 'PGRST204' || fetchError.code === '42703') {
        console.warn('[prop-firm-guard] PATCH: select failed with missing column, retrying with minimal select')
        const retry = await admin
          .from('prop_firm_challenges')
          .select('id,user_id')
          .eq('id', id)
          .maybeSingle()
        if (retry.error) {
          console.error('[prop-firm-guard] PATCH minimal fetch error:', retry.error)
          return NextResponse.json({ error: retry.error.message }, { status: 500 })
        }
        if (!retry.data || String(retry.data.user_id) !== String(user.id)) {
          return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
        }
        // Proceed with minimal existing data
        const existingMinimal = retry.data
        // Continue with update below using existingMinimal instead of existing
        // We'll skip derived field recalculation since we don't have the data
        const data2: any = {}
        if (updates.challengePhase !== undefined) {
          const validPhases = ['phase1', 'phase2', 'funded']
          if (!validPhases.includes(updates.challengePhase)) {
            return NextResponse.json({ error: 'Invalid phase' }, { status: 400 })
          }
          data2.challenge_phase = updates.challengePhase
        }
        if (updates.alertAtPercent !== undefined) data2.alert_at_percent = updates.alertAtPercent
        if (updates.firmName !== undefined) data2.firm_name = updates.firmName
        if (updates.accountSize !== undefined) data2.account_size = updates.accountSize
        if (updates.maxDailyLoss !== undefined) data2.max_daily_loss = updates.maxDailyLoss
        if (updates.maxTotalDD !== undefined) data2.max_total_dd = updates.maxTotalDD
        if (updates.profitTarget !== undefined) data2.profit_target = updates.profitTarget
        if (updates.currentBalance !== undefined) data2.current_balance = updates.currentBalance
        if (updates.isActive !== undefined) data2.is_active = updates.isActive
        if (updates.resetBreach === true) {
          data2.is_breached = false
          data2.breach_reason = null
          data2.breached_at = null
        }
        if (Object.keys(data2).length === 0) {
          return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
        }
        // Strip optional columns that might not exist
        const optionalCols = ['consistency_rule','best_day_pl','current_daily_dd','current_total_dd','current_progress']
        for (const c of optionalCols) delete (data2 as any)[c]

        const { data: updated2, error: updateError2 } = await admin
          .from('prop_firm_challenges')
          .update(data2)
          .eq('id', id)
          .select('id,user_id,firm_name,challenge_phase,account_size,max_daily_loss,max_total_dd,profit_target,current_balance,alert_at_percent,is_active,is_breached,created_at,updated_at')
          .single()
        if (updateError2) {
          console.error('[prop-firm-guard] PATCH update error (minimal):', updateError2)
          return NextResponse.json({ error: updateError2.message }, { status: 500 })
        }
        return NextResponse.json({ challenge: toCamelCase(updated2) })
      }
      console.error('[prop-firm-guard] PATCH fetch error:', fetchError)
      if (fetchError.message?.includes('type') || fetchError.message?.includes('does not exist')) {
        return NextResponse.json({ error: 'Database schema needs updating. Run FIX_ALL_TYPE_MISMATCHES.sql in Supabase SQL Editor.' }, { status: 500 })
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!existing) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    // Ownership check — compare as strings to handle both UUID and TEXT types
    if (String(existing.user_id) !== String(user.id)) {
      console.warn('[prop-firm-guard] PATCH ownership mismatch: DB user_id=', existing.user_id, 'auth user.id=', user.id)
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    // Build safe update data (snake_case for DB)
    const data: any = {}
    console.log('[prop-firm-guard] PATCH updates:', JSON.stringify(updates))

    if (updates.challengePhase !== undefined) {
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

    if (updates.currentBalance !== undefined) {
      data.current_balance = updates.currentBalance
      // Auto-recalculate derived metrics when balance changes
      const acctSize = updates.accountSize ?? existing.account_size
      const maxDailyLoss = updates.maxDailyLoss ?? existing.max_daily_loss
      const maxTotalDD = updates.maxTotalDD ?? existing.max_total_dd
      const profitTarget = updates.profitTarget ?? existing.profit_target
      const dailyPL = updates.dailyPL ?? existing.daily_pl ?? 0
      const totalPL = updates.totalPL ?? existing.total_pl ?? 0
      // current_daily_dd = maxDailyLoss - dailyPL (how close to daily loss limit)
      if (maxDailyLoss > 0) {
        data.current_daily_dd = Math.max(0, (maxDailyLoss - Math.abs(dailyPL < 0 ? dailyPL : 0)) / maxDailyLoss * 100)
      }
      // current_total_dd = how much of total DD limit is used
      if (maxTotalDD > 0 && acctSize > 0) {
        const usedDD = acctSize - updates.currentBalance
        data.current_total_dd = Math.max(0, usedDD / maxTotalDD * 100)
      }
      // current_progress = progress toward profit target
      if (profitTarget > 0) {
        data.current_progress = Math.max(0, Math.min(100, totalPL / profitTarget * 100))
      }
    }

    if (updates.consistencyRule !== undefined) {
      data.consistency_rule = updates.consistencyRule
    }

    if (updates.bestDayPL !== undefined) {
      data.best_day_pl = updates.bestDayPL
    }

    if (updates.dailyPL !== undefined) {
      data.daily_pl = updates.dailyPL
    }

    if (updates.totalPL !== undefined) {
      data.total_pl = updates.totalPL
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

    // Defensive: ensure we have something to update
    if (Object.keys(data).length === 0) {
      console.warn('[prop-firm-guard] PATCH: no fields to update after processing body:', Object.keys(updates))
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    console.log('[prop-firm-guard] PATCH DB update data:', data)

    let { data: updated, error: updateError } = await admin
      .from('prop_firm_challenges')
      .update(data)
      .eq('id', id)
      .select('id,user_id,firm_name,challenge_phase,account_size,max_daily_loss,max_total_dd,profit_target,current_balance,alert_at_percent,is_active,is_breached,created_at,updated_at')
      .single()

    // If update failed due to missing columns, progressively remove problematic columns and retry
    // Handles: consistency_rule, best_day_pl, current_balance, daily_pl, total_pl, current_daily_dd, current_total_dd, current_progress
    // Error codes: 42703 (PostgreSQL undefined column), PGRST204 (PostgREST schema cache miss)
    if (updateError) {
      const missingColumnPatterns = [
        'consistency_rule', 'best_day_pl', 'current_balance',
        'daily_pl', 'total_pl', 'current_daily_dd', 'current_total_dd', 'current_progress',
      ]
      const isMissingColumnError =
        updateError.code === '42703' ||
        updateError.code === 'PGRST204' ||
        missingColumnPatterns.some((col) => updateError.message?.includes(col))

      if (isMissingColumnError) {
        // Remove ALL optional/new columns from the update data and retry
        const safeData = { ...data }
        let removedCols: string[] = []

        for (const col of missingColumnPatterns) {
          if (col in safeData) {
            delete (safeData as any)[col]
            removedCols.push(col)
          }
        }

        if (removedCols.length > 0) {
          console.warn('[prop-firm-guard] PATCH: columns not found in DB, retrying without:', removedCols.join(', '))
          const retryResult = await admin
            .from('prop_firm_challenges')
            .update(safeData)
            .eq('id', id)
            .select('id,user_id,firm_name,challenge_phase,account_size,max_daily_loss,max_total_dd,profit_target,current_balance,alert_at_percent,is_active,is_breached,created_at,updated_at')
            .single()
          updated = retryResult.data
          updateError = retryResult.error
        }
      }
    }

    if (updateError) {
      console.error('[prop-firm-guard] PATCH update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const challenge = toCamelCase(updated)
    console.log('[prop-firm-guard] PATCH success, updated fields:', Object.keys(data), 'result:', challenge)
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

  const admin = await getSupabaseAdminAsync()
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Challenge id is required' }, { status: 400 })
    }

    // Verify ownership — use minimal select to avoid PGRST204 errors
    const { data: existing, error: fetchError } = await admin
      .from('prop_firm_challenges')
      .select('id,user_id')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      // Handle PGRST204 — column not in schema cache
      if (fetchError.code === 'PGRST204' || fetchError.code === '42703') {
        console.warn('[prop-firm-guard] DELETE: select failed, trying direct delete for id:', id)
        // Try direct delete — if ownership is wrong, RLS will prevent it
        const { error: directDeleteError } = await admin
          .from('prop_firm_challenges')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id)
        if (directDeleteError) {
          console.error('[prop-firm-guard] DELETE direct error:', directDeleteError)
          return NextResponse.json({ error: directDeleteError.message }, { status: 500 })
        }
        return NextResponse.json({ success: true })
      }
      console.error('[prop-firm-guard] DELETE fetch error:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!existing || String(existing.user_id) !== String(user.id)) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    // Hard delete — remove the challenge from the database
    const { error: deleteError } = await admin
      .from('prop_firm_challenges')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[prop-firm-guard] DELETE error:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    console.log('[prop-firm-guard] DELETE success, id:', id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[prop-firm-guard] DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
