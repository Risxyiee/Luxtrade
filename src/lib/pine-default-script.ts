/**
 * ============================================================
 * pine-default-script — skrip Pine DEFAULT Luxtradee (SERVER ONLY)
 * ============================================================
 * PENTING: file ini memuat SOURCE Pine master milik Bos —
 * JANGAN PERNAH diimpor dari client component / dipakai di API
 * yang mengembalikan isi file ini ke browser.
 *
 * Tujuan:
 *  1. Source Pine "Luxtradee Candle Impulsif" — PORT indicator
 *     dari strategy master Bos "Impulsive Breakout XAUUSD v5
 *     (Prop Firm & API Safe)": logika sinyal IDENTIK (sesi WIB
 *     07.30–22.00, anti-fakeout body 83%, ADX anti-sideways,
 *     breakout 2-bar, SL/TP dari pip, paksa tutup saat sesi
 *     berakhir, lock drawdown harian, jeda rentetan kalah +
 *     trade bayangan), format kompatibel engine headless
 *     (menghasilkan plot + alert()).
 *  2. ensureDefaultScript() — auto-seed ke tabel protected_scripts
 *     (upsert by slug) SEHINGGA BOS TIDAK PERLU SQL MANUAL.
 *     Dipanggil route compile-pine (GET/POST) & daftar alert.
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import {
  DEFAULT_PINE_SLUG,
  DEFAULT_PINE_NAME,
  DEFAULT_PINE_DESCRIPTION,
} from './pine-default-meta'

export { DEFAULT_PINE_SLUG, DEFAULT_PINE_NAME, DEFAULT_PINE_DESCRIPTION }

/* ============================================================
   SOURCE PINE — port indicator dari strategy master Bos v5.
   Perbedaan dari strategy asli (SENGAJA, agar jalan headless):
   - indicator() bukan strategy() → tidak butuh akun simulasi
   - posisi & ekuitah disimulasikan dengan var (identik: 1
     posisi, SL prioritas bila dobel, force close 22:00 WIB,
     lock DD harian 5%, jeda rentetan kalah + trade bayangan)
   - ADX dihitung manual (Wilder) — setara ta.dmi
   - sesi WIB via aritmetika epoch (setara hour(time,"GMT+7"))
   - SEGMENT HISTORIS: Entry/SL/TP digambar dari bar entry
     sampai bar exit tiap trade (setara line.new + label di
     strategy asli) — bukan hanya saat posisi terbuka. Karena
     pyramiding=0, trade TIDAK pernah tumpang tindih sehingga
     satu series per level cukup (jeda antar segmen = na).
   - alert() per entry → sinyal Telegram (server hanya terima
     bar TERAKHIR — anti spam historis)
   ============================================================ */
export const DEFAULT_PINE_SOURCE = `//@version=6
indicator("Luxtradee Candle Impulsif", overlay=true)

// ============================================================
// LUXTRADEE MASTER — Luxtradee Candle Impulsif
// Port indicator dari strategy master Bos v5 (Prop Firm & API
// Safe): sesi WIB 07.30–22.00, anti-fakeout body 83%, ADX,
// breakout 2-bar, SL/TP pip, force close 22:00, lock DD harian,
// jeda rentetan kalah + trade bayangan. Sinyal alert() -> Telegram.
// ============================================================

// --- Inputs (identik strategy master v5) ---
slPipsInput = input.int(200, "Stop Loss (Pips)", minval=1)
tpPipsInput = input.int(400, "Target Profit (Pips)", minval=1)
pricePerPipInput = input.float(0.1, "Nilai 1 pip dalam harga", minval=0.000001, step=0.1)
bodyPercentInput = input.int(83, "Min Body % (Anti-Fakeout)", minval=1, maxval=100)
startHourWIB = input.int(7, "Jam Mulai (WIB)", minval=0, maxval=23)
startMinWIB = input.int(30, "Menit Mulai (WIB)", minval=0, maxval=59)
endHourWIB = input.int(22, "Jam Selesai (WIB)", minval=0, maxval=23)
endMinWIB = input.int(0, "Menit Selesai (WIB)", minval=0, maxval=59)
forceCloseEndSession = input.bool(true, "Paksa Tutup Posisi Saat Sesi Berakhir (22:00 WIB)")
useSidewaysFilterInput = input.bool(true, "Hindari Market Sideways")
adxDiLengthInput = input.int(10, "ADX DI Length", minval=1)
adxSmoothingInput = input.int(14, "ADX Smoothing", minval=1)
minAdxInput = input.float(17.0, "ADX Minimum", minval=1.0, step=0.5)
dailyMaxLossPctInput = input.float(5.0, "Batas Drawdown Harian (%)", minval=0.1, maxval=100.0, step=0.1)
maxLossStreakInput = input.int(2, "Batas Loss Beruntun (Max Loss Streak)", minval=1)

// --- Waktu WIB (GMT+7) via aritmetika epoch (setara hour/minute(time,"GMT+7")) ---
wibMs = time + 7 * 3600000
wibHour = int(math.floor(wibMs / 3600000.0)) % 24
wibMin = int(math.floor(wibMs / 60000.0)) % 60
currentMinWIB = wibHour * 60 + wibMin
sessionStartMin = startHourWIB * 60 + startMinWIB
sessionEndMin = endHourWIB * 60 + endMinWIB
inSession = currentMinWIB >= sessionStartMin and currentMinWIB < sessionEndMin

// --- Hari trading WIB (setara time("D","0000-2359","GMT+7")) — reset ekuitas harian ---
dayIdx = int(math.floor(wibMs / 86400000.0))
newTradingDay = na(dayIdx[1]) or dayIdx != dayIdx[1]

// --- Konversi pip (harga absolut — API Safe) ---
stopDistance = slPipsInput * pricePerPipInput
targetDistance = tpPipsInput * pricePerPipInput

// --- Impulsive body (anti-fakeout) ---
barRange = high - low
isImpulsive = barRange > 0 and math.abs(close - open) / barRange * 100 >= bodyPercentInput

// --- Breakout 2-bar (setara ta.highest(high,2)[1]) ---
lookbackHigh = math.max(high[1], high[2])
lookbackLow = math.min(low[1], low[2])

// --- ADX Wilder manual (setara ta.dmi) ---
upMove = high - high[1]
downMove = low[1] - low
plusDM = na(upMove) or na(downMove) ? 0.0 : (upMove > downMove and upMove > 0 ? upMove : 0.0)
minusDM = na(upMove) or na(downMove) ? 0.0 : (downMove > upMove and downMove > 0 ? downMove : 0.0)
trRange = na(close[1]) ? high - low : math.max(high - low, math.max(math.abs(high - close[1]), math.abs(low - close[1])))
diLen = adxDiLengthInput
adxLen = adxSmoothingInput
var float trW = na
var float plusW = na
var float minusW = na
trW := na(trRange) ? trW : (na(trW) ? trRange : (trW * (diLen - 1) + trRange) / diLen)
plusW := na(plusW) ? plusDM : (plusW * (diLen - 1) + plusDM) / diLen
minusW := na(minusW) ? minusDM : (minusW * (diLen - 1) + minusDM) / diLen
plusDI = not na(trW) and trW > 0 ? 100.0 * plusW / trW : 0.0
minusDI = not na(trW) and trW > 0 ? 100.0 * minusW / trW : 0.0
dxSum = plusDI + minusDI
dx = dxSum > 0 ? 100.0 * math.abs(plusDI - minusDI) / dxSum : 0.0
var float adxW = na
adxW := na(adxW) ? dx : (adxW * (adxLen - 1) + dx) / adxLen
isTrending = not useSidewaysFilterInput or (not na(adxW) and adxW >= minAdxInput)

// --- State simulasi posisi + ekuitas (mirror strategy master v5) ---
var int posDir = 0
var float entryP = na
var float slP = na
var float tpP = na
var int effLossStreak = 0
var int currentWinStreak = 0
var bool paused = false
var int shadowDir = 0
var float shadowSL = na
var float shadowTP = na
var float simEquity = 10000.0
var float dayStartEquity = 10000.0
var bool dailyLossLocked = false
// Level trade TERAKHIR utk segmen historis (setara line.new entry->exit)
var float lastEntryP = na
var float lastSlP = na
var float lastTpP = na
// Trade ditutup PADA bar ini (plot segmen masih digambar di bar exit)
bool endedThisBar = false

if newTradingDay
    dayStartEquity := simEquity
    dailyLossLocked := false

if simEquity <= dayStartEquity - dayStartEquity * dailyMaxLossPctInput / 100.0
    dailyLossLocked := true

// 1) Exit posisi aktif pada bar ini (SL prioritas bila dobel — konservatif)
if posDir == 1
    if low <= slP
        simEquity := simEquity + (slP - entryP)
        effLossStreak := effLossStreak + 1
        currentWinStreak := 0
        endedThisBar := true
        posDir := 0
        if effLossStreak >= maxLossStreakInput
            paused := true
            shadowDir := 0
    else if high >= tpP
        simEquity := simEquity + (tpP - entryP)
        currentWinStreak := currentWinStreak + 1
        effLossStreak := 0
        endedThisBar := true
        posDir := 0
if posDir == -1
    if high >= slP
        simEquity := simEquity + (entryP - slP)
        effLossStreak := effLossStreak + 1
        currentWinStreak := 0
        endedThisBar := true
        posDir := 0
        if effLossStreak >= maxLossStreakInput
            paused := true
            shadowDir := 0
    else if low <= tpP
        simEquity := simEquity + (entryP - tpP)
        currentWinStreak := currentWinStreak + 1
        effLossStreak := 0
        endedThisBar := true
        posDir := 0

// 1b) Paksa tutup akhir sesi (22:00 WIB) — setara strategy.close_all
if forceCloseEndSession and not inSession and posDir != 0
    forcePnl = posDir == 1 ? close - entryP : entryP - close
    simEquity := simEquity + forcePnl
    if forcePnl < 0
        effLossStreak := effLossStreak + 1
        currentWinStreak := 0
        if effLossStreak >= maxLossStreakInput
            paused := true
            shadowDir := 0
    else if forcePnl > 0
        currentWinStreak := currentWinStreak + 1
        effLossStreak := 0
    endedThisBar := true
    posDir := 0

// 1c) Lock drawdown harian — tutup posisi & stop trading hari ini
if dailyLossLocked and posDir != 0
    lockPnl = posDir == 1 ? close - entryP : entryP - close
    simEquity := simEquity + lockPnl
    if lockPnl < 0
        effLossStreak := effLossStreak + 1
        currentWinStreak := 0
        if effLossStreak >= maxLossStreakInput
            paused := true
            shadowDir := 0
    else if lockPnl > 0
        currentWinStreak := currentWinStreak + 1
        effLossStreak := 0
    endedThisBar := true
    posDir := 0

// 2) Pantau trade bayangan saat jeda (TP bayangan = lanjut trading)
if paused and shadowDir == 1
    if low <= shadowSL
        shadowDir := 0
    else if high >= shadowTP
        paused := false
        effLossStreak := 0
        shadowDir := 0
if paused and shadowDir == -1
    if high >= shadowSL
        shadowDir := 0
    else if low <= shadowTP
        paused := false
        effLossStreak := 0
        shadowDir := 0

// 3) Sinyal mentah (identik master v5)
baseOk = inSession and not dailyLossLocked and (not useSidewaysFilterInput or isTrending)
rawLong = baseOk and close > lookbackHigh and isImpulsive and close > open
rawShort = baseOk and close < lookbackLow and isImpulsive and close < open

// 4) Entry bayangan saat jeda (dipantau tanpa uang — identik v5)
if paused and shadowDir == 0 and posDir == 0
    if inSession and close > lookbackHigh and isImpulsive and close > open
        shadowDir := 1
        shadowSL := close - stopDistance
        shadowTP := close + targetDistance
    else if inSession and close < lookbackLow and isImpulsive and close < open
        shadowDir := -1
        shadowSL := close + stopDistance
        shadowTP := close - targetDistance

// 5) Entry baru + alert (sinyal Telegram utk user Pro)
canEnter = posDir == 0 and not paused
longSignal = canEnter and rawLong
shortSignal = canEnter and rawShort and not longSignal
if longSignal
    posDir := 1
    entryP := close
    slP := close - stopDistance
    tpP := close + targetDistance
    lastEntryP := entryP
    lastSlP := slP
    lastTpP := tpP
    alert("BUY @ " + str.tostring(close) + " | SL " + str.tostring(slP) + " | TP " + str.tostring(tpP), alert.freq_once_per_bar)
if shortSignal
    posDir := -1
    entryP := close
    slP := close + stopDistance
    tpP := close - targetDistance
    lastEntryP := entryP
    lastSlP := slP
    lastTpP := tpP
    alert("SELL @ " + str.tostring(close) + " | SL " + str.tostring(slP) + " | TP " + str.tostring(tpP), alert.freq_once_per_bar)

// 6) PLOT — segmen Entry/SL/TP dari bar entry s.d. bar exit tiap
//    trade (setara line.new + label TP/SL strategy asli). Jeda
//    antar segmen = na. Posisi terbuka = garis menjulur ke bar ini.
inTradeSeg = posDir != 0 or endedThisBar
plot(inTradeSeg ? lastEntryP : na, title="Entry", color=color.green, linewidth=2)
plot(inTradeSeg ? lastSlP : na, title="Stop Loss", color=color.red, linewidth=1)
plot(inTradeSeg ? lastTpP : na, title="Take Profit", color=color.aqua, linewidth=1)
// Plot STATE tersembunyi (prefix _ — disaring dari chart, dipakai
// alert_rules server: transisi 0->1 = entry baru)
plot(posDir == 1 ? 1.0 : 0.0, title="_LongState", display=display.none)
plot(posDir == -1 ? 1.0 : 0.0, title="_ShortState", display=display.none)`

/* ============================================================
   AUTO-SEED — pastikan skrip default ada di protected_scripts.
   Cache in-memory 5 menit agar tidak nembak DB tiap request.
   ============================================================ */

/* Aturan sinyal declaratif (dipakai evaluateAlertRules — hanya bar
   TERAKHIR, dedupe per-bar): transisi state 0→1 = entry baru.
   (alert() engine PineTS headless tidak memicu onAlert — rules ini
   jalur resmi pemicu Telegram.) */
const DEFAULT_PINE_ALERT_RULES = [
  {
    type: 'cross_above', a: '_LongState', b: 0.5,
    signal: 'ENTRY_LONG',
    message: 'Luxtradee Candle Impulsif: sinyal BUY terkonfirmasi (breakout impulsif + filter sesi/ADX)',
  },
  {
    type: 'cross_above', a: '_ShortState', b: 0.5,
    signal: 'ENTRY_SHORT',
    message: 'Luxtradee Candle Impulsif: sinyal SELL terkonfirmasi (breakdown impulsif + filter sesi/ADX)',
  },
]

let cachedDefault: { id: string; at: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

export async function ensureDefaultScript(): Promise<{ id: string } | null> {
  if (cachedDefault && Date.now() - cachedDefault.at < CACHE_TTL_MS) return cachedDefault

  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  try {
    /* 1) Sudah ada? */
    const sel = await supabase
      .from('protected_scripts')
      .select('id')
      .eq('slug', DEFAULT_PINE_SLUG)
      .maybeSingle()
    if (sel?.data?.id) {
      const id = String(sel.data.id)
      cachedDefault = { id, at: Date.now() }
      /* Migrasi sekali: skrip lama tanpa rules / source lama v4 →
         mutakhirkan nama, deskripsi, source, rules sekalian. */
      const cur = await supabase
        .from('protected_scripts')
        .select('alert_rules, source')
        .eq('id', id)
        .maybeSingle()
      const rules = (cur?.data as any)?.alert_rules
      const rulesEmpty = !Array.isArray(rules) || rules.length === 0
      const sourceStale = String((cur?.data as any)?.source || '') !== DEFAULT_PINE_SOURCE
      if (rulesEmpty || sourceStale) {
        await supabase
          .from('protected_scripts')
          .update({
            name: DEFAULT_PINE_NAME,
            description: DEFAULT_PINE_DESCRIPTION,
            source: DEFAULT_PINE_SOURCE,
            alert_rules: DEFAULT_PINE_ALERT_RULES,
          })
          .eq('id', id)
        console.log('[pine-default] skrip default dimutakhirkan (v5 Candle Impulsif — source/rules/nama)')
      }
      return cachedDefault
    }

    /* 2) Belum ada → seed (idempotent by slug unique) */
    const ins = await supabase
      .from('protected_scripts')
      .insert({
        slug: DEFAULT_PINE_SLUG,
        name: DEFAULT_PINE_NAME,
        description: DEFAULT_PINE_DESCRIPTION,
        source: DEFAULT_PINE_SOURCE,
        is_active: true,
        sort_order: -1, // tampil paling atas (default)
        alert_rules: DEFAULT_PINE_ALERT_RULES,
      })
      .select('id')
      .maybeSingle()
    if (ins?.data?.id) {
      cachedDefault = { id: String(ins.data.id), at: Date.now() }
      console.log('[pine-default] skrip default ter-seed:', DEFAULT_PINE_SLUG)
      return cachedDefault
    }

    const errMsg = String((ins as any)?.error?.message || 'unknown')
    console.error(
      `[pine-default] seed gagal: ${errMsg} — bila "relation does not exist", jalankan docs/PROTECTED_SCRIPTS.sql di Supabase SQL Editor`,
    )
    return null
  } catch (x: any) {
    console.error('[pine-default] ensure gagal:', String(x?.message || x).slice(0, 140))
    return null
  }
}
