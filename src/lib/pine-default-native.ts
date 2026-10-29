/**
 * ============================================================
 * pine-default-native — Runner NATIVE TypeScript untuk skrip
 * default "Luxtradee Candle Impulsif" (SERVER ONLY)
 * ============================================================
 * KENAPA ADA FILE INI (penemuan production, Screenshot 2025):
 *   Engine PineTS meng-compile Pine → JS via new Function() —
 *   Cloudflare Workers MEMBLOKIR code generation from strings
 *   ("Code generation from strings disallowed for this context").
 *   Akibatnya jalur server (compile-pine POST + cron alert 5 menit
 *   + test alert) TIDAK PERNAH bisa menjalankan engine Pine di
 *   production — chart tampak kosong & Bos terpaksa "masukin pine"
 *   manual (engine jalan di browser-nya, bukan di server).
 *
 * SOLUSI: logika skrip master di-port ke TypeScript MURNI —
 * matematika identik per-bar dengan port Pine (pine-default-script)
 * dan strategy asli Bos v5 — TANPA eval/new Function → jalan di
 * Cloudflare Workers, Node, di mana saja. Source Pine asli tetap
 * tidak pernah dikirim ke browser.
 *
 * Logika (identik port Pine / strategy master v5):
 *   - Sesi WIB 07:30–22:00 (GMT+7 via aritmetika epoch)
 *   - Anti-fakeout body 83%, breakout 2-bar, ADX Wilder ≥ 17
 *   - SL 200 pip / TP 400 pip (1 pip = 0.1)
 *   - Force close 22:00 WIB, lock drawdown harian 5%
 *   - Pause setelah 2× loss beruntun + trade bayangan
 *   - 1 posisi pada satu waktu (pyramiding=0)
 */

import {
  DEFAULT_PINE_SLUG, DEFAULT_PINE_NAME,
} from './pine-default-meta'
import {
  runPineHeadless,
  type PineRunResult, type PlotSeries,
} from './pine-protected'

/* ---------- Konstanta input master (identik default Pine) ---------- */
const SL_PIPS = 200
const TP_PIPS = 400
const PRICE_PER_PIP = 0.1
const BODY_PERCENT = 83
const SESSION_START_MIN = 7 * 60 + 30 // 07:30 WIB
const SESSION_END_MIN = 22 * 60 // 22:00 WIB
const FORCE_CLOSE_SESSION = true
const USE_SIDEWAYS_FILTER = true
const ADX_DI_LENGTH = 10
const ADX_SMOOTHING = 14
const MIN_ADX = 17.0
const DAILY_MAX_LOSS_PCT = 5.0
const MAX_LOSS_STREAK = 2
const SIM_INITIAL_EQUITY = 10000.0

const WIB_OFFSET_MS = 7 * 3_600_000
const DAY_MS = 86_400_000

export interface NativeBar {
  time: number // epoch DETIK
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

/**
 * Jalankan skrip default secara native atas bars (epoch detik).
 * Output bentuknya sama persis dengan runPineHeadless — plots
 * (Entry/Stop Loss/Take Profit + state tersembunyi _LongState/
 * _ShortState) + engineAlerts (entry/exit) sehingga seluruh
 * jalur alert & chart memakai kode yang sama.
 */
export function runDefaultScriptNative(
  barsSec: NativeBar[],
): PineRunResult {
  if (!barsSec.length) return { ok: false, error: 'Tidak ada candle untuk dieksekusi' }

  const stopDistance = SL_PIPS * PRICE_PER_PIP
  const targetDistance = TP_PIPS * PRICE_PER_PIP
  const dailyLossLimitRatio = DAILY_MAX_LOSS_PCT / 100

  /* ---------- Plot arrays ---------- */
  const entryPts: Array<{ time: number; value: number | null }> = []
  const slPts: Array<{ time: number; value: number | null }> = []
  const tpPts: Array<{ time: number; value: number | null }> = []
  const longStatePts: Array<{ time: number; value: number }> = []
  const shortStatePts: Array<{ time: number; value: number }> = []
  const engineAlerts: Array<{ message: string; time: number; barIndex: number }> = []

  /* ---------- State (mirror var Pine) ---------- */
  let posDir = 0
  let entryP = NaN
  let slP = NaN
  let tpP = NaN
  let effLossStreak = 0
  let currentWinStreak = 0
  let paused = false
  let shadowDir = 0
  let shadowSL = NaN
  let shadowTP = NaN
  let simEquity = SIM_INITIAL_EQUITY
  let dayStartEquity = SIM_INITIAL_EQUITY
  let dailyLossLocked = false
  let lastEntryP = NaN
  let lastSlP = NaN
  let lastTpP = NaN
  let prevDayIdx: number | null = null

  /* ---------- ADX Wilder state ---------- */
  let trW: number | null = null
  let plusW: number | null = null
  let minusW: number | null = null
  let adxW: number | null = null

  const pushAlert = (message: string, timeMs: number, barIndex: number) => {
    engineAlerts.push({ message, time: timeMs, barIndex })
  }

  for (let i = 0; i < barsSec.length; i++) {
    const b = barsSec[i]
    const timeMs = b.time * 1000
    const wibMs = timeMs + WIB_OFFSET_MS

    /* --- Waktu WIB --- */
    const wibHour = Math.floor(wibMs / 3_600_000) % 24
    const wibMin = Math.floor(wibMs / 60_000) % 60
    const currentMinWIB = wibHour * 60 + wibMin
    const inSession = currentMinWIB >= SESSION_START_MIN && currentMinWIB < SESSION_END_MIN

    const dayIdx = Math.floor(wibMs / DAY_MS)
    const newTradingDay = prevDayIdx === null || dayIdx !== prevDayIdx
    prevDayIdx = dayIdx

    /* --- ADX Wilder manual (identik port Pine) --- */
    const prevClose = i > 0 ? barsSec[i - 1].close : NaN
    const upMove = i > 0 ? b.high - barsSec[i - 1].high : NaN
    const downMove = i > 0 ? barsSec[i - 1].low - b.low : NaN
    const plusDM = !Number.isFinite(upMove) || !Number.isFinite(downMove) ? 0
      : (upMove > downMove && upMove > 0 ? upMove : 0)
    const minusDM = !Number.isFinite(upMove) || !Number.isFinite(downMove) ? 0
      : (downMove > upMove && downMove > 0 ? downMove : 0)
    const trRange = !Number.isFinite(prevClose) ? b.high - b.low
      : Math.max(b.high - b.low, Math.max(Math.abs(b.high - prevClose), Math.abs(b.low - prevClose)))
    trW = trW === null ? trRange : (trW * (ADX_DI_LENGTH - 1) + trRange) / ADX_DI_LENGTH
    plusW = plusW === null ? plusDM : (plusW * (ADX_DI_LENGTH - 1) + plusDM) / ADX_DI_LENGTH
    minusW = minusW === null ? minusDM : (minusW * (ADX_DI_LENGTH - 1) + minusDM) / ADX_DI_LENGTH
    const plusDI = trW !== null && trW > 0 ? 100 * plusW / trW : 0
    const minusDI = trW !== null && trW > 0 ? 100 * minusW / trW : 0
    const dxSum = plusDI + minusDI
    const dx = dxSum > 0 ? 100 * Math.abs(plusDI - minusDI) / dxSum : 0
    adxW = adxW === null ? dx : (adxW * (ADX_SMOOTHING - 1) + dx) / ADX_SMOOTHING
    const isTrending = !USE_SIDEWAYS_FILTER || (adxW !== null && adxW >= MIN_ADX)

    /* --- Reset harian + lock drawdown --- */
    if (newTradingDay) {
      dayStartEquity = simEquity
      dailyLossLocked = false
    }
    if (simEquity <= dayStartEquity - dayStartEquity * dailyLossLimitRatio) {
      dailyLossLocked = true
    }

    let endedThisBar = false

    /* --- 1) Exit posisi aktif (SL prioritas bila dobel — konservatif) --- */
    const exitTrade = (exitPrice: number) => {
      const pnl = exitPrice - entryP
      simEquity += posDir === 1 ? pnl : -pnl // short: (entry - exit)
      const effPnl = posDir === 1 ? pnl : -pnl
      if (effPnl < 0) {
        effLossStreak += 1
        currentWinStreak = 0
        if (effLossStreak >= MAX_LOSS_STREAK) { paused = true; shadowDir = 0 }
      } else if (effPnl > 0) {
        currentWinStreak += 1
        effLossStreak = 0
      } else {
        effLossStreak = 0
        currentWinStreak = 0
      }
      pushAlert(
        `STRATEGY ${effPnl < 0 ? 'STOP LOSS' : 'TAKE PROFIT'} exit @ ${round2(exitPrice)}`,
        timeMs, i,
      )
      endedThisBar = true
      posDir = 0
    }

    if (posDir === 1) {
      if (b.low <= slP) exitTrade(slP)
      else if (b.high >= tpP) exitTrade(tpP)
    } else if (posDir === -1) {
      if (b.high >= slP) exitTrade(slP)
      else if (b.low <= tpP) exitTrade(tpP)
    }

    /* --- 1b) Force close akhir sesi (22:00 WIB) --- */
    if (FORCE_CLOSE_SESSION && !inSession && posDir !== 0) {
      const exitPrice = b.close
      simEquity += posDir === 1 ? exitPrice - entryP : entryP - exitPrice
      const effPnl = posDir === 1 ? exitPrice - entryP : entryP - exitPrice
      if (effPnl < 0) {
        effLossStreak += 1
        currentWinStreak = 0
        if (effLossStreak >= MAX_LOSS_STREAK) { paused = true; shadowDir = 0 }
      } else if (effPnl > 0) {
        currentWinStreak += 1
        effLossStreak = 0
      }
      pushAlert(`STRATEGY ${effPnl < 0 ? 'STOP LOSS' : 'TAKE PROFIT'} exit @ ${round2(exitPrice)}`, timeMs, i)
      endedThisBar = true
      posDir = 0
    }

    /* --- 1c) Lock drawdown harian — tutup posisi --- */
    if (dailyLossLocked && posDir !== 0) {
      const exitPrice = b.close
      simEquity += posDir === 1 ? exitPrice - entryP : entryP - exitPrice
      const effPnl = posDir === 1 ? exitPrice - entryP : entryP - exitPrice
      if (effPnl < 0) {
        effLossStreak += 1
        currentWinStreak = 0
        if (effLossStreak >= MAX_LOSS_STREAK) { paused = true; shadowDir = 0 }
      } else if (effPnl > 0) {
        currentWinStreak += 1
        effLossStreak = 0
      }
      pushAlert(`STRATEGY ${effPnl < 0 ? 'STOP LOSS' : 'TAKE PROFIT'} exit @ ${round2(exitPrice)}`, timeMs, i)
      endedThisBar = true
      posDir = 0
    }

    /* --- 2) Pantau trade bayangan saat jeda --- */
    if (paused && shadowDir === 1) {
      if (b.low <= shadowSL) shadowDir = 0
      else if (b.high >= shadowTP) { paused = false; effLossStreak = 0; shadowDir = 0 }
    }
    if (paused && shadowDir === -1) {
      if (b.high >= shadowSL) shadowDir = 0
      else if (b.low <= shadowTP) { paused = false; effLossStreak = 0; shadowDir = 0 }
    }

    /* --- 3) Sinyal mentah (identik master v5) --- */
    const baseOk = inSession && !dailyLossLocked && (!USE_SIDEWAYS_FILTER || isTrending)
    const lookbackHigh = i >= 2 ? Math.max(barsSec[i - 1].high, barsSec[i - 2].high) : NaN
    const lookbackLow = i >= 2 ? Math.min(barsSec[i - 1].low, barsSec[i - 2].low) : NaN
    const barRange = b.high - b.low
    const isImpulsive = barRange > 0 && (Math.abs(b.close - b.open) / barRange) * 100 >= BODY_PERCENT
    const rawLong = i >= 2 && baseOk && b.close > lookbackHigh && isImpulsive && b.close > b.open
    const rawShort = i >= 2 && baseOk && b.close < lookbackLow && isImpulsive && b.close < b.open

    /* --- 4) Entry bayangan saat jeda (dipantau tanpa uang) --- */
    if (paused && shadowDir === 0 && posDir === 0) {
      if (inSession && i >= 2 && b.close > lookbackHigh && isImpulsive && b.close > b.open) {
        shadowDir = 1
        shadowSL = b.close - stopDistance
        shadowTP = b.close + targetDistance
      } else if (inSession && i >= 2 && b.close < lookbackLow && isImpulsive && b.close < b.open) {
        shadowDir = -1
        shadowSL = b.close + stopDistance
        shadowTP = b.close - targetDistance
      }
    }

    /* --- 5) Entry baru + alert --- */
    const canEnter = posDir === 0 && !paused
    const longSignal = canEnter && rawLong
    const shortSignal = canEnter && rawShort && !longSignal
    if (longSignal) {
      posDir = 1
      entryP = b.close
      slP = b.close - stopDistance
      tpP = b.close + targetDistance
      lastEntryP = entryP; lastSlP = slP; lastTpP = tpP
      pushAlert(`STRATEGY BUY LONG entry @ ${round2(b.close)}`, timeMs, i)
    }
    if (shortSignal) {
      posDir = -1
      entryP = b.close
      slP = b.close + stopDistance
      tpP = b.close - targetDistance
      lastEntryP = entryP; lastSlP = slP; lastTpP = tpP
      pushAlert(`STRATEGY SELL SHORT entry @ ${round2(b.close)}`, timeMs, i)
    }

    /* --- 6) PLOT — segmen Entry/SL/TP dari bar entry s.d. bar exit --- */
    const inTradeSeg = posDir !== 0 || endedThisBar
    entryPts.push({ time: timeMs, value: inTradeSeg ? lastEntryP : null })
    slPts.push({ time: timeMs, value: inTradeSeg ? lastSlP : null })
    tpPts.push({ time: timeMs, value: inTradeSeg ? lastTpP : null })
    longStatePts.push({ time: timeMs, value: posDir === 1 ? 1 : 0 })
    shortStatePts.push({ time: timeMs, value: posDir === -1 ? 1 : 0 })
  }

  const plots: PlotSeries[] = [
    { key: 'Entry', title: 'Entry', kind: 'line', color: '#22ab94', data: entryPts },
    { key: 'Stop Loss', title: 'Stop Loss', kind: 'line', color: '#ef5350', data: slPts },
    { key: 'Take Profit', title: 'Take Profit', kind: 'line', color: '#26c6da', data: tpPts },
    { key: '_LongState', title: '_LongState', kind: 'line', color: '#9e9e9e', data: longStatePts },
    { key: '_ShortState', title: '_ShortState', kind: 'line', color: '#9e9e9e', data: shortStatePts },
  ]

  return {
    ok: true,
    title: DEFAULT_PINE_NAME,
    overlay: true,
    plots,
    engineAlerts,
  }
}

function round2(x: number): string {
  return String(Math.round(x * 100) / 100)
}

/* ============================================================
   ROUTER RUNNER — skrip default → NATIVE (tanpa eval, jalan di
   Cloudflare Workers); skrip lain → engine PineTS (dev/Node).
   Dipakai compile-pine POST + pine-alert-runner (cron & test).
   ============================================================ */
export async function runProtectedScript(opts: {
  slug: string
  source: string
  symbol: string
  interval: string
  bars: NativeBar[]
}): Promise<PineRunResult> {
  if (String(opts.slug || '') === DEFAULT_PINE_SLUG) {
    return runDefaultScriptNative(opts.bars)
  }
  return runPineHeadless(opts.source, opts.symbol, opts.interval, opts.bars)
}
