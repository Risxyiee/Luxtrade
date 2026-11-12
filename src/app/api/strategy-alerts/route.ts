import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { isUserPro } from '@/lib/pro-check'
import { isStrategyCondType, STRATEGY_COND_TYPES } from '@/lib/market/indicators'

/**
 * ============================================================
 * /api/strategy-alerts — CRUD ALERT STRATEGI & INDIKATOR ALA PINE
 * ============================================================
 * Direktif Bos (2026-11-11): pengganti alert Pine Script TradingView
 * (wajib Essential ±$13/bln) — kondisi indikator (RSI / cross EMA /
 * harga×EMA / MACD) dicek cron /api/cron/strategy-alerts tiap 15
 * menit → push notif ke HP. Chart tetap TradingView (visual saja).
 *
 * Tabel: strategy_alerts (supabase/migrations/20261111_strategy_alerts.sql)
 * Auth: session cookie Supabase (pola sama dengan /api/watchlist)
 * PRO: POST/PATCH/DELETE butuh plan PRO (alert = fitur PRO, tetap
 *      jauh lebih murah dari langganan TradingView)
 * Kuota: maks 20 alert per user — TradingView Plus ($29.95/bln) hanya
 *      kasih 100 alert dgn harga 20× lebih mahal.
 * ============================================================
 */
export const dynamic = 'force-dynamic'

const MAX_ALERTS_PER_USER = 20
const TF_ALLOWED = ['5m', '15m', '30m', '1h', '2h', '4h', '1d', '1w']

async function getUserWithSession(request: NextRequest) {
  const { supabase: cookieClient } = await createClientForApi(request)
  if (!cookieClient) return { user: null, client: null }

  let { data: { user } } = await cookieClient.auth.getUser()
  if (user) return { user, client: cookieClient }

  // Fallback Bearer token
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

  return { user: null, client: cookieClient }
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(v))
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(n, min), max)
}

function validateBody(body: Record<string, unknown>): { error?: string; data?: Record<string, unknown> } {
  const condType = String(body.cond_type || '')
  if (!isStrategyCondType(condType)) {
    return { error: `cond_type tidak valid. Pilihan: ${STRATEGY_COND_TYPES.join(', ')}` }
  }
  const symbol = String(body.symbol || '').toUpperCase().trim()
  if (!symbol) return { error: 'Symbol is required' }
  const timeframe = TF_ALLOWED.includes(String(body.timeframe)) ? String(body.timeframe) : '15m'

  const data: Record<string, unknown> = { cond_type: condType, symbol, timeframe }

  if (condType === 'RSI_ABOVE' || condType === 'RSI_BELOW') {
    data.rsi_period = clampInt(body.rsi_period, 2, 50, 14)
    const level = Number(body.rsi_level)
    if (!Number.isFinite(level) || level <= 0 || level >= 100) {
      return { error: 'Level RSI harus angka 1–99, mis. 30' }
    }
    data.rsi_level = level
  } else if (condType === 'EMA_CROSS_UP' || condType === 'EMA_CROSS_DOWN') {
    const fast = clampInt(body.ema_fast, 2, 100, 9)
    const slow = clampInt(body.ema_slow, 3, 200, 21)
    if (slow <= fast) return { error: 'EMA lambat harus lebih besar dari EMA cepat (mis. 9 & 21)' }
    data.ema_fast = fast
    data.ema_slow = slow
  } else if (condType === 'PRICE_X_EMA_ABOVE' || condType === 'PRICE_X_EMA_BELOW') {
    data.ema_fast = null
    data.ema_slow = clampInt(body.ema_slow, 2, 200, 21)
  }
  // MACD_* : default Pine 12/26/9 — tanpa parameter

  if (typeof body.notes === 'string') data.notes = body.notes.slice(0, 120) || null

  return { data }
}

// GET — daftar alert strategi milik user
export async function GET(request: NextRequest) {
  try {
    const { user, client } = await getUserWithSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await client
      .from('strategy_alerts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) {
      console.error('[strategy-alerts GET] Supabase error:', error)
      return NextResponse.json({ items: [] })
    }
    return NextResponse.json({ items: data || [] })
  } catch (error) {
    console.error('[strategy-alerts GET] Error:', error)
    return NextResponse.json({ items: [] })
  }
}

// POST — pasang alert strategi baru
export async function POST(request: NextRequest) {
  try {
    const { user, client } = await getUserWithSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const pro = await isUserPro(user.id)
    if (!pro) {
      return NextResponse.json({ error: 'PRO_REQUIRED', code: 'PRO_REQUIRED' }, { status: 403 })
    }

    const { data: existing } = await client
      .from('strategy_alerts')
      .select('id')
      .eq('user_id', user.id)
      .limit(MAX_ALERTS_PER_USER + 1)
    if ((existing?.length ?? 0) >= MAX_ALERTS_PER_USER) {
      return NextResponse.json(
        { error: `Kuota ${MAX_ALERTS_PER_USER} alert tercapai — hapus yang tidak dipakai dulu.` },
        { status: 400 }
      )
    }

    const body = await request.json()
    const v = validateBody(body)
    if (v.error || !v.data) {
      return NextResponse.json({ error: v.error || 'Payload tidak valid' }, { status: 400 })
    }

    const { data: item, error } = await client
      .from('strategy_alerts')
      .insert([{ id: crypto.randomUUID(), user_id: user.id, ...v.data }])
      .select()
      .single()
    if (error) {
      console.error('[strategy-alerts POST] Supabase error:', error)
      return NextResponse.json({ error: 'Gagal memasang alert strategi' }, { status: 500 })
    }
    return NextResponse.json({ item })
  } catch (error) {
    console.error('[strategy-alerts POST] Error:', error)
    return NextResponse.json({ error: 'Gagal memasang alert strategi' }, { status: 500 })
  }
}

// PATCH — aktif/nonaktifkan alert (toggle) milik user
export async function PATCH(request: NextRequest) {
  try {
    const { user, client } = await getUserWithSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const pro = await isUserPro(user.id)
    if (!pro) {
      return NextResponse.json({ error: 'PRO_REQUIRED', code: 'PRO_REQUIRED' }, { status: 403 })
    }

    const body = await request.json()
    const id = typeof body?.id === 'string' ? body.id.trim() : ''
    if (!id) return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })

    const active = Boolean(body.active)
    // Reset dedupe saat diaktifkan lagi → bar berikutnya boleh push
    const update: Record<string, unknown> = { active }
    if (active) {
      update.last_bar_time = null
      update.last_triggered_at = null
    }

    const { data: item, error } = await client
      .from('strategy_alerts')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error || !item) {
      console.error('[strategy-alerts PATCH] Supabase error:', error)
      return NextResponse.json({ error: 'Gagal mengubah alert' }, { status: 500 })
    }
    return NextResponse.json({ success: true, item })
  } catch (error) {
    console.error('[strategy-alerts PATCH] Error:', error)
    return NextResponse.json({ error: 'Gagal mengubah alert' }, { status: 500 })
  }
}

// DELETE — hapus alert strategi milik user
export async function DELETE(request: NextRequest) {
  try {
    const { user, client } = await getUserWithSession(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const pro = await isUserPro(user.id)
    if (!pro) {
      return NextResponse.json({ error: 'PRO_REQUIRED', code: 'PRO_REQUIRED' }, { status: 403 })
    }

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })

    const { error } = await client
      .from('strategy_alerts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) {
      console.error('[strategy-alerts DELETE] Supabase error:', error)
      return NextResponse.json({ error: 'Gagal menghapus alert' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[strategy-alerts DELETE] Error:', error)
    return NextResponse.json({ error: 'Gagal menghapus alert' }, { status: 500 })
  }
}
