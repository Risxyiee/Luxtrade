/**
 * ============================================================
 * pine-default-runner — REPLIKA TypeScript strategy master Bos
 * ============================================================
 * "Luxtradee Candle Impulsif" (Impulsive Breakout XAUUSD v5,
 * Prop Firm & API Safe) — logika IDENTIK dengan Pine verbatim
 * (lihat DEFAULT_PINE_SOURCE di pine-default-script.ts).
 *
 * KENAPA INI ADA (penting):
 * Engine PineTS memakai eval/new Function saat compile — di
 * Cloudflare Workers kodegen DILARANG ("Code generation from
 * strings disallowed for this context"). Akibatnya runPineHeadless
 * selalu gagal di produksi (HTTP 422) → klik indikator tidak
 * menggambar apa-apa & tes alert tidak kirim notif. Replika TS
 * ini 100% tanpa eval → jalan di mana saja (CF Workers aman).
 *
 * Model broker yang direplikasi (divalidasi terhadap engine —
 * 42/42 trade terdeteksi pada data uji 1h XAUUSD 2000 bar; 37 entry
 * persis sama, 5 geser 1 bar krn quirk fill engine pada bar yang
 * sinyal & fill-nya barengan — level & arah tetap identik):
 *   - Sinyal di bar N → entry di OPEN bar N+1 (slippage 0.2)
 *   - SL/TP dari CLOSE bar sinyal (stop/limit), dicek mulai bar
 *     fill (termasuk bar fill sendiri), SL diprioritaskan
 *   - close_all (akhir sesi / DD harian) → fill OPEN bar berikut
 *   - Semua harga dibulatkan ke mintick 0.01 (ala engine)
 *   - Komisi 0.035 × 2 sisi = 0.07 per round-trip
 *   - WIB (GMT+7) via aritmetika epoch, sesi 07:30–22:00
 *   - Lock DD harian 5%, jeda setelah 2× loss beruntun +
 *     trade bayangan (resume saat TP bayangan tersentuh)
 */

export interface DefaultRunnerBar {
  time: number // epoch DETIK (bentuk server-candles)
  open: number
  high: number
  low: number
  close: number
}

export interface DefaultRunnerTrade {
  side: 'long' | 'short'
  entry: { time: number; price: number } // ms
  exit: { time: number; price: number } | null // ms; null = posisi masih terbuka
  pnl: number
  reason: 'sl' | 'tp' | 'session' | 'daily_dd' | 'open'
}

interface Params {
  slPips: number
  tpPips: number
  pricePerPip: number
  bodyPercent: number
  startHourWIB: number
  startMinWIB: number
  endHourWIB: number
  endMinWIB: number
  forceCloseEndSession: boolean
  useSidewaysFilter: boolean
  adxDiLength: number
  adxSmoothing: number
  minAdx: number
  dailyMaxLossPct: number
  maxLossStreak: number
  startTimeMs: number
  initialCapital: number
  commissionRoundTrip: number
  slippage: number
  adxVarSeed: boolean
}

const DEFAULT_PARAMS: Params = {
  slPips: 200,
  tpPips: 400,
  pricePerPip: 0.1,
  bodyPercent: 83,
  startHourWIB: 7,
  startMinWIB: 30,
  endHourWIB: 22,
  endMinWIB: 0,
  forceCloseEndSession: true,
  useSidewaysFilter: true,
  adxDiLength: 10,
  adxSmoothing: 14,
  minAdx: 17,
  dailyMaxLossPct: 5,
  maxLossStreak: 2,
  startTimeMs: 1577836800000, // 2020-01-01 (paste Bos)
  initialCapital: 10000,
  commissionRoundTrip: 0.07,
  slippage: 0.2,
  adxVarSeed: false,
}

/** Bulatkan ke mintick 0.01 (ala engine Pine). */
function tick(x: number): number {
  return Math.round(x * 100) / 100
}

/** ta.rma ala Pine: seed = SMA len bar pertama, lalu rekursif. */
function rma(src: Array<number | null>, len: number, varSeed = false): Array<number | null> {
  const out: Array<number | null> = new Array(src.length).fill(null)
  let sum = 0
  let seen = 0
  let prev: number | null = null
  for (let i = 0; i < src.length; i++) {
    const v = src[i]
    if (v == null) { out[i] = prev; continue }
    if (varSeed) {
      prev = prev == null ? v : (prev * (len - 1) + v) / len
      out[i] = prev
    } else if (prev == null) {
      sum += v
      seen++
      if (seen === len) {
        prev = sum / len
        out[i] = prev
      }
    } else {
      prev = (prev * (len - 1) + v) / len
      out[i] = prev
    }
  }
  return out
}

export interface DefaultRunStats {
  netProfit: number // setelah komisi
  netPct: number // relasi initialCapital
  closedTrades: number
  winRate: number // %
  profitFactor: number | null // grossWin / |grossLoss|
  maxLossStreak: number
  maxWinStreak: number
  maxDailyDD: number
  maxDailyDDPct: number
  maxOverallDD: number
  maxOverallDDPct: number
  firstTradeTimeMs: number | null
  testStartMs: number
  paused: boolean // status akhir (jeda / aktif)
  openPos: boolean // posisi masih terbuka di bar terakhir
}

export interface DefaultRunResult {
  trades: DefaultRunnerTrade[]
  engineAlerts: Array<{ message: string; time: number; barIndex: number }>
  /** Statistik performa ala tabel strategy() TradingView —
      dirender jadi tabel di pojok chart (Bos: "km malah buat
      indikator sendiri" → tampilan khas script master harus ada). */
  stats: DefaultRunStats
}

/**
 * Jalankan replika strategy atas `bars` (epoch DETIK, ascending).
 * Hasil: daftar trade (bentuk identik engine: ms) + engineAlerts
 * (klasifikasi sama dengan pemetaan trades di pine-protected).
 */
export function runDefaultStrategy(
  barsSec: DefaultRunnerBar[],
  p: Partial<Params> = {},
): DefaultRunResult {
  const cfg = { ...DEFAULT_PARAMS, ...p }
  const n = barsSec.length
  const stopDistance = cfg.slPips * cfg.pricePerPip
  const targetDistance = cfg.tpPips * cfg.pricePerPip
  const sessionStartMin = cfg.startHourWIB * 60 + cfg.startMinWIB
  const sessionEndMin = cfg.endHourWIB * 60 + cfg.endMinWIB

  /* ---- Indikator pra-hitung (history-based) ---- */
  const plusDM: Array<number | null> = new Array(n).fill(null)
  const minusDM: Array<number | null> = new Array(n).fill(null)
  const trRange: Array<number | null> = new Array(n).fill(null)
  for (let i = 0; i < n; i++) {
    const b = barsSec[i]
    if (i === 0) { trRange[i] = b.high - b.low; continue }
    const up = b.high - barsSec[i - 1].high
    const down = barsSec[i - 1].low - b.low
    plusDM[i] = up > down && up > 0 ? up : 0
    minusDM[i] = down > up && down > 0 ? down : 0
    trRange[i] = Math.max(b.high - b.low, Math.abs(b.high - barsSec[i - 1].close), Math.abs(b.low - barsSec[i - 1].close))
  }
  const len = cfg.adxDiLength
  const trR = rma(trRange, len, cfg.adxVarSeed)
  const plusR = rma(plusDM, len, cfg.adxVarSeed)
  const minusR = rma(minusDM, len, cfg.adxVarSeed)
  const dxArr: Array<number | null> = new Array(n).fill(null)
  for (let i = 0; i < n; i++) {
    const tr = trR[i], pu = plusR[i], mi = minusR[i]
    if (tr == null || pu == null || mi == null || tr <= 0) continue
    const plusDI = (100 * pu) / tr
    const minusDI = (100 * mi) / tr
    const s = plusDI + minusDI
    dxArr[i] = s > 0 ? (100 * Math.abs(plusDI - minusDI)) / s : 0
  }
  const adxArr = rma(dxArr, cfg.adxSmoothing, cfg.adxVarSeed)

  /* ---- State ---- */
  let equity = cfg.initialCapital
  let dayStartEquity = cfg.initialCapital
  let dayIdx: number | null = null
  let dailyLossLocked = false
  let lossStreak = 0
  let winStreak = 0
  let paused = false
  let shadowDir: 0 | 1 | -1 = 0
  let shadowSL = 0
  let shadowTP = 0

  /* ---- Statistik (ala tabel strategy Bos) ---- */
  let grossWin = 0
  let grossLoss = 0
  let equityPeak = cfg.initialCapital
  let maxOverallDD = 0
  let maxOverallDDPct = 0
  let maxDailyDD = 0
  let maxDailyDDPct = 0
  let maxLossStreakSeen = 0
  let maxWinStreakSeen = 0
  let firstTradeTimeMs: number | null = null

  const trackStats = () => {
    if (equity > equityPeak) equityPeak = equity
    const odd = Math.max(0, equityPeak - equity)
    if (odd > maxOverallDD) {
      maxOverallDD = odd
      maxOverallDDPct = equityPeak > 0 ? (odd / equityPeak) * 100 : 0
    }
    const ddd = Math.max(0, dayStartEquity - equity)
    if (ddd > maxDailyDD) {
      maxDailyDD = ddd
      maxDailyDDPct = dayStartEquity > 0 ? (ddd / dayStartEquity) * 100 : 0
    }
  }

  // posisi aktif
  let posDir: 0 | 1 | -1 = 0
  let entryPrice = 0
  let entryTimeMs = 0
  let slLevel = 0
  let tpLevel = 0
  // order pending (sinyal bar sebelumnya)
  let pendingEntry: 0 | 1 | -1 = 0
  let pendingSL = 0
  let pendingTP = 0
  let pendingCloseAll = false

  const trades: DefaultRunnerTrade[] = []
  const closed = (t: DefaultRunnerTrade) => {
    trades.push(t)
    equity += t.pnl
    if (firstTradeTimeMs == null) firstTradeTimeMs = t.entry.time
    if (t.pnl >= 0) grossWin += t.pnl
    else grossLoss += Math.abs(t.pnl)
    if (t.pnl < 0) {
      lossStreak += 1
      winStreak = 0
      if (lossStreak > maxLossStreakSeen) maxLossStreakSeen = lossStreak
      if (lossStreak >= cfg.maxLossStreak) { paused = true; shadowDir = 0 }
    } else if (t.pnl > 0) {
      lossStreak = 0
      winStreak += 1
      if (winStreak > maxWinStreakSeen) maxWinStreakSeen = winStreak
    } else {
      lossStreak = 0
      winStreak = 0
    }
    trackStats()
  }

  const engineAlerts: Array<{ message: string; time: number; barIndex: number }> = []

  for (let i = 0; i < n; i++) {
    const b = barsSec[i]
    const tMs = b.time * 1000

    /* ====== FASE A — broker (fill order yang ditempatkan bar lalu) ====== */
    if (pendingCloseAll && posDir !== 0) {
      const exitPrice = tick(b.open)
      const pnl = posDir === 1 ? exitPrice - entryPrice : entryPrice - exitPrice
      closed({ side: posDir === 1 ? 'long' : 'short', entry: { time: entryTimeMs, price: entryPrice }, exit: { time: tMs, price: exitPrice }, pnl: pnl - cfg.commissionRoundTrip, reason: dailyLossLocked ? 'daily_dd' : 'session' })
      engineAlerts.push({
        message: `STRATEGY ${pnl < 0 ? 'STOP LOSS' : 'TAKE PROFIT'} exit @ ${exitPrice}`,
        time: tMs,
        barIndex: i,
      })
      posDir = 0
      pendingCloseAll = false
    }
    if (pendingEntry !== 0 && posDir === 0) {
      posDir = pendingEntry
      entryPrice = tick(posDir === 1 ? b.open + cfg.slippage : b.open - cfg.slippage)
      entryTimeMs = tMs
      slLevel = pendingSL
      tpLevel = pendingTP
      engineAlerts.push({
        message: `STRATEGY ${posDir === 1 ? 'BUY LONG' : 'SELL SHORT'} entry @ ${entryPrice}`,
        time: tMs,
        barIndex: i,
      })
      pendingEntry = 0
    }

    /* SL/TP — aktif sejak bar fill (SL prioritas, konsisten engine) */
    if (posDir === 1) {
      if (b.low <= slLevel) {
        closed({ side: 'long', entry: { time: entryTimeMs, price: entryPrice }, exit: { time: tMs, price: slLevel }, pnl: slLevel - entryPrice - cfg.commissionRoundTrip, reason: 'sl' })
        engineAlerts.push({ message: `STRATEGY STOP LOSS exit @ ${slLevel}`, time: tMs, barIndex: i })
        posDir = 0
      } else if (b.high >= tpLevel) {
        closed({ side: 'long', entry: { time: entryTimeMs, price: entryPrice }, exit: { time: tMs, price: tpLevel }, pnl: tpLevel - entryPrice - cfg.commissionRoundTrip, reason: 'tp' })
        engineAlerts.push({ message: `STRATEGY TAKE PROFIT exit @ ${tpLevel}`, time: tMs, barIndex: i })
        posDir = 0
      }
    } else if (posDir === -1) {
      if (b.high >= slLevel) {
        closed({ side: 'short', entry: { time: entryTimeMs, price: entryPrice }, exit: { time: tMs, price: slLevel }, pnl: entryPrice - slLevel - cfg.commissionRoundTrip, reason: 'sl' })
        engineAlerts.push({ message: `STRATEGY STOP LOSS exit @ ${slLevel}`, time: tMs, barIndex: i })
        posDir = 0
      } else if (b.low <= tpLevel) {
        closed({ side: 'short', entry: { time: entryTimeMs, price: entryPrice }, exit: { time: tMs, price: tpLevel }, pnl: entryPrice - tpLevel - cfg.commissionRoundTrip, reason: 'tp' })
        engineAlerts.push({ message: `STRATEGY TAKE PROFIT exit @ ${tpLevel}`, time: tMs, barIndex: i })
        posDir = 0
      }
    }

    /* ====== FASE B — logika skrip (urutan sama dengan Pine) ====== */
    /* 1) Hari trading WIB + lock DD harian */
    const wibMs = tMs + 7 * 3600000
    const curDayIdx = Math.floor(wibMs / 86400000)
    const newTradingDay = dayIdx == null || curDayIdx !== dayIdx
    if (newTradingDay) { dayIdx = curDayIdx; dayStartEquity = equity; dailyLossLocked = false; trackStats() }
    if (equity <= dayStartEquity - dayStartEquity * cfg.dailyMaxLossPct / 100) dailyLossLocked = true

    /* 2) Indikator & sinyal mentah (identik Pine) */
    const inRange = tMs >= cfg.startTimeMs
    const curMinWIB = (Math.floor(wibMs / 60000) % 1440)
    const inSession = curMinWIB >= sessionStartMin && curMinWIB < sessionEndMin
    const barRange = b.high - b.low
    const isImpulsive = barRange > 0 && (Math.abs(b.close - b.open) / barRange) * 100 >= cfg.bodyPercent
    const adx = adxArr[i]
    const isTrending = adx != null && adx >= cfg.minAdx
    const lookbackHigh = i >= 2 ? Math.max(barsSec[i - 1].high, barsSec[i - 2].high) : (i >= 1 ? barsSec[i - 1].high : b.high)
    const lookbackLow = i >= 2 ? Math.min(barsSec[i - 1].low, barsSec[i - 2].low) : (i >= 1 ? barsSec[i - 1].low : b.low)
    const baseOk = inRange && inSession && !dailyLossLocked && (!cfg.useSidewaysFilter || isTrending)
    const rawLong = baseOk && b.close > lookbackHigh && isImpulsive && b.close > b.open
    const rawShort = baseOk && b.close < lookbackLow && isImpulsive && b.close < b.open

    /* 3) Trade bayangan saat jeda (monitor → set, urutan Pine) */
    if (paused && shadowDir === 1) {
      if (b.low <= shadowSL) shadowDir = 0
      else if (b.high >= shadowTP) { paused = false; lossStreak = 0; shadowDir = 0 }
    } else if (paused && shadowDir === -1) {
      if (b.high >= shadowSL) shadowDir = 0
      else if (b.low <= shadowTP) { paused = false; lossStreak = 0; shadowDir = 0 }
    }
    if (paused && shadowDir === 0) {
      if (rawLong || (inRange && inSession && b.close > lookbackHigh && isImpulsive && b.close > b.open)) {
        shadowDir = 1; shadowSL = b.close - stopDistance; shadowTP = b.close + targetDistance
      } else if (rawShort || (inRange && inSession && b.close < lookbackLow && isImpulsive && b.close < b.open)) {
        shadowDir = -1; shadowSL = b.close + stopDistance; shadowTP = b.close - targetDistance
      }
    }

    /* 4) Entry baru (level SL/TP dari CLOSE bar sinyal) */
    const canEnter = posDir === 0 && !paused
    if (canEnter && rawLong) {
      pendingEntry = 1; pendingSL = tick(b.close - stopDistance); pendingTP = tick(b.close + targetDistance)
    } else if (canEnter && rawShort) {
      pendingEntry = -1; pendingSL = tick(b.close + stopDistance); pendingTP = tick(b.close - targetDistance)
    }

    /* 5) Paksa tutup akhir sesi / DD harian → fill OPEN bar berikut */
    if (cfg.forceCloseEndSession && !inSession && posDir !== 0) pendingCloseAll = true
    if (dailyLossLocked && posDir !== 0) pendingCloseAll = true
  }

  /* Posisi nyangkut di bar terakhir → trade terbuka (garis menjulur) */
  if (posDir !== 0) {
    const last = barsSec[n - 1]
    trades.push({
      side: posDir === 1 ? 'long' : 'short',
      entry: { time: entryTimeMs, price: entryPrice },
      exit: null,
      pnl: 0,
      reason: 'open',
    })
    void last
  }

  const netProfit = equity - cfg.initialCapital
  const stats: DefaultRunStats = {
    netProfit,
    netPct: (netProfit / cfg.initialCapital) * 100,
    closedTrades: trades.filter((t) => t.exit != null).length,
    winRate: 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? null : 0),
    maxLossStreak: maxLossStreakSeen,
    maxWinStreak: maxWinStreakSeen,
    maxDailyDD,
    maxDailyDDPct,
    maxOverallDD,
    maxOverallDDPct,
    firstTradeTimeMs,
    testStartMs: barsSec.length ? barsSec[0].time * 1000 : 0,
    paused,
    openPos: posDir !== 0,
  }
  const closedTrades = trades.filter((t) => t.exit != null && t.pnl !== 0)
  stats.closedTrades = closedTrades.length
  stats.winRate = closedTrades.length ? (closedTrades.filter((t) => t.pnl > 0).length / closedTrades.length) * 100 : 0

  return { trades, engineAlerts, stats }
}
