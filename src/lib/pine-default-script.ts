/**
 * ============================================================
 * pine-default-script — skrip Pine DEFAULT Luxtradee (SERVER ONLY)
 * ============================================================
 * PENTING: file ini memuat SOURCE Pine master milik Bos —
 * JANGAN PERNAH diimpor dari client component / dipakai di API
 * yang mengembalikan isi file ini ke browser.
 *
 * Tujuan:
 *  1. Source Pine "Impulsive Breakout XAUUSD v4" (port indicator
 *     dari strategy master Bos — logika sinyal identik, format
 *     kompatibel engine headless: menghasilkan plot + alert()).
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
   SOURCE PINE — port indicator dari strategy master Bos v4.
   Perbedaan dari strategy asli (SENGAJA, agar jalan headless):
   - indicator() bukan strategy() → tidak butuh akun simulasi
   - posisi disimulasikan dengan var (identik: 1 posisi, SL
     prioritas bila dobel, jeda rentetan kalah + trade bayangan)
   - ADX dihitung manual (Wilder) — setara ta.dmi
   - sesi WIB via aritmetika epoch (setara input.session)
   - alert() per entry → sinyal Telegram (server hanya terima
     bar TERAKHIR — anti spam historis)
   ============================================================ */
export const DEFAULT_PINE_SOURCE = `//@version=6
indicator("Impulsive Breakout XAUUSD v4", overlay=true)

// ============================================================
// LUXTRADEE MASTER — Impulsive Breakout XAUUSD v4 (viewer)
// Port indicator dari strategy master Bos: logika sinyal identik
// (sesi WIB, anti-fakeout, ADX, breakout 2-bar, simulasi posisi
// + jeda rentetan kalah). Sinyal alert() -> Telegram user Pro.
// ============================================================

// --- Inputs (identik strategy master) ---
slPipsInput = input.int(200, "Stop Loss (Pips)", minval=1)
tpPipsInput = input.int(400, "Target Profit (Pips)", minval=1)
pricePerPipInput = input.float(0.1, "Nilai 1 pip dalam harga", minval=0.000001, step=0.1)
bodyPercentInput = input.int(83, "Min Body % (Anti-Fakeout)", minval=1, maxval=100)
sessStartInput = input.int(730, "Jam Mulai Sesi (WIB HHMM)", minval=0, maxval=2359)
sessEndInput = input.int(2200, "Jam Selesai Sesi (WIB HHMM)", minval=0, maxval=2359)
useSidewaysFilterInput = input.bool(true, "Hindari Market Sideways")
adxDiLengthInput = input.int(10, "ADX DI Length", minval=1)
adxSmoothingInput = input.int(14, "ADX Smoothing", minval=1)
minAdxInput = input.float(17, "ADX Minimum", minval=1.0, step=0.5)
useStreakPauseInput = input.bool(true, "Aktifkan jeda rentetan kalah")
streakPauseNInput = input.int(2, "Batas kalah beruntun (N)", minval=1)

// --- Waktu WIB (GMT+7) via aritmetika epoch ---
wibMs = time + 7 * 3600000
wibHour = int(math.floor(wibMs / 3600000.0)) % 24
wibMin = int(math.floor(wibMs / 60000.0)) % 60
wibHHMM = wibHour * 100 + wibMin
inSession = wibHHMM >= sessStartInput and wibHHMM < sessEndInput

// --- Konversi pip ---
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

// --- State simulasi posisi (mirror strategy master) ---
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

// 1) Exit posisi aktif pada bar ini (SL prioritas bila dobel — konservatif)
if posDir == 1
    if low <= slP
        effLossStreak := effLossStreak + 1
        currentWinStreak := 0
        posDir := 0
        if useStreakPauseInput and effLossStreak >= streakPauseNInput
            paused := true
    else if high >= tpP
        currentWinStreak := currentWinStreak + 1
        effLossStreak := 0
        posDir := 0
if posDir == -1
    if high >= slP
        effLossStreak := effLossStreak + 1
        currentWinStreak := 0
        posDir := 0
        if useStreakPauseInput and effLossStreak >= streakPauseNInput
            paused := true
    else if low <= tpP
        currentWinStreak := currentWinStreak + 1
        effLossStreak := 0
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

// 3) Sinyal mentah (identik master)
baseOk = inSession and isTrending
rawLong = baseOk and close > lookbackHigh and isImpulsive and close > open
rawShort = baseOk and close < lookbackLow and isImpulsive and close < open

// 4) Entry baru + alert (sinyal Telegram untuk user Pro)
canEnter = posDir == 0 and not paused
longSignal = canEnter and rawLong
shortSignal = canEnter and rawShort and not longSignal
if longSignal
    posDir := 1
    entryP := close
    slP := close - stopDistance
    tpP := close + targetDistance
    alert("BUY @ " + str.tostring(close) + " | SL " + str.tostring(slP) + " | TP " + str.tostring(tpP), alert.freq_once_per_bar)
if shortSignal
    posDir := -1
    entryP := close
    slP := close + stopDistance
    tpP := close - targetDistance
    alert("SELL @ " + str.tostring(close) + " | SL " + str.tostring(slP) + " | TP " + str.tostring(tpP), alert.freq_once_per_bar)

// 5) Entry bayangan saat jeda (dipantau tanpa uang)
if paused and shadowDir == 0 and posDir == 0
    if rawLong
        shadowDir := 1
        shadowSL := close - stopDistance
        shadowTP := close + targetDistance
    else if rawShort
        shadowDir := -1
        shadowSL := close + stopDistance
        shadowTP := close - targetDistance

// 6) PLOT — garis Entry / SL / TP selama posisi hidup
plot(posDir != 0 ? entryP : na, title="Entry", color=color.green, linewidth=2)
plot(posDir != 0 ? slP : na, title="Stop Loss", color=color.red, linewidth=1)
plot(posDir != 0 ? tpP : na, title="Take Profit", color=color.aqua, linewidth=1)
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
    message: 'Impulsive Breakout: sinyal BUY terkonfirmasi (breakout impulsif + filter sesi/ADX)',
  },
  {
    type: 'cross_above', a: '_ShortState', b: 0.5,
    signal: 'ENTRY_SHORT',
    message: 'Impulsive Breakout: sinyal SELL terkonfirmasi (breakdown impulsif + filter sesi/ADX)',
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
      /* Migrasi sekali: skrip lama tanpa alert_rules → isi rules +
         source terbaru (tidak menimpa bila rules sudah ada). */
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
          .update({ source: DEFAULT_PINE_SOURCE, alert_rules: DEFAULT_PINE_ALERT_RULES })
          .eq('id', id)
        console.log('[pine-default] skrip default dimutakhirkan (source/rules)')
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
