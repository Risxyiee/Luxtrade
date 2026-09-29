import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'

export const dynamic9 = 'force-dynamic'

interface TradeRecord {
  profit_loss: number
  close_time: string
}

interface DrawdownResult {
  challenge_size: number
  current_balance: number
  peak_balance: number
  current_pnl: number
  current_drawdown: number
  current_drawdown_percent: number
  max_drawdown: number
  max_drawdown_amount: number
  daily_pnl: number
  daily_starting_balance: number
  current_daily_drawdown: number
  current_daily_drawdown_percent: number
  max_daily_drawdown: number
  max_daily_drawdown_amount: number
  daily_drawdown_type: string
  profit_target: number
  progress_percent: number
  days_traded: number
  min_trading_days: number
  is_violated: boolean
  violation_reason: string | null
  phase: number
  firm_name: string
  profit_split: number
}

/**
 * POST /api/prop-firm/calculate — Calculate current drawdown status from trades
 *
 * Body: { ruleId: string, accountId?: string }
 *
 * Fetches the prop firm rule and all trades for the user (optionally filtered
 * by account_id and the rule's start_date), then computes drawdown metrics.
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

    if (!body.ruleId) {
      return NextResponse.json(
        { error: 'ruleId is required' },
        { status: 400 }
      )
    }

    // Fetch the prop firm rule
    const { data: rule, error: ruleError } = await supabase
      .from('prop_firm_rules')
      .select('*')
      .eq('id', String(body.ruleId))
      .eq('user_id', user.id)
      .single()

    if (ruleError || !rule) {
      return NextResponse.json(
        { error: 'Prop firm rule not found' },
        { status: 404 }
      )
    }

    // Build trades query — filter by user and optionally by account_id and start_date
    let tradesQuery = supabase
      .from('trades')
      .select('profit_loss, close_time')
      .eq('user_id', user.id)

    // If the rule has an account_id, filter trades by it
    const accountId = body.accountId || rule.account_id
    if (accountId) {
      tradesQuery = tradesQuery.eq('account_id', String(accountId))
    }

    // Only consider trades from the start_date of the challenge
    if (rule.start_date) {
      tradesQuery = tradesQuery.gte('close_time', rule.start_date)
    }

    tradesQuery = tradesQuery.order('close_time', { ascending: true })

    const { data: trades, error: tradesError } = await tradesQuery

    if (tradesError) {
      console.error('[prop-firm/calculate] Trades fetch error:', tradesError)
      return NextResponse.json(
        { error: 'Failed to fetch trades for calculation' },
        { status: 500 }
      )
    }

    // Perform drawdown calculations
    const calculation = calculateDrawdown(rule, (trades ?? []) as TradeRecord[])

    // Update the rule in the database with the latest computed values
    const { error: updateError } = await supabase
      .from('prop_firm_rules')
      .update({
        current_balance: calculation.current_balance,
        peak_balance: calculation.peak_balance,
        current_drawdown: calculation.current_drawdown,
        current_daily_drawdown: calculation.current_daily_drawdown,
        progress_percent: calculation.progress_percent,
        days_traded: calculation.days_traded,
        is_violated: calculation.is_violated,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rule.id)

    if (updateError) {
      console.warn('[prop-firm/calculate] Failed to update rule with computed values:', updateError)
      // Non-fatal — still return the calculation
    }

    return NextResponse.json({ calculation })
  } catch (err) {
    console.error('[prop-firm/calculate] Error:', err)
    return NextResponse.json(
      { error: 'Failed to calculate drawdown', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * Core drawdown calculation logic
 */
function calculateDrawdown(rule: Record<string, unknown>, trades: TradeRecord[]): DrawdownResult {
  const challengeSize = Number(rule.challenge_size) || 0
  const maxDrawdownPercent = Number(rule.max_drawdown) || 10
  const maxDailyDrawdownPercent = Number(rule.max_daily_drawdown) || 5
  const dailyDrawdownType = String(rule.daily_drawdown_type || 'relative')
  const profitTargetPercent = Number(rule.profit_target_percent) || 10
  const profitTargetAbsolute = rule.profit_target != null ? Number(rule.profit_target) : null
  const minTradingDays = Number(rule.min_trading_days) || 0
  const profitSplit = Number(rule.profit_split) || 80
  const phase = Number(rule.phase) || 1
  const firmName = String(rule.firm_name || '')

  // --- Calculate running balance and peak ---
  let runningBalance = challengeSize
  let peakBalance = challengeSize
  let currentPnl = 0

  // Track daily data for daily drawdown calculation
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  // Group trades by day to compute daily PnL
  const dailyPnlMap = new Map<string, number>()
  const tradingDaysSet = new Set<string>()

  for (const trade of trades) {
    const pnl = Number(trade.profit_loss) || 0
    currentPnl += pnl
    runningBalance = challengeSize + currentPnl

    if (runningBalance > peakBalance) {
      peakBalance = runningBalance
    }

    // Track by day
    const tradeDate = String(trade.close_time).split('T')[0]
    tradingDaysSet.add(tradeDate)
    dailyPnlMap.set(tradeDate, (dailyPnlMap.get(tradeDate) || 0) + pnl)
  }

  // --- Current drawdown from peak ---
  const currentBalance = runningBalance
  const currentDrawdown = peakBalance - currentBalance
  const currentDrawdownPercent = peakBalance > 0 ? (currentDrawdown / peakBalance) * 100 : 0

  // --- Max drawdown in absolute terms ---
  const maxDrawdownAmount = (maxDrawdownPercent / 100) * challengeSize

  // --- Daily drawdown ---
  // Calculate today's PnL
  const todayPnl = dailyPnlMap.get(todayStr) || 0

  // Calculate the balance at the start of today
  // This is the balance after all trades before today
  let balanceBeforeToday = challengeSize
  for (const trade of trades) {
    const tradeDate = String(trade.close_time).split('T')[0]
    if (tradeDate >= todayStr) break
    balanceBeforeToday += Number(trade.profit_loss) || 0
  }

  const dailyStartingBalance = balanceBeforeToday

  // Daily drawdown calculation
  let currentDailyDrawdown: number
  let currentDailyDrawdownPercent: number
  let maxDailyDrawdownAmount: number

  if (dailyDrawdownType === 'absolute') {
    // Absolute: daily DD is measured as a fixed dollar amount from the challenge size
    currentDailyDrawdown = Math.max(0, -todayPnl)
    maxDailyDrawdownAmount = (maxDailyDrawdownPercent / 100) * challengeSize
    currentDailyDrawdownPercent = maxDailyDrawdownAmount > 0
      ? (currentDailyDrawdown / maxDailyDrawdownAmount) * 100
      : 0
  } else {
    // Relative: daily DD is measured relative to the day's starting balance
    // If today's PnL is negative, the drawdown is |todayPnl|
    currentDailyDrawdown = Math.max(0, -todayPnl)
    maxDailyDrawdownAmount = (maxDailyDrawdownPercent / 100) * dailyStartingBalance
    currentDailyDrawdownPercent = dailyStartingBalance > 0
      ? (currentDailyDrawdown / dailyStartingBalance) * 100
      : 0
  }

  // --- Profit target ---
  let profitTarget: number
  if (profitTargetAbsolute != null && profitTargetAbsolute > 0) {
    profitTarget = profitTargetAbsolute
  } else {
    profitTarget = (profitTargetPercent / 100) * challengeSize
  }

  // --- Progress to profit target ---
  const progressPercent = profitTarget > 0
    ? Math.min((currentPnl / profitTarget) * 100, 100)
    : 0

  // --- Days traded ---
  const daysTraded = tradingDaysSet.size

  // --- Violation check ---
  let isViolated = false
  let violationReason: string | null = null

  if (currentDrawdown >= maxDrawdownAmount) {
    isViolated = true
    violationReason = `Max drawdown breached: ${currentDrawdown.toFixed(2)} >= ${maxDrawdownAmount.toFixed(2)} (${maxDrawdownPercent}%)`
  } else if (currentDailyDrawdown >= maxDailyDrawdownAmount && maxDailyDrawdownAmount > 0) {
    isViolated = true
    violationReason = `Max daily drawdown breached: ${currentDailyDrawdown.toFixed(2)} >= ${maxDailyDrawdownAmount.toFixed(2)} (${maxDailyDrawdownPercent}%)`
  }

  return {
    challenge_size: challengeSize,
    current_balance: currentBalance,
    peak_balance: peakBalance,
    current_pnl: currentPnl,
    current_drawdown: currentDrawdown,
    current_drawdown_percent: currentDrawdownPercent,
    max_drawdown: maxDrawdownPercent,
    max_drawdown_amount: maxDrawdownAmount,
    daily_pnl: todayPnl,
    daily_starting_balance: dailyStartingBalance,
    current_daily_drawdown: currentDailyDrawdown,
    current_daily_drawdown_percent: currentDailyDrawdownPercent,
    max_daily_drawdown: maxDailyDrawdownPercent,
    max_daily_drawdown_amount: maxDailyDrawdownAmount,
    daily_drawdown_type: dailyDrawdownType,
    profit_target: profitTarget,
    progress_percent: progressPercent,
    days_traded: daysTraded,
    min_trading_days: minTradingDays,
    is_violated: isViolated,
    violation_reason: violationReason,
    phase: phase,
    firm_name: firmName,
    profit_split: profitSplit,
  }
}
