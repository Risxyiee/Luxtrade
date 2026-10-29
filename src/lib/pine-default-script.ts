/**
 * ============================================================
 * pine-default-script — skrip Pine DEFAULT Luxtradee (SERVER ONLY)
 * ============================================================
 * PENTING: file ini memuat SOURCE Pine master milik Bos —
 * JANGAN PERNAH diimpor dari client component / dipakai di API
 * yang mengembalikan isi file ini ke browser.
 *
 * Tujuan:
 *  1. Source Pine "Luxtradee Candle Impulsif" — strategy() VERBATIM
 *     100% paste Bos ("Impulsive Breakout XAUUSD v5 (Prop Firm & API
 *     Safe)") — TANPA perubahan apa pun juga (judul asli dipakai):
 *     sesi WIB 07.30–22.00, anti-fakeout body 83%, ADX anti-sideways,
 *     breakout 2-bar, SL/TP dari pip, paksa tutup saat sesi berakhir,
 *     lock drawdown harian, jeda rentetan kalah + trade bayangan.
 *     Blok line.new/label.new milik Bos = acuan visual chart
 *     (digambar ulang client dari data trade server — lihat titik 2).
 *  2. Chart: engine headless TIDAK punya plot() di skrip ini, jadi
 *     segmen Entry/SL/TP di-sintesis dari TRADES engine (lihat
 *     synthesizeTradePlots di pine-protected.ts) — klik indikator
 *     → garis Entry/SL/TP langsung muncul, tanpa paste manual.
 *  3. Sinyal Telegram: tiap trade engine → engineAlerts
 *     (ENTRY_LONG/ENTRY_SHORT/STOP_LOSS/TAKE_PROFIT) di
 *     pine-protected.ts — jalur resmi pemicu notif utk strategy().
 *  4. ensureDefaultScript() — auto-seed + auto-migrate ke tabel
 *     protected_scripts (upsert by slug) SEHINGGA BOS TIDAK PERLU
 *     SQL MANUAL. Dipanggil route compile-pine (GET/POST) & daftar alert.
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import {
  DEFAULT_PINE_SLUG,
  DEFAULT_PINE_NAME,
  DEFAULT_PINE_DESCRIPTION,
} from './pine-default-meta'

export { DEFAULT_PINE_SLUG, DEFAULT_PINE_NAME, DEFAULT_PINE_DESCRIPTION }

/* ============================================================
   SOURCE PINE — VERBATIM 100% paste Bos (tidak ada satu karakter
   pun yang diubah: judul strategy, input, komentar, semua utuh).
   Judul: "Impulsive Breakout XAUUSD v5 (Prop Firm & API Safe)".
   ============================================================ */
export const DEFAULT_PINE_SOURCE = `// This Pine Script® code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/ MPL-2.0
//@version=6
strategy("Impulsive Breakout XAUUSD v5 (Prop Firm & API Safe)", overlay=true, initial_capital=10000, currency=currency.USD, pyramiding=0, default_qty_type=strategy.fixed, default_qty_value=1, calc_on_order_fills=true, commission_type=strategy.commission.cash_per_contract, commission_value=0.035, slippage=20, max_lines_count=500, max_labels_count=500)

// --- Inputs Utama ---
slPipsInput = input.int(200, "Stop Loss (Pips)", minval=1, tooltip="Jarak stop loss dalam pip; default XAUUSD 200 pip = 20.0 harga.")
tpPipsInput = input.int(400, "Target Profit (Pips)", minval=1, tooltip="Jarak target profit dalam pip.")
pricePerPipInput = input.float(0.1, "Nilai 1 pip dalam harga", minval=0.000001, step=0.1, tooltip="Konversi pip ke jarak harga XAUUSD; default 1 pip = 0.1.")
bodyPercentInput = input.int(83, "Min Body % (Anti-Fakeout)", minval=1, maxval=100, tooltip="Minimum ukuran body candle sebagai persentase dari rentang high-low.")

// --- Jam Operasional Presisi (WIB / GMT+7) ---
startHourWIB = input.int(7, "Jam Mulai (WIB)", minval=0, maxval=23, group="Jam Operasional")
startMinWIB  = input.int(30, "Menit Mulai (WIB)", minval=0, maxval=59, group="Jam Operasional")
endHourWIB   = input.int(22, "Jam Selesai (WIB)", minval=0, maxval=23, group="Jam Operasional")
endMinWIB    = input.int(0, "Menit Selesai (WIB)", minval=0, maxval=59, group="Jam Operasional")
forceCloseEndSession = input.bool(true, "Paksa Tutup Posisi Saat Sesi Berakhir (22:00 WIB)", group="Jam Operasional", tooltip="Jika aktif, posisi yang masih menggantung akan langsung ditutup otomatis pukul 22:00 WIB.")

// --- Filter & Proteksi ---
useSidewaysFilterInput = input.bool(true, "Hindari Market Sideways", tooltip="Entry hanya diizinkan saat ADX mencapai ambang minimum.")
adxDiLengthInput = input.int(10, "ADX DI Length", minval=1)
adxSmoothingInput = input.int(14, "ADX Smoothing", minval=1)
minAdxInput = input.float(17.0, "ADX Minimum", minval=1.0, step=0.5, tooltip="Disetel ke 17.0 untuk menyaring tren lebih kuat.")
dailyMaxLossPctInput = input.float(5.0, "Batas Drawdown Harian (%)", minval=0.1, maxval=100.0, step=0.1)

// --- Batas Loss Beruntun (Strict Pause Prop Firm) ---
maxLossStreakInput = input.int(2, "Batas Loss Beruntun (Max Loss Streak)", minval=1, group="Proteksi Loss Beruntun", tooltip="Jika loss berturut-turut mencapai 2x, robot LANGSUNG PAUSE global dan memantau sinyal bayangan.")

// FIX MUTLAK (CE10123 & CE10275): Menggunakan Unix Milliseconds murni untuk 1 Januari 2020
startTimeInput = input.time(1577836800000, "Tanggal Mulai Backtest", group="Periode")
tablePosInput = input.string("Bottom Right", "Posisi Tabel", options=["Top Right", "Top Left", "Bottom Right", "Bottom Left", "Middle Center"], group="Tampilan")

// --- Perhitungan Jarak SL/TP (Harga Absolut - API Safe) ---
stopDistance = slPipsInput * pricePerPipInput
targetDistance = tpPipsInput * pricePerPipInput

// --- Filter Jam Kerja Matematik Presisi (GMT+7) ---
currentMinWIB = hour(time, "GMT+7") * 60 + minute(time, "GMT+7")
sessionStartMin = startHourWIB * 60 + startMinWIB
sessionEndMin   = endHourWIB * 60 + endMinWIB
inSession = (currentMinWIB >= sessionStartMin) and (currentMinWIB < sessionEndMin)
inRange = time >= startTimeInput

// --- Lock Drawdown Harian (%) ---
dayKey = time("D", "0000-2359", "GMT+7")
newTradingDay = na(dayKey[1]) or dayKey != dayKey[1]
var float dayStartEquity = na
var bool dailyLossLocked = false

if na(dayStartEquity) or newTradingDay
    dayStartEquity := strategy.equity
    dailyLossLocked := false

dailyLossLimit = dayStartEquity * dailyMaxLossPctInput / 100.0
if strategy.equity <= dayStartEquity - dailyLossLimit
    dailyLossLocked := true

// --- Filter Indikator Trend & Impulsive ---
barRange = high - low
isImpulsive = barRange > 0 and math.abs(close - open) / barRange * 100 >= bodyPercentInput
[plusDi, minusDi, adxValue] = ta.dmi(adxDiLengthInput, adxSmoothingInput)
isTrending = adxValue >= minAdxInput
lookbackHigh = ta.highest(high, 2)[1]
lookbackLow = ta.lowest(low, 2)[1]

// --- Sinyal Mentah ---
baseOk = inRange and inSession and not dailyLossLocked and (not useSidewaysFilterInput or isTrending)
rawLong = baseOk and close > lookbackHigh and isImpulsive and close > open
rawShort = baseOk and close < lookbackLow and isImpulsive and close < open

// --- Logika Loss Streak & Trade Bayangan (Strict Global Pause) ---
var int processedClosedTrades = 0
var int currentLossStreak = 0
var int currentWinStreak = 0
var int maxWinStreak = 0
var int maxLossStreak = 0
var bool paused = false
var int shadowDir = 0
var float shadowSL = na
var float shadowTP = na

if strategy.closedtrades > processedClosedTrades
    for tradeIndex = processedClosedTrades to strategy.closedtrades - 1
        closedTradeProfit = strategy.closedtrades.profit(tradeIndex)
        if closedTradeProfit < 0
            currentLossStreak += 1
            currentWinStreak := 0
            maxLossStreak := math.max(maxLossStreak, currentLossStreak)
            if currentLossStreak >= maxLossStreakInput
                paused := true
                shadowDir := 0
        else if closedTradeProfit > 0
            currentLossStreak := 0
            currentWinStreak += 1
            maxWinStreak := math.max(maxWinStreak, currentWinStreak)
        else
            currentLossStreak := 0
            currentWinStreak := 0
    processedClosedTrades := strategy.closedtrades

// Evaluasi Sinyal Bayangan Saat Mode Paused
if paused and shadowDir != 0
    if shadowDir == 1
        if low <= shadowSL
            shadowDir := 0
        else if high >= shadowTP
            paused := false
            currentLossStreak := 0
            shadowDir := 0
    else if shadowDir == -1
        if high >= shadowSL
            shadowDir := 0
        else if low <= shadowTP
            paused := false
            currentLossStreak := 0
            shadowDir := 0

if paused and shadowDir == 0
    if rawLong or (inRange and inSession and close > lookbackHigh and isImpulsive and close > open)
        shadowDir := 1
        shadowSL := close - stopDistance
        shadowTP := close + targetDistance
    else if rawShort or (inRange and inSession and close < lookbackLow and isImpulsive and close < open)
        shadowDir := -1
        shadowSL := close + stopDistance
        shadowTP := close - targetDistance

// --- Eksekusi Strategy ---
canEnter = strategy.position_size == 0 and not paused
longSignal = canEnter and rawLong
shortSignal = canEnter and rawShort

if longSignal
    strategy.entry("BUY", strategy.long)
    strategy.exit("BUY Exit", from_entry="BUY", stop=close - stopDistance, limit=close + targetDistance)

if shortSignal
    strategy.entry("SELL", strategy.short)
    strategy.exit("SELL Exit", from_entry="SELL", stop=close + stopDistance, limit=close - targetDistance)

if forceCloseEndSession and not inSession and strategy.position_size != 0
    strategy.close_all(comment="Sesi Selesai (22:00 WIB)")

if dailyLossLocked and strategy.position_size != 0
    strategy.close_all(comment="Daily DD Limit")

// --- Garis visualisasi entry-ke-exit ---
tradeClosed = strategy.position_size[1] != 0 and strategy.position_size == 0 and strategy.closedtrades > 0
if tradeClosed
    lastTrade = strategy.closedtrades - 1
    entryPrice = strategy.closedtrades.entry_price(lastTrade)
    exitPrice = strategy.closedtrades.exit_price(lastTrade)
    entryBar = strategy.closedtrades.entry_bar_index(lastTrade)
    exitBar = strategy.closedtrades.exit_bar_index(lastTrade)
    isWin = strategy.closedtrades.profit(lastTrade) > 0
    line.new(entryBar, entryPrice, exitBar, exitPrice, xloc=xloc.bar_index, color=isWin ? color.green : color.red, style=line.style_dotted, width=2)
    label.new(exitBar, exitPrice, text=isWin ? "TP" : "SL", xloc=xloc.bar_index, style=label.style_none, textcolor=isWin ? color.green : color.red, size=size.tiny)

// --- Statistik Drawdown & Tabel Performa (Ukuran Tiny) ---
var float equityPeak = na
var float maxOverallDrawdown = 0.0
var float maxOverallDrawdownPct = 0.0
if na(equityPeak) or strategy.equity > equityPeak
    equityPeak := strategy.equity
currentOverallDrawdown = math.max(0.0, equityPeak - strategy.equity)
currentOverallDrawdownPct = equityPeak > 0 ? currentOverallDrawdown / equityPeak * 100 : 0.0
maxOverallDrawdown := math.max(maxOverallDrawdown, currentOverallDrawdown)
maxOverallDrawdownPct := math.max(maxOverallDrawdownPct, currentOverallDrawdownPct)

var float maxDailyDrawdown = 0.0
var float maxDailyDrawdownPct = 0.0
currentDailyDrawdown = math.max(0.0, dayStartEquity - strategy.equity)
currentDailyDrawdownPct = dayStartEquity > 0 ? currentDailyDrawdown / dayStartEquity * 100 : 0.0
maxDailyDrawdown := math.max(maxDailyDrawdown, currentDailyDrawdown)
maxDailyDrawdownPct := math.max(maxDailyDrawdownPct, currentDailyDrawdownPct)

var int firstBarTime = time
tablePos = switch tablePosInput
    "Top Right" => position.top_right
    "Top Left" => position.top_left
    "Bottom Left" => position.bottom_left
    "Middle Center" => position.middle_center
    => position.bottom_right

var table perf = table.new(tablePos, 2, 10, bgcolor=color.rgb(22, 22, 22), border_width=1, border_color=color.rgb(60, 60, 60))

if barstate.islastconfirmedhistory or barstate.isrealtime
    closedN = strategy.closedtrades
    winRate = closedN > 0 ? strategy.wintrades / closedN * 100 : 0.0
    grossLossAbs = math.abs(strategy.grossloss)
    profitFactor = grossLossAbs > 0 ? strategy.grossprofit / grossLossAbs : na
    netPct = strategy.netprofit / strategy.initial_capital * 100
    firstTradeTime = closedN > 0 ? strategy.closedtrades.entry_time(0) : na
    testStart = math.max(firstBarTime, startTimeInput)

    table.cell(perf, 0, 0, "Net P&L", text_color=color.silver, text_size=size.tiny)
    table.cell(perf, 1, 0, "$" + str.tostring(strategy.netprofit, "#.##") + " (" + str.tostring(netPct, "#.##") + "%)", text_color=strategy.netprofit >= 0 ? color.lime : color.red, text_size=size.tiny)
    table.cell(perf, 0, 1, "Trade / Win rate", text_color=color.silver, text_size=size.tiny)
    table.cell(perf, 1, 1, str.tostring(closedN) + " / " + str.tostring(winRate, "#.#") + "%", text_color=color.white, text_size=size.tiny)
    table.cell(perf, 0, 2, "Profit factor", text_color=color.silver, text_size=size.tiny)
    table.cell(perf, 1, 2, na(profitFactor) ? "-" : str.tostring(profitFactor, "#.##"), text_color=color.white, text_size=size.tiny)
    table.cell(perf, 0, 3, "Max loss / win streak*", text_color=color.silver, text_size=size.tiny)
    table.cell(perf, 1, 3, str.tostring(maxLossStreak) + " / " + str.tostring(maxWinStreak), text_color=color.white, text_size=size.tiny)
    table.cell(perf, 0, 4, "DD harian terdalam", text_color=color.silver, text_size=size.tiny)
    table.cell(perf, 1, 4, "$" + str.tostring(maxDailyDrawdown, "#.##") + " (" + str.tostring(maxDailyDrawdownPct, "#.##") + "%)", text_color=color.orange, text_size=size.tiny)
    table.cell(perf, 0, 5, "DD total terdalam", text_color=color.silver, text_size=size.tiny)
    table.cell(perf, 1, 5, "$" + str.tostring(maxOverallDrawdown, "#.##") + " (" + str.tostring(maxOverallDrawdownPct, "#.##") + "%)", text_color=color.orange, text_size=size.tiny)
    table.cell(perf, 0, 6, "Mulai uji", text_color=color.silver, text_size=size.tiny)
    table.cell(perf, 1, 6, str.format_time(testStart, "yyyy-MM-dd", "GMT+7"), text_color=color.white, text_size=size.tiny)
    table.cell(perf, 0, 7, "Trade pertama", text_color=color.silver, text_size=size.tiny)
    table.cell(perf, 1, 7, na(firstTradeTime) ? "-" : str.format_time(firstTradeTime, "yyyy-MM-dd", "GMT+7"), text_color=color.white, text_size=size.tiny)
    table.cell(perf, 0, 8, "TF / mintick", text_color=color.silver, text_size=size.tiny)
    table.cell(perf, 1, 8, timeframe.period + " / (API Murni)", text_color=color.white, text_size=size.tiny)
    table.cell(perf, 0, 9, "Status (*efektif)", text_color=color.silver, text_size=size.tiny)
    table.cell(perf, 1, 9, paused ? "JEDA, tunggu TP bayangan" : "Trading aktif", text_color=paused ? color.orange : color.lime, text_size=size.tiny)`

/* ============================================================
   AUTO-SEED — pastikan skrip default ada di protected_scripts.
   Cache in-memory 5 menit agar tidak nembak DB tiap request.
   ============================================================ */

/* Sinyal strategy() TIDAK lewat alert_rules declaratif (skrip verbatim
   Bos tidak punya plot state) — jalur resmi: TRADES engine → engineAlerts
   di pine-protected.ts (ENTRY_LONG/ENTRY_SHORT/STOP_LOSS/TAKE_PROFIT).
   Rules dikosongkan agar tidak ada rule mati yang membingungkan. */
const DEFAULT_PINE_ALERT_RULES: Array<Record<string, unknown>> = []

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
      /* Migrasi sekali: source berubah (mis. "Clean Native" → kembali
         VERBATIM "Prop Firm & API Safe" milik Bos) → mutakhirkan
         nama, deskripsi, source, rules sekalian. */
      const cur = await supabase
        .from('protected_scripts')
        .select('source')
        .eq('id', id)
        .maybeSingle()
      const sourceStale = String((cur?.data as any)?.source || '') !== DEFAULT_PINE_SOURCE
      if (sourceStale) {
        await supabase
          .from('protected_scripts')
          .update({
            name: DEFAULT_PINE_NAME,
            description: DEFAULT_PINE_DESCRIPTION,
            source: DEFAULT_PINE_SOURCE,
            alert_rules: DEFAULT_PINE_ALERT_RULES,
          })
          .eq('id', id)
        console.log('[pine-default] skrip default dimutakhirkan (strategy v5 verbatim — judul Luxtradee Candle Impulsif)')
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
