/**
 * ============================================================
 * indicators.ts — MESIN INDIKATOR SERVER (terjemahan Pine Script)
 * ============================================================
 * Fondasi "alert strategi & indikator ala Pine" Luxtradee (Bos
 * 2026-11-11: "alert strategi dan indikator yang kita pasang…
 * alertnya lewat fitur luxtradee sendiri, numpang di chart
 * TradingView untuk visualnya aja").
 *
 * File Pine user TIDAK bisa jalan di chart embed TradingView (batasan
 * resmi TradingView), tapi LOGIKA alert-nya bisa diterjemahkan: fungsi
 * di bawah ini 1:1 dengan built-in Pine:
 *   ta.ema  → ema()
 *   ta.rsi  → rsi()   (smoothing Wilder — sama dengan Pine)
 *   ta.macd → macd()  (12, 26, 9 — default Pine)
 *   ta.crossover / ta.crossunder → cek dua titik terakhir
 *
 * Semua murni matematika — nol network, nol dependensi, cukup murah
 * untuk cron CPU-limited Cloudflare Workers (evaluasi 300 alert <
 * 1 ms CPU).
 * ============================================================
 */

/** EMA ala Pine ta.ema (alpha = 2 / (period + 1), seed SMA). */
export function ema(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN)
  if (period < 1 || values.length < period) return out
  let sum = 0
  for (let i = 0; i < period; i++) sum += values[i]
  let prev = sum / period // seed = SMA periode pertama (sama dengan Pine)
  out[period - 1] = prev
  const k = 2 / (period + 1)
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

/** RSI ala Pine ta.rsi — smoothing Wilder (RMA), bukan SMA sederhana. */
export function rsi(closes: number[], period = 14): number[] {
  const out: number[] = new Array(closes.length).fill(NaN)
  if (period < 1 || closes.length <= period) return out
  let gainSum = 0
  let lossSum = 0
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1]
    if (d >= 0) gainSum += d
    else lossSum -= d
  }
  let avgGain = gainSum / period
  let avgLoss = lossSum / period
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    const gain = d > 0 ? d : 0
    const loss = d < 0 ? -d : 0
    avgGain = (avgGain * (period - 1) + gain) / period // Wilder RMA
    avgLoss = (avgLoss * (period - 1) + loss) / period
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return out
}

/** MACD ala Pine ta.macd(12, 26, 9) — macd, signal, histogram. */
export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): { macd: number[]; signal: number[]; hist: number[] } {
  const emaFast = ema(closes, fast)
  const emaSlow = ema(closes, slow)
  const macdLine = closes.map((_, i) =>
    Number.isFinite(emaFast[i]) && Number.isFinite(emaSlow[i]) ? emaFast[i] - emaSlow[i] : NaN
  )
  const valid = macdLine.filter((v) => Number.isFinite(v))
  const signalValid = ema(valid, signalPeriod)
  const signal: number[] = new Array(closes.length).fill(NaN)
  let vi = 0
  for (let i = 0; i < closes.length; i++) {
    if (Number.isFinite(macdLine[i])) {
      signal[i] = signalValid[vi]
      vi++
    }
  }
  const hist = macdLine.map((v, i) =>
    Number.isFinite(v) && Number.isFinite(signal[i]) ? v - signal[i] : NaN
  )
  return { macd: macdLine, signal, hist }
}

/* ============================================================
   KONDISI STRATEGI (ala alert Pine Script)
   ============================================================ */

export type StrategyCondType =
  | 'RSI_ABOVE'
  | 'RSI_BELOW'
  | 'EMA_CROSS_UP'
  | 'EMA_CROSS_DOWN'
  | 'PRICE_X_EMA_ABOVE'
  | 'PRICE_X_EMA_BELOW'
  | 'MACD_CROSS_UP'
  | 'MACD_CROSS_DOWN'

export const STRATEGY_COND_TYPES: StrategyCondType[] = [
  'RSI_ABOVE', 'RSI_BELOW',
  'EMA_CROSS_UP', 'EMA_CROSS_DOWN',
  'PRICE_X_EMA_ABOVE', 'PRICE_X_EMA_BELOW',
  'MACD_CROSS_UP', 'MACD_CROSS_DOWN',
]

export function isStrategyCondType(v: unknown): v is StrategyCondType {
  return typeof v === 'string' && STRATEGY_COND_TYPES.includes(v as StrategyCondType)
}

export interface StrategyAlertParams {
  condType: StrategyCondType
  rsiPeriod?: number | null
  rsiLevel?: number | null
  emaFast?: number | null
  emaSlow?: number | null
}

export interface EvalBar {
  time: number // epoch detik
  close: number
  high?: number
  low?: number
}

export interface StrategyEvalResult {
  hit: boolean
  /** Keterangan nilai indikator untuk isi notifikasi */
  detail: string
  /** epoch detik bar evaluasi (dedupe 1 push per bar) */
  barTime: number
}

const DEFAULT_RSI_PERIOD = 14
const DEFAULT_EMA_FAST = 9
const DEFAULT_EMA_SLOW = 21

function crossUp(a: number[], b: number[]): boolean {
  const n = a.length
  if (n < 2) return false
  return a[n - 2] <= b[n - 2] && a[n - 1] > b[n - 1]
}
function crossDown(a: number[], b: number[]): boolean {
  const n = a.length
  if (n < 2) return false
  return a[n - 2] >= b[n - 2] && a[n - 1] < b[n - 1]
}

/**
 * Evaluasi SATU kondisi strategi atas candle (candle terakhir = bar
 * evaluasi, sama seperti alert "Once Per Bar" Pine). Closes harus
 * cukup dalam (≥ max(emaSlow, rsiPeriod) + 30 bar) supaya EMA/RSI
 * konvergen — bila kurang, kondisi dianggap tidak kena (bukan error).
 */
export function evaluateStrategy(
  params: StrategyAlertParams,
  bars: EvalBar[],
): StrategyEvalResult {
  const last = bars[bars.length - 1]
  const barTime = Number.isFinite(last?.time) ? last.time : Math.floor(Date.now() / 1000)
  const misses = (why: string): StrategyEvalResult => ({ hit: false, detail: why, barTime })
  if (!bars || bars.length < 40) return misses('candle belum cukup untuk hitung indikator')

  const closes = bars.map((b) => b.close)
  if (!closes.every((c) => Number.isFinite(c) && c > 0)) return misses('candle tidak valid')

  const { condType } = params

  if (condType === 'RSI_ABOVE' || condType === 'RSI_BELOW') {
    const period = Math.min(Math.max(params.rsiPeriod || DEFAULT_RSI_PERIOD, 2), 50)
    const level = Number(params.rsiLevel)
    if (!Number.isFinite(level)) return misses('level RSI tidak valid')
    if (closes.length < period + 5) return misses(`candle < ${period + 5} — RSI belum sah`)
    const series = rsi(closes, period)
    const cur = series[series.length - 1]
    if (!Number.isFinite(cur)) return misses('RSI belum terbentuk')
    const hit = condType === 'RSI_ABOVE' ? cur > level : cur < level
    return {
      hit,
      detail: `RSI${period} ${cur.toFixed(1)} (${condType === 'RSI_ABOVE' ? '>' : '<'} ${level})`,
      barTime,
    }
  }

  if (condType === 'EMA_CROSS_UP' || condType === 'EMA_CROSS_DOWN') {
    const fast = Math.min(Math.max(params.emaFast || DEFAULT_EMA_FAST, 2), 100)
    const slow = Math.min(Math.max(params.emaSlow || DEFAULT_EMA_SLOW, fast + 1), 200)
    if (closes.length < slow + 10) return misses(`candle < ${slow + 10} — EMA${slow} belum konvergen`)
    const ef = ema(closes, fast)
    const es = ema(closes, slow)
    const hit = condType === 'EMA_CROSS_UP' ? crossUp(ef, es) : crossDown(ef, es)
    return {
      hit,
      detail: `EMA${fast} ${condType === 'EMA_CROSS_UP' ? 'cross↑' : 'cross↓'} EMA${slow}`,
      barTime,
    }
  }

  if (condType === 'PRICE_X_EMA_ABOVE' || condType === 'PRICE_X_EMA_BELOW') {
    const slow = Math.min(Math.max(params.emaSlow || DEFAULT_EMA_SLOW, 2), 200)
    if (closes.length < slow + 10) return misses(`candle < ${slow + 10} — EMA${slow} belum konvergen`)
    const es = ema(closes, slow)
    const n = closes.length
    const cPrev = closes[n - 2]
    const cLast = closes[n - 1]
    const ePrev = es[n - 2]
    const eLast = es[n - 1]
    if (![cPrev, cLast, ePrev, eLast].every(Number.isFinite)) return misses('EMA belum terbentuk')
    const hit =
      condType === 'PRICE_X_EMA_ABOVE'
        ? cPrev <= ePrev && cLast > eLast
        : cPrev >= ePrev && cLast < eLast
    return {
      hit,
      detail: `Close ${cLast.toFixed(2)} ${condType === 'PRICE_X_EMA_ABOVE' ? 'cross↑' : 'cross↓'} EMA${slow} ${eLast.toFixed(2)}`,
      barTime,
    }
  }

  // MACD_CROSS_UP / MACD_CROSS_DOWN — default Pine 12, 26, 9
  if (closes.length < 60) return misses('candle < 60 — MACD belum konvergen')
  const m = macd(closes)
  const hit = condType === 'MACD_CROSS_UP' ? crossUp(m.macd, m.signal) : crossDown(m.macd, m.signal)
  const cur = m.macd[m.macd.length - 1]
  return {
    hit,
    detail: `MACD(12,26,9) ${condType === 'MACD_CROSS_UP' ? 'cross↑ signal' : 'cross↓ signal'} (${Number.isFinite(cur) ? cur.toFixed(3) : '-'})`,
    barTime,
  }
}

/** Label Indonesia utk notifikasi & UI */
export function condLabel(cond: StrategyAlertParams): string {
  switch (cond.condType) {
    case 'RSI_ABOVE':
      return `RSI${cond.rsiPeriod || 14} naik di atas ${cond.rsiLevel}`
    case 'RSI_BELOW':
      return `RSI${cond.rsiPeriod || 14} turun di bawah ${cond.rsiLevel}`
    case 'EMA_CROSS_UP':
      return `EMA${cond.emaFast || 9} cross NAIK EMA${cond.emaSlow || 21}`
    case 'EMA_CROSS_DOWN':
      return `EMA${cond.emaFast || 9} cross TURUN EMA${cond.emaSlow || 21}`
    case 'PRICE_X_EMA_ABOVE':
      return `Harga cross NAIK EMA${cond.emaSlow || 21}`
    case 'PRICE_X_EMA_BELOW':
      return `Harga cross TURUN EMA${cond.emaSlow || 21}`
    case 'MACD_CROSS_UP':
      return 'MACD cross NAIK signal'
    case 'MACD_CROSS_DOWN':
      return 'MACD cross TURUN signal'
  }
}
