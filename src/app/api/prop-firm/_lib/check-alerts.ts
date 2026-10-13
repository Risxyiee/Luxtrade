/**
 * Shared PropFirm Alert Checker
 *
 * Called by:
 *   - /api/cron/auto-sync-trades (after syncing trades)
 *   - /api/webhook/trading, fxblue, myfxbook (after inserting trades)
 *   - PropFirmTab frontend (for display)
 *
 * For each active prop firm rule of the user:
 *   1. Calculate current drawdown from trades
 *   2. Compare against thresholds (80% warning, 95% danger, 100% breach)
 *   3. Return alerts array
 *   4. Optionally send push notifications for danger/breach
 */

import { SupabaseClient } from '@supabase/supabase-js'

// ==================== TYPES ====================

export interface PropFirmAlert {
  ruleId: string
  firmName: string
  type: 'warning' | 'danger' | 'breach'
  message: string
  drawdownPercent: number
  maxDrawdownPercent: number
  dailyDrawdownPercent: number
  maxDailyDrawdownPercent: number
  isDaily: boolean
}

export interface AlertCheckResult {
  alerts: PropFirmAlert[]
  checkedRules: number
}

interface TradeRecord {
  profit_loss: number
  close_time: string
}

interface PropFirmRuleRow {
  id: string
  user_id: string
  firm_name: string
  challenge_size: number
  phase: number
  max_drawdown: number
  max_daily_drawdown: number
  daily_drawdown_type: 'relative' | 'absolute'
  profit_target: number | null
  profit_target_percent: number
  min_trading_days: number
  profit_split: number
  start_date: string | null
  account_id: string | null
  is_active: boolean
  is_violated: boolean
  current_balance: number
  peak_balance: number
  current_drawdown: number
  current_daily_drawdown: number
  alert_threshold_warning: number
  alert_threshold_danger: number
}

// ==================== DEFAULT THRESHOLDS ====================

const DEFAULT_WARNING_THRESHOLD = 80  // % of max DD
const DEFAULT_DANGER_THRESHOLD = 95   // % of max DD

// ==================== CORE DRAWDOWN CALC ====================

interface DrawdownCalc {
  current_balance: number
  peak_balance: number
  current_pnl: number
  current_drawdown: number
  current_drawdown_percent: number
  max_drawdown_amount: number
  daily_pnl: number
  daily_starting_balance: number
  current_daily_drawdown: number
  current_daily_drawdown_percent: number
  max_daily_drawdown_amount: number
  is_violated: boolean
  violation_reason: string | null
}

function calculateDrawdown(rule: PropFirmRuleRow, trades: TradeRecord[]): DrawdownCalc {
  const challengeSize = Number(rule.challenge_size) || 0
  const maxDrawdownPercent = Number(rule.max_drawdown) || 10
  const maxDailyDrawdownPercent = Number(rule.max_daily_drawdown) || 5
  const dailyDrawdownType = rule.daily_drawdown_type || 'relative'

  let runningBalance = challengeSize
  let peakBalance = challengeSize
  let currentPnl = 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  const dailyPnlMap = new Map<string, number>()

  for (const trade of trades) {
    const pnl = Number(trade.profit_loss) || 0
    currentPnl += pnl
    runningBalance = challengeSize + currentPnl
    if (runningBalance > peakBalance) peakBalance = runningBalance

    const tradeDate = String(trade.close_time).split('T')[0]
    dailyPnlMap.set(tradeDate, (dailyPnlMap.get(tradeDate) || 0) + pnl)
  }

  const currentBalance = runningBalance
  const currentDrawdown = peakBalance - currentBalance
  const currentDrawdownPercent = peakBalance > 0 ? (currentDrawdown / peakBalance) * 100 : 0
  const maxDrawdownAmount = (maxDrawdownPercent / 100) * challengeSize

  const todayPnl = dailyPnlMap.get(todayStr) || 0
  let balanceBeforeToday = challengeSize
  for (const trade of trades) {
    const tradeDate = String(trade.close_time).split('T')[0]
    if (tradeDate >= todayStr) break
    balanceBeforeToday += Number(trade.profit_loss) || 0
  }

  const dailyStartingBalance = balanceBeforeToday
  let currentDailyDrawdown: number
  let currentDailyDrawdownPercent: number
  let maxDailyDrawdownAmount: number

  if (dailyDrawdownType === 'absolute') {
    currentDailyDrawdown = Math.max(0, -todayPnl)
    maxDailyDrawdownAmount = (maxDailyDrawdownPercent / 100) * challengeSize
    currentDailyDrawdownPercent = maxDailyDrawdownAmount > 0
      ? (currentDailyDrawdown / maxDailyDrawdownAmount) * 100 : 0
  } else {
    currentDailyDrawdown = Math.max(0, -todayPnl)
    maxDailyDrawdownAmount = (maxDailyDrawdownPercent / 100) * dailyStartingBalance
    currentDailyDrawdownPercent = dailyStartingBalance > 0
      ? (currentDailyDrawdown / dailyStartingBalance) * 100 : 0
  }

  let isViolated = false
  let violationReason: string | null = null

  if (currentDrawdown >= maxDrawdownAmount) {
    isViolated = true
    violationReason = `Max drawdown breached: ${currentDrawdown.toFixed(2)} >= ${maxDrawdownAmount.toFixed(2)}`
  } else if (currentDailyDrawdown >= maxDailyDrawdownAmount && maxDailyDrawdownAmount > 0) {
    isViolated = true
    violationReason = `Max daily drawdown breached: ${currentDailyDrawdown.toFixed(2)} >= ${maxDailyDrawdownAmount.toFixed(2)}`
  }

  return {
    current_balance: currentBalance,
    peak_balance: peakBalance,
    current_pnl: currentPnl,
    current_drawdown: currentDrawdown,
    current_drawdown_percent: currentDrawdownPercent,
    max_drawdown_amount: maxDrawdownAmount,
    daily_pnl: todayPnl,
    daily_starting_balance: dailyStartingBalance,
    current_daily_drawdown: currentDailyDrawdown,
    current_daily_drawdown_percent: currentDailyDrawdownPercent,
    max_daily_drawdown_amount: maxDailyDrawdownAmount,
    is_violated: isViolated,
    violation_reason: violationReason,
  }
}

// ==================== MAIN CHECK FUNCTION ====================

/**
 * Check PropFirm rules for a user and return alerts.
 *
 * @param supabaseAdmin - Admin client (bypasses RLS) — required for cron/webhook contexts
 * @param userId - The user whose rules to check
 * @param sendPush - Whether to send push notifications for danger/breach alerts
 * @returns Array of alerts and count of checked rules
 */
export async function checkPropFirmAlerts(
  supabaseAdmin: SupabaseClient,
  userId: string,
  sendPush: boolean = false
): Promise<AlertCheckResult> {
  const alerts: PropFirmAlert[] = []

  // 1. Fetch all active, non-violated prop firm rules for this user
  const { data: rules, error: rulesError } = await supabaseAdmin
    .from('prop_firm_rules')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (rulesError || !rules || rules.length === 0) {
    return { alerts: [], checkedRules: 0 }
  }

  const activeRules = (rules as PropFirmRuleRow[]).filter(r => !r.is_violated)

  for (const rule of activeRules) {
    // 2. Fetch trades for this rule
    let tradesQuery = supabaseAdmin
      .from('trades')
      .select('profit_loss, close_time')
      .eq('user_id', userId)

    if (rule.account_id) {
      tradesQuery = tradesQuery.eq('account_id', rule.account_id)
    }
    if (rule.start_date) {
      tradesQuery = tradesQuery.gte('close_time', rule.start_date)
    }
    tradesQuery = tradesQuery.order('close_time', { ascending: true })

    const { data: trades } = await tradesQuery
    const tradeRecords: TradeRecord[] = (trades ?? []) as TradeRecord[]

    // 3. Calculate drawdown
    const calc = calculateDrawdown(rule, tradeRecords)

    // 4. Determine alert level
    const warningThreshold = rule.alert_threshold_warning ?? DEFAULT_WARNING_THRESHOLD
    const dangerThreshold = rule.alert_threshold_danger ?? DEFAULT_DANGER_THRESHOLD

    // Overall drawdown as % of max
    const ddPercentOfMax = calc.max_drawdown_amount > 0
      ? (calc.current_drawdown / calc.max_drawdown_amount) * 100
      : 0

    // Daily drawdown as % of max
    const dailyDdPercentOfMax = calc.max_daily_drawdown_amount > 0
      ? (calc.current_daily_drawdown / calc.max_daily_drawdown_amount) * 100
      : 0

    // Check overall drawdown
    if (calc.is_violated) {
      // BREACH
      const isDaily = calc.violation_reason?.includes('daily') ?? false
      alerts.push({
        ruleId: rule.id,
        firmName: rule.firm_name,
        type: 'breach',
        message: isDaily
          ? `🚨 ${rule.firm_name}: Daily DD BREACHED! Challenge failed.`
          : `🚨 ${rule.firm_name}: Max DD BREACHED! Challenge failed.`,
        drawdownPercent: ddPercentOfMax,
        maxDrawdownPercent: 100,
        dailyDrawdownPercent: dailyDdPercentOfMax,
        maxDailyDrawdownPercent: 100,
        isDaily,
      })

      // Mark rule as violated in DB
      await supabaseAdmin
        .from('prop_firm_rules')
        .update({
          is_violated: true,
          current_drawdown: calc.current_drawdown,
          current_daily_drawdown: calc.current_daily_drawdown,
          current_balance: calc.current_balance,
          peak_balance: calc.peak_balance,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rule.id)
    } else if (ddPercentOfMax >= dangerThreshold) {
      // DANGER
      alerts.push({
        ruleId: rule.id,
        firmName: rule.firm_name,
        type: 'danger',
        message: `🚨 ${rule.firm_name}: DD at ${ddPercentOfMax.toFixed(1)}% of max! STOP TRADING!`,
        drawdownPercent: ddPercentOfMax,
        maxDrawdownPercent: 100,
        dailyDrawdownPercent: dailyDdPercentOfMax,
        maxDailyDrawdownPercent: 100,
        isDaily: false,
      })
    } else if (ddPercentOfMax >= warningThreshold) {
      // WARNING
      alerts.push({
        ruleId: rule.id,
        firmName: rule.firm_name,
        type: 'warning',
        message: `⚠️ ${rule.firm_name}: DD at ${ddPercentOfMax.toFixed(1)}% of max — be careful!`,
        drawdownPercent: ddPercentOfMax,
        maxDrawdownPercent: 100,
        dailyDrawdownPercent: dailyDdPercentOfMax,
        maxDailyDrawdownPercent: 100,
        isDaily: false,
      })
    }

    // Check daily drawdown separately (not breached yet but in danger)
    if (!calc.is_violated && dailyDdPercentOfMax >= dangerThreshold) {
      alerts.push({
        ruleId: rule.id,
        firmName: rule.firm_name,
        type: 'danger',
        message: `🚨 ${rule.firm_name}: Daily DD at ${dailyDdPercentOfMax.toFixed(1)}% of max!`,
        drawdownPercent: ddPercentOfMax,
        maxDrawdownPercent: 100,
        dailyDrawdownPercent: dailyDdPercentOfMax,
        maxDailyDrawdownPercent: 100,
        isDaily: true,
      })
    } else if (!calc.is_violated && dailyDdPercentOfMax >= warningThreshold && ddPercentOfMax < warningThreshold) {
      alerts.push({
        ruleId: rule.id,
        firmName: rule.firm_name,
        type: 'warning',
        message: `⚠️ ${rule.firm_name}: Daily DD at ${dailyDdPercentOfMax.toFixed(1)}% of max — watch out!`,
        drawdownPercent: ddPercentOfMax,
        maxDrawdownPercent: 100,
        dailyDrawdownPercent: dailyDdPercentOfMax,
        maxDailyDrawdownPercent: 100,
        isDaily: true,
      })
    }

    // Update rule with latest computed values
    await supabaseAdmin
      .from('prop_firm_rules')
      .update({
        current_balance: calc.current_balance,
        peak_balance: calc.peak_balance,
        current_drawdown: calc.current_drawdown,
        current_daily_drawdown: calc.current_daily_drawdown,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rule.id)
  }

  // 5. Send push notifications for danger and breach alerts
  if (sendPush && alerts.length > 0) {
    const pushAlerts = alerts.filter(a => a.type === 'danger' || a.type === 'breach')
    if (pushAlerts.length > 0) {
      try {
        const { sendPushToUser } = await import('@/lib/web-push')
        const { db } = await import('@/lib/db')

        const subscriptions = await db.pushSubscription.findMany({
          where: { userId },
          select: { endpoint: true, p256dh: true, auth: true },
        })

        if (subscriptions.length > 0) {
          for (const alert of pushAlerts) {
            await sendPushToUser(subscriptions, {
              title: alert.type === 'breach'
                ? `❌ ${alert.firmName} BREACHED`
                : `🚨 ${alert.firmName} DANGER`,
              body: alert.message,
              icon: '/icon-192x192.png',
              tag: `propfirm-${alert.ruleId}`,
              type: 'trade',
              url: '/dashboard',
            })
          }
        }
      } catch (pushErr) {
        console.warn('[check-alerts] Push notification failed:', pushErr)
        // Non-fatal — alerts are still returned
      }
    }
  }

  return { alerts, checkedRules: activeRules.length }
}

/**
 * Simplified version: just check and return alerts without push.
 * Useful for quick checks after webhook trade insert.
 */
export async function quickCheckAlerts(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<PropFirmAlert[]> {
  const result = await checkPropFirmAlerts(supabaseAdmin, userId, false)
  return result.alerts
}
