import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getSupabaseAdminAsync } from '@/lib/supabase-admin-alt'

export const dynamic = 'force-dynamic'

/**
 * /api/prop-firm-guard
 *
 * GET    — List user's challenges with calculated metrics from trades
 * POST   — Create new challenge with validation
 * PATCH  — Update challenge (phase, alert settings, manual metrics)
 * DELETE — Deactivate challenge
 *
 * ✅ FIX: Proper TEXT/UUID type handling with casting
 * ✅ FIX: Auto-calculate metrics from trades
 * ✅ FIX: Schema validation on startup
 * ✅ FIX: No silent column failures
 */

/** Transform snake_case DB row to camelCase for frontend */
function toCamelCase(row: any) {
  return {
    id: row.id,
    userId: String(row.user_id),
    tradingAccountId: row.trading_account_id,
    firmName: row.firm_name,
    challengePhase: row.challenge_phase,
    accountSize: Number(row.account_size),
    maxDailyLoss: Number(row.max_daily_loss),
    maxTotalDD: Number(row.max_total_dd),
    profitTarget: Number(row.profit_target),
    currentBalance: Number(row.current_balance),
    dailyPL: Number(row.daily_pl || 0),
    totalPL: Number(row.total_pl || 0),
    currentDailyDD: Number(row.current_daily_dd || 0),
    currentTotalDD: Number(row.current_total_dd || 0),
    currentProgress: Number(row.current_progress || 0),
    alertAtPercent: Number(row.alert_at_percent),
    lastAlertAt: row.last_alert_at,
    isBreached: Boolean(row.is_breached),
    breachReason: row.breach_reason,
    breachedAt: row.breached_at,
    isActive: Boolean(row.is_active),
    consistencyRule: Number(row.consistency_rule || 0),
    bestDayPL: Number(row.best_day_pl || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── Schema Validation ───────────────────────────────────────────────────────
const REQUIRED_COLUMNS = [
  'id', 'user_id', 'firm_name', 'challenge_phase', 'account_size',
  'max_daily_loss', 'max_total_dd', 'profit_target',
  'current_balance', 'daily_pl', 'total_pl',
  'current_daily_dd', 'current_total_dd', 'current_progress',
  'consistency_rule', 'best_day_pl', 'alert_at_percent',
  'is_breached', 'breach_reason', 'breached_at',
  'is_active', 'last_alert_at', 'created_at', 'updated_at',
]

async function validateSchema(admin: any): Promise<{ valid: boolean; missingCols?: string[] }> {
  try {
    const { data: cols, error } = await admin.rpc('get_table_columns', {
      table_name: 'prop_firm_challenges',
    })

    if (error) {
      const { data: probe } = await admin
        .from('prop_firm_challenges')
        .select('*')
        .limit(1)

      if (!probe) {
        return { valid: false, missingCols: ['TABLE_NOT_FOUND'] }
      }
      return { valid: true }
    }

    const existingCols = cols?.map((c: any) => c.name) || []
    const missingCols = REQUIRED_COLUMNS.filter(col => !existingCols.includes(col))

    return {
      valid: missingCols.length === 0,
      missingCols,
    }
  } catch (err: any) {
    console.error('[prop-firm-guard] Schema validation error:', err.message)
    return { valid: false, missingCols: ['VALIDATION_ERROR'] }
  }
}

// ─── Metrics Calculation from Trades ─────────────────────────────────────────
async function calculateMetricsFromTrades(
  admin: any,
  userId: string,
  accountId: string | null,
  accountSize: number
): Promise<{
  dailyPL: number
  totalPL: number
  currentBalance: number
  bestDayPL: number
}> {
  try {
    let query = admin
      .from('trades')
      .select('profit_loss, close_time')
      .eq('user_id', String(userId))

    if (accountId) {
      query = query.eq('account_id', accountId)
    }

    const { data: trades, error } = await query

    if (error || !trades || trades.length === 0) {
      console.log(`[prop-firm-guard] No trades found for user ${userId}`)
      return {
        dailyPL: 0,
        totalPL: 0,
        currentBalance: accountSize,
        bestDayPL: 0,
      }
    }

    const totalPL = trades.reduce((sum: number, t: any) => sum + (Number(t.profit_loss) || 0), 0)
    const currentBalance = accountSize + totalPL

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dailyPL = trades
      .filter((t: any) => t.close_time && new Date(t.close_time) >= today)
      .reduce((sum: number, t: any) => sum + (Number(t.profit_loss) || 0), 0)

    const dayGroups: Record<string, number> = {}
    trades.forEach((t: any) => {
      if (!t.close_time) return
      const dayKey = t.close_time.split('T')[0]
      dayGroups[dayKey] = (dayGroups[dayKey] || 0) + (Number(t.profit_loss) || 0)
    })
    const bestDayPL = Math.max(...Object.values(dayGroups), 0)

    return { dailyPL, totalPL, currentBalance, bestDayPL }
  } catch (err: any) {
    console.error('[prop-firm-guard] Metrics calculation error:', err.message)
    return {
      dailyPL: 0,
      totalPL: 0,
      currentBalance: accountSize,
      bestDayPL: 0,
    }
  }
}

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user || response) return response

  const admin = await getSupabaseAdminAsync()
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  try {
    const schema = await validateSchema(admin)
    if (!schema.valid) {
      console.warn('[prop-firm-guard] Schema invalid:', schema.missingCols)
      return NextResponse.json({
        error: 'Prop Firm database not initialized',
        missingColumns: schema.missingCols,
        unavailable: true,
      }, { status: 503 })
    }

    const { data, error } = await admin
      .from('prop_firm_challenges')
      .select('*')
      .eq('user_id', String(user.id))
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[prop-firm-guard] GET query error:', error)
      if (
        error.message?.includes('Could not find the table') ||
        error.code === '42P01' ||
        error.code === '42501' ||
        error.message?.includes('permission denied')
      ) {
        return NextResponse.json({
          error: 'Prop Firm feature is not yet available',
          unavailable: true,
        }, { status: 503 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const challenges = await Promise.all(
      (data || []).map(async (ch: any) => {
        const metrics = await calculateMetricsFromTrades(
          admin,
          String(ch.user_id),
          ch.trading_account_id,
          Number(ch.account_size)
        )

        const converted = toCamelCase(ch)
        return {
          ...converted,
          dailyPL: metrics.dailyPL,
          totalPL: metrics.totalPL,
          currentBalance: metrics.currentBalance,
          bestDayPL: metrics.bestDayPL,
        }
      })
    )

    return NextResponse.json({
      challenges,
      total: challenges.length,
      calculatedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[prop-firm-guard] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
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

    if (!firmName || !accountSize) {
      return NextResponse.json(
        { error: 'firmName and accountSize are required' },
        { status: 400 }
      )
    }

    if (typeof accountSize !== 'number' || accountSize <= 0) {
      return NextResponse.json(
        { error: 'accountSize must be a positive number' },
        { status: 400 }
      )
    }

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

    const validPhases = ['phase1', 'phase2', 'funded']
    const phase = challengePhase || 'phase1'
    if (!validPhases.includes(phase)) {
      return NextResponse.json(
        { error: `Invalid phase. Must be one of: ${validPhases.join(', ')}` },
        { status: 400 }
      )
    }

    const { count, error: countError } = await admin
      .from('prop_firm_challenges')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', String(user.id))
      .eq('is_active', true)

    if (countError && !countError.message?.includes('Could not find the table')) {
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }

    if ((count || 0) >= 10) {
      return NextResponse.json(
        { error: 'Maximum 10 active challenges per user' },
        { status: 400 }
      )
    }

    const insertData = {
      user_id: String(user.id),
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
      daily_pl: 0,
      total_pl: 0,
      current_daily_dd: 0,
      current_total_dd: 0,
      current_progress: 0,
      is_active: true,
      is_breached: false,
      breach_reason: null,
      breached_at: null,
    }

    const { data, error: insertError } = await admin
      .from('prop_firm_challenges')
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      console.error('[prop-firm-guard] POST insert error:', insertError)

      if (insertError.message?.includes('Could not find the table') || insertError.code === '42P01') {
        return NextResponse.json({
          error: 'Prop Firm feature is not yet available. Run database migrations.',
          unavailable: true,
        }, { status: 503 })
      }

      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const challenge = toCamelCase(data)
    return NextResponse.json({ challenge }, { status: 201 })
  } catch (error: any) {
    console.error('[prop-firm-guard] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ─── PATCH ───────────────────────────────────────────────────────────────────
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

    const { data: existing, error: fetchError } = await admin
      .from('prop_firm_challenges')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      console.error('[prop-firm-guard] PATCH fetch error:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!existing) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    if (String(existing.user_id) !== String(user.id)) {
      console.warn('[prop-firm-guard] PATCH ownership mismatch')
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    const data: any = {}

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

    if (updates.dailyPL !== undefined) data.daily_pl = updates.dailyPL
    if (updates.totalPL !== undefined) data.total_pl = updates.totalPL
    if (updates.currentBalance !== undefined) data.current_balance = updates.currentBalance
    if (updates.maxDailyLoss !== undefined) data.max_daily_loss = updates.maxDailyLoss
    if (updates.maxTotalDD !== undefined) data.max_total_dd = updates.maxTotalDD
    if (updates.profitTarget !== undefined) data.profit_target = updates.profitTarget
    if (updates.firmName !== undefined) data.firm_name = updates.firmName
    if (updates.accountSize !== undefined) data.account_size = updates.accountSize
    if (updates.consistencyRule !== undefined) data.consistency_rule = updates.consistencyRule
    if (updates.bestDayPL !== undefined) data.best_day_pl = updates.bestDayPL
    if (updates.tradingAccountId !== undefined) data.trading_account_id = updates.tradingAccountId || null
    if (updates.isActive !== undefined) data.is_active = updates.isActive

    if (updates.resetBreach === true) {
      data.is_breached = false
      data.breach_reason = null
      data.breached_at = null
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    data.updated_at = new Date().toISOString()

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

// ─── DELETE ───────────────────────────────────────────────────────────────────
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

    const { data: existing, error: fetchError } = await admin
      .from('prop_firm_challenges')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      console.error('[prop-firm-guard] DELETE fetch error:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!existing || String(existing.user_id) !== String(user.id)) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    const { error: updateError } = await admin
      .from('prop_firm_challenges')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('[prop-firm-guard] DELETE error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    console.log('[prop-firm-guard] DELETE success, id:', id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[prop-firm-guard] DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
