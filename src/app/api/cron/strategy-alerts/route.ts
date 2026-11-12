import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { pushToUser } from '@/lib/push-notify'
import { getSelfFetch } from '@/lib/cloudflare-bindings'
import { isXauMarketOpen } from '@/lib/market-hours'
import {
  evaluateStrategy,
  evalMomentumBreakout,
  condLabel,
  type StrategyCondType,
} from '@/lib/market/indicators'

/**
 * ============================================================
 * GET/POST /api/cron/strategy-alerts
 * ============================================================
 * MESIN ALERT STRATEGI & INDIKATOR ALA PINE — pengganti alert
 * Pine Script TradingView (yang wajib langganan Essential ±$13/bln
 * untuk 20 alert + webhook).
 *
 * Direktif Bos (2026-11-11): "alert strategi dan indikator yang
 * kita pasang… alertnya lewat fitur luxtradee sendiri, numpang di
 * chart TradingView untuk visualnya aja."
 *
 * Cara kerja (numpang slot cron 15-menit — jalur cepat, HEMAT CPU):
 *   1. Baca alert aktif dari tabel strategy_alerts (SQL 20261111)
 *   2. Group per (symbol, timeframe) → 1 fetch candle per group
 *      (cap 30 group) via /api/candles — rantai TradingView →
 *      TwelveData yang sama dengan chart user
 *   3. Hitung indikator di server (EMA/RSI/MACD — lib/market/
 *      indicators.ts, terjemahan Pine) + evaluasi kondisi
 *   4. Kena + belum pernah push di bar ini → web-push ke HP
 *      (dedupe 1 push per bar — perilaku "Once Per Bar" Pine)
 *
 * Guard pasar: XAU-like pakai isXauMarketOpen; forex/US100 ikut
 * jadwal yang sama; crypto 24/7. Anti data beku weekend (insiden
 * 8 Nov: cross palsu dari candle Jumat).
 *
 * Auth: Bearer PINE_ALERT_CRON_SECRET / CRON_SECRET — fail-closed.
 * ============================================================
 */
export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'

/* Anti dobel-run seperti price-alerts */
let running = false
let lastRunAt = 0

/* 120 bar cukup utk EMA50 + RSI14 + MACD(12,26,9) konvergen */
const CANDLE_LIMIT = 120
const MAX_GROUPS = 30
const MAX_ALERTS = 300

function isAuthorized(request: NextRequest): boolean {
  const provided = String(
    request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.headers.get('x-cron-secret') ||
      ''
  ).trim()
  const validSecrets = [
    String(process.env.PINE_ALERT_CRON_SECRET || '').trim(),
    String(process.env.CRON_SECRET || '').trim(),
  ].filter(Boolean)
  if (!validSecrets.length) return process.env.NODE_ENV === 'development'
  if (provided && validSecrets.includes(provided)) return true
  return process.env.NODE_ENV === 'development'
}

/** Crypto 24/7; OTC/forex/US100 ikut jadwal NY (sama dgn XAU spot). */
function isCryptoSymbol(symbol: string): boolean {
  return /^(BTC|ETH|SOL|BNB|XRP|ADA|DOGE|AVAX|DOT|LINK)/i.test(String(symbol || ''))
}

function marketOpen(symbol: string, now: Date = new Date()): boolean {
  if (isCryptoSymbol(symbol)) return true
  return isXauMarketOpen(now) // jadwal NY spot — berlaku juga utk FX/US100
}

interface StrategyAlertRow {
  id: string
  user_id: string
  symbol: string
  cond_type: StrategyCondType
  timeframe: string
  rsi_period: number | null
  rsi_level: number | null
  ema_fast: number | null
  ema_slow: number | null
  body_min_pct: number | null
  adx_len: number | null
  adx_smooth: number | null
  adx_min: number | null
  fractal_len: number | null
  use_fractal: boolean | null
  sess_start: string | null
  sess_end: string | null
  notes: string | null
  last_bar_time: number | null
  trigger_count: number
}

interface OhlcvBar {
  time: number
  open: number
  high: number
  low: number
  close: number
}

async function fetchCandles(symbol: string, timeframe: string): Promise<OhlcvBar[] | null> {
  try {
    const url = `${SITE_URL}/api/candles?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(timeframe)}&limit=${CANDLE_LIMIT}`
    const selfFetch = await getSelfFetch()
    const res = selfFetch
      ? await selfFetch(url, { signal: AbortSignal.timeout(12_000) })
      : await fetch(url, { signal: AbortSignal.timeout(12_000) })
    if (!res.ok) return null
    const json = await res.json()
    const bars = Array.isArray(json?.data) ? json.data : []
    if (!bars.length) return null
    const clean: OhlcvBar[] = []
    for (const b of bars) {
      const t = Number(b?.time)
      const c = Number(b?.close)
      if (!(Number.isFinite(t) && Number.isFinite(c) && c > 0)) continue
      clean.push({
        time: t,
        close: c,
        open: Number(b?.open),
        high: Number(b?.high),
        low: Number(b?.low),
      })
    }
    return clean.length ? clean : null
  } catch {
    return null
  }
}

/* LABEL timeframe utk pesan notifikasi */
const TF_LABEL: Record<string, string> = {
  '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1H',
  '2h': '2H', '4h': '4H', '1d': '1D', '1w': '1W',
}

async function handle(): Promise<NextResponse> {
  const startTime = Date.now()
  if (running && Date.now() - lastRunAt < 10 * 60_000) {
    return NextResponse.json({ skipped: 'run sebelumnya masih jalan' })
  }
  running = true
  lastRunAt = Date.now()

  try {
    const supabase = getSupabaseAdmin()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase admin tidak tersedia' }, { status: 500 })
    }

    /* 1. Alert aktif (cap MAX_ALERTS — hemat DB & CPU) */
    const { data: rows, error } = await supabase
      .from('strategy_alerts')
      .select(
        'id, user_id, symbol, cond_type, timeframe, rsi_period, rsi_level, ema_fast, ema_slow, body_min_pct, adx_len, adx_smooth, adx_min, fractal_len, use_fractal, sess_start, sess_end, notes, last_bar_time, trigger_count'
      )
      .eq('active', true)
      .limit(MAX_ALERTS)
    if (error) {
      /* Tabel belum ada (migrasi SQL 20261111 belum dijalankan via
         Supabase SQL Editor) → LAPOR dengan tenang, jangan 500
         (500 memicu health-alert + email admin tiap 15 menit). */
      const code = (error as { code?: string }).code || ''
      if (code === '42P01' || /does not exist/i.test(error.message || '')) {
        return NextResponse.json({
          ok: true,
          table_missing: true,
          note: 'Tabel strategy_alerts belum ada — jalankan supabase/migrations/20261111_strategy_alerts.sql di Supabase SQL Editor.',
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const alerts = ((rows ?? []) as StrategyAlertRow[]).filter((r) => r.symbol && r.cond_type)
    if (!alerts.length) {
      return NextResponse.json({ ok: true, checked: 0, groups: 0, pushed: 0 })
    }

    /* 2. Group per (symbol, timeframe) → 1 fetch candle per group */
    const groupMap = new Map<string, StrategyAlertRow[]>()
    for (const a of alerts) {
      const key = `${a.symbol}:${a.timeframe}`
      const list = groupMap.get(key)
      if (list) list.push(a)
      else if (groupMap.size < MAX_GROUPS) groupMap.set(key, [a])
      // group ke-31+ dikorbankan run ini (dicek run berikutnya)
    }

    /* 3. Fetch + evaluasi + push */
    let pushed = 0
    let skippedDedupe = 0
    const details: { symbol: string; cond: string }[] = []

    for (const [key, group] of groupMap) {
      const sep = key.lastIndexOf(':')
      const symbol = key.slice(0, sep)
      const timeframe = key.slice(sep + 1)
      if (!marketOpen(symbol)) continue // data beku weekend/jeda → jangan evaluasi

      const bars = await fetchCandles(symbol, timeframe)
      if (!bars || bars.length < 40) continue

      for (const a of group) {
        const params = {
          condType: a.cond_type,
          rsiPeriod: a.rsi_period,
          rsiLevel: a.rsi_level != null ? Number(a.rsi_level) : null,
          emaFast: a.ema_fast,
          emaSlow: a.ema_slow,
          bodyMinPct: a.body_min_pct != null ? Number(a.body_min_pct) : null,
          adxLen: a.adx_len,
          adxSmooth: a.adx_smooth,
          adxMin: a.adx_min != null ? Number(a.adx_min) : null,
          fractalLen: a.use_fractal === false ? 0 : a.fractal_len,
          sessStart: a.sess_start,
          sessEnd: a.sess_end,
        }
        /* Breakout momentum = jalur evaluator khusus (butuh OHLC penuh);
           kondisi lain cukup close. */
        const evalRes = (a.cond_type === 'MOM_BRK_UP' || a.cond_type === 'MOM_BRK_DN')
          ? evalMomentumBreakout(params, bars, a.cond_type === 'MOM_BRK_UP' ? 'up' : 'dn')
          : evaluateStrategy(params, bars)
        if (!evalRes.hit) continue

        /* Dedupe "Once Per Bar": bar yang sama tidak push dua kali */
        if (a.last_bar_time === evalRes.barTime) {
          skippedDedupe++
          continue
        }

        const label = condLabel(params)
        const tf = TF_LABEL[a.timeframe] || a.timeframe
        const push = await pushToUser(supabase, a.user_id, {
          title: `${a.symbol} ${tf} · ${label}`,
          body: `${evalRes.detail}${a.notes ? ` · ${a.notes}` : ''}`,
          tag: `stratalert-${a.id}`,
          type: 'strategy-alert',
          url: '/dashboard/chart',
          urgency: 'high',
        })

        /* Update state alert (dedupe + statistik) — service-role */
        await supabase
          .from('strategy_alerts')
          .update({
            last_bar_time: evalRes.barTime,
            last_triggered_at: new Date().toISOString(),
            trigger_count: (Number(a.trigger_count) || 0) + 1,
          })
          .eq('id', a.id)

        if (push.sent > 0) {
          pushed++
          details.push({ symbol: a.symbol, cond: label })
        }
      }

      await new Promise((r) => setTimeout(r, 150)) // jeda sopan antar upstream
    }

    return NextResponse.json({
      ok: true,
      checked: alerts.length,
      groups: groupMap.size,
      pushed,
      skippedDedupe,
      details,
      elapsed_ms: Date.now() - startTime,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  } finally {
    running = false
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handle()
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handle()
}
