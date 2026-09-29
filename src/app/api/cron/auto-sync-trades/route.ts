import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getMetaApiDeals, isMetaApiConfigured } from '@/lib/metaapi'
import { checkPropFirmAlerts } from '@/app/api/prop-firm/_lib/check-alerts'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/auto-sync-trades
 *
 * Cron job: auto-syncs trades from MetaApi connected accounts every 5 minutes.
 * After syncing, checks PropFirm rules and sends alerts if needed.
 *
 * Flow:
 *   1. Find all trading_accounts where metaapi_account_id IS NOT NULL and is_active = true
 *   2. For each, call MetaApi deals API to get new trades since last sync
 *   3. Insert new trades (dedup by deal_id or open_time+symbol)
 *   4. Check PropFirm rules for each user → send alerts
 *
 * Auth: CRON_SECRET via Bearer header, or ?force=true to bypass
 */

// Lazy Supabase admin client
let _supabaseAdmin: SupabaseClient | null = null

function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Missing Supabase env vars')
    _supabaseAdmin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return _supabaseAdmin
}

interface SyncSummary {
  accountId: string
  userId: string
  metaapiAccountId: string
  newTrades: number
  skippedTrades: number
  errors: string[]
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

  // Auth check
  const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!force && process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isMetaApiConfigured()) {
    return NextResponse.json({
      message: 'MetaApi not configured — nothing to sync',
      synced: 0,
      newTrades: 0,
      alertsSent: 0,
    })
  }

  const supabase = getSupabaseAdmin()

  try {
    // 1. Find all connected, active trading accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('trading_accounts')
      .select('id, user_id, metaapi_account_id, account_number, updated_at, last_synced_at')
      .not('metaapi_account_id', 'is', null)
      .eq('is_active', true)

    if (accountsError) {
      console.error('[auto-sync] Failed to fetch accounts:', accountsError)
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({
        message: 'No connected MetaApi accounts to sync',
        synced: 0,
        newTrades: 0,
        alertsSent: 0,
        elapsed_ms: Date.now() - startTime,
      })
    }

    // Dry run — just list accounts
    if (dry) {
      return NextResponse.json({
        message: `DRY RUN — would sync ${accounts.length} accounts`,
        accounts: accounts.map(a => ({
          id: a.id,
          userId: a.user_id,
          metaapiId: a.metaapi_account_id,
          lastSynced: a.last_synced_at || a.updated_at,
        })),
        elapsed_ms: Date.now() - startTime,
      })
    }

    // 2. Sync trades for each account
    const syncResults: SyncSummary[] = []
    const usersToCheck = new Set<string>()

    for (const account of accounts) {
      const summary: SyncSummary = {
        accountId: account.id,
        userId: account.user_id,
        metaapiAccountId: account.metaapi_account_id,
        newTrades: 0,
        skippedTrades: 0,
        errors: [],
      }

      try {
        // Determine last sync time
        const lastSynced = account.last_synced_at || account.updated_at
        const syncFrom = lastSynced
          ? new Date(lastSynced).toISOString()
          : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // default: last 24h

        // Fetch deals from MetaApi
        const deals = await getMetaApiDeals(account.metaapi_account_id, {
          startTime: syncFrom,
        })

        if (!Array.isArray(deals) || deals.length === 0) {
          syncResults.push(summary)
          continue
        }

        // 3. Insert new trades (dedup by deal_id)
        for (const deal of deals) {
          try {
            const dealId = String(deal.id || deal.brokerClientId || '')

            // Check for existing trade
            if (dealId) {
              const { data: existing } = await supabase
                .from('trades')
                .select('id')
                .eq('deal_id', dealId)
                .maybeSingle()

              if (existing) {
                summary.skippedTrades++
                continue
              }
            }

            // Also dedup by open_time + symbol for deals without ID
            const openTime = deal.time ? new Date(deal.time).toISOString() : new Date().toISOString()
            const symbol = deal.symbol || 'UNKNOWN'

            if (!dealId) {
              const { data: existing } = await supabase
                .from('trades')
                .select('id')
                .eq('user_id', account.user_id)
                .eq('symbol', symbol)
                .eq('open_time', openTime)
                .maybeSingle()

              if (existing) {
                summary.skippedTrades++
                continue
              }
            }

            // Insert the trade
            const tradeData = {
              user_id: account.user_id,
              symbol,
              type: (deal.type || 'BUY').toUpperCase(),
              lot_size: deal.volume || 0,
              open_price: deal.price || 0,
              close_price: deal.closePrice || deal.price || 0,
              profit_loss: deal.profit || 0,
              commission: deal.commission || 0,
              swap: deal.swap || 0,
              open_time: openTime,
              close_time: deal.closeTime ? new Date(deal.closeTime).toISOString() : openTime,
              deal_id: dealId || undefined,
              comment: deal.comment || '',
              session: 'MetaApi Auto-Sync',
              trading_account_id: account.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }

            const { error: insertError } = await supabase
              .from('trades')
              .insert(tradeData)

            if (insertError) {
              summary.errors.push(`Deal ${dealId}: ${insertError.message}`)
            } else {
              summary.newTrades++
              usersToCheck.add(account.user_id)
            }
          } catch (dealErr: any) {
            summary.errors.push(`Deal error: ${dealErr.message}`)
          }
        }

        // Update last_synced_at on the account
        await supabase
          .from('trading_accounts')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', account.id)
      } catch (accountErr: any) {
        summary.errors.push(`Account sync error: ${accountErr.message}`)
      }

      syncResults.push(summary)
    }

    // 4. Check PropFirm rules for users that got new trades
    let totalAlerts = 0
    for (const userId of usersToCheck) {
      try {
        const result = await checkPropFirmAlerts(supabase, userId, true) // sendPush = true
        totalAlerts += result.alerts.length

        if (result.alerts.length > 0) {
          console.log(`[auto-sync] User ${userId}: ${result.alerts.length} alert(s) —`,
            result.alerts.map(a => `${a.type}:${a.firmName}`).join(', '))
        }
      } catch (alertErr: any) {
        console.error(`[auto-sync] Alert check failed for user ${userId}:`, alertErr.message)
      }
    }

    const totalNewTrades = syncResults.reduce((sum, r) => sum + r.newTrades, 0)
    const totalSkipped = syncResults.reduce((sum, r) => sum + r.skippedTrades, 0)
    const totalErrors = syncResults.reduce((sum, r) => sum + r.errors.length, 0)

    return NextResponse.json({
      message: `Synced ${totalNewTrades} new trades across ${accounts.length} accounts`,
      synced: accounts.length,
      newTrades: totalNewTrades,
      skippedTrades: totalSkipped,
      alertsSent: totalAlerts,
      errors: totalErrors,
      results: syncResults.map(r => ({
        accountId: r.accountId,
        metaapiId: r.metaapiAccountId,
        newTrades: r.newTrades,
        skipped: r.skippedTrades,
        errors: r.errors.length,
      })),
      elapsed_ms: Date.now() - startTime,
    })
  } catch (error: any) {
    console.error('[cron/auto-sync-trades] Fatal error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
