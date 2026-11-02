import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { isUserPro } from '@/lib/pro-check'
import { checkAchievementsAfterTrade } from '@/lib/achievement-checker'
import { edgeCrypto } from '@/lib/edge-crypto'
import { runInBackground } from '@/lib/background'

export const dynamic = 'force-dynamic'

// ============================================================================
// BULK TRADE IMPORT — laporan Bos (2026-11-02): "import berhasil tapi ga
// masuk transaksinya". Penyebab: /api/import/file cuma PARSE file lalu
// balikin daftar trade; client cuma auto-fill 1 trade pertama ke form —
// sisanya dibuang & user harus klik Simpan manual. Endpoint ini nyimpen
// SEMUA trade hasil import sekaligus (satu request, insert bertahap).
// ============================================================================

const FREE_TRADE_LIMIT = 10 // sama dengan /api/trades POST
const MAX_TRADES_PER_REQUEST = 500
const INSERT_CHUNK = 100 // Supabase aman dengan payload per-batch ini

async function invalidateAnalytics(userId: string) {
  try {
    const { invalidateAnalyticsCache } = await import('@/lib/analytics-cache')
    invalidateAnalyticsCache(userId)
  } catch { /* best effort */ }
}

async function updateAccountBalance(client: any, accountId: string | null) {
  if (!accountId) return
  try {
    const { data: account } = await client
      .from('trading_accounts')
      .select('initial_balance')
      .eq('id', accountId)
      .single()
    if (!account) return
    const { data: trades } = await client
      .from('trades')
      .select('profit_loss')
      .eq('account_id', accountId)
    const totalPL = (trades || []).reduce((sum: number, t: any) => sum + (t.profit_loss || 0), 0)
    await client
      .from('trading_accounts')
      .update({ current_balance: (account.initial_balance || 0) + totalPL, updated_at: new Date().toISOString() })
      .eq('id', accountId)
  } catch (err) {
    console.warn('[trades/bulk updateAccountBalance] Failed:', err)
  }
}

async function countUserTrades(client: any, userId: string): Promise<number> {
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const { count, error } = await client
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('close_time', startOfMonth)
    return count || 0
  } catch {
    return 0
  }
}

async function getUserWithSession(request: NextRequest) {
  const { supabase } = await createClientForApi(request)
  if (!supabase) return { user: null, client: null }
  const { data: { user } } = await supabase.auth.getUser()
  if (user) return { user, client: supabase }
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const bearerClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const result = await bearerClient.auth.getUser(token)
    if (result.data.user) return { user: result.data.user, client: bearerClient }
  }
  return { user: null, client: supabase }
}

const safeFloat = (val: any, fallback = 0): number => {
  const n = parseFloat(String(val))
  return isNaN(n) ? fallback : n
}

function normalizeTrade(raw: any, userId: string, accountId: string | null) {
  const symbolStr = String(raw?.symbol ?? '').toUpperCase().trim()
  if (symbolStr.length < 2 || symbolStr.length > 12) return null
  const type = String(raw?.type ?? '').toUpperCase().includes('SELL') ? 'SELL' : 'BUY'
  const openTime = raw?.open_time ? new Date(String(raw.open_time)) : null
  const closeTime = raw?.close_time ? new Date(String(raw.close_time)) : null
  const iso = (d: Date | null) => (d && !isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString())
  return {
    id: edgeCrypto.randomUUID(),
    user_id: userId,
    account_id: accountId,
    symbol: symbolStr,
    type,
    open_price: safeFloat(raw?.open_price),
    close_price: safeFloat(raw?.close_price),
    lot_size: safeFloat(raw?.lot_size, 0.1),
    profit_loss: safeFloat(raw?.profit_loss),
    open_time: iso(openTime),
    close_time: iso(closeTime),
    session: raw?.session ? String(raw.session) : null,
    notes: raw?.notes ? String(raw.notes).slice(0, 2000) : null,
    stop_loss: raw?.stop_loss != null && raw.stop_loss !== '' ? safeFloat(raw.stop_loss) : null,
    take_profit: raw?.take_profit != null && raw.take_profit !== '' ? safeFloat(raw.take_profit) : null,
    ticket_number: raw?.ticket_number ? String(raw.ticket_number).slice(0, 50) : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, client } = await getUserWithSession(request)
    if (!user || !client) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const rawTrades: any[] = Array.isArray(body?.trades) ? body.trades : []
    if (rawTrades.length === 0) {
      return NextResponse.json({ success: false, error: 'Tidak ada trade untuk disimpan' }, { status: 400 })
    }
    if (rawTrades.length > MAX_TRADES_PER_REQUEST) {
      return NextResponse.json({
        success: false,
        error: `Maksimal ${MAX_TRADES_PER_REQUEST} trade per import. Pecah filenya dulu.`,
      }, { status: 400 })
    }

    const accountId: string | null = body?.account_id ? String(body.account_id) : null

    // Validasi + normalisasi semua row dulu (yang gak valid dilewati, bukan gagal total)
    const normalized = rawTrades
      .map(t => normalizeTrade(t, user.id, accountId))
      .filter((t): t is NonNullable<ReturnType<typeof normalizeTrade>> => t !== null)

    if (normalized.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Tidak ada trade valid untuk disimpan (cek kolom Symbol & harga)',
      }, { status: 400 })
    }

    // Batas trade Free: hitung kuota sisa bulan ini (sama seperti single POST)
    const pro = await isUserPro(user.id)
    let allowed = normalized
    let skippedByLimit = 0
    if (!pro) {
      const used = await countUserTrades(client, user.id)
      const remaining = Math.max(0, FREE_TRADE_LIMIT - used)
      if (normalized.length > remaining) {
        skippedByLimit = normalized.length - remaining
        allowed = normalized.slice(0, remaining)
      }
    }

    let inserted = 0
    const insertErrors: string[] = []
    for (let i = 0; i < allowed.length; i += INSERT_CHUNK) {
      const chunk = allowed.slice(i, i + INSERT_CHUNK)
      const { error } = await client
        .from('trades')
        .insert(chunk)
      if (error) {
        console.error('[trades/bulk] Insert error:', error)
        insertErrors.push(error.message)
      } else {
        inserted += chunk.length
      }
    }

    if (inserted > 0) {
      runInBackground(() => invalidateAnalytics(user.id))
      runInBackground(() => updateAccountBalance(client, accountId))
      runInBackground(() => checkAchievementsAfterTrade(user.id))
    }

    const limited = skippedByLimit > 0
    return NextResponse.json({
      success: inserted > 0,
      inserted,
      skippedByLimit,
      failed: allowed.length - inserted,
      errors: insertErrors.slice(0, 3),
      limitReached: limited,
      message: limited
        ? `${inserted} transaksi masuk. ${skippedByLimit} gak masuk karena batas Free (${FREE_TRADE_LIMIT}/bulan) — upgrade PRO untuk unlimited.`
        : inserted > 0
          ? `${inserted} transaksi berhasil masuk ke jurnal.`
          : 'Gagal menyimpan transaksi.',
    })
  } catch (err) {
    console.error('[trades/bulk] Unexpected error:', err)
    return NextResponse.json(
      { success: false, error: 'Gagal menyimpan transaksi', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
