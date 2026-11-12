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

/** RMA (Wilder) ala Pine ta.rma — seed SMA, alpha = 1/period. */
export function rma(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN)
  if (period < 1 || values.length < period) return out
  let sum = 0
  for (let i = 0; i < period; i++) sum += values[i]
  let prev = sum / period
  out[period - 1] = prev
  for (let i = period; i < values.length; i++) {
    prev = (values[i] * 1 + prev * (period - 1)) / period // alpha = 1/period
    out[i] = prev
  }
  return out
}

/**
 * DMI ala Pine ta.dmi(diLen, adxSmooth) — versi Wilder klasik.
 * Return series +DI, -DI, dan ADX (NaN sebelum konvergen).
 */
export function dmi(
  high: number[],
  low: number[],
  close: number[],
  diLen = 10,
  adxSmooth = 14,
): { diPlus: number[]; diMinus: number[]; adx: number[] } {
  const n = high.length
  const diPlus: number[] = new Array(n).fill(NaN)
  const diMinus: number[] = new Array(n).fill(NaN)
  const adx: number[] = new Array(n).fill(NaN)
  if (n < diLen + adxSmooth + 2) return { diPlus, diMinus, adx }

  const plusDM: number[] = [NaN]
  const minusDM: number[] = [NaN]
  const tr: number[] = [NaN]
  for (let i = 1; i < n; i++) {
    const upMove = high[i] - high[i - 1]
    const downMove = low[i - 1] - low[i]
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0)
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0)
    tr.push(Math.max(
      high[i] - low[i],
      Math.abs(high[i] - close[i - 1]),
      Math.abs(low[i] - close[i - 1]),
    ))
  }

  /* RMA mulai dari index 1 (index 0 NaN) — geser array agar rma() bekerja */
  const pDm = plusDM.slice(1)
  const mDm = minusDM.slice(1)
  const trS = tr.slice(1)
  const rPlus = rma(pDm, diLen)
  const rMinus = rma(mDm, diLen)
  const rTr = rma(trS, diLen)

  const dx: number[] = []
  const dxIdx: number[] = []
  for (let i = 0; i < pDm.length; i++) {
    const gi = i + 1 // index asli di array high/low
    if (!Number.isFinite(rPlus[i]) || !Number.isFinite(rMinus[i]) || !Number.isFinite(rTr[i])) continue
    const dp = rTr[i] === 0 ? 0 : (100 * rPlus[i]) / rTr[i]
    const dm = rTr[i] === 0 ? 0 : (100 * rMinus[i]) / rTr[i]
    diPlus[gi] = dp
    diMinus[gi] = dm
    const denom = dp + dm
    dx.push(denom === 0 ? 0 : (100 * Math.abs(dp - dm)) / denom)
    dxIdx.push(gi)
  }

  const adxVals = rma(dx, adxSmooth)
  for (let i = 0; i < dxIdx.length; i++) {
    if (Number.isFinite(adxVals[i])) adx[dxIdx[i]] = adxVals[i]
  }
  return { diPlus, diMinus, adx }
}

/**
 * Pivot high/low ala Pine ta.pivothigh/ta.pivotlow(high/low, len, len)
 * — konfirmasi len bar KANAN (non-repainting, sama seperti Pine).
 * Return harga pivot terakhir yang SUDAH terkonfirmasi, atau null.
 */
export function lastPivotHigh(
  high: number[],
  len: number,
): number | null {
  const n = high.length
  if (len < 1 || n < len * 2 + 1) return null
  for (let i = n - 1 - len; i >= len; i--) {
    const v = high[i]
    let ok = true
    for (let j = i - len; j <= i + len && ok; j++) {
      if (j === i) continue
      if (high[j] >= v) ok = false
    }
    if (ok) return v
  }
  return null
}

export function lastPivotLow(low: number[], len: number): number | null {
  const n = low.length
  if (len < 1 || n < len * 2 + 1) return null
  for (let i = n - 1 - len; i >= len; i--) {
    const v = low[i]
    let ok = true
    for (let j = i - len; j <= i + len && ok; j++) {
      if (j === i) continue
      if (low[j] <= v) ok = false
    }
    if (ok) return v
  }
  return null
}

/**
 * Apakah epoch detik bar jatuh di jendela sesi WIB ('HH:MM'–'HH:MM')?
 * Mengikuti Pine: time(timeframe.period, sessStr, "Asia/Jakarta") —
 * pakai JAM BAR, bukan jam sekarang, jadi aman utk candle historis.
 */
export function barInSessionWIB(
  barTimeSec: number,
  startHHMM: string,
  endHHMM: string,
): boolean {
  const parse = (s: string): number | null => {
    const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(s || '').trim())
    return m ? Number(m[1]) * 60 + Number(m[2]) : null
  }
  const start = parse(startHHMM)
  const end = parse(endHHMM)
  if (start === null || end === null) return true // sesi tidak valid = tanpa filter
  if (start >= end) return true // jendela lintas tengah malam tidak didukung = tanpa filter
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(barTimeSec * 1000))
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const mi = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  const cur = h * 60 + mi
  return cur >= start && cur < end
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
  | 'MOM_BRK_UP'
  | 'MOM_BRK_DN'

export const STRATEGY_COND_TYPES: StrategyCondType[] = [
  'RSI_ABOVE', 'RSI_BELOW',
  'EMA_CROSS_UP', 'EMA_CROSS_DOWN',
  'PRICE_X_EMA_ABOVE', 'PRICE_X_EMA_BELOW',
  'MACD_CROSS_UP', 'MACD_CROSS_DOWN',
  'MOM_BRK_UP', 'MOM_BRK_DN',
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
  /* Breakout momentum (candle konfluensi) */
  bodyMinPct?: number | null   // body minimal % dari range
  adxLen?: number | null       // panjang DI Wilder
  adxSmooth?: number | null    // smoothing ADX Wilder
  adxMin?: number | null       // ADX minimal
  fractalLen?: number | null   // panjang pivot fractal (0 = nonaktif)
  sessStart?: string | null    // 'HH:MM' WIB
  sessEnd?: string | null      // 'HH:MM' WIB
}

export interface EvalBar {
  time: number // epoch detik
  close: number
  open?: number
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

/**
 * Evaluasi MOM_BRK_UP / MOM_BRK_DN — breakout candle konfluensi:
 * candle searah (close>open utk naik) + body ≥ X% range + tembus
 * high/low 2 bar sebelumnya + ADX ≥ min + DI searah + tembus fractal
 * + di dalam sesi WIB. Terjemahan 1:1 strategi H1 milik Bos (nama
 * DINEUTRALKAN — jangan sebut nama strateginya di repo).
 */
export function evalMomentumBreakout(
  params: StrategyAlertParams,
  bars: EvalBar[],
  dir: 'up' | 'dn',
): StrategyEvalResult {
  const last = bars[bars.length - 1]
  const barTime = Number.isFinite(last?.time) ? last.time : Math.floor(Date.now() / 1000)
  const misses = (why: string): StrategyEvalResult => ({ hit: false, detail: why, barTime })

  if (!bars || bars.length < 60) return misses('candle < 60 — ADX/fractal belum sah')
  if (!bars.every((b) => Number.isFinite(b.open) && Number.isFinite(b.high) && Number.isFinite(b.low) && Number.isFinite(b.close)))
    return misses('candle OHLC tidak lengkap')

  const n = bars.length
  const o = bars.map((b) => b.open as number)
  const h = bars.map((b) => b.high as number)
  const l = bars.map((b) => b.low as number)
  const c = bars.map((b) => b.close)

  /* Filter sesi WIB (jam BAR, bukan jam server) */
  const sessStart = params.sessStart || ''
  const sessEnd = params.sessEnd || ''
  if ((sessStart || sessEnd) && !barInSessionWIB(barTime, sessStart, sessEnd))
    return misses('di luar sesi')

  /* ADX + DI (Wilder) */
  const diLen = Math.min(Math.max(params.adxLen || 10, 1), 50)
  const adxSmooth = Math.min(Math.max(params.adxSmooth || 14, 1), 50)
  const adxMin = Number.isFinite(Number(params.adxMin)) && Number(params.adxMin) > 0
    ? Number(params.adxMin) : 0 // 0 = tanpa filter ADX
  const { diPlus, diMinus, adx } = dmi(h, l, c, diLen, adxSmooth)
  const adxNow = adx[n - 1]
  if (!Number.isFinite(adxNow)) return misses('ADX belum terbentuk')
  if (adxMin > 0 && adxNow < adxMin) return misses(`ADX ${adxNow.toFixed(1)} < ${adxMin}`)

  /* DI searah */
  const dpNow = diPlus[n - 1]
  const dmNow = diMinus[n - 1]
  if (!Number.isFinite(dpNow) || !Number.isFinite(dmNow)) return misses('DI belum terbentuk')
  if (dir === 'up' && !(dpNow > dmNow)) return misses('DI+ ≤ DI-')
  if (dir === 'dn' && !(dmNow > dpNow)) return misses('DI- ≤ DI+')

  /* Body % dari range */
  const rng = h[n - 1] - l[n - 1]
  const bodyAbs = Math.abs(c[n - 1] - o[n - 1])
  const bodyPct = rng > 0 ? (bodyAbs / rng) * 100 : 0
  const bodyMin = Number.isFinite(Number(params.bodyMinPct)) && Number(params.bodyMinPct) > 0
    ? Math.min(Number(params.bodyMinPct), 100) : 0
  if (bodyPct < bodyMin) return misses(`body ${bodyPct.toFixed(0)}% < ${bodyMin}%`)

  /* Breakout high/low 2 bar sebelumnya */
  const brkUp = c[n - 1] > Math.max(h[n - 2], h[n - 3])
  const brkDn = c[n - 1] < Math.min(l[n - 2], l[n - 3])
  if (dir === 'up' && !brkUp) return misses('belum tembus high 2 bar')
  if (dir === 'dn' && !brkDn) return misses('belum tembus low 2 bar')

  /* Candle searah */
  if (dir === 'up' && !(c[n - 1] > o[n - 1])) return misses('candle tidak bullish')
  if (dir === 'dn' && !(c[n - 1] < o[n - 1])) return misses('candle tidak bearish')

  /* Fractal pivot (0 = nonaktif; pivot null = belum ada → lolos, sama dgn Pine) */
  const frLen = Math.min(Math.max(params.fractalLen || 0, 0), 10)
  let fractalTxt = ''
  if (frLen >= 1) {
    const ph = lastPivotHigh(h, frLen)
    const pl = lastPivotLow(l, frLen)
    if (dir === 'up') {
      if (ph !== null && !(c[n - 1] > ph)) return misses(`belum tembus fractal high ${ph.toFixed(2)}`)
      fractalTxt = ph !== null ? ` · frak ${ph.toFixed(2)}⤫` : ''
    } else {
      if (pl !== null && !(c[n - 1] < pl)) return misses(`belum tembus fractal low ${pl.toFixed(2)}`)
      fractalTxt = pl !== null ? ` · frak ${pl.toFixed(2)}⤫` : ''
    }
  }

  /* Level retest = open candle sinyal (pesan notifikasi) */
  const retest = o[n - 1]
  return {
    hit: true,
    detail: `body ${bodyPct.toFixed(0)}% · ADX ${adxNow.toFixed(1)}${fractalTxt} · retest open ${retest.toFixed(2)}`,
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
    case 'MOM_BRK_UP':
      return 'Breakout momentum NAIK (candle kuat + ADX)'
    case 'MOM_BRK_DN':
      return 'Breakout momentum TURUN (candle kuat + ADX)'
  }
}
