import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { sendEmail, getPropFirmAlertHtml } from '@/lib/email'
import { sendPushToUser } from '@/lib/web-push'

/**
 * POST /api/prop-firm-guard/check
 *
 * User-initiated prop firm guard check.
 * Unlike the cron route (which requires CRON_SECRET), this uses requireAuth()
 * and only processes the authenticated user's challenges.
 *
 * For each active challenge:
 *   - Calculates daily DD and total DD from trades
 *   - If DD reaches alertAtPercent (default 40%) → WARNING email + push
 *   - If DD reaches 80% → URGENT email + push
 *   - If DD reaches 100% → BREACH email, mark isBreached
 *   - Also checks profit target completion
 *   - Updates challenge state (daily_pl, total_pl, current_daily_dd, etc.)
 */

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'

async function calculateDailyPL(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>, userId: string, accountId?: string | null): Promise<number> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  let query = admin
    .from('trades')
    .select('profit_loss')
    .eq('user_id', userId)
    .gte('close_time', todayStart.toISOString())

  if (accountId) {
    query = query.eq('account_id', accountId)
  }

  const { data: trades } = await query
  if (!trades || trades.length === 0) return 0
  return trades.reduce((sum: number, t: any) => sum + (Number(t.profit_loss) || 0), 0)
}

async function calculateTotalPL(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>, userId: string, accountId?: string | null): Promise<number> {
  let query = admin
    .from('trades')
    .select('profit_loss')
    .eq('user_id', userId)

  if (accountId) {
    query = query.eq('account_id', accountId)
  }

  const { data: trades } = await query
  if (!trades || trades.length === 0) return 0
  return trades.reduce((sum: number, t: any) => sum + (Number(t.profit_loss) || 0), 0)
}

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

export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (!user || response) return response

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  try {
    // Get user's active, non-breached challenges
    const { data: challenges, error: challengesError } = await admin
      .from('prop_firm_challenges')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .eq('is_breached', false)

    if (challengesError) {
      console.error('[prop-firm-guard/check] Fetch challenges error:', challengesError)
      if (
        challengesError.message?.includes('Could not find the table') ||
        challengesError.code === '42P01' ||
        challengesError.code === '42501'
      ) {
        return NextResponse.json({ message: 'Prop Firm feature not yet available', processed: 0, results: [] })
      }
      return NextResponse.json({ error: challengesError.message }, { status: 500 })
    }

    if (!challenges || challenges.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active challenges to check',
        processed: 0,
        results: [],
      })
    }

    // Get user email for alerts
    const { data: profile } = await admin
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .maybeSingle()

    const userEmail = profile?.email || null
    const userName = profile?.full_name || null

    // Process each challenge
    const results: {
      challengeId: string
      firm: string
      alertsSent: string[]
      breached: boolean
      profitTargetReached: boolean
      dailyPL: number
      totalPL: number
      currentDailyDD: number
      currentTotalDD: number
      currentProgress: number
    }[] = []

    for (const ch of challenges) {
      const alertsSent: string[] = []
      let breached = false
      let profitTargetReached = false

      try {
        const dailyPL = await calculateDailyPL(admin, ch.user_id, ch.trading_account_id)
        const totalPL = await calculateTotalPL(admin, ch.user_id, ch.trading_account_id)

        const maxDailyLossDollar = ch.max_daily_loss
        const maxTotalDDDollar = ch.max_total_dd
        const profitTargetDollar = ch.profit_target

        const dailyLoss = Math.min(dailyPL, 0)
        const currentDailyDDPercent = Math.abs(dailyLoss) / ch.account_size * 100
        const dailyDDLimitPercent = (maxDailyLossDollar / ch.account_size) * 100

        const totalLoss = Math.min(totalPL, 0)
        const currentTotalDDPercent = Math.abs(totalLoss) / ch.account_size * 100
        const totalDDLimitPercent = (maxTotalDDDollar / ch.account_size) * 100

        const totalProfit = Math.max(totalPL, 0)
        const progressPercent = (totalProfit / profitTargetDollar) * 100

        // Check daily DD alerts
        const dailyDDAlert = getAlertInfo(currentDailyDDPercent, dailyDDLimitPercent, ch.alert_at_percent)
        if (dailyDDAlert && dailyDDAlert.shouldAlert && userEmail) {
          const roomLeftPercent = dailyDDLimitPercent - currentDailyDDPercent
          const roomLeftDollar = maxDailyLossDollar - Math.abs(dailyLoss)

          try {
            const html = getPropFirmAlertHtml({
              name: userName || 'Trader',
              firmName: ch.firm_name,
              accountSize: ch.account_size,
              challengePhase: ch.challenge_phase,
              alertType: dailyDDAlert.severity === 'breach' ? 'breach' : 'daily_dd',
              severity: dailyDDAlert.severity,
              currentDDPercent: currentDailyDDPercent,
              ddLimitPercent: dailyDDLimitPercent,
              roomLeftPercent: Math.max(roomLeftPercent, 0),
              roomLeftDollar: Math.max(roomLeftDollar, 0),
              ctaUrl: `${SITE_URL}/dashboard`,
            })

            await sendEmail({
              to: userEmail,
              subject: dailyDDAlert.severity === 'breach'
                ? `🚫 CHALLENGE BREACHED — ${ch.firm_name} | LuxTradee`
                : `⚠️ Drawdown Warning ${currentDailyDDPercent.toFixed(1)}% — ${ch.firm_name} | LuxTradee`,
              html,
            })
            alertsSent.push(`daily_dd_${dailyDDAlert.severity}`)
          } catch (emailErr: any) {
            console.warn('[prop-firm-guard/check] Email send failed:', emailErr.message)
          }

          try {
            const { data: pushSubs } = await admin
              .from('push_subscriptions')
              .select('endpoint, p256dh, auth')
              .eq('user_id', ch.user_id)

            if (pushSubs && pushSubs.length > 0) {
              await sendPushToUser(pushSubs as any, {
                title: dailyDDAlert.severity === 'breach' ? 'Challenge Breached!' : `Drawdown ${currentDailyDDPercent.toFixed(1)}%`,
                body: `${ch.firm_name}: DD at ${currentDailyDDPercent.toFixed(1)}% of ${dailyDDLimitPercent.toFixed(1)}% limit.`,
                url: `${SITE_URL}/dashboard`,
                tag: `propfirm-${ch.id}`,
                type: 'trade',
              })
            }
          } catch (pushErr: any) {
            console.warn('[prop-firm-guard/check] Push notification failed:', pushErr.message)
          }

          if (dailyDDAlert.severity === 'breach') {
            breached = true
            await admin
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
                current_balance: ch.account_size + totalPL,
                last_alert_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', ch.id)
          }
        }

        // Check total DD alerts
        if (!breached) {
          const totalDDAlert = getAlertInfo(currentTotalDDPercent, totalDDLimitPercent, ch.alert_at_percent)
          if (totalDDAlert && totalDDAlert.shouldAlert && userEmail) {
            const roomLeftPercent = totalDDLimitPercent - currentTotalDDPercent
            const roomLeftDollar = maxTotalDDDollar - Math.abs(totalLoss)

            try {
              const html = getPropFirmAlertHtml({
                name: userName || 'Trader',
                firmName: ch.firm_name,
                accountSize: ch.account_size,
                challengePhase: ch.challenge_phase,
                alertType: totalDDAlert.severity === 'breach' ? 'breach' : 'total_dd',
                severity: totalDDAlert.severity,
                currentDDPercent: currentTotalDDPercent,
                ddLimitPercent: totalDDLimitPercent,
                roomLeftPercent: Math.max(roomLeftPercent, 0),
                roomLeftDollar: Math.max(roomLeftDollar, 0),
                ctaUrl: `${SITE_URL}/dashboard`,
              })

              await sendEmail({
                to: userEmail,
                subject: totalDDAlert.severity === 'breach'
                  ? `🚫 CHALLENGE BREACHED — ${ch.firm_name} | LuxTradee`
                  : `⚠️ Drawdown Warning ${currentTotalDDPercent.toFixed(1)}% — ${ch.firm_name} | LuxTradee`,
                html,
              })
              alertsSent.push(`total_dd_${totalDDAlert.severity}`)
            } catch (emailErr: any) {
              console.warn('[prop-firm-guard/check] Email send failed:', emailErr.message)
            }

            try {
              const { data: pushSubs } = await admin
                .from('push_subscriptions')
                .select('endpoint, p256dh, auth')
                .eq('user_id', ch.user_id)

              if (pushSubs && pushSubs.length > 0) {
                await sendPushToUser(pushSubs as any, {
                  title: totalDDAlert.severity === 'breach' ? 'Challenge Breached!' : `Drawdown ${currentTotalDDPercent.toFixed(1)}%`,
                  body: `${ch.firm_name}: DD at ${currentTotalDDPercent.toFixed(1)}% of ${totalDDLimitPercent.toFixed(1)}% limit.`,
                  url: `${SITE_URL}/dashboard`,
                  tag: `propfirm-${ch.id}`,
                  type: 'trade',
                })
              }
            } catch (pushErr: any) {
              console.warn('[prop-firm-guard/check] Push notification failed:', pushErr.message)
            }

            if (totalDDAlert.severity === 'breach') {
              breached = true
              await admin
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
                  current_balance: ch.account_size + totalPL,
                  last_alert_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', ch.id)
            }
          }
        }

        // Check profit target
        if (!breached && totalPL >= profitTargetDollar) {
          profitTargetReached = true
          if (userEmail) {
            try {
              const html = getPropFirmAlertHtml({
                name: userName || 'Trader',
                firmName: ch.firm_name,
                accountSize: ch.account_size,
                challengePhase: ch.challenge_phase,
                alertType: 'profit_target',
                severity: 'success',
                currentDDPercent: progressPercent,
                ddLimitPercent: 100,
                roomLeftPercent: 0,
                roomLeftDollar: 0,
                ctaUrl: `${SITE_URL}/dashboard`,
              })

              await sendEmail({
                to: userEmail,
                subject: `🎉 Profit Target Reached! — ${ch.firm_name} | LuxTradee`,
                html,
              })
              alertsSent.push('profit_target')
            } catch (emailErr: any) {
              console.warn('[prop-firm-guard/check] Profit email failed:', emailErr.message)
            }
          }
        }

        // Update challenge state
        if (!breached) {
          const { error: updateError } = await admin
            .from('prop_firm_challenges')
            .update({
              current_daily_dd: currentDailyDDPercent,
              daily_pl: dailyPL,
              current_total_dd: currentTotalDDPercent,
              total_pl: totalPL,
              current_progress: Math.min(progressPercent, 100),
              current_balance: ch.account_size + totalPL,
              last_alert_at: alertsSent.length > 0 ? new Date().toISOString() : ch.last_alert_at || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', ch.id)

          if (updateError) {
            console.error('[prop-firm-guard/check] State update error:', updateError)
          }
        }

        results.push({
          challengeId: ch.id,
          firm: ch.firm_name,
          alertsSent,
          breached,
          profitTargetReached,
          dailyPL,
          totalPL,
          currentDailyDD: currentDailyDDPercent,
          currentTotalDD: currentTotalDDPercent,
          currentProgress: Math.min(progressPercent, 100),
        })

      } catch (err: any) {
        console.error(`[prop-firm-guard/check] Error processing challenge ${ch.id}:`, err.message)
        results.push({
          challengeId: ch.id,
          firm: ch.firm_name,
          alertsSent: [],
          breached: false,
          profitTargetReached: false,
          dailyPL: 0,
          totalPL: 0,
          currentDailyDD: 0,
          currentTotalDD: 0,
          currentProgress: 0,
        })
      }
    }

    const totalAlerts = results.reduce((sum, r) => sum + r.alertsSent.length, 0)
    const totalBreaches = results.filter(r => r.breched).length
    const totalTargets = results.filter(r => r.profitTargetReached).length

    return NextResponse.json({
      success: true,
      message: `Checked ${challenges.length} challenges: ${totalAlerts} alerts, ${totalBreaches} breaches, ${totalTargets} targets reached`,
      processed: challenges.length,
      alertsSent: totalAlerts,
      breaches: totalBreaches,
      targetsReached: totalTargets,
      results,
    })

  } catch (error: any) {
    console.error('[prop-firm-guard/check] Fatal error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
