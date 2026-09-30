import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { sendEmail, getPropFirmAlertHtml } from '@/lib/email'
import { sendPushToUser } from '@/lib/web-push'

/**
 * GET /api/cron/prop-firm-guard
 * Cron job: monitors prop firm challenges for drawdown limit breaches.
 *
 * For each active challenge:
 *   - Calculates daily DD and total DD from trades
 *   - If DD reaches alertAtPercent (default 40%) → WARNING email + push
 *   - If DD reaches 80% → URGENT email + push
 *   - If DD reaches 100% → BREACH email, mark isBreached
 *   - Also checks profit target completion
 *
 * Supported params:
 *   ?dry=true   — preview without sending alerts
 *   ?uid=xxx    — process single user only
 *   ?force=true — bypass CRON_SECRET auth
 *
 * Rate limit: max 3 alert emails per challenge per day
 */

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'

// In-memory rate limit: max 3 alerts per challenge per day
const alertRateLimit = new Map<string, { count: number; date: string }>()
const MAX_DAILY_ALERTS_PER_CHALLENGE = 3

function isAlertRateLimited(challengeId: string): boolean {
  const today = new Date().toISOString().split('T')[0]
  const entry = alertRateLimit.get(challengeId)

  if (!entry || entry.date !== today) {
    alertRateLimit.set(challengeId, { count: 1, date: today })
    return false
  }

  if (entry.count >= MAX_DAILY_ALERTS_PER_CHALLENGE) {
    return true
  }

  entry.count++
  return false
}

interface ChallengeWithUser {
  id: string
  userId: string
  tradingAccountId: string | null
  firmName: string
  challengePhase: string
  accountSize: number
  maxDailyLoss: number
  maxTotalDD: number
  profitTarget: number
  currentBalance: number
  dailyPL: number
  totalPL: number
  currentDailyDD: number
  currentTotalDD: number
  currentProgress: number
  alertAtPercent: number
  lastAlertAt: Date | null
  isBreached: boolean
  breachReason: string | null
  userEmail: string | null
  userName: string | null
}

async function getActiveChallenges(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>, targetUid?: string): Promise<ChallengeWithUser[]> {
  let query = admin
    .from('prop_firm_challenges')
    .select('*')
    .eq('is_active', true)
    .eq('is_breached', false)

  if (targetUid) {
    query = query.eq('user_id', targetUid)
  }

  const { data: challenges, error } = await query

  if (error) {
    console.error('[prop-firm-guard] getActiveChallenges error:', error)
    return []
  }

  // Also get profile email as fallback
  const results: ChallengeWithUser[] = []

  for (const ch of challenges || []) {
    let userEmail: string | null = null
    let userName: string | null = null

    // Fetch user email from profiles
    const { data: profile } = await admin
      .from('profiles')
      .select('email, full_name')
      .eq('id', ch.user_id)
      .maybeSingle()

    userEmail = profile?.email || null
    userName = profile?.full_name || null

    results.push({
      id: ch.id,
      userId: ch.user_id,
      tradingAccountId: ch.trading_account_id,
      firmName: ch.firm_name,
      challengePhase: ch.challenge_phase,
      accountSize: ch.account_size,
      maxDailyLoss: ch.max_daily_loss,
      maxTotalDD: ch.max_total_dd,
      profitTarget: ch.profit_target,
      currentBalance: ch.current_balance,
      dailyPL: ch.daily_pl,
      totalPL: ch.total_pl,
      currentDailyDD: ch.current_daily_dd,
      currentTotalDD: ch.current_total_dd,
      currentProgress: ch.current_progress,
      alertAtPercent: ch.alert_at_percent,
      lastAlertAt: ch.last_alert_at,
      isBreached: ch.is_breached,
      breachReason: ch.breach_reason,
      userEmail,
      userName,
    })
  }

  return results
}

/**
 * Calculate daily P/L for a challenge's trades today.
 * Uses the tradingAccountId if set, otherwise all user trades.
 */
async function calculateDailyPL(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>, challenge: ChallengeWithUser): Promise<number> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  let query = admin
    .from('trades')
    .select('profit_loss')
    .eq('user_id', challenge.userId)
    .gte('close_time', todayStart.toISOString())

  if (challenge.tradingAccountId) {
    query = query.eq('account_id', challenge.tradingAccountId)
  }

  const { data: trades } = await query

  if (!trades || trades.length === 0) return 0

  return trades.reduce((sum: number, t: any) => sum + (Number(t.profit_loss) || 0), 0)
}

/**
 * Calculate total P/L for all trades in this challenge.
 */
async function calculateTotalPL(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>, challenge: ChallengeWithUser): Promise<number> {
  let query = admin
    .from('trades')
    .select('profit_loss')
    .eq('user_id', challenge.userId)

  if (challenge.tradingAccountId) {
    query = query.eq('account_id', challenge.tradingAccountId)
  }

  const { data: trades } = await query

  if (!trades || trades.length === 0) return 0

  return trades.reduce((sum: number, t: any) => sum + (Number(t.profit_loss) || 0), 0)
}

/**
 * Determine severity and alert type based on DD percentage of limit.
 */
function getAlertInfo(
  ddPercent: number,
  ddLimitPercent: number,
  alertAtPercent: number
): { shouldAlert: boolean; severity: 'warning' | 'urgent' | 'breach'; percentOfLimit: number } | null {
  const percentOfLimit = (ddPercent / ddLimitPercent) * 100

  if (percentOfLimit >= 100) {
    return { shouldAlert: true, severity: 'breach', percentOfLimit }
  }
  if (percentOfLimit >= 80) {
    return { shouldAlert: true, severity: 'urgent', percentOfLimit }
  }
  if (percentOfLimit >= alertAtPercent) {
    return { shouldAlert: true, severity: 'warning', percentOfLimit }
  }

  return null
}

async function sendAlert(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  challenge: ChallengeWithUser,
  alertType: 'daily_dd' | 'total_dd' | 'breach' | 'profit_target',
  severity: 'warning' | 'urgent' | 'breach' | 'success',
  currentDDPercent: number,
  ddLimitPercent: number,
  roomLeftPercent: number,
  roomLeftDollar: number
): Promise<boolean> {
  if (!challenge.userEmail) return false

  // Rate limit
  if (severity !== 'breach' && isAlertRateLimited(challenge.id)) {
    return false
  }

  const name = challenge.userName || 'Trader'
  const ctaUrl = `${SITE_URL}/dashboard`

  const html = getPropFirmAlertHtml({
    name,
    firmName: challenge.firmName,
    accountSize: challenge.accountSize,
    challengePhase: challenge.challengePhase,
    alertType,
    severity,
    currentDDPercent,
    ddLimitPercent,
    roomLeftPercent,
    roomLeftDollar,
    ctaUrl,
  })

  // Build subject
  let subject: string
  if (severity === 'breach') {
    subject = `🚫 CHALLENGE BREACHED — ${challenge.firmName} $${challenge.accountSize.toLocaleString()} | LuxTradee`
  } else if (severity === 'success') {
    subject = `🎉 Profit Target Reached! — ${challenge.firmName} | LuxTradee`
  } else if (severity === 'urgent') {
    subject = `🚨 URGENT: Drawdown ${currentDDPercent.toFixed(1)}% — ${challenge.firmName} | LuxTradee`
  } else {
    subject = `⚠️ Drawdown Warning ${currentDDPercent.toFixed(1)}% — ${challenge.firmName} | LuxTradee`
  }

  // Send email
  const emailResult = await sendEmail({
    to: challenge.userEmail,
    subject,
    html,
  })

  // Send push notification
  try {
    const { data: pushSubs } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', challenge.userId)

    if (pushSubs && pushSubs.length > 0) {
      await sendPushToUser(pushSubs as any, {
        title: severity === 'breach'
          ? 'Challenge Breached!'
          : severity === 'success'
          ? 'Profit Target Reached!'
          : `Drawdown ${currentDDPercent.toFixed(1)}%`,
        body: severity === 'breach'
          ? `${challenge.firmName} challenge has been breached.`
          : severity === 'success'
          ? `${challenge.firmName} profit target achieved!`
          : `${challenge.firmName}: DD at ${currentDDPercent.toFixed(1)}% of ${ddLimitPercent.toFixed(1)}% limit.`,
        url: ctaUrl,
        tag: `propfirm-${challenge.id}`,
        type: 'trade',
      })
    }
  } catch (err) {
    console.warn('[prop-firm-guard] Push notification failed:', err)
  }

  return emailResult.success
}

export async function GET(request: NextRequest) {
  return handleRequest(request)
}

export async function POST(request: NextRequest) {
  return handleRequest(request)
}

async function handleRequest(request: NextRequest) {
  const startTime = Date.now()
  const { searchParams } = new URL(request.url)
  const dry = searchParams.get('dry') === 'true'
  const force = searchParams.get('force') === 'true'
  const targetUid = searchParams.get('uid') || undefined

  // Auth check
  const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!force && process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  try {
    const challenges = await getActiveChallenges(admin, targetUid)

    if (challenges.length === 0) {
      return NextResponse.json({
        message: 'No active challenges to monitor',
        processed: 0,
        elapsed_ms: Date.now() - startTime,
      })
    }

    // Dry run
    if (dry) {
      return NextResponse.json({
        message: `DRY RUN — would process ${challenges.length} challenges`,
        challenges: challenges.map(c => ({
          id: c.id,
          firm: c.firmName,
          accountSize: c.accountSize,
          phase: c.challengePhase,
          userId: c.userId,
          email: c.userEmail,
        })),
        elapsed_ms: Date.now() - startTime,
      })
    }

    // Process each challenge
    const results: {
      challengeId: string
      firm: string
      alertsSent: string[]
      breached: boolean
      profitTargetReached: boolean
    }[] = []

    for (const challenge of challenges) {
      const alertsSent: string[] = []
      let breached = false
      let profitTargetReached = false

      try {
        // Calculate current P/L
        const dailyPL = await calculateDailyPL(admin, challenge)
        const totalPL = await calculateTotalPL(admin, challenge)

        // Calculate DD percentages relative to account size
        const maxDailyLossDollar = challenge.maxDailyLoss
        const maxTotalDDDollar = challenge.maxTotalDD
        const profitTargetDollar = challenge.profitTarget

        // Daily DD: only count negative daily P/L
        const dailyLoss = Math.min(dailyPL, 0) // negative or zero
        const currentDailyDDPercent = Math.abs(dailyLoss) / challenge.accountSize * 100
        const dailyDDLimitPercent = (maxDailyLossDollar / challenge.accountSize) * 100

        // Total DD: only count negative total P/L
        const totalLoss = Math.min(totalPL, 0)
        const currentTotalDDPercent = Math.abs(totalLoss) / challenge.accountSize * 100
        const totalDDLimitPercent = (maxTotalDDDollar / challenge.accountSize) * 100

        // Profit progress
        const totalProfit = Math.max(totalPL, 0)
        const progressPercent = (totalProfit / profitTargetDollar) * 100

        // Check daily DD alerts
        const dailyDDAlert = getAlertInfo(currentDailyDDPercent, dailyDDLimitPercent, challenge.alertAtPercent)
        if (dailyDDAlert && dailyDDAlert.shouldAlert) {
          const roomLeftPercent = dailyDDLimitPercent - currentDailyDDPercent
          const roomLeftDollar = maxDailyLossDollar - Math.abs(dailyLoss)

          const alertSent = await sendAlert(
            admin,
            challenge,
            dailyDDAlert.severity === 'breach' ? 'breach' : 'daily_dd',
            dailyDDAlert.severity,
            currentDailyDDPercent,
            dailyDDLimitPercent,
            Math.max(roomLeftPercent, 0),
            Math.max(roomLeftDollar, 0)
          )

          if (alertSent) {
            alertsSent.push(`daily_dd_${dailyDDAlert.severity}`)
          }

          if (dailyDDAlert.severity === 'breach') {
            breached = true
            const { error: updateError } = await admin
              .from('prop_firm_challenges')
              .update({
                is_breached: true,
                breach_reason: `Daily drawdown breached: ${currentDailyDDPercent.toFixed(1)}% exceeds ${dailyDDLimitPercent.toFixed(1)}% limit`,
                breached_at: new Date().toISOString(),
                current_daily_dd: currentDailyDDPercent,
                daily_pl: dailyPL,
                current_total_dd: currentTotalDDPercent,
                total_pl: totalPL,
                current_progress: progressPercent,
                current_balance: challenge.accountSize + totalPL,
                last_alert_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', challenge.id)

            if (updateError) {
              console.error('[prop-firm-guard] Daily DD breach update error:', updateError)
            }
          }
        }

        // Check total DD alerts (only if not already breached by daily DD)
        if (!breached) {
          const totalDDAlert = getAlertInfo(currentTotalDDPercent, totalDDLimitPercent, challenge.alertAtPercent)
          if (totalDDAlert && totalDDAlert.shouldAlert) {
            const roomLeftPercent = totalDDLimitPercent - currentTotalDDPercent
            const roomLeftDollar = maxTotalDDDollar - Math.abs(totalLoss)

            const alertSent = await sendAlert(
              admin,
              challenge,
              totalDDAlert.severity === 'breach' ? 'breach' : 'total_dd',
              totalDDAlert.severity,
              currentTotalDDPercent,
              totalDDLimitPercent,
              Math.max(roomLeftPercent, 0),
              Math.max(roomLeftDollar, 0)
            )

            if (alertSent) {
              alertsSent.push(`total_dd_${totalDDAlert.severity}`)
            }

            if (totalDDAlert.severity === 'breach') {
              breached = true
              const { error: updateError } = await admin
                .from('prop_firm_challenges')
                .update({
                  is_breached: true,
                  breach_reason: `Total drawdown breached: ${currentTotalDDPercent.toFixed(1)}% exceeds ${totalDDLimitPercent.toFixed(1)}% limit`,
                  breached_at: new Date().toISOString(),
                  current_daily_dd: currentDailyDDPercent,
                  daily_pl: dailyPL,
                  current_total_dd: currentTotalDDPercent,
                  total_pl: totalPL,
                  current_progress: progressPercent,
                  current_balance: challenge.accountSize + totalPL,
                  last_alert_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', challenge.id)

              if (updateError) {
                console.error('[prop-firm-guard] Total DD breach update error:', updateError)
              }
            }
          }
        }

        // Check profit target
        if (!breached && totalPL >= profitTargetDollar) {
          profitTargetReached = true

          // Send profit target alert
          const alertSent = await sendAlert(
            admin,
            challenge,
            'profit_target',
            'success',
            progressPercent,
            100, // target is 100%
            0,
            0
          )

          if (alertSent) {
            alertsSent.push('profit_target')
          }
        }

        // Update challenge state (if not already updated by breach)
        if (!breached) {
          const { error: updateError } = await admin
            .from('prop_firm_challenges')
            .update({
              current_daily_dd: currentDailyDDPercent,
              daily_pl: dailyPL,
              current_total_dd: currentTotalDDPercent,
              total_pl: totalPL,
              current_progress: Math.min(progressPercent, 100),
              current_balance: challenge.accountSize + totalPL,
              last_alert_at: alertsSent.length > 0 ? new Date().toISOString() : challenge.lastAlertAt?.toISOString() || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', challenge.id)

          if (updateError) {
            console.error('[prop-firm-guard] State update error:', updateError)
          }
        }

        results.push({
          challengeId: challenge.id,
          firm: challenge.firmName,
          alertsSent,
          breached,
          profitTargetReached,
        })

      } catch (err: any) {
        console.error(`[prop-firm-guard] Error processing challenge ${challenge.id}:`, err.message)
        results.push({
          challengeId: challenge.id,
          firm: challenge.firmName,
          alertsSent: [],
          breached: false,
          profitTargetReached: false,
        })
      }
    }

    const totalAlerts = results.reduce((sum, r) => sum + r.alertsSent.length, 0)
    const totalBreaches = results.filter(r => r.breached).length
    const totalTargets = results.filter(r => r.profitTargetReached).length

    return NextResponse.json({
      message: `Prop Firm Guard: processed ${challenges.length} challenges, ${totalAlerts} alerts sent, ${totalBreaches} breaches, ${totalTargets} targets reached`,
      processed: challenges.length,
      alertsSent: totalAlerts,
      breaches: totalBreaches,
      targetsReached: totalTargets,
      results,
      elapsed_ms: Date.now() - startTime,
    })

  } catch (error: any) {
    console.error('[cron/prop-firm-guard] Fatal error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
