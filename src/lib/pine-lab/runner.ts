/**
 * ============================================================
 * pine-lab/runner.ts — eksekusi script server-side
 * ============================================================
 * Dipakai run manual (API) dan cron jam-an. Menarik candle H1
 * dari datafeed internal (/api/candles — TradingView WS →
 * TwelveData) via SELF binding (pola sama dengan price-alerts),
 * lalu menjalankan Lux Engine dengan guardrail penuh.
 * ============================================================
 */

import type { LuxCandle, LuxRunResult } from '@/engine/lux'
import { runLuxScript } from '@/engine/lux'
import { getSelfFetch } from '@/lib/cloudflare-bindings'
import { PINE_LAB_CONFIG } from './config'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id').replace(/\/+$/, '')

interface CandleResp {
  success?: boolean
  data?: { time: number; open: number; high: number; low: number; close: number; volume?: number }[]
}

/** Tarik candle dari datafeed internal (kanonik: interval '1h'). */
export async function fetchCandles(symbol: string, limit: number): Promise<LuxCandle[]> {
  const url = `${SITE_URL}/api/candles?symbol=${encodeURIComponent(symbol)}&interval=1h&limit=${limit}`
  const selfFetch = await getSelfFetch()
  let res: Response | null = null
  try {
    res = selfFetch
      ? await selfFetch(url, { signal: AbortSignal.timeout(20_000) })
      : await fetch(url, { signal: AbortSignal.timeout(20_000) })
  } catch {
    return []
  }
  if (!res || !res.ok) return []
  try {
    const json = (await res.json()) as CandleResp
    const rows = Array.isArray(json?.data) ? json.data : []
    return rows
      .filter((r) => Number.isFinite(r?.time) && Number.isFinite(r?.close))
      .map((r) => ({
        time: Number(r.time),
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
        volume: r.volume !== undefined ? Number(r.volume) : undefined,
      }))
  } catch {
    return []
  }
}

export interface RunOneResult {
  run: LuxRunResult
  durationMs: number
  candleCount: number
  /** Epoch detik candle PERTAMA dalam rentang data (info rentang history). */
  dataFrom?: number
  /** Epoch detik candle TERAKHIR (harusnya ≈ sekarang — bukti data live). */
  dataTo?: number
}

/**
 * Jalankan SATU script pada candle milik simbolnya.
 * Sandbox: deadline + caps ditegakkan DI DALAM engine; error selalu
 * tertangkap → tidak pernah melempar ke caller (cron tetap jalan
 * untuk script lain — spek item 6).
 */
export async function runOneScript(
  script: { id: string; symbol: string; source: string },
  candleLimit: number = PINE_LAB_CONFIG.MANUAL_CANDLE_LIMIT
): Promise<RunOneResult> {
  const candles = await fetchCandles(script.symbol || PINE_LAB_CONFIG.DEFAULT_SYMBOL, candleLimit)
  if (!candles.length) {
    return {
      run: {
        ok: false,
        bars: 0,
        events: [],
        plots: [],
        durationMs: 0,
        error: 'Data candle tidak tersedia saat ini (datafeed sibuk / pasar tutup). Coba lagi nanti.',
        errorCode: 'RUNTIME_ERROR',
      },
      durationMs: 0,
      candleCount: 0,
    }
  }
  const run = runLuxScript(script.source, candles, {
    deadlineMs: PINE_LAB_CONFIG.ENGINE_DEADLINE_MS,
    maxBars: candleLimit,
    maxEvents: PINE_LAB_CONFIG.MAX_EVENTS_PER_RUN,
  })
  return {
    run,
    durationMs: run.durationMs,
    candleCount: candles.length,
    dataFrom: candles[0]?.time,
    dataTo: candles[candles.length - 1]?.time,
  }
}

/** event_id stabil untuk dedupe lintas-cron (user + script + bar + title). */
export function makeEventId(scriptId: string, ev: { time: number; title: string }): string {
  return `${scriptId}:${ev.time}:${ev.title.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60)}`
}
