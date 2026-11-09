'use client'
/**
 * ============================================================
 * VelaChartTerminal — Chart terminal baru Luxtradee (Task 36)
 * ============================================================
 * Menggantikan chart lama (lightweight-charts) dengan Vela™ by
 * LuxAlgo (@luxalgo/vela) — WebGL2, workspace lengkap (symbol
 * search, timeframe, indikator bawaan 70+, drawing tools), tema
 * gelap elegan ala Luxtradee.
 *
 * DATAFEED (urutan FINAL Bos — BINANCE DIBUANG, satu pintu keyless):
 *   Semua simbol (FX/Gold/US100/crypto) → LuxtradeeForexProvider
 *   via /api/candles: TradingView keyless → Twelve Data
 *   (TWELVE_DATA_API_KEY) → Yahoo keyless. Chart tak pernah
 *   mati 401.
 * - Pine Script®           : @luxalgo/vela-pinets (PineEngine)
 *                            + editor Save/Compile dengan kuota
 *                            FREE 2×/bulan (/api/pine/save)
 * - Indikator DEFAULT      : Luxtradee Candle Impulsif (v5, master
 *                            Bos) — aktif otomatis, semua user bisa
 *                            lihat; alert push HP khusus Pro (🔔)
 * - Alert otomatis         : 🔔 di chip skrip eksklusif — sinyal
 *                            Entry/SL/TP jadi PUSH NOTIFIKASI di layar
 *                            HP (/api/pine/alerts + web push)
 *
 * CATATAN SSR: komponen ini WAJIB dimuat via next/dynamic dengan
 * { ssr: false } (dilakukan di ChartTab) — Vela menyentuh
 * WebGL/canvas sejak konstruktor.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { VelaWorkspace } from '@luxalgo/vela/workspace'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, ScrollText, Bell, X, GraduationCap, TriangleAlert, Trash2, ChevronDown, BarChart3 } from 'lucide-react'
import { DEFAULT_PINE_SLUG, DEFAULT_PINE_NAME, DEFAULT_PINE_DESCRIPTION } from '@/lib/pine-default-meta'
import { TRADE_MARKER_TYPE, registerTradeMarkerNative } from '@/components/vela/TradeMarkerIndicator'
import { STRATEGY_PNL_TYPE, registerStrategyPnlNative, type StrategyPnlTrade } from '@/components/vela/StrategyPnlIndicator'
import {
  consumePendingTradeHighlight,
  TRADE_HIGHLIGHT_EVENT,
  type TradeMarkerPayload,
} from '@/lib/trade-highlight'

/* ---------- Luxtradee Pine® presets (muncul di indicator picker) ---------- */
const PINE_PRESETS = [
  {
    name: 'Luxtradee — EMA 20/50',
    category: 'Luxtradee',
    enabled: true,
    script: `//@version=6
indicator("Luxtradee EMA 20/50", overlay=true)
plot(ta.ema(close, 20), color=color.orange, linewidth=2)
plot(ta.ema(close, 50), color=color.teal, linewidth=2)`,
  },
  {
    name: 'Luxtradee — RSI 14',
    category: 'Luxtradee',
    script: `//@version=6
indicator("Luxtradee RSI 14", overlay=false)
plot(ta.rsi(close, 14), color=color.purple, linewidth=2)
hline(70), hline(30)`,
  },
  {
    name: 'Luxtradee — VWAP',
    category: 'Luxtradee',
    script: `//@version=6
indicator("Luxtradee VWAP", overlay=true)
plot(ta.vwap, color=color.aqua, linewidth=2)`,
  },
]

/* ---------- Batas indikator preset (SOP Bos: free 1, pro buka semua) ---------- */
const FREE_INDICATOR_LIMIT = 1

/* ============================================================
   PROTECTED CUSTOM PINE SCRIPT® (Task 41) — client-side glue
   ============================================================
   Source Pine TIDAK PERNAH dikirim ke browser. Server
   (/api/compile-pine) menjalankan engine PineTS headless dan
   HANYA mengembalikan hasil plot {time, value}. Client menggambar
   hasilnya via NATIVE INDICATOR Vela (registerNativeIndicator)
   — tanpa tab editor, tanpa source, tanpa cara menyalin kodenya.
   ============================================================ */
const PROTECTED_TYPE = 'luxtradee-protected'

interface ProtectedPlot { key: string; title: string; color: string; data: Array<{ time: number; value: number | null }> }
/* Visual non-garis dari server (plotshape/plotchar/bgcolor/label.new/
   line.new/box.new/table.new) — format renderer PENUH dari model engine
   (DrawingLabel/Background/DrawingLine/DrawingBox/DrawingTable). Dulu
   SEMUA dibuang di jalur terproteksi → sinyal BUY/SELL, level retest,
   fractal, tabel dsb. tidak tampil di chart padahal di TradingView
   tampil. Sekarang ikut dikirim & digambar penuh. */
interface ProtectedVisuals {
  labels: Array<Record<string, unknown>>
  backgrounds: Array<Record<string, unknown>>
  lines: Array<Record<string, unknown>>
  boxes: Array<Record<string, unknown>>
  tables: Array<Record<string, unknown>>
}
interface ProtectedScriptMeta { id: string; slug?: string; name: string; description: string | null; kind?: 'protected' | 'pine' }
/* Trade strategy (server) — bahan visual chart ala line.new/label.new
   Pine Bos: garis entry→exit dotted hijau/merah + label TP/SL + panah
   entry ala Strategy Tester TradingView. time dalam ms. */
interface ProtectedTrade {
  side: 'long' | 'short'
  entryTime: number
  entryPrice: number
  exitTime: number | null
  exitPrice: number | null
  pnl: number
  reason: 'sl' | 'tp' | 'session' | 'daily_dd' | 'open'
}

/* Event status protected → UI (error tidak lagi DIAM — Bos: chip
   diklik tapi garis tidak muncul tanpa jejak penyebabnya). */
const PROTECTED_STATUS_EVENT = 'ltx-protected-status'
function emitProtectedStatus(key: string, message: string) {
  try { window.dispatchEvent(new CustomEvent(PROTECTED_STATUS_EVENT, { detail: { key, message } })) } catch { /* diam */ }
}

/* Event STATISTIK performa (tabel ala strategy() TradingView) — server
   compile-pine mengirim meta.stats utk skrip default; dirender sebagai
   tabel di pojok KANAN-BAWAH chart (posisi default tablePos Pine Bos:
   "Bottom Right") → indikator Luxtradee kelihatan sebagai script
   master utuh, bukan "indikator sendiri". */
export interface ProtectedStats {
  netProfit?: string
  trades?: string
  profitFactor?: string
  streaks?: string
  dailyDD?: string
  overallDD?: string
  testStart?: string
  firstTrade?: string
  openPos?: boolean
  paused?: boolean
  symbol?: string
  interval?: string
}
const PROTECTED_STATS_EVENT = 'ltx-protected-stats'
function emitProtectedStats(key: string, stats: ProtectedStats) {
  try { window.dispatchEvent(new CustomEvent(PROTECTED_STATS_EVENT, { detail: { key, stats } })) } catch { /* diam */ }
}

/* Cache plot+trades per (scriptKey, symbol, tf) — 45 detik. Refetch ringan
   ini sekaligus jadi loop LISTENER alert: tiap refresh, server
   mengevaluasi ulang sinyal Entry/SL/TP → push layar HP user Pro. */
const protectedPlotCache = new Map<string, { at: number; plots: ProtectedPlot[]; trades: ProtectedTrade[]; visuals?: ProtectedVisuals }>()

/**
 * Visual dari server (format model engine — DrawingLabel/Background/
 * DrawingLine/…) dipetakan ke emit native: paneId dipaksa 'price'
 * (indikator terproteksi selalu overlay di pane harga), nilai wajib
 * label (size/textAlign/fontFamily) dilengkapi bila engine tak kirim.
 * plotshape marker dari engine datang sebagai label dgn style
 * triangleup/triangledown/cross/… + yloc abovebar/belowbar — persis
 * yang renderer pahami, jadi TIDAK perlu konversi manual lagi.
 */
function buildVisualDrawings(
  visuals: ProtectedVisuals,
  scriptId: string,
  barsArr: ReadonlyArray<{ time: number }> = [],
): { labels: any[]; backgrounds: any[]; lines: any[]; boxes: any[]; tables: any[] } {
  const labels: any[] = []
  const backgrounds: any[] = []
  const lines: any[] = []
  const boxes: any[] = []
  const tables: any[] = []
  /* Snap waktu visual ke bar chart TERDEKAT — anchor candle server bisa
     beda beberapa ms/harian-sama dgn bar chart (sumber data berbeda);
     label yloc abovebar/belowbar Butuh bar yang TEPAT (barAt) → kalau
     waktu meleset, label SENYAP tidak tergambar (barAt null → skip). */
  const times = barsArr.map((b) => Number(b.time)).filter((t) => Number.isFinite(t)).sort((a, b) => a - b)
  const snapTime = (t: number): number => {
    if (!times.length || !Number.isFinite(t)) return t
    let lo = 0, hi = times.length - 1
    while (lo < hi) { const mid = (lo + hi) >> 1; if (times[mid] < t) lo = mid + 1; else hi = mid }
    const cand = [times[lo], times[Math.max(0, lo - 1)]]
    return cand.reduce((best, c) => (Math.abs(c - t) < Math.abs(best - t) ? c : best), cand[0])
  }
  try {
    (visuals.labels || []).forEach((lb, i) => {
      const x = snapTime(Number((lb as any).x))
      if (!Number.isFinite(x)) return
      labels.push({
        id: `ltxv-${scriptId}-l${i}`,
        paneId: 'price',
        overlay: true, // WAJIB — filter drawings pane harga hanya ambil overlay===true
        xloc: 'bar_time',
        x,
        y: Number((lb as any).y) || 0,
        yloc: (lb as any).yloc || 'price',
        text: String((lb as any).text ?? ''),
        style: (lb as any).style || 'none',
        ...(typeof (lb as any).color === 'string' ? { color: (lb as any).color } : {}),
        ...(typeof (lb as any).textColor === 'string' ? { textColor: (lb as any).textColor } : {}),
        size: (lb as any).size || 'tiny',
        textAlign: (lb as any).textAlign || 'center',
        fontFamily: (lb as any).fontFamily || 'default',
        ...(typeof (lb as any).noFill === 'boolean' ? { noFill: (lb as any).noFill } : {}),
        ...(typeof (lb as any).tooltip === 'string' ? { tooltip: (lb as any).tooltip } : {}),
      })
    })
    ;(visuals.backgrounds || []).forEach((bg, i) => {
      const from = snapTime(Number((bg as any).from))
      const toRaw = Number((bg as any).to)
      const to = Number.isFinite(toRaw) ? Math.max(from + 1, snapTime(toRaw)) : from
      const color = (bg as any).color
      if (!Number.isFinite(from) || !Number.isFinite(to) || typeof color !== 'string') return
      backgrounds.push({ id: `ltxv-${scriptId}-b${i}`, paneId: 'price', from, to, color, overlay: true })
    })
    ;(visuals.lines || []).forEach((ln, i) => {
      const x1 = snapTime(Number((ln as any).x1))
      const y1 = Number((ln as any).y1)
      if (!Number.isFinite(x1) || !Number.isFinite(y1)) return
      lines.push({
        id: `ltxv-${scriptId}-n${i}`,
        paneId: 'price',
        overlay: true,
        xloc: (ln as any).xloc || 'bar_time',
        x1, y1,
        x2: snapTime(Number((ln as any).x2) || x1),
        y2: Number((ln as any).y2) || y1,
        extend: (ln as any).extend || 'none',
        color: (ln as any).color || '#22ab94',
        width: Number((ln as any).width) || 1,
        style: (ln as any).style || 'solid',
        arrowLeft: false,
        arrowRight: false,
      })
    })
    ;(visuals.boxes || []).forEach((bx, i) => {
      const left = snapTime(Number((bx as any).left))
      const right = snapTime(Number((bx as any).right))
      const top = Number((bx as any).top)
      const bottom = Number((bx as any).bottom)
      if (![left, right, top, bottom].every(Number.isFinite)) return
      boxes.push({
        id: `ltxv-${scriptId}-x${i}`,
        paneId: 'price',
        overlay: true,
        xloc: (bx as any).xloc || 'bar_time',
        left, right, top, bottom,
        ...(typeof (bx as any).borderColor === 'string' ? { borderColor: (bx as any).borderColor } : {}),
        ...(typeof (bx as any).borderStyle === 'string' ? { borderStyle: (bx as any).borderStyle } : {}),
        ...(Number.isFinite(Number((bx as any).borderWidth)) ? { borderWidth: Number((bx as any).borderWidth) } : {}),
        ...(typeof (bx as any).backgroundColor === 'string' ? { backgroundColor: (bx as any).backgroundColor } : {}),
      })
    })
    ;(visuals.tables || []).forEach((tb, i) => {
      if (!tb || typeof tb !== 'object') return
      tables.push({ ...(tb as any), id: `ltxv-${scriptId}-t${i}`, paneId: 'price', overlay: true })
    })
  } catch { /* dekoratif — jangan guncang chart */ }
  return { labels, backgrounds, lines, boxes, tables }
}

function emitProtectedPlots(ctx: any, plots: ProtectedPlot[], scriptId: string, trades: ProtectedTrade[] = [], visuals?: ProtectedVisuals) {
  try {
    const barsArr: Array<{ time: number }> = typeof ctx?.bars === 'function' ? ctx.bars() : []
    /* BUCKET-TOLERANT MATCHING (fix "pine ga ada Entry/SL/TP"):
       dulu nilai plot di-match ke bar dgn kesamaan waktu PERSIS —
       kalau candle server datang dari sumber ber-anchor beda
       (mis. 4h TradingView mulai 01:00 UTC vs Yahoo 00:00) SATU
       MS pun selisih → semua nilai null → garis blank total.
       Sekarang kedua sisi di-snap ke awal bucket TF (floor), jadi
       selisih kecil anchor tetap mendarat di bar yang sama. */
    const tfKey = String(ctx?.timeframe || '60')
    const bucketMs = TF_MS[tfKey] || 3_600_000
    const snap = (t: number) => Math.floor(t / bucketMs) * bucketMs
    /* Visual ala line.new/label.new Pine Bos (Strategy Tester
       TradingView): bila data trade tersedia, garis Entry→Exit dotted
       hijau/merah + label TP/SL + panah BUY/SELL MENGGANTIKAN garis
       stepped SL/TP sintetis yang menempel candle & susah dibaca.
       Garis stepped Entry tetap (posisi terbuka menjulur). */
    const hasTradeVisuals = trades.length > 0
    const series = plots
      .filter((p) => !hasTradeVisuals || (p.key !== 'StopLoss' && p.key !== 'TakeProfit'))
      .map((p) => {
        const m = new Map<number, number | null>()
        for (const d of p.data) if (d.value != null) m.set(snap(d.time), d.value)
        return {
          id: `ltxp-${scriptId}-${p.key}`,
          title: p.title,
          paneId: 'price',
          kind: 'line' as const,
          /* Index-aligned terhadap bars() SAAT EMIT (kontrak Vela) */
          points: barsArr.map((b) => ({ time: b.time, value: m.get(snap(b.time)) ?? null })),
          style: { color: p.color, width: p.key === 'Entry' ? 2 : 1, lineStyle: 'solid' as const },
        }
      })
    /* ---- Garis & label per trade (replika line.new/label.new) ----
       Warna = isWin ? color.green : color.red ala Pine Bos; batas
       400 trade terakhir = max_lines_count/max_labels_count Pine. */
    const WIN = '#22ab94'
    const LOSS = '#ef5350'
    const recent = trades.slice(-400)
    const lines: any[] = []
    const labels: any[] = []
    const backgroundsArr: any[] = []
    let extraDrawings: Record<string, any[]> | null = null
    const lastBarTime = barsArr.length ? barsArr[barsArr.length - 1].time : 0
    for (let i = 0; i < recent.length; i++) {
      const t = recent[i]
      if (!t?.entryTime || !Number.isFinite(t.entryPrice)) continue
      const win = t.pnl > 0
      const col = win ? WIN : LOSS
      const t1 = snap(t.entryTime)
      const isOpen = t.exitTime == null
      const t2 = isOpen ? lastBarTime : snap(t.exitTime as number)
      if (!t2 || t2 < t1) continue
      const y2 = isOpen ? t.entryPrice : Number(t.exitPrice)
      if (!Number.isFinite(y2)) continue
      lines.push({
        id: `ltxl-${scriptId}-${i}`,
        paneId: 'price',
        overlay: true,
        xloc: 'bar_time',
        x1: t1, y1: t.entryPrice, x2: t2, y2,
        extend: 'none',
        color: isOpen ? WIN : col,
        invisible: false,
        width: 2,
        style: isOpen ? 'solid' : 'dotted',
        arrowLeft: false,
        arrowRight: false,
      })
      /* Panah entry ala Strategy Tester TradingView */
      if (t.side === 'long') {
        labels.push({ id: `ltxb-${scriptId}-${i}`, paneId: 'price', overlay: true, xloc: 'bar_time', x: t1, y: t.entryPrice, yloc: 'belowbar', text: 'BUY', style: 'arrowup', color: WIN, textColor: '#ffffff', size: 'tiny', textAlign: 'center', fontFamily: 'default' })
      } else {
        labels.push({ id: `ltxs-${scriptId}-${i}`, paneId: 'price', overlay: true, xloc: 'bar_time', x: t1, y: t.entryPrice, yloc: 'abovebar', text: 'SELL', style: 'arrowdown', color: LOSS, textColor: '#ffffff', size: 'tiny', textAlign: 'center', fontFamily: 'default' })
      }
      /* Label TP/SL di harga exit — style_none ala label.new Bos */
      if (!isOpen) {
        labels.push({ id: `ltxe-${scriptId}-${i}`, paneId: 'price', overlay: true, xloc: 'bar_time', x: t2, y: y2, yloc: 'price', text: win ? 'TP' : 'SL', style: 'none', noFill: true, textColor: col, size: 'tiny', textAlign: 'center', fontFamily: 'default' })
      }
    }
    /* Visual Pine (plotshape/bgcolor/label.new/line.new/box/table) →
       gabungkan ke SATU emit (emit = PATCH — dua emit terpisah saling
       MENIMPA labels/lines!). */
    if (visuals) {
      try {
        const fullBars: any[] = typeof ctx?.bars === 'function' ? ctx.bars() : []
        const { labels: visLabels, backgrounds: visBackgrounds, lines: visLines, boxes: visBoxes, tables: visTables } = buildVisualDrawings(visuals, scriptId, fullBars)
        if (visLabels.length) labels.push(...visLabels)
        if (visBackgrounds.length) backgroundsArr.push(...visBackgrounds)
        if (visLines.length) lines.push(...visLines)
        if (visBoxes.length || visTables.length) {
          const boxesArr: any[] = visBoxes
          const tablesArr: any[] = visTables
          extraDrawings = { ...(boxesArr.length ? { boxes: boxesArr } : {}), ...(tablesArr.length ? { tables: tablesArr } : {}) }
        }
      } catch { /* dekoratif */ }
    }
    ctx?.emit?.({
      series,
      ...(lines.length ? { lines } : {}),
      ...(labels.length ? { labels } : {}),
      ...(backgroundsArr.length ? { backgrounds: backgroundsArr } : {}),
      ...(extraDrawings || {}),
    })
  } catch { /* jangan biarkan satu emit mengguncang chart */ }
}

function createProtectedInstance() {
  let ctx: any = null
  let scriptKey = '' // id ATAU slug (default auto-load pakai slug)
  let lastRunKey = '' // "SYM:TF" run terakhir — ganti TF/simbol WAJIB recompute (fix "mulai uji" nyangkut TF lama)
  let busy = false
  let lastEmit = 0
  let lastFail = 0 // backoff: jangan hammer server saat gagal
  let lastPlots: ProtectedPlot[] | null = null
  let lastTrades: ProtectedTrade[] = [] // visual garis/label per trade
  let lastVisuals: ProtectedVisuals | null = null // plotshape/bgcolor/label.new dari server
  let lastBarsSig = '' // anti re-emit sia-sia saat bars tak berubah
  const reemitTimers: ReturnType<typeof setTimeout>[] = []

  /* Kunci run dari ctx — simbol bisa berprefiks provider (buang sebelum ':'). */
  const ctxRunKey = (c: any): string => {
    const sym = String(c?.symbol || '').split(':').pop() || ''
    const tf = String(c?.timeframe || '60')
    return `${sym.toUpperCase()}:${tf}`
  }

  const clearTimers = () => {
    while (reemitTimers.length) { try { clearTimeout(reemitTimers.pop() as any) } catch { /* diam */ } }
  }

  /* Re-emit beberapa kali setelah plot siap — history chart bisa
     datang TERLAMBAT dari boot (getBars 5000 bar). Tanpa ini garis
     Entry/SL/TP kadang tidak tampak sampai tick berikutnya. */
  const scheduleReEmits = () => {
    clearTimers()
    for (const d of [700, 1800, 3500, 6000]) {
      reemitTimers.push(setTimeout(() => { try { if (ctx && lastPlots) emitProtectedPlots(ctx, lastPlots, scriptKey, lastTrades, lastVisuals || undefined) } catch { /* diam */ } }, d))
    }
  }

  /* Emit hanya bila bars berubah (jumlah/ujung waktu) — plot
     bergantung pada TIME saja, bukan nilai close live. */
  const maybeEmit = (c: any) => {
    if (!lastPlots) return
    try {
      const barsArr: Array<{ time: number }> = typeof c?.bars === 'function' ? c.bars() : []
      const sig = `${barsArr.length}:${barsArr[0]?.time ?? 0}:${barsArr[barsArr.length - 1]?.time ?? 0}`
      if (sig === lastBarsSig) return
      lastBarsSig = sig
      emitProtectedPlots(c, lastPlots, scriptKey, lastTrades, lastVisuals || undefined)
    } catch { try { emitProtectedPlots(c, lastPlots, scriptKey, lastTrades, lastVisuals || undefined) } catch { /* diam */ } }
  }

  const run = async (force: boolean) => {
    const c = ctx
    if (!c || !scriptKey || busy) return
    /* simbol bisa berprefiks provider — buang sebelum ':'] */
    const sym = String(c.symbol || '').split(':').pop() || ''
    const tf = String(c.timeframe || '60')
    const ck = `${scriptKey}:${sym.toUpperCase()}:${tf}`
    const cached = protectedPlotCache.get(ck)
    if (cached && Date.now() - cached.at < 45000) {
      lastPlots = cached.plots
      lastTrades = Array.isArray(cached.trades) ? cached.trades : []
      lastVisuals = cached.visuals || null
      lastBarsSig = '' // paksa emit ulang utk ctx baru
      lastRunKey = ctxRunKey(c) // cache ini memang utk simbol+TF sekarang — sah
      maybeEmit(c)
      return
    }
    if (!force && Date.now() - lastEmit < 15000) return // anti-jitter live tick
    if (!force && Date.now() - lastFail < 20000) return // backoff pasca gagal (jangan banjir server)
    busy = true
    try {
      c.setStatus?.('loading')
      const res = await fetch('/api/compile-pine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: scriptKey, symbol: sym.toUpperCase(), interval: tf }),
      })
      if (res.ok) {
        const j: any = await res.json()
        if (Array.isArray(j?.plots) && j.plots.length || j?.visuals) {
          const tradesArr: ProtectedTrade[] = Array.isArray(j?.trades) ? j.trades : []
          const vis: ProtectedVisuals | null = j?.visuals && Array.isArray(j.visuals.labels)
            ? {
                labels: j.visuals.labels || [],
                backgrounds: Array.isArray(j.visuals.backgrounds) ? j.visuals.backgrounds : [],
                lines: Array.isArray(j.visuals.lines) ? j.visuals.lines : [],
                boxes: Array.isArray(j.visuals.boxes) ? j.visuals.boxes : [],
                tables: Array.isArray(j.visuals.tables) ? j.visuals.tables : [],
              }
            : null
          protectedPlotCache.set(ck, { at: Date.now(), plots: j.plots || [], trades: tradesArr, ...(vis ? { visuals: vis } : {}) })
          lastPlots = j.plots || []
          lastTrades = tradesArr
          lastVisuals = vis
          lastBarsSig = ''
          lastRunKey = ctxRunKey(c) // run ini sah utk simbol+TF sekarang
          if (j?.meta?.stats) emitProtectedStats(scriptKey, j.meta.stats as ProtectedStats)
          if ((lastPlots && lastPlots.length) || vis) maybeEmit(c)
          lastEmit = Date.now()
          c.setStatus?.('live')
          scheduleReEmits()
          return
        }
        emitProtectedStatus(scriptKey, 'Skrip berjalan tapi belum menghasilkan plot — coba lagi sebentar.')
      } else if (res.status === 403) {
        /* Pro kadaluarsa di tengah sesi — chip UI akan menutup akses
           pada pemakaian berikutnya */
        emitProtectedStatus(scriptKey, '🔒 Indikator eksklusif ini khusus member Pro.')
      } else {
        let msg = `HTTP ${res.status}`
        try { const je: any = await res.json(); if (je?.error) msg = String(je.error) } catch { /* diam */ }
        emitProtectedStatus(scriptKey, `Gagal memuat indikator: ${msg}`)
        lastFail = Date.now()
      }
      c.setStatus?.('idle')
    } catch (x: any) {
      lastFail = Date.now()
      emitProtectedStatus(scriptKey, `Gagal memuat indikator (jaringan): ${String(x?.message || x).slice(0, 100)}`)
      try { c?.setStatus?.('idle') } catch { /* diam */ }
    } finally { busy = false }
  }

  return {
    start: (c: any, inputs: Record<string, any>) => {
      ctx = c
      scriptKey = String(inputs?.scriptId || inputs?.slug || '')
      lastPlots = null
      lastTrades = []
      lastVisuals = null
      lastBarsSig = ''
      lastRunKey = ''
      run(true)
    },
    onBars: () => {
      /* History termuat / tick live → gambar ulang dari plot terakhir
         TANPA fetch (instan) — fix: garis Entry/SL/TP kadang kosong
         karena plot siap SEBELUM history chart selesai dimuat.
         FIX BOS ("tabel mulai uji 2026"): ganti TF/simbol → plot &
         tabel stats dari TF LAMA TIDAK BOLEH dipakai (dulu stats run
         1h nyangkut tampil di chart 5m — Mulai uji 29 Jun 2026) →
         recompute wajib utk simbol+TF yang baru. */
      const c = ctx
      if (!c) return
      if (lastPlots) {
        if (ctxRunKey(c) !== lastRunKey) { run(true); return }
        maybeEmit(c)
        return
      }
      run(false)
    },
    onViewport: () => { if (lastPlots && ctx) maybeEmit(ctx) },
    setInputs: (i: Record<string, any>) => {
      const s = String(i?.scriptId || i?.slug || '')
      if (s && s !== scriptKey) { scriptKey = s; lastPlots = null; lastTrades = []; lastBarsSig = ''; lastRunKey = ''; run(true) }
    },
    suspend: () => { /* tetap hidup — data murah dari cache */ },
    resume: () => {
      const c = ctx
      if (!c) return
      if (lastPlots && ctxRunKey(c) === lastRunKey) maybeEmit(c)
      else run(false)
    },
    stop: () => { clearTimers(); ctx = null },
  }
}

let protectedRegistered = false
function ensureProtectedNativeRegistered(register: (d: any) => void) {
  if (protectedRegistered) return
  protectedRegistered = true
  register({
    type: PROTECTED_TYPE,
    title: 'Luxtradee Pro Script',
    shortTitle: 'LTX Pro',
    paneHint: 'price',
    overlay: true,
    multiInstance: true,
    inputsSchema: () => [{ key: 'scriptId', type: 'text', defval: '', title: 'Script ID', visible: false } as any],
    defaultInputs: () => ({ scriptId: '' }),
    create: createProtectedInstance,
  })
}

/* ---------- Template awal editor ---------- */
const PINE_TEMPLATE = `//@version=6
strategy("Luxtradee Sinyal Entry Saya", overlay=true)

// ── Contoh sinyal: persilangan EMA 9 × EMA 21 ──────────────
// Ganti logika di bawah dengan rumus milikmu sendiri.
emaCepat = ta.ema(close, 9)
emaLambat = ta.ema(close, 21)

plot(emaCepat, color=color.orange, linewidth=2)
plot(emaLambat, color=color.aqua, linewidth=2)

beli = ta.crossover(emaCepat, emaLambat)   // sinyal BUY
jual = ta.crossunder(emaCepat, emaLambat)  // sinyal SELL

// ── Entry otomatis: muncul di chart + jadi push HP via 🔔 ──
if beli
    strategy.entry("Long", strategy.long)
if jual
    strategy.entry("Short", strategy.short)

// ── SL 1% / TP 3% otomatis (ubah sesuai gaya tradingmu) ───
if strategy.position_size > 0
    strategy.exit("Keluar Long", from_entry="Long", stop=close * 0.99, limit=close * 1.03)
if strategy.position_size < 0
    strategy.exit("Keluar Short", from_entry="Short", stop=close * 1.01, limit=close * 0.97)`

/* ============================================================
   AUTO-SAVE INDIKATOR (localStorage) — permintaan Bos:
   "kalau keluar halaman chart semua kembali, semua pengaturan chart
   pine hilang harus masukin lagi" → state indikator aktif + draft
   editor Pine disimpan dan dipanggil ulang setiap terminal dibuka.
   ============================================================ */
const INDICATOR_STORE_KEY = 'luxtradee_active_indicators'
const PINE_DRAFT_KEY = 'luxtradee_pine_draft'

interface StoredIndicatorState { v: 1; presets: number[]; protected: string[]; pines: string[]; savedAt: number }

function loadStoredIndicators(): StoredIndicatorState | null {
  try {
    const raw = localStorage.getItem(INDICATOR_STORE_KEY)
    if (!raw) return null
    const j = JSON.parse(raw)
    if (!j || !Array.isArray(j.presets) || !Array.isArray(j.protected)) return null
    return {
      v: 1,
      presets: j.presets.filter((n: any) => Number.isInteger(n) && n >= 0 && n < PINE_PRESETS.length).slice(0, PINE_PRESETS.length),
      protected: j.protected.filter((s: any) => typeof s === 'string' && s).slice(0, 12),
      /* FIX "masukin pine keluar ga aktif, harus masukin lagi":
         skrip Pine milik user yang aktif di chart ikut tersimpan. */
      pines: Array.isArray(j.pines) ? j.pines.filter((s: any) => typeof s === 'string' && s).slice(0, 12) : [],
      savedAt: Number(j.savedAt) || 0,
    }
  } catch { return null }
}

function saveStoredIndicators(state: { presets: number[]; protected: string[]; pines: string[] }) {
  try {
    localStorage.setItem(INDICATOR_STORE_KEY, JSON.stringify({ v: 1, presets: state.presets, protected: state.protected, pines: state.pines, savedAt: Date.now() }))
  } catch { /* storage penuh / private mode — diam */ }
}

/** Timeframe Vela (menit, string) → ms per bar — utk jendela viewport marker trade. */
const TF_MS: Record<string, number> = {
  '5': 5 * 60_000, '15': 15 * 60_000, '30': 30 * 60_000, '60': 60 * 60_000,
  '120': 2 * 3_600_000, '240': 4 * 3_600_000,
  '1D': 86_400_000, 'D': 86_400_000, '1440': 86_400_000,
  '1W': 604_800_000, 'W': 604_800_000, '10080': 604_800_000,
}

/* ---------- Format Strategy Tester (ala Strategy Tester TradingView) ---------- */
function fmtTesterPrice(p: number | null): string {
  if (p == null || !Number.isFinite(p)) return '-'
  const abs = Math.abs(p)
  const digits = abs >= 1000 ? 2 : abs >= 10 ? 3 : 5
  return p.toFixed(digits)
}
function fmtTesterTime(ms: number | null): string {
  if (!ms) return '-'
  try {
    return new Date(ms).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch { return '-' }
}
function fmtTesterPnl(p: number | null): string {
  if (p == null || !Number.isFinite(p)) return '-'
  return `${p >= 0 ? '+' : '-'}${Math.abs(p).toFixed(2)}`
}
function fmtTesterQty(q: number | null): string {
  if (q == null || !Number.isFinite(q)) return '-'
  return String(Math.abs(Number(q.toFixed(8))))
}

interface PineScriptRow { id: string; name: string; source: string }
interface QuotaBadge { isPro: boolean; used: number; limit: number | null; remaining: number | null }

/* ---------- Alert otomatis Pine (Task 44 — klik 🔔 aktif 24 jam) ---------- */
interface AlertSubRow {
  id: string; scriptId: string; scriptName: string; scriptKind?: 'protected' | 'pine'; symbol: string; interval: string; enabled: boolean; orphan?: boolean
  /* Migrasi 044 — bukti evaluasi runner: true = skrip beneran dieksekusi
     engine; false = gagal (lastEvalError); null/undefined = belum dirun */
  lastEvalAt?: string | null; lastEvalOk?: boolean | null; lastEvalError?: string | null
}
const ALERT_TFS: Array<{ v: string; label: string }> = [
  { v: '5m', label: '5 Menit' }, { v: '15m', label: '15 Menit' }, { v: '30m', label: '30 Menit' },
  { v: '1h', label: '1 Jam' }, { v: '2h', label: '2 Jam' }, { v: '4h', label: '4 Jam' },
  { v: '1d', label: '1 Hari' }, { v: '1w', label: '1 Minggu' },
]
/* Timeframe chart Vela → interval kanonik server */
const TF_TO_ALERT: Record<string, string> = {
  '5': '5m', '15': '15m', '30': '30m', '60': '1h', '120': '2h', '240': '4h',
  '1D': '1d', 'D': '1d', '1440': '1d', '1W': '1w', 'W': '1w', '10080': '1w',
}
function tfToAlert(tf: string): string {
  const t = String(tf || '').trim()
  return TF_TO_ALERT[t] || (/^\d+m$|^\d+h$|^1d$|^1w$/.test(t) ? t : '1h')
}

/* Migrasi 044 — bukti nyata "skrip beneran jalan ga si?": tiap baris
   langganan menampilkan hasil evaluasi runner TERAKHIR (ok / gagal +
   alasan engine / belum pernah dirun) — bukan janji. */
function alertHealthLine(s: AlertSubRow): { text: string; cls: string } {
  const when = s.lastEvalAt
    ? (() => {
        const ms = Date.now() - new Date(s.lastEvalAt as string).getTime()
        if (!Number.isFinite(ms) || ms < 0) return ''
        const m = Math.floor(ms / 60_000)
        if (m < 1) return 'baru saja'
        if (m < 60) return `${m} mnt lalu`
        const h = Math.floor(m / 60)
        if (h < 24) return `${h} jam lalu`
        return `${Math.floor(h / 24)} hari lalu`
      })()
    : ''
  if (s.lastEvalOk === true) {
    return { text: `Skrip beneran dievaluasi engine${when ? ` · cek ${when}` : ''} — jalan normal, nunggu kondisi sinyal terpicu`, cls: 'text-emerald-300/85' }
  }
  if (s.lastEvalOk === false) {
    const err = String(s.lastEvalError || 'alasan tidak diketahui').slice(0, 160)
    return { text: `Engine GAGAL menjalankan skrip${when ? ` (${when})` : ''}: ${err} — perbaiki skrip lalu simpan ulang`, cls: 'text-red-300/90' }
  }
  return { text: 'Belum ada evaluasi — runner mengeksekusi skrip ini otomatis tiap ±5 menit', cls: 'text-white/45' }
}
/** Hasil test alert → kalimat manusiawi untuk dialog.
    FIX: dulu run gagal (candle kosong / engine error) TETAP tampil
    "✅ Berjalan normal" — Bos tes tidak ada notif tanpa tahu
    penyebabnya. Sekarang: error pipeline + alasan kirim ditampilkan
    apa adanya (jujur), baru pesan sukses. Notifikasi dikirim lewat
    WEB PUSH (layar HP) — jalur Telegram dihapus (riwayat git). */
function alertTestMsg(tj: any): { kind: 'ok' | 'warn'; text: string } {
  /* Engine Pine memang TIDAK bisa jalan di runtime produksi (Cloudflare
     Workers melarang code generation) — ini BUKAN kegagalan: alert tetap
     terdaftar & dievaluasi runner eksternal (GitHub Actions, Node penuh)
     tiap ±5 menit. Dulu tampil "⚠️ Pengecekan GAGAL" → Bos kira alertnya
     error/padahal normal (foto Bos 2026-11-07). Sekarang: pesan ramah. */
  if (tj?.engineDeferred) {
    /* FIX lanjutan (foto Bos 7 Nov): server produksi sekarang TETAP
       mengirim push tes 🧪 walau engine tidak bisa jalan (codegen
       dinonaktifkan Cloudflare) — pesan menyebut itu supaya Bos tahu
       jalur Pine→HP-nya sudah TERBUKTI, bukan sekadar janji. */
    const tes = tj?.testMessage
      ? ' Tes push juga baru saja dikirim ke layar HP kamu — cek sekarang.'
      : ''
    return { kind: 'ok', text: `Alert AKTIF 24 jam! Pengecekan langsung memang tidak tersedia di server produksi — skrip kamu dievaluasi runner eksternal tiap ±5 menit, dan notifikasi Entry/SL/TP otomatis masuk ke layar HP begitu ada sinyal.${tes} Tidak perlu lakukan apa-apa lagi.` }
  }
  if (tj?.ok === false || tj?.error) {
    return { kind: 'warn', text: `Pengecekan GAGAL: ${String(tj?.error || 'tidak diketahui').slice(0, 180)} — alert tetap terdaftar, server mencoba lagi otomatis.` }
  }
  const n = Array.isArray(tj?.triggers) ? tj.triggers.length : 0
  if (tj?.sent > 0 && n > 0 && !tj?.testMessage) return { kind: 'ok', text: 'Sinyal ditemukan & notifikasi terkirim ke layar HP! Alert tetap aktif 24 jam.' }
  if (tj?.sent > 0 && tj?.testMessage) return { kind: 'ok', text: 'Tes pipeline BERHASIL — cek notifikasi di layar HP kamu. Alert aktif 24 jam, dicek otomatis tiap 5 menit.' }
  if (tj?.sent > 0) return { kind: 'ok', text: `${n} sinyal di bar ini terkirim ke layar HP. Alert aktif 24 jam.` }
  /* sent === 0 tapi pipeline OK — tampilkan ALASAN nyata dari runner */
  const reason = Array.isArray(tj?.perUser) && tj.perUser.length && tj.perUser[0]?.reason
    ? String(tj.perUser[0].reason)
    : ''
  if (/notifikasi|push/i.test(reason)) return { kind: 'warn', text: `Pengecekan jalan, tapi notifikasi gagal terkirim (${reason}). Izinkan notifikasi di browser/PWA lalu tes lagi.` }
  return { kind: 'ok', text: 'Berjalan normal — belum ada sinyal di bar terakhir. Alert dicek server otomatis tiap 5 menit, 24 jam.' }
}

/**
 * Hitung tinggi auto-fit (REVISI Bos: "ukuran chart agak dikasih
 * celah dikit dibawahnya 20%/30% lah biar ga full bgt"):
 * chart memakai ±75% sisa viewport (viewport − header sticky −
 * footer − jarak napas) → SISANYA ±25% jadi celah kosong di
 * BAWAH chart. Diklem min 420px (mobile) / max 1400px.
 */
function computeFitHeight(host: HTMLElement): string | null {
  try {
    const head = document.querySelector('header')
    const headH = head ? head.offsetHeight : 0
    const foot = document.querySelector('footer')
    const footH = foot ? foot.offsetHeight : 0
    const avail = window.innerHeight - headH - footH - 28
    const fit = Math.round(avail * 0.75) // celah ±25% di bawah chart
    return `${Math.round(Math.min(Math.max(fit, 420), 1400))}px`
  } catch {
    return null
  }
}
export default function VelaChartTerminal({
  height = 'clamp(420px, 62vh, 640px)',
  defaultSymbol = 'XAUUSD',
  defaultTimeframe = '60',
}: {
  /** Tinggi awal sebelum auto-fit aktif (setelah mount, chart otomatis
   *  mengisi sisa ruang viewport sampai footer — lihat effect AUTO-FIT). */
  height?: string
  defaultSymbol?: string
  defaultTimeframe?: string
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const wsRef = useRef<VelaWorkspace | null>(null)
  const deadRef = useRef(false) // unmount flag utk listener async
  const [booting, setBooting] = useState(true)
  const [bootError, setBootError] = useState<string | null>(null)

  /* ============================================================
     STRATEGY TESTER (ala TradingView) — skrip strategy() milik user
     Jawaban Bos: "pine script udah kupasang tapi buy and sell ga ada
     propertiesnya didalem ga kaya trading view". Dulu panah BUY/SELL
     dari engine Vela tampil TANPA apa pun — tidak ada harga entry,
     tidak ada garis ke exit, tidak ada PnL, tidak ada daftar trade.
     Sekarang: chart.on('script:run') menangkap setiap run strategy →
     tarik run.trades() + broker state → panel tester (Net P&L, win
     rate, PF, DD, daftar trade klik-lompat) + indikator native yang
     menggambar garis entry→exit + label harga/PnL di chart.
     ============================================================ */
  interface TesterRow extends StrategyPnlTrade { qty: number | null }
  interface StrategyTesterState {
    id: string
    title: string
    netPnl: number | null
    grossProfit: number | null
    grossLoss: number | null
    wins: number
    losses: number
    even: number
    maxDrawdown: number | null
    openNow: boolean
    rows: TesterRow[]
    truncated: boolean
    /* DIAGNOSTIK (Bos: "beneran berfungsi ga strategi testernya?") —
       bukti nyata bahwa engine BENAR-BENAR menilai skrip: jumlah bar
       harga yang dievaluasi + apakah history penuh + warning engine
       (fungsi tak didukung dsb.) supaya 0 trade ada PENJELASANNYA,
       bukan +0.00 diam tanpa jejak. */
    evaluatedBars: number | null
    lastBarTime: number | null
    complete: boolean
    warnings: string[]
  }
  const [strategyTester, setStrategyTester] = useState<StrategyTesterState | null>(null)
  const [testerOpen, setTesterOpen] = useState(true)
  const stratSigRef = useRef('') // anti re-pull: hanya saat broker state berubah
  const stratIdRef = useRef('') // id indikator strategy yang sedang ditampilkan

  /* Pasang/perbarui indikator PnL di chart (garis entry→exit + label).
     Snapshot penuh: lepas instance lama, pasang ulang dgn trade kini —
     hanya dipanggil saat broker state berubah (bukan tiap tick). */
  const updateStrategyPnl = (rows: TesterRow[]) => {
    const chart: any = (wsRef.current as any)?.chart
    if (!chart || typeof chart.addNativeIndicator !== 'function') return
    try {
      for (const h of ((typeof chart.indicators === 'function' ? chart.indicators() : []) || []) as any[]) {
        if (h?.nativeType === STRATEGY_PNL_TYPE) { try { h.remove() } catch { /* diam */ } }
      }
      const compact: StrategyPnlTrade[] = rows.slice(-250).map((t) => ({
        side: t.side, entryTime: t.entryTime, entryPrice: t.entryPrice,
        exitTime: t.exitTime, exitPrice: t.exitPrice, pnl: t.pnl, open: t.open,
      }))
      if (compact.length) {
        chart.addNativeIndicator(STRATEGY_PNL_TYPE, { inputs: { trades: JSON.stringify(compact) } })
      }
    } catch { /* dekoratif — jangan guncang chart */ }
  }

  /* StrategyTrade engine → baris tester + trade PnL chart */
  const mapStrategyTrades = (all: readonly any[]): { rows: TesterRow[]; truncated: boolean } => {
    const truncated = all.length > 500
    const rows: TesterRow[] = all
      .slice(-500)
      .map((t) => ({
        side: t?.side === 'short' ? 'short' as const : 'long' as const,
        entryTime: Number(t?.entry?.time) || 0,
        entryPrice: Number(t?.entry?.price),
        exitTime: t?.exit?.time != null ? Number(t.exit.time) : null,
        exitPrice: t?.exit?.price != null ? Number(t.exit.price) : null,
        pnl: t?.pnl != null && Number.isFinite(Number(t.pnl)) ? Number(t.pnl) : null,
        open: t?.open === true,
        qty: t?.qty != null && Number.isFinite(Number(t.qty)) ? Number(t.qty) : null,
      }))
      .filter((t) => t.entryTime > 0 && Number.isFinite(t.entryPrice))
    return { rows, truncated }
  }

  /* Dengarkan script:run chart — pasang SEKALI setelah workspace siap.
     Dipanggil dari effect boot (setelah WS dibuat). */
  const attachStrategyTesterListeners = async () => {
    let chart: any = null
    for (let i = 0; i < 40 && !deadRef.current; i++) {
      try { chart = (wsRef.current as any)?.chart } catch { chart = null } // getter bisa melempar sebelum init
      if (chart && typeof chart.on === 'function') break
      await new Promise((r) => setTimeout(r, 500))
    }
    if (!chart || typeof chart.on !== 'function' || deadRef.current) return

    const pullTrades = async (run: any) => {
      try {
        const s = run.strategy || {}
        /* Signature murah dari broker state (naik di ATAS engine tanpa
           tarik ledger) — trades() hanya ditarik saat ia BERUBAH. */
        const sig = [run.id, s.wins ?? '', s.losses ?? '', s.even ?? '', s.position ?? '', s.netPnl ?? '', run.complete ? 1 : 0].join(':')
        if (sig === stratSigRef.current) return
        stratSigRef.current = sig
        stratIdRef.current = String(run.id || '')
        const all = (await (typeof run.trades === 'function' ? run.trades() : Promise.resolve([]))) || []
        const { rows, truncated } = mapStrategyTrades(all as any[])
        /* DIAGNOSTIK: bar yang benar-benar dinilai engine + warning skrip.
           run.bar = index bar terakhir yang dihitung (0-based) → jumlah
           bar ≈ bar+1. Warnings = pesan engine (mis. fungsi tidak
           didukung) — inilah penjelasan kenapa sebuah strategy bisa 0
           trade di data kita padahal jalan di TradingView. */
        const evaluatedBars = Number.isFinite(Number(run?.bar)) ? Math.max(Number(run.bar) + 1, 0) : null
        const lastBarTime = Number.isFinite(Number(run?.time)) ? Number(run.time) : null
        const warnings = (Array.isArray(run?.warnings) ? run.warnings : [])
          .map((w: any) => String(w?.message || w?.warning || w || '').trim())
          .filter(Boolean)
          .slice(0, 4)
        setStrategyTester({
          id: String(run.id || ''),
          title: String(run.title || 'Strategy'),
          netPnl: s.netPnl != null ? Number(s.netPnl) : null,
          grossProfit: s.grossProfit != null ? Number(s.grossProfit) : null,
          grossLoss: s.grossLoss != null ? Number(s.grossLoss) : null,
          wins: Number(s.wins) || 0,
          losses: Number(s.losses) || 0,
          even: Number(s.even) || 0,
          maxDrawdown: s.maxDrawdown != null ? Number(s.maxDrawdown) : null,
          openNow: Number(s.position) !== 0,
          rows,
          truncated,
          evaluatedBars,
          lastBarTime,
          complete: run?.complete !== false,
          warnings,
        })
        updateStrategyPnl(rows)
      } catch { /* engine belum siap — run berikutnya menarik ulang */ }
    }

    const warnShownAt = new Map<string, number>() // anti-spam toast per skrip
    const onScriptRun = (run: any) => {
      if (!run) return
      /* DIAGNOSTIK indikator (Bos: "di chart ga tampil kek gitu") —
         warning engine dulu SENYAP total untuk skrip indikator: fungsi
         yang tidak didukung membuat elemen tidak tergambar tanpa jejak.
         Sekarang muncul toast jelas (sekali per skrip per 30 detik). */
      const warnings = (Array.isArray(run?.warnings) ? run.warnings : [])
        .map((w: any) => String(w?.message || w?.warning || w || '').trim())
        .filter(Boolean)
      if (warnings.length) {
        const now = Date.now()
        const key = String(run.id || run.title || '?')
        if (now - (warnShownAt.get(key) || 0) > 30_000) {
          warnShownAt.set(key, now)
          try {
            wsRef.current?.toast?.(
              `Skrip "${String(run.title || 'Pine')}": ${warnings.length} fungsi tidak didukung engine — ${warnings[0].slice(0, 120)}`,
              'error', 9000
            )
          } catch { /* diam */ }
        }
      }
      if (run.kind !== 'strategy') return // indikator biasa → selesai (warning sudah ditampilkan)
      void pullTrades(run)
    }
    const onIndicatorRemoved = (p: any) => {
      /* Strategy dilepas dari chart → panel + gambar PnL ikut bersih */
      if (p?.id && stratIdRef.current && String(p.id) === stratIdRef.current) {
        stratSigRef.current = ''
        stratIdRef.current = ''
        setStrategyTester(null)
        updateStrategyPnl([])
      }
    }
    const onIndicatorError = (p: any) => {
      /* FIX "pine ga tampil tanpa jejak" — compile/run gagal dulu hanya
         muncul di console; sekarang toast jelas di chart. */
      const msg = String((p as any)?.error?.message || (p as any)?.error || 'gagal tidak diketahui').slice(0, 180)
      try { wsRef.current?.toast?.(`Skrip Pine gagal jalan — ${msg}`, 'error', 9000) } catch { /* diam */ }
    }
    try { chart.on('script:run', onScriptRun) } catch { /* diam */ }
    try { chart.on('indicator:removed', onIndicatorRemoved) } catch { /* diam */ }
    try { chart.on('indicator:error', onIndicatorError) } catch { /* diam */ }
  }

  /* ---------- AUTO-FIT tinggi chart ----------
   * Bos: "ukuran chart agak dikasih celah dikit dibawahnya
   * 20%/30% lah biar ga full bgt" → tinggi = 75% sisa viewport
   * (lihat computeFitHeight) — sisanya celah kosong di bawah.
   * Dua pasang — kunci anti-crash (error openTime saat Vela boot
   * kena resize container di tengah inisialisasi):
   *   Pass 1 useLayoutEffect: hitung & set tinggi SEBELUM effect
   *     boot Vela jalan → workspace lahir dengan ukuran final.
   *   Pass 2 (booting=false): ResizeObserver baru dipasang —
   *     adaptif banner PWA/promo muncul/hilang & viewport resize.
   * Tidak bisa loop: tinggi host tidak memengaruhi header/footer,
   * dan setState di-guard sama-nilai. Min 420px (mobile). */
  const [autoH, setAutoH] = useState<string | null>(null)

  useLayoutEffect(() => {
    /* Pass 1 — sebelum Vela boot: pasang ukuran final dari awal */
    const host = hostRef.current
    if (!host) return
    const h = computeFitHeight(host)
    if (h) setAutoH(h)
  }, [])

  useEffect(() => {
    /* Pass 2 — setelah boot selesai: reaksi perubahan layout */
    if (booting) return
    const host = hostRef.current
    if (!host) return
    let raf = 0
    const apply = () => {
      const h = computeFitHeight(host)
      if (h) setAutoH((prev) => (prev === h ? prev : h))
    }
    apply()
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(apply)
    })
    ro.observe(document.body)
    if (host.parentElement) ro.observe(host.parentElement)
    window.addEventListener('resize', apply)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', apply)
    }
  }, [booting])

  /* ---------- Pine editor state ---------- */
  const [pineOpen, setPineOpen] = useState(false)
  const [pineName, setPineName] = useState('Skrip saya')
  const [pineSource, setPineSource] = useState(PINE_TEMPLATE)
  const [pineBusy, setPineBusy] = useState(false)
  const [pineMsg, setPineMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [pineScripts, setPineScripts] = useState<PineScriptRow[]>([])
  const [pineQuota, setPineQuota] = useState<QuotaBadge | null>(null)

  /* ---------- Upgrade paywall dialog ---------- */
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null)

  /* ---------- Preset indikator (chip) — free 1 · pro 3 ---------- */
  const [activePresets, setActivePresets] = useState<Record<number, boolean>>({})
  const [presetBusy, setPresetBusy] = useState<number | null>(null)
  const [presetMsg, setPresetMsg] = useState<string | null>(null)

  /* ---------- Indikator Eksklusif (Protected Pine — Pro saja) ---------- */
  const [protectedScripts, setProtectedScripts] = useState<ProtectedScriptMeta[]>([])
  const [protectedIsPro, setProtectedIsPro] = useState(false)
  const [activeProtected, setActiveProtected] = useState<Record<string, boolean>>({})
  const [protectedBusy, setProtectedBusy] = useState<string | null>(null)
  const [protectedMsg, setProtectedMsg] = useState<string | null>(null)

  /* ---------- Alert otomatis Pine (🔔 klik aktif 24 jam) ---------- */
  const [alertDlg, setAlertDialog] = useState<ProtectedScriptMeta | null>(null)
  const [alertSubs, setAlertSubs] = useState<AlertSubRow[]>([])
  const [alertSymbol, setAlertSymbol] = useState('XAUUSD')
  const [alertInterval, setAlertInterval] = useState('1h')
  const [alertSaving, setAlertSaving] = useState(false)
  const [alertDlgMsg, setAlertDlgMsg] = useState<{ kind: 'ok' | 'err' | 'warn'; text: string } | null>(null)

  /* ---------- Pusat Notifikasi (tombol 🔔 di toolbar chart) ----------
     Permintaan Bos: "ga ada tombol aktifin notif untuk chart dan
     pine" → satu tombol jelas di toolbar yang membuka dialog untuk
     MENGAKTIFKAN alert (pilih skrip + simbol + TF ikut chart) DAN
     melihat/mengelola semua langganan (termasuk yatim). */
  const [notifDlg, setNotifDlg] = useState(false)
  const [notifScript, setNotifScript] = useState('') // "protected:<id>" | "pine:<id>"

  /* ---------- Pine milik user: status aktif di chart ----------
     FIX "setiap masukin pine keluarnya ga aktif, harus masukin
     lagi": skrip yang di-▶-kan ditandai aktif → di-restore otomatis
     setiap terminal dibuka + badge ✓ pada daftar Skrip tersimpan. */
  const [activePines, setActivePines] = useState<Record<string, boolean>>({})
  const restoredPinesRef = useRef(false)

  /* ---------- Tabel performa skrip default (ala strategy Bos) ----------
     Server compile-pine mengirim meta.stats saat indikator default
     aktif → tabel Net P&L s.d. Status tampil di kanan-bawah chart
     (posisi tablePos Pine master: "Bottom Right"). */
  const [protectedStats, setProtectedStats] = useState<{ key: string; stats: ProtectedStats } | null>(null)
  const [statsDismissed, setStatsDismissed] = useState(false)

  /* ---------- Boot Vela workspace (sekali) ---------- */
  useEffect(() => {
    let dead = false
    /* RESET unmount-flag: React StrictMode (dev) mount→cleanup→mount dua
       kali — cleanup pertama set deadRef=true; tanpa reset di sini,
       attachStrategyTesterListeners di mount kedua langsung batal dan
       Strategy Tester tidak pernah terpasang di dev. */
    deadRef.current = false
    ;(async () => {
      try {
        const [{ VelaWorkspace: WS }, { LuxtradeeForexProvider }, { PineEngine }, velaCore] = await Promise.all([
          import('@luxalgo/vela/workspace'),
          import('@/components/vela/LuxtradeeProvider'),
          import('@luxalgo/vela-pinets'),
          import('@luxalgo/vela'),
        ])
        if (dead || !hostRef.current) return
        /* Native indicator utk hasil Protected Pine (server-computed)
           + Trade Marker (klik Riwayat Trade → garis/marker di chart)
           — daftar SEBELUM chart dibuat supaya addNativeIndicator hidup */
        ensureProtectedNativeRegistered((velaCore as any).registerNativeIndicator)
        registerTradeMarkerNative((velaCore as any).registerNativeIndicator)
        registerStrategyPnlNative((velaCore as any).registerNativeIndicator)
        const ws = new WS(hostRef.current, {
          layout: false, // satu chart penuh
          symbol: defaultSymbol,
          timeframe: defaultTimeframe,
          live: true,
          theme: 'dark',
          /* Branding Vela dimatikan via opsi resmi (bukan hack DOM) —
             area chart bersih, fokus ke identitas Luxtradee */
          watermark: false,
          /* Gaya candle Luxtradee: emerald naik / merah turun */
          upColor: '#10b981',
          downColor: '#ef4444',
          /* Datafeed (urutan FINAL Bos — BINANCE DIBUANG, semua via feed
             Luxtradee /api/candles: TradingView → Twelve Data →
             Yahoo; FX/Gold/US100/crypto satu pintu keyless) */
          providers: {
            luxtradee: () => new LuxtradeeForexProvider(), // TV→TD→Yahoo
          },
          /* Pine Script® engine — in-process (paling stabil).
             Skrip berat nanti bisa ganti PineWorkerEngine. */
          engines: { pine: () => new PineEngine() },
          indicators: PINE_PRESETS,
          persist: 'luxtradee-vela-v1', // restore layout/indikator/gambar user
        })
        wsRef.current = ws
        setBooting(false)
        /* ============================================================
           STRATEGY TESTER ala TradingView (jawaban Bos: "pine script
           udah kupasang tapi buy and sell ga ada propertiesnya
           didalem ga kaya trading view") — dengarkan script:run:
           setiap skrip STRATEGY milik user yang jalan di chart →
           tarik daftar trade + broker state (Net P&L, win rate, PF,
           DD) → tampilkan panel tester + pasang indikator PnL yang
           menggambar garis entry→exit + label harga/PnL di chart.
           ============================================================ */
        void attachStrategyTesterListeners()
      } catch (x: any) {
        if (!dead) {
          setBootError(String(x?.message || x).slice(0, 160))
          setBooting(false)
        }
      }
    })()
    return () => {
      dead = true
      deadRef.current = true
      try { wsRef.current?.destroy() } catch { /* ignore */ }
      wsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------- Alert otomatis Pine: muat langganan ---------- */
  const loadAlertSubs = useCallback(async () => {
    try {
      const r = await fetch('/api/pine/alerts', { cache: 'no-store' })
      if (!r.ok) return
      const j: any = await r.json()
      setAlertSubs((Array.isArray(j?.subscriptions) ? j.subscriptions : []).map((x: any) => ({ ...x, scriptKind: x.scriptKind === 'pine' ? 'pine' : 'protected' })))
      if (typeof j?.isPro === 'boolean') setProtectedIsPro(j.isPro)
    } catch { /* belum login — dot bell cukup kosong */ }
  }, [])

  /* ---------- Kuota badge (mount) ---------- */
  const refreshQuotas = useCallback(async () => {
    try {
      const [p, pr] = await Promise.all([
        fetch('/api/pine/save', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/compile-pine', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ])
      if (p?.quota) setPineQuota(p.quota)
      if (p?.scripts) setPineScripts(p.scripts)
      if (pr) {
        setProtectedIsPro(pr.isPro === true)
        if (Array.isArray(pr.scripts)) setProtectedScripts(pr.scripts)
      }
      loadAlertSubs()
    } catch { /* belum login — badge disembunyikan */ }
  }, [loadAlertSubs])
  useEffect(() => { refreshQuotas() }, [refreshQuotas])

  /* ============================================================
     AUTO-SAVE & RESTORE INDIKATOR (localStorage) — permintaan Bos:
     "kalau keluar halaman chart semua kembali, semua pengaturan
     chart pine hilang harus masukin lagi" + Pine Master otomatis
     termuat secara DEFAULT saat terminal dibuka.
     ============================================================
     - Preset Pine (EMA/RSI/VWAP) = script indicator "external" yang
       TIDAK di-persist Vela → kita panggil ulang sendiri dari
       localStorage.
     - Protected Pine = native indicator (di-persist Vela bila
       tersimpan) → yang belum ada kita tambahkan; yang sudah
       dipulihkan persist cukup ditandai aktif.
     - Pine Master (Luxtradee Candle Impulsif) SELALU dimuat BY SLUG
       TANPA menunggu daftar API (fix Bos: "harus masukin pine dulu
       baru keluar log entry sl tp" — bila API list lambat/gagal,
       indikator default tetap tampil di chart seketika). */
  const restoredRef = useRef(false) // write-guard: state aman ditulis ke localStorage
  const restoredPresetsRef = useRef(false)
  const restoredProtectedRef = useRef(false)
  const [restoreRetry, setRestoreRetry] = useState(0)
  useEffect(() => {
    if (booting) return
    /* Restore dua BAGIAN yang saling lepas (fix bug lama: sebelumnya
       seluruh restore menunggu daftar protected — bila API list gagal/
       401, preset EMA/RSI/VWAP ikut tidak dipulihkan = "pengaturan
       hilang"). Sekarang:
       - PRESETS     → dipulihkan segera setelah chart siap.
       - PROTECTED   → Pine Master default dipulihkan SEKETIKA (by
                       slug); skrip eksklusif lain menyusul saat
                       daftar skrip tersedia. */
    const needPresets = !restoredPresetsRef.current
    const needProtected = !restoredProtectedRef.current
    if (!needPresets && !needProtected) return
    const t = setTimeout(async () => {
      /* Tunggu chart siap (maks ±20 detik) — boot bisa lambat saat
         compile/dev; kalau belum siap juga, retry otomatis via
         restoreRetry (efek terpicu ulang, refs belum terisi). */
      let chart: any = null
      for (let i = 0; i < 20; i++) {
        chart = (wsRef.current as any)?.chart
        if (chart && typeof chart.addNativeIndicator === 'function') break
        await new Promise((r) => setTimeout(r, 1000))
      }
      if (!chart || typeof chart.addNativeIndicator !== 'function') {
        setRestoreRetry((n) => n + 1)
        return
      }
      restoredRef.current = true
      const stored = loadStoredIndicators()

      /* ---- 1) RESTORE preset Pine dari localStorage ---- */
      if (needPresets) {
        restoredPresetsRef.current = true
        const presetIdx = stored ? stored.presets : []
        for (const i of presetIdx) {
          try {
            const handles = ((typeof chart.indicators === 'function' ? chart.indicators() : []) || []) as any[]
            const already = handles.some((h) => h?.source === PINE_PRESETS[i].script)
            if (!already) await runOnChart(PINE_PRESETS[i].script)
            setActivePresets((m) => ({ ...m, [i]: true }))
          } catch { /* satu preset gagal → lanjut yang lain */ }
        }
      }

      /* ---- 2) RESTORE protected — Pine Master selalu dijamin ada,
              by slug / id (dua-duanya diterima server) ---- */
      if (needProtected) {
        restoredProtectedRef.current = true
        try {
          /* default punya dua kunci ekuivalen (slug & id) — jangan
             pasang dobel: satu saja cukup */
          const defMeta = protectedScripts.find((s) => s.slug === DEFAULT_PINE_SLUG)
          const defKeys = new Set<string>([DEFAULT_PINE_SLUG, ...(defMeta ? [defMeta.id] : [])])
          /* kunci = id skrip yang tersimpan saja. FIX 2026-11-05: Pine
             DEFAULT TIDAK di-auto-load lagi (dihapus dari UI) — restore
             hanya skrip eksklusif yang dulu diaktifkan user. */
          const keys = new Set<string>()
          for (const id of stored?.protected || []) {
            if (defKeys.has(String(id))) continue // jangan restore default
            if (!defMeta) continue // tanpa daftar API, UUID lama tak terverifikasi → skip
            keys.add(String(id))
          }
          for (const s of protectedScripts) {
            if (defKeys.has(s.id) || s.slug === DEFAULT_PINE_SLUG) continue
            if ((stored?.protected || []).includes(s.id)) keys.add(s.id)
          }
          /* baca scriptId instance yang SUDAH ada di chart (persist Vela) */
          const have = new Set<string>()
          try {
            for (const h of ((typeof chart.indicators === 'function' ? chart.indicators() : []) || []) as any[]) {
              if (h?.nativeType === PROTECTED_TYPE) have.add(String(h?.inputValues?.()?.scriptId || ''))
            }
          } catch { /* diam */ }
          const present: string[] = typeof chart.presentNativeIndicators === 'function'
            ? chart.presentNativeIndicators()
            : []
          const presentCount = present.filter((x) => x === PROTECTED_TYPE).length
          for (const key of keys) {
            const equivalents = defKeys.has(key) ? defKeys : new Set([key])
            if ([...equivalents].some((k) => have.has(k))) {
              setActiveProtected((m) => ({ ...m, [key]: true })) // sudah dipulihkan persist
              continue
            }
            /* Guard ANTI-DOBEL default: bila daftar skrip kosong (API
               gagal) tapi persist Vela sudah memulihkan instance dgn id
               tak dikenal — itu hampir pasti UUID default dr sesi lama.
               Jangan tambah instance slug lagi (garis Entry/SL/TP dobel). */
            if (defKeys.has(key) && !defMeta) {
              const unknown = [...have].filter((id) => id && !keys.has(id))
              if (unknown.length > 0 && presentCount > 0) {
                setActiveProtected((m) => ({ ...m, [key]: true }))
                continue
              }
            }
            if (presentCount > 0 && have.size < presentCount) {
              /* persist memulihkan instance tapi id tak terbaca —
                 jangan tambah dobel, cukup tandai aktif */
              setActiveProtected((m) => ({ ...m, [key]: true }))
              continue
            }
            chart.addNativeIndicator(PROTECTED_TYPE, { inputs: { scriptId: key } })
            setActiveProtected((m) => ({ ...m, [key]: true }))
          }

          /* ---- 3) REKONSILIASI ANTI-DOBEL (fix "LTX Pro" 2× di legend):
             persist internal Vela bisa memulihkan instance protected
             SETELAH restore kita jalan → dua instance dgn scriptId
             ekuivalen tampil bersamaan (garis Entry/SL/TP digambar
             dua kali). Pindai berkala 3× — equivalent (slug/id
             default) disisakan SATU; id lain persis satu per kunci. */
          const reconcile = (attempts: number) => {
            if (attempts <= 0) return
            setTimeout(() => {
              try {
                const c2: any = (wsRef.current as any)?.chart
                if (c2 && typeof c2.indicators === 'function') {
                  const prot = ((c2.indicators() || []) as any[]).filter((h) => h?.nativeType === PROTECTED_TYPE)
                  const seenDef = new Set<string>() // slug+uuid default = satu
                  const seenOther = new Set<string>()
                  for (const h of prot) {
                    const sid = String(h?.inputValues?.()?.scriptId || '')
                    if (!sid) continue // tak terbaca → biarkan (guard restore lain)
                    if (defKeys.has(sid)) {
                      if (seenDef.size >= 1) { try { h.remove() } catch { /* diam */ } }
                      else seenDef.add(sid)
                    } else if (seenOther.has(sid)) {
                      try { h.remove() } catch { /* diam */ }
                    } else seenOther.add(sid)
                  }
                }
              } catch { /* diam */ }
              reconcile(attempts - 1)
            }, 2500)
          }
          reconcile(3)
        } catch { /* diam — chip manual tetap tersedia */ }
      }
    }, 2000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booting, protectedScripts, restoreRetry])

  /* ---------- Tulis state → localStorage tiap perubahan ----------
     (hanya SETELAH restore pertama selesai — jangan menimpa state
     tersimpan dengan state kosong sebelum restore jalan). */
  useEffect(() => {
    if (!restoredRef.current) return
    const presets = Object.entries(activePresets).filter(([, v]) => v).map(([k]) => Number(k))
    const prot = Object.entries(activeProtected).filter(([, v]) => v).map(([k]) => k)
    const pines = Object.entries(activePines).filter(([, v]) => v).map(([k]) => k)
    saveStoredIndicators({ presets, protected: prot, pines })
  }, [activePresets, activeProtected, activePines])

  /* ---------- Draft editor Pine ikut tersimpan (tak hilang saat pindah menu) ---------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PINE_DRAFT_KEY)
      if (!raw) return
      const j = JSON.parse(raw)
      if (typeof j?.name === 'string' && j.name.trim()) setPineName(j.name)
      if (typeof j?.source === 'string' && j.source.trim()) setPineSource(j.source)
    } catch { /* diam */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(PINE_DRAFT_KEY, JSON.stringify({ name: pineName, source: pineSource, savedAt: Date.now() })) } catch { /* diam */ }
    }, 600)
    return () => clearTimeout(t)
  }, [pineName, pineSource])

  /* ---------- RESTORE Pine milik user (Skrip tersimpan aktif) ----------
     FIX "setiap masukin pine terus keluar pine nya ga aktif, harus
     masukin lagi": id skrip yang pernah aktif di chart disimpan di
     localStorage; setiap terminal dibuka, source-nya diambil dari
     /api/pine/save (GET) lalu dijalankan ulang ke chart otomatis —
     user TIDAK perlu memasukkan ulang pinenya. */
  useEffect(() => {
    if (booting) return
    if (restoredPinesRef.current) return
    if (pineScripts.length === 0) return // daftar belum datang dari API
    restoredPinesRef.current = true
    const ids = (loadStoredIndicators()?.pines || []).filter((id) => pineScripts.some((s) => s.id === id))
    if (!ids.length) return
    ;(async () => {
      /* tunggu chart siap (maks ±20 detik) */
      for (let i = 0; i < 20; i++) {
        const chart: any = (wsRef.current as any)?.chart
        if (chart && typeof chart.runIndicator === 'function') break
        await new Promise((r) => setTimeout(r, 1000))
      }
      const chart: any = (wsRef.current as any)?.chart
      if (!chart || typeof chart.runIndicator !== 'function') return
      for (const id of ids) {
        const s = pineScripts.find((x) => x.id === id)
        if (!s) continue
        try {
          const err = await runOnChart(s.source)
          if (!err) setActivePines((m) => ({ ...m, [id]: true }))
        } catch { /* satu gagal → lanjut yang lain */ }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booting, pineScripts])

  /* ---------- Status protected → pesan UI (error tidak diam lagi:
     sebelumnya POST gagal = tidak ada garis TANPA penjelasan) ---------- */
  useEffect(() => {
    const onStatus = (e: Event) => {
      const d = (e as CustomEvent)?.detail
      if (d && typeof d.message === 'string' && d.message) setProtectedMsg(d.message)
    }
    window.addEventListener(PROTECTED_STATUS_EVENT, onStatus)
    return () => window.removeEventListener(PROTECTED_STATUS_EVENT, onStatus)
  }, [])

  /* ---------- Stats performa protected → tabel chart ---------- */
  useEffect(() => {
    const onStats = (e: Event) => {
      const d = (e as CustomEvent)?.detail
      if (d?.key && d?.stats) {
        setProtectedStats({ key: String(d.key), stats: d.stats as ProtectedStats })
        setStatsDismissed(false) // skrip ganti simbol/TF → tabel segar lagi
      }
    }
    window.addEventListener(PROTECTED_STATS_EVENT, onStats)
    return () => window.removeEventListener(PROTECTED_STATS_EVENT, onStats)
  }, [])

  /* ============================================================
     KLIK RIWAYAT TRADE → MARKER CHART (fitur Bos)
     highlightTradeOnChart: lompat ke timestamp trade, gambar garis
     Entry (biru) / Exit (putih) / SL (merah) / TP (hijau) + marker
     panah Buy/Sell + callout di candle terkait.
     ============================================================ */
  const [tradeHighlightMsg, setTradeHighlightMsg] = useState<string | null>(null)
  const highlightTradeOnChart = useCallback(async (t: TradeMarkerPayload): Promise<boolean> => {
    const chart: any = (wsRef.current as any)?.chart
    if (!chart || typeof chart.addNativeIndicator !== 'function') return false // terminal belum siap
    try {
      /* 0) singkirkan marker trade sebelumnya (tipe multi-instance) */
      try {
        for (const h of ((typeof chart.indicators === 'function' ? chart.indicators() : []) || []) as any[]) {
          if (h?.nativeType === TRADE_MARKER_TYPE) { try { h.remove() } catch { /* diam */ } }
        }
      } catch { /* diam */ }

      /* 1) pindah simbol bila trade bukan simbol chart sekarang */
      const cur = String(chart.symbol || '').split(':').pop()?.toUpperCase() || ''
      const want = String(t.symbol || '').split(':').pop()?.toUpperCase() || cur
      if (want && cur && want !== cur && typeof chart.setSymbol === 'function') {
        chart.setSymbol(want)
        await new Promise((r) => setTimeout(r, 1400)) // beri waktu candle termuat
      }

      /* 2) pasang marker: garis Entry/Exit/SL/TP + panah Buy/Sell + callout */
      chart.addNativeIndicator(TRADE_MARKER_TYPE, {
        inputs: {
          entryPrice: t.entryPrice || 0,
          exitPrice: t.exitPrice || 0,
          slPrice: t.slPrice || 0,
          tpPrice: t.tpPrice || 0,
          timestamp: t.timestamp || 0,
          side: t.type === 'SELL' ? 'SELL' : 'BUY',
          symbol: want || cur || '',
          label: t.label || '',
        },
      })

      /* 3) arahkan viewport ke sekitar timestamp transaksi */
      if (typeof chart.setVisibleRange === 'function' && t.timestamp > 0) {
        const barMs = TF_MS[String(chart.timeframe || '60')] || 3_600_000
        try { chart.setVisibleRange({ from: t.timestamp - barMs * 40, to: t.timestamp + barMs * 20 }) } catch { /* diam */ }
      }
      return true
    } catch { return false }
  }, [])

  /* ---------- Strategy Tester: klik baris trade → lompat ke chart ---------- */
  const jumpToTesterTrade = (t: TesterRow) => {
    const chart: any = (wsRef.current as any)?.chart
    if (!chart || !t.entryTime || typeof chart.setVisibleRange !== 'function') return
    const barMs = TF_MS[String(chart.timeframe || '60')] || 3_600_000
    try {
      const to = t.exitTime || t.entryTime
      chart.setVisibleRange({ from: t.entryTime - barMs * 25, to: to + barMs * 15 })
    } catch { /* diam */ }
  }

  /* ---------- Konsumsi pesan highlight (Riwayat Trade / Jurnal / chat) ---------- */
  useEffect(() => {
    if (booting) return
    let alive = true
    const run = async (t: TradeMarkerPayload) => {
      /* tunggu chart + sejarah siap (maks ±8 detik) sebelum menggambar */
      for (let i = 0; i < 20 && alive; i++) {
        const chart: any = (wsRef.current as any)?.chart
        let n = 0
        try { n = (chart?.bars?.() || []).length } catch { /* diam */ }
        if (chart && n > 5) break
        await new Promise((r) => setTimeout(r, 400))
      }
      if (!alive) return
      const ok = await highlightTradeOnChart(t)
      if (!ok) return // chart belum siap → pesan tetap menunggu di localStorage
      try { consumePendingTradeHighlight({ remove: true }) } catch { /* diam */ }
      const when = t.timestamp > 0 ? new Date(t.timestamp).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
      setTradeHighlightMsg(`📍 Trade ${t.type} ${t.symbol} @ ${t.entryPrice}${when ? ` · ${when}` : ''} dimuat ke chart`)
      setTimeout(() => setTradeHighlightMsg(null), 8000)
    }
    /* pesan tertunda (user datang dari tab lain) */
    const pending = consumePendingTradeHighlight({ remove: false })
    if (pending) void run(pending)
    /* pesan live (chart sedang terbuka — mis. klik trade di chat) */
    const onEvt = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (d && typeof d.entryPrice === 'number' && typeof d.timestamp === 'number') void run(d as TradeMarkerPayload)
    }
    window.addEventListener(TRADE_HIGHLIGHT_EVENT, onEvt)
    return () => {
      alive = false
      window.removeEventListener(TRADE_HIGHLIGHT_EVENT, onEvt)
    }
  }, [booting, highlightTradeOnChart])

  /* ---------- Aksi alert otomatis (klik 🔔 → aktif + test / toggle / hapus) ---------- */
  const openAlertDialog = useCallback((s: ProtectedScriptMeta) => {
    /* Default simbol & TF ikut chart yang sedang dibuka */
    let sym = 'XAUUSD'
    let tf = '1h'
    try {
      const c: any = (wsRef.current as any)?.chart
      const cs = String(c?.symbol || '').split(':').pop()?.toUpperCase()
      if (cs) sym = cs
      if (c?.timeframe) tf = tfToAlert(String(c.timeframe))
    } catch { /* default tetap dipakai */ }
    setAlertSymbol(sym)
    setAlertInterval(tf)
    setAlertDlgMsg(null)
    setAlertDialog(s)
    loadAlertSubs()
  }, [loadAlertSubs])

  const saveAlertSub = useCallback(async (opts: { scriptId: string; symbol: string; interval: string; enabled: boolean; withTest?: boolean; scriptKind?: 'protected' | 'pine' }) => {
    setAlertSaving(true)
    setAlertDlgMsg(null)
    try {
      const res = await fetch('/api/pine/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: opts.scriptId, scriptKind: opts.scriptKind || 'protected', symbol: opts.symbol.trim(), timeframe: opts.interval, enabled: opts.enabled }),
      })
      const j: any = await res.json().catch(() => null)
      if (res.status === 403) { setAlertDialog(null); setUpgradeMsg(String(j?.error || 'Alert otomatis khusus member Pro.')); return }
      if (res.status === 401) { setAlertDlgMsg({ kind: 'err', text: 'Sesi habis — login ulang dulu ya.' }); return }
      if (!res.ok) { setAlertDlgMsg({ kind: 'err', text: String(j?.error || `HTTP ${res.status}`) }); return }
      await loadAlertSubs()
      if (!opts.withTest) {
        setAlertDlgMsg({ kind: 'ok', text: opts.enabled ? `Alert ${opts.symbol} ${opts.interval} dinyalakan.` : `Alert ${opts.symbol} ${opts.interval} dimatikan.` })
        return
      }
      /* Test langsung — user langsung lihat hasil evaluasi bar terakhir */
      const t = await fetch('/api/pine/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: opts.scriptId, scriptKind: opts.scriptKind || 'protected', symbol: opts.symbol.trim(), timeframe: opts.interval }),
      })
      const tj: any = await t.json().catch(() => null)
      if (!t.ok) {
        /* 502 = pipeline gagal (candle/engine) → tampilkan alasan NYATA,
           bukan pura-pura "berjalan normal" (keluhan Bos) */
        if (t.status === 502 && tj?.error) {
          setAlertDlgMsg(alertTestMsg(tj))
          return
        }
        setAlertDlgMsg({ kind: 'ok', text: `Alert aktif 24 jam — dicek otomatis tiap 5 menit. (Test gagal: ${String(tj?.error || t.status)})` })
        return
      }
      setAlertDlgMsg(alertTestMsg(tj))
    } catch (x: any) {
      setAlertDlgMsg({ kind: 'err', text: String(x?.message || x).slice(0, 140) })
    } finally { setAlertSaving(false) }
  }, [loadAlertSubs])

  const testAlertSub = useCallback(async (sub: AlertSubRow) => {
    setAlertSaving(true)
    setAlertDlgMsg(null)
    try {
      const t = await fetch('/api/pine/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId: sub.scriptId, scriptKind: sub.scriptKind || 'protected', symbol: sub.symbol, timeframe: sub.interval }),
      })
      const tj: any = await t.json().catch(() => null)
      if (!t.ok) {
        /* 502 engineDeferred = bukan gagal beneran → pesan ramah yang
           sama dengan tombol Aktifkan (dulu: error mentah merah) */
        if (t.status === 502 && tj?.error) { setAlertDlgMsg(alertTestMsg(tj)); return }
        setAlertDlgMsg({ kind: 'err', text: String(tj?.error || `HTTP ${t.status}`) }); return
      }
      setAlertDlgMsg(alertTestMsg(tj))
    } catch (x: any) {
      setAlertDlgMsg({ kind: 'err', text: String(x?.message || x).slice(0, 140) })
    } finally { setAlertSaving(false) }
  }, [])

  const deleteAlertSub = useCallback(async (id: string) => {
    try {
      await fetch(`/api/pine/alerts?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      setAlertSubs((l) => l.filter((s) => s.id !== id))
    } catch { /* diam — daftar segar saat dialog dibuka lagi */ }
  }, [])

  /* ---------- Jalankan Pine ke chart ---------- */
  const runOnChart = useCallback(async (source: string): Promise<string | null> => {
    const chart: any = (wsRef.current as any)?.chart
    if (!chart) return 'Chart belum siap — tunggu sebentar lalu coba lagi.'
    try {
      if (typeof chart.runIndicator === 'function') await chart.runIndicator(source)
      else await chart.addIndicator(source)
      return null
    } catch (x: any) {
      /* runIndicator Vela mengembalikan error terstruktur — tampilkan apa adanya */
      const m = String(x?.message || x?.reason || x).replace(/https?:\/\/\S+/g, '').slice(0, 180)
      return m || 'Skrip gagal dikompilasi.'
    }
  }, [])

  /* ---------- Save/Compile Pine (kuota 2×/bulan untuk free) ----------
     FIX "harus masukin lagi": API sekarang UPSERT per nama — nama
     sama = update baris yang sama (UUID tetap → langganan alert
     tidak jadi yatim) DAN tidak menghabiskan kuota free. */
  const pineSave = useCallback(async () => {
    setPineBusy(true); setPineMsg(null)
    try {
      const res = await fetch('/api/pine/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: pineName, source: pineSource }),
      })
      const r: any = await res.json()
      if (res.status === 403) { // kuota free habis
        setUpgradeMsg(String(r?.error || 'Batas edit tercapai.'))
        return
      }
      if (!res.ok) { setPineMsg({ kind: 'err', text: String(r?.error || `HTTP ${res.status}`) }); return }
      /* Sukses simpan → compile langsung ke chart + tandai AKTIF */
      const err = await runOnChart(pineSource)
      if (r?.script) {
        const sid = String(r.script.id)
        /* upsert: ganti entri lama dgn id sama (hindari dobel di daftar) */
        setPineScripts((l) => [r.script, ...l.filter((x) => x.id !== sid)].slice(0, 30))
        if (!err) setActivePines((m) => ({ ...m, [sid]: true }))
      }
      if (err) { setPineMsg({ kind: 'err', text: `Tersimpan, tapi gagal tampil di chart: ${err}` }) }
      else {
        setPineMsg({ kind: 'ok', text: r?.reused
          ? `"${r?.script?.name || pineName}" diperbarui & tampil di chart — langganan alert tetap aman.`
          : `"${r?.script?.name || pineName}" tersimpan & tampil di chart. Klik ikon bel di daftar untuk aktifkan alert.` })
      }
      if (r?.quota) setPineQuota(r.quota)
    } catch (x: any) {
      setPineMsg({ kind: 'err', text: String(x?.message || x).slice(0, 140) })
    } finally { setPineBusy(false) }
  }, [pineName, pineSource, runOnChart])

  const quotaLabel = (q: QuotaBadge | null, unit: string) =>
    !q ? '' : q.isPro ? 'PRO ∞' : `${q.remaining ?? 0} ${unit} lagi`

  /* ---------- Indikator Eksklusif (Protected Pine — Pro) ----------
     Source tidak pernah keluar dari server: chip ini hanya menambah
     NATIVE indicator yang menggambar hasil plot dari /api/compile-pine.
     Free → dialog upgrade. Pro kadaluarsa di tengah sesi → server 403.

     visibleProtected: chip DEFAULT (Luxtradee Candle Impulsif) SELALU
     disertakan — bila daftar API belum datang/gagal, fallback meta
     dari kode dipakai (id = slug; server compile-pine menerima dua-duanya).
     (Definisi di sini — SEBELUM notifScriptMeta/openNotifCenter yang
     memakainya di deps — supaya render bebas TDZ.) */
  const visibleProtected = useMemo<ProtectedScriptMeta[]>(() => {
    /* FIX 2026-11-05 (permintaan Bos): Pine DEFAULT DIHAPUS dari daftar
       — tidak ada lagi chip "Luxtradee Candle Impulsif". Tiap user
       menambahkan Pine miliknya sendiri via editor (bell 🔔 di daftar
       "Skrip tersimpan"). Skrip eksklusif lain tetap tampil. */
    return protectedScripts.filter((s) => s.slug !== DEFAULT_PINE_SLUG && s.id !== DEFAULT_PINE_SLUG)
  }, [protectedScripts])

  /* ---------- Derivasi notifikasi & hak akses ---------- */
  const isProUser = protectedIsPro || pineQuota?.isPro === true
  const anySubActive = alertSubs.some((x) => x.enabled)
  const notifScriptMeta = useMemo(() => {
    const [kind, id] = String(notifScript).split(':')
    if (!id) return null
    if (kind === 'pine') {
      const s = pineScripts.find((x) => x.id === id)
      return s ? { id: s.id, name: s.name, kind: 'pine' as const } : null
    }
    const s = visibleProtected.find((x) => x.id === id)
    return s ? { id: s.id, name: s.name, kind: 'protected' as const } : null
  }, [notifScript, pineScripts, visibleProtected])

  /* ---------- Pusat Notifikasi: buka dialog (toolbar 🔔) ----------
     Simbol & timeframe default ikut chart yang sedang dibuka;
     pilihan skrip default = Pine user terbaru, kalau belum ada →
     skrip eksklusif pertama. */
  const openNotifCenter = useCallback(() => {
    let sym = 'XAUUSD'
    let tf = '1h'
    try {
      const c: any = (wsRef.current as any)?.chart
      const cs = String(c?.symbol || '').split(':').pop()?.toUpperCase()
      if (cs) sym = cs
      if (c?.timeframe) tf = tfToAlert(String(c.timeframe))
    } catch { /* default tetap dipakai */ }
    setAlertSymbol(sym)
    setAlertInterval(tf)
    setAlertDlgMsg(null)
    setNotifScript((prev) => prev || (pineScripts[0] ? `pine:${pineScripts[0].id}` : visibleProtected[0] ? `protected:${visibleProtected[0].id}` : ''))
    setNotifDlg(true)
    loadAlertSubs()
  }, [loadAlertSubs, pineScripts, visibleProtected])

  /* ---------- Hapus skrip Pine milik sendiri (bersih-bersih daftar) ---------- */
  const deletePineScript = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/pine/save?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) return
      setPineScripts((l) => l.filter((x) => x.id !== id))
      setActivePines((m) => { if (!m[id]) return m; const n = { ...m }; delete n[id]; return n })
    } catch { /* diam */ }
  }, [])

  /* ---------- Preset chip: tambah/lepas indikator Luxtradee ----------
     Free: 1 indikator (EMA 20/50). Pro: semua terbuka. Kuota nyata
     (Pine edit) tetap dijaga server-side di API.
     Klik chip AKTIF → indikator dilepas dari chart (state ikut). */
  const runPreset = useCallback(async (i: number) => {
    if (presetBusy !== null) return
    /* --- TOGGLE OFF: chip aktif diklik lagi → lepas dari chart --- */
    if (activePresets[i]) {
      setPresetBusy(i); setPresetMsg(null)
      try {
        const chart: any = (wsRef.current as any)?.chart
        const handles = ((typeof chart?.indicators === 'function' ? chart.indicators() : []) || []) as any[]
        const h = handles.find((x) => x?.source === PINE_PRESETS[i].script)
        if (h) { try { h.remove() } catch { /* diam */ } }
        setActivePresets((m) => ({ ...m, [i]: false }))
        setPresetMsg(`✕ ${PINE_PRESETS[i].name.replace('Luxtradee — ', '')} dilepas dari chart.`)
      } finally { setPresetBusy(null) }
      return
    }
    setPresetBusy(i); setPresetMsg(null)
    const err = await runOnChart(PINE_PRESETS[i].script)
    const short = PINE_PRESETS[i].name.replace('Luxtradee — ', '')
    if (err) setPresetMsg(`Gagal: ${short}: ${err}`)
    else {
      setActivePresets((s) => ({ ...s, [i]: true }))
      setPresetMsg(`${short} tampil di chart. Klik chipnya lagi untuk melepas.`)
    }
    setPresetBusy(null)
  }, [presetBusy, activePresets, runOnChart])

  const lockedPresetMsg = (i: number) => {
    const names = PINE_PRESETS.slice(FREE_INDICATOR_LIMIT).map((x) => x.name.replace('Luxtradee — ', ''))
    return `Paket gratis hanya ${FREE_INDICATOR_LIMIT} indikator (${PINE_PRESETS[0].name.replace('Luxtradee — ', '')}). Upgrade ke Pro (Rp49rb/bulan) untuk membuka ${names.join(' + ')} dan pasang indikator sepuasnya!`
  }

  /* ---------- Indikator Eksklusif: tambah/lepas ke chart ---------- */
  const addProtected = useCallback(async (s: ProtectedScriptMeta) => {
    if (protectedBusy) return
    const isDef = s.slug === DEFAULT_PINE_SLUG
    /* --- TOGGLE OFF: chip aktif diklik lagi → lepas dari chart --- */
    if (activeProtected[s.id] || (isDef && activeProtected[DEFAULT_PINE_SLUG])) {
      setProtectedBusy(s.id); setProtectedMsg(null)
      try {
        const chart: any = (wsRef.current as any)?.chart
        const handles = ((typeof chart?.indicators === 'function' ? chart.indicators() : []) || []) as any[]
        const h = handles.find((x) => {
          if (x?.nativeType !== PROTECTED_TYPE) return false
          const sid = String(x?.inputValues?.()?.scriptId || '')
          return sid === s.id || (isDef && sid === DEFAULT_PINE_SLUG)
        })
        if (h) { try { h.remove() } catch { /* diam */ } }
        setActiveProtected((m) => ({ ...m, [s.id]: false, ...(isDef ? { [DEFAULT_PINE_SLUG]: false } : {}) }))
        if (protectedStats && (protectedStats.key === s.id || (isDef && protectedStats.key === DEFAULT_PINE_SLUG))) {
          setProtectedStats(null) // indikator dilepas → tabel ikut hilang
        }
        setProtectedMsg(`✕ ${s.name} dilepas dari chart. (Pine Master akan muncul lagi otomatis saat terminal dibuka berikutnya.)`)
      } finally { setProtectedBusy(null) }
      return
    }
    setProtectedBusy(s.id); setProtectedMsg(null)
    try {
      const chart: any = (wsRef.current as any)?.chart
      if (!chart) { setProtectedMsg('Gagal: chart belum siap — coba lagi sebentar.'); return }
      if (typeof chart.addNativeIndicator !== 'function') {
        setProtectedMsg('Gagal: terminal belum mendukung indikator eksklusif (update chart).'); return
      }
      chart.addNativeIndicator(PROTECTED_TYPE, { inputs: { scriptId: s.id } })
      setActiveProtected((m) => ({ ...m, [s.id]: true }))
      setProtectedMsg(s.name + ' tampil di chart. Klik ikon bel di sebelah nama skrip untuk alert otomatis 24 jam ke layar HP.')
    } catch (x: any) {
      setProtectedMsg('Gagal: ' + String(x?.message || x).slice(0, 120))
    } finally { setProtectedBusy(null) }
  }, [protectedBusy, activeProtected, protectedStats])

  return (
    <div className="space-y-2">
      {/* ---------- Toolbar atas (di luar canvas — tidak menutupi UI Vela) ---------- */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[11px] text-white/40 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          Luxtradee Trading Terminal · Forex · Gold · US100 · Crypto · data live
        </div>
        <div className="flex items-center gap-1.5">
          {pineQuota && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/60">
              📐 {quotaLabel(pineQuota, 'edit')}
            </span>
          )}
          {/* ---------- TOMBOL AKTIFKAN NOTIFIKASI (permintaan Bos:
             "ga ada tombol aktifin notif untuk chart dan pine") —
             hijau melambat bila ada langganan alert aktif ---------- */}
          <Button size="sm" variant="outline" className="text-xs h-8 relative border-sky-400/30 text-sky-200 hover:bg-sky-400/10 hover:text-sky-100" onClick={openNotifCenter}>
            <Bell className="w-3.5 h-3.5 mr-1" /> Notifikasi
            {anySubActive && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" aria-hidden="true" />}
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => setPineOpen((v) => !v)}>
            <ScrollText className="w-3.5 h-3.5 mr-1" /> Pine Script
          </Button>
        </div>
      </div>

      {/* ---------- Indikator preset Luxtradee — free 1 · pro 3 ---------- */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-white/35">Indikator</span>
        {PINE_PRESETS.map((p, i) => {
          const short = p.name.replace('Luxtradee — ', '')
          const locked = !isProUser && i >= FREE_INDICATOR_LIMIT
          if (locked) {
            return (
              <button key={p.name}
                onClick={() => setUpgradeMsg(lockedPresetMsg(i))}
                className="text-[11px] px-2.5 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-white/35 hover:text-white/60 hover:border-white/20 transition-colors inline-flex items-center gap-1 min-h-[32px]"
                aria-label={`${short} — khusus Pro, klik untuk info upgrade`}>
                🔒 {short} <span className="text-[9px] font-bold text-amber-300/80">PRO</span>
              </button>
            )
          }
          const active = !!activePresets[i]
          return (
            <button key={p.name} onClick={() => runPreset(i)} disabled={presetBusy !== null}
              className={`text-[11px] px-2.5 py-1.5 rounded-full border transition-colors inline-flex items-center gap-1 min-h-[32px] disabled:opacity-50 ${active ? 'border-purple-400/40 bg-purple-400/15 text-purple-200' : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/10 hover:text-white'}`}
              aria-label={`Tambah ${short} ke chart`}>
              {active ? '✓' : '+'} {short}
            </button>
          )
        })}
        {presetMsg && (
          <span className={`text-[10.5px] ${!presetMsg.startsWith('Gagal') ? 'text-sky-300/80' : 'text-red-300/80'}`}>{presetMsg}</span>
        )}
      </div>

      {/* ---------- Indikator Eksklusif (Protected Pine® — Pro) ----------
          Skrip master Bos: source tak pernah ke browser, user hanya
          melihat garis + sinyal. Free melihat chip terkunci.
          CHIP DEFAULT SELALU TAMPIL (fix Bos: "klik pineku keluar di
          chart") — walau API daftar skrip gagal/lambat/belum login,
          chip ⚡ Luxtradee Candle Impulsif tetap ada dan bisa diklik
          (server compile-pine mengeksekusi slug tanpa DB). */}
      {visibleProtected.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-purple-300/50">Eksklusif</span>
          {visibleProtected.map((s) => {
            const isDefaultScript = s.slug === DEFAULT_PINE_SLUG
            const active = !!activeProtected[s.id] || (isDefaultScript && !!activeProtected[DEFAULT_PINE_SLUG])
            /* Free: skrip DEFAULT tetap bisa dilihat (permintaan Bos),
               skrip eksklusif lain tetap terkunci → paywall. */
            if (!protectedIsPro && !isDefaultScript) {
              return (
                <button key={s.id}
                  onClick={() => setUpgradeMsg(`🛡️ ${s.name} adalah indikator EKSKLUSIF member Pro. Source code dijamin aman (tidak pernah dikirim ke browser) — kamu hanya melihat garis & sinyal Entry/SL/TP-nya di chart, plus alert otomatis ke layar HP. Upgrade ke Pro (Rp49rb/bulan) untuk mengaktifkannya!`)}
                  className="text-[11px] px-2.5 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-white/35 hover:text-white/60 hover:border-white/20 transition-colors inline-flex items-center gap-1 min-h-[32px]"
                  aria-label={`${s.name} — khusus Pro, klik untuk info upgrade`}>
                  🔒 {s.name} <span className="text-[9px] font-bold text-purple-300/80">PRO</span>
                </button>
              )
            }
            const hasSub = alertSubs.some((x) => x.scriptId === s.id && x.enabled)
            return (
              <span key={s.id} className={`inline-flex items-stretch rounded-full border overflow-hidden min-h-[32px] ${active ? 'border-purple-400/40 bg-purple-400/15' : 'border-purple-400/20 bg-purple-400/[0.06]'}`}>
                <button onClick={() => addProtected(s)} disabled={protectedBusy === s.id}
                  className={`text-[11px] pl-2.5 pr-2 py-1.5 inline-flex items-center gap-1 transition-colors disabled:opacity-50 ${active ? 'text-purple-200' : 'text-purple-100/80 hover:text-white'}`}
                  aria-label={`Aktifkan ${s.name} (indikator terproteksi)`}
                  title={s.description || s.name}>
                  {protectedBusy === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : active ? '✓' : ''}{s.name}
                </button>
                <span className="w-px bg-purple-400/20" aria-hidden="true" />
                <button onClick={() => {
                  /* Free → paywall: notifikasi sinyal khusus Pro */
                  if (!protectedIsPro) {
                    setUpgradeMsg(`Alert otomatis sinyal ${s.name} ke layar HP (push notification) adalah fitur PRO. Kamu tetap bisa melihat garis & sinyalnya di chart secara gratis — upgrade ke Pro (Rp49rb/bulan) untuk menerima notifikasi Entry/SL/TP otomatis 24 jam!`)
                    return
                  }
                  openAlertDialog(s)
                }}
                  className="relative px-2 inline-flex items-center text-purple-100/80 hover:bg-purple-400/15 hover:text-white transition-colors"
                  aria-label={`Alert otomatis 24 jam untuk ${s.name} — klik untuk mengaktifkan`}
                  title="Alert otomatis 24 jam — sinyal Entry/SL/TP ke layar HP">
                  <Bell className="w-3 h-3" />
                  {hasSub && <span className="absolute top-1 right-0.5 w-1.5 h-1.5 rounded-full bg-sky-400" aria-hidden="true" />}
                </button>
              </span>
            )
          })}
          {protectedMsg && (
            <span className={`text-[10.5px] ${!protectedMsg.startsWith('Gagal') ? 'text-sky-300/80' : 'text-red-300/80'}`}>{protectedMsg}</span>
          )}
        </div>
      )}

      {/* ---------- Vela workspace ---------- */}
      <div className="relative rounded-2xl border border-white/10 bg-[#05070d] overflow-hidden">
        <div ref={hostRef} style={{ height: autoH || height }} className="w-full" />

        {booting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#05070d] gap-2">
            <Loader2 className="w-7 h-7 text-purple-400 animate-spin" />
            <div className="text-white/50 text-xs">Menyalakan mesin chart…</div>
          </div>
        )}
        {bootError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#05070d] gap-2 p-6 text-center">
            <TriangleAlert className="w-8 h-8 text-red-400" />
            <div className="text-white text-sm font-semibold">Chart gagal dimuat</div>
            <div className="text-white/50 text-xs max-w-md">{bootError}</div>
            <Button size="sm" variant="outline" className="mt-1" onClick={() => window.location.reload()}>
              Muat ulang
            </Button>
          </div>
        )}

        {/* ---------- Badge: trade dari Riwayat/Jurnal dimuat ke chart ---------- */}
        {tradeHighlightMsg && (
          <div className="absolute left-2 top-2 z-30 max-w-[85%] rounded-lg border border-sky-400/30 bg-sky-400/10 backdrop-blur px-2.5 py-1.5 text-[11px] text-sky-100 shadow-lg" role="status">
            {tradeHighlightMsg}
          </div>
        )}

        {/* ---------- Tabel performa skrip default (ala strategy TradingView) ----------
            Muncul saat indikator default aktif & server mengirim stats —
            posisi KANAN-BAWAH persis tablePos Pine master Bos. */}
        {protectedStats && !statsDismissed && !booting && !!activeProtected[protectedStats.key] && (
          <div className="absolute right-2 bottom-2 z-20 w-[190px] rounded-lg border border-purple-400/25 bg-[#0a0f16]/92 backdrop-blur px-2.5 py-2 shadow-xl" role="status" aria-label="Tabel performa Luxtradee Candle Impulsif">
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[10px] font-bold text-purple-200 tracking-wide truncate">Impulsive Breakout XAUUSD v5</span>
              <button onClick={() => setStatsDismissed(true)} className="text-white/35 hover:text-white shrink-0" aria-label="Tutup tabel performa">
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-0.5 text-[10px] leading-snug">
              {[
                ['Net P&L', protectedStats.stats.netProfit, Number(String(protectedStats.stats.netProfit || '').replace(/[^0-9.\-]/g, '')) >= 0],
                ['Trade / WR', protectedStats.stats.trades, null],
                ['Profit factor', protectedStats.stats.profitFactor, null],
                ['Loss / Win streak', protectedStats.stats.streaks, null],
                ['DD harian', protectedStats.stats.dailyDD, false],
                ['DD total', protectedStats.stats.overallDD, false],
                ['Mulai uji', protectedStats.stats.testStart, null],
                ['Trade pertama', protectedStats.stats.firstTrade, null],
              ].map(([label, value, good]) => (
                <div key={String(label)} className="flex items-center justify-between gap-2">
                  <span className="text-white/40 shrink-0">{String(label)}</span>
                  <span className={`font-semibold truncate ${good === null ? 'text-white/85' : (good ? 'text-emerald-300' : 'text-orange-300')}`} title={String(value ?? '-')}>{String(value ?? '-')}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-white/10 mt-1">
                <span className="text-white/40">Status</span>
                <span className={`font-semibold ${protectedStats.stats.paused ? 'text-orange-300' : 'text-emerald-300'}`}>
                  {protectedStats.stats.paused ? 'JEDA (streak)' : protectedStats.stats.openPos ? 'POSISI TERBUKA' : 'Trading aktif'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ---------- Drawer: Pine Script editor ---------- */}
        {pineOpen && (
          <div className="absolute right-2 top-2 bottom-2 w-[min(92vw,380px)] z-30 flex flex-col rounded-xl border border-white/10 bg-[#0a0f16]/95 backdrop-blur shadow-2xl">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <div className="text-xs font-semibold text-purple-300">📐 Pine Script® Editor</div>
              <button className="text-white/40 hover:text-white" onClick={() => setPineOpen(false)} aria-label="Tutup editor"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-3 py-2 space-y-2 flex-1 min-h-0 flex flex-col">
              <input
                value={pineName} onChange={(e) => setPineName(e.target.value)}
                placeholder="Nama skrip"
                className="w-full text-xs bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-white/90 outline-none focus:border-purple-400/40"
              />
              <textarea
                value={pineSource} onChange={(e) => setPineSource(e.target.value)}
                spellCheck={false}
                className="w-full flex-1 min-h-[160px] text-[11.5px] leading-relaxed font-mono bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-purple-100/90 outline-none focus:border-purple-400/40 resize-none kscroll"
              />
              {pineMsg && (
                <div className={`text-[11px] rounded-lg px-2.5 py-1.5 border ${pineMsg.kind === 'ok' ? 'border-sky-400/30 bg-sky-400/10 text-sky-200' : 'border-red-400/30 bg-red-400/10 text-red-200'}`}>
                  {pineMsg.text}
                </div>
              )}
              <Button size="sm" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold" disabled={pineBusy} onClick={pineSave}>
                {pineBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : '▶ Save / Compile ke Chart'}
              </Button>
              {pineQuota && !pineQuota.isPro && (
                <div className="text-[10px] text-white/40 leading-relaxed">
                  Paket gratis: 2× edit/bulan · terpakai {pineQuota.used}. Pro = tanpa batas (Rp49rb/bulan).
                </div>
              )}
              {pineScripts.length > 0 && (
                <div className="min-h-0 overflow-y-auto kscroll space-y-1">
                  <div className="text-[10px] text-white/40 uppercase tracking-wider">Skrip tersimpan</div>
                  {pineScripts.map((s) => {
                    const active = !!activePines[s.id]
                    const hasSub = alertSubs.some((x) => x.scriptId === s.id && x.enabled)
                    return (
                      <div key={s.id} className="flex items-stretch gap-1">
                        <button onClick={async () => {
                          /* ▶ kecil = jalankan di chart (perilaku lama dipindah
                             ke tombol ini supaya klik NAMA kini membuka alert —
                             permintaan Bos 2026-11-05: "klik nama pinenya ada
                             tambahkan alert". */
                          setPineName(s.name); setPineSource(s.source)
                          const err = await runOnChart(s.source)
                          if (!err) setActivePines((m) => ({ ...m, [s.id]: true }))
                          setPineMsg(err
                            ? { kind: 'err', text: `⚠️ ${s.name}: ${err}` }
                            : { kind: 'ok', text: `▶ ${s.name} tampil di chart${active ? ' (sudah aktif)' : ' — otomatis aktif tiap buka terminal'}.` })
                        }}
                          className={`px-2 rounded-l-lg border border-r-0 bg-white/5 hover:bg-white/10 ${active ? 'border-sky-400/30 text-sky-300' : 'border-white/5 text-white/50'}`}
                          title={`Jalankan "${s.name}" di chart${active ? ' (sedang aktif)' : ''}`}
                          aria-label={`Jalankan ${s.name} di chart`}>
                          {active ? '✓' : '▶'}
                        </button>
                        <button onClick={() => {
                          /* KLIK NAMA = TAMBAH ALERT (permintaan Bos):
                             alert otomatis = Pro → free lihat paywall. */
                          if (!protectedIsPro) {
                            setUpgradeMsg(`🔔 Alert otomatis sinyal "${s.name}" ke layar HP (push notification) adalah fitur PRO. Skrip kamu tetap bisa dijalankan di chart secara gratis — upgrade ke Pro (Rp49rb/bulan) untuk menerima notifikasi Entry/SL/TP otomatis 24 jam!`)
                            return
                          }
                          openAlertDialog({ id: s.id, name: s.name, description: null, kind: 'pine' })
                        }}
                          className="relative flex-1 min-w-0 text-left text-[11px] px-2 py-1.5 border border-white/5 bg-white/5 hover:bg-white/10 text-white/70 truncate"
                          title={`Klik untuk pasang ALERT otomatis untuk "${s.name}"`}
                          aria-label={`Tambah alert untuk ${s.name}`}>
                          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${hasSub ? 'bg-sky-400' : 'bg-white/25'}`} aria-hidden="true" />
                          🔔 {s.name}
                          {active && <span className="ml-1.5 text-[9px] px-1 py-px rounded bg-sky-400/15 text-sky-300 border border-sky-400/25 align-middle">AKTIF</span>}
                        </button>
                        <button onClick={() => deletePineScript(s.id)}
                          className="px-1.5 rounded-r-lg border border-l-0 border-white/5 bg-white/5 hover:bg-red-400/15 text-white/35 hover:text-red-300"
                          title={`Hapus "${s.name}"`}
                          aria-label={`Hapus skrip ${s.name}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ---------- Strategy Tester (ala TradingView) — skrip strategy() user ----------
          Permintaan Bos: "buy and sell ga ada propertiesnya didalem ga kaya
          trading view" → setiap skrip strategy yang jalan di chart kini punya:
          ringkasan Net P&L / Win Rate / Profit Factor / Max DD + daftar trade
          lengkap (waktu, harga entry/exit, qty, PnL) — klik baris = lompat ke
          trade-nya di chart. Posisi: di bawah chart, persis semangat panel
          Strategy Tester TradingView. */}
      {strategyTester && (
        <div className="rounded-2xl border border-white/10 bg-[#0a0f16] overflow-hidden" role="region" aria-label="Strategy Tester — properti trade skrip strategy kamu">
          <button
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
            onClick={() => setTesterOpen((v) => !v)}
            aria-expanded={testerOpen}
          >
            <span className="flex items-center gap-2 min-w-0 text-xs font-semibold text-purple-200">
              <BarChart3 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> Strategy Tester
              <span className="text-white/40 font-normal truncate max-w-[260px]">· {strategyTester.title}</span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-bold ${strategyTester.netPnl != null && strategyTester.netPnl < 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                {fmtTesterPnl(strategyTester.netPnl)}
              </span>
              <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${testerOpen ? '' : '-rotate-90'}`} aria-hidden="true" />
            </span>
          </button>

          {testerOpen && (
            <div className="px-3 pb-3 space-y-2">
              {/* DIAGNOSTIK — bukti engine beneran jalan + penjelasan saat
                  0 trade (Bos: "beneran berfungsi ga strategi testernya
                  kaya trading view?"). Warning engine ditampilkan mentah:
                  biasanya inilah penyebab kondisi entry tak pernah tepuk. */}
              {(() => {
                const closedN = strategyTester.wins + strategyTester.losses + strategyTester.even
                const when = strategyTester.lastBarTime ? fmtTesterTime(strategyTester.lastBarTime) : null
                const evaluated = strategyTester.evaluatedBars != null
                  ? `Engine menilai ${strategyTester.evaluatedBars.toLocaleString('id-ID')} bar harga${when ? ` (s/d ${when})` : ''}${strategyTester.complete ? '' : ' — sejarah masih menyusul'}`
                  : null
                if (strategyTester.warnings.length) {
                  return (
                    <div className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-2.5 py-1.5 text-[10.5px] leading-relaxed text-amber-200/90" role="status">
                      <div className="font-semibold">{evaluated || 'Engine menilai skrip ini'} — ada {strategyTester.warnings.length} warning dari engine:</div>
                      {strategyTester.warnings.map((w, i) => <div key={i} className="truncate text-amber-200/70" title={w}>- {w}</div>)}
                      {closedN === 0 && <div className="text-amber-200/70">Warning di atas biasanya penyebab kondisi entry tidak pernah terpicu. Cek juga: filter sesi/jam, timeframe, dan input yang dipakai.</div>}
                    </div>
                  )
                }
                if (closedN === 0) {
                  return (
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[10.5px] leading-relaxed text-white/45" role="status">
                      {evaluated || 'Skrip strategy berjalan di chart.'} — kondisi entry skrip belum terpicu pada data ini, jadi belum ada trade. Catatan: TradingView memakai rentang waktu, feed harga, dan setelan input miliknya sendiri — samakan rentang & input untuk membandingkan hasil.
                    </div>
                  )
                }
                return evaluated ? <div className="text-[10px] text-white/30">{evaluated}.</div> : null
              })()}

              {/* Ringkasan performa — angka yang sama dengan Overview TradingView */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
                {(() => {
                  const closed = strategyTester.wins + strategyTester.losses + strategyTester.even
                  const winRate = closed > 0 ? (strategyTester.wins / closed) * 100 : null
                  const pf = strategyTester.grossLoss != null && Math.abs(strategyTester.grossLoss) > 1e-9
                    ? (strategyTester.grossProfit ?? 0) / Math.abs(strategyTester.grossLoss)
                    : strategyTester.grossProfit ? Infinity : null
                  const chips: Array<{ label: string; value: string; tone: 'pos' | 'neg' | 'net' }> = [
                    { label: 'Net P&L', value: fmtTesterPnl(strategyTester.netPnl), tone: strategyTester.netPnl != null && strategyTester.netPnl < 0 ? 'neg' : 'pos' },
                    { label: 'Win Rate', value: winRate != null ? `${winRate.toFixed(1)}%` : '-', tone: 'net' },
                    { label: 'Profit Factor', value: pf == null ? '-' : pf === Infinity ? '∞' : pf.toFixed(2), tone: 'net' },
                    { label: 'Max Drawdown', value: strategyTester.maxDrawdown != null ? `-${Math.abs(strategyTester.maxDrawdown).toFixed(2)}` : '-', tone: 'neg' },
                    { label: 'Trade Closed', value: String(closed), tone: 'net' },
                    { label: 'Win / Loss', value: `${strategyTester.wins} / ${strategyTester.losses}`, tone: 'net' },
                  ]
                  return chips.map((c) => (
                    <div key={c.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
                      <div className="text-[9.5px] uppercase tracking-wider text-white/35">{c.label}</div>
                      <div className={`text-[12.5px] font-bold ${c.tone === 'pos' ? 'text-emerald-300' : c.tone === 'neg' ? 'text-orange-300' : 'text-white/85'}`}>{c.value}</div>
                    </div>
                  ))
                })()}
              </div>

              {/* Daftar trade — kolom sama semangat List of Trades TradingView */}
              <div className="max-h-80 overflow-y-auto kscroll rounded-lg border border-white/[0.06]">
                <table className="w-full text-[11px] border-collapse">
                  <thead className="sticky top-0 bg-[#0d131c] z-10">
                    <tr className="text-white/40">
                      {['#', 'Arah', 'Waktu Entry', 'Harga Entry', 'Waktu Exit', 'Harga Exit', 'Qty', 'P&L'].map((h) => (
                        <th key={h} className={`px-2 py-1.5 font-semibold text-left whitespace-nowrap ${h === 'P&L' ? 'text-right' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {strategyTester.rows.slice().reverse().map((t, idx) => {
                      const n = strategyTester.rows.length - idx
                      const isOpen = t.open
                      const pnlCol = isOpen ? 'text-sky-300' : t.pnl != null && t.pnl < 0 ? 'text-red-300' : 'text-emerald-300'
                      return (
                        <tr
                          key={`${t.entryTime}-${idx}`}
                          className="border-t border-white/[0.04] hover:bg-white/[0.04] cursor-pointer transition-colors"
                          onClick={() => jumpToTesterTrade(t)}
                          title="Klik untuk melompat ke trade ini di chart"
                        >
                          <td className="px-2 py-1.5 text-white/35 whitespace-nowrap">{n}</td>
                          <td className={`px-2 py-1.5 font-semibold whitespace-nowrap ${t.side === 'long' ? 'text-emerald-300' : 'text-red-300'}`}>
                            {t.side === 'long' ? 'Long' : 'Short'}
                          </td>
                          <td className="px-2 py-1.5 text-white/70 whitespace-nowrap">{fmtTesterTime(t.entryTime)}</td>
                          <td className="px-2 py-1.5 text-white/85 whitespace-nowrap">{fmtTesterPrice(t.entryPrice)}</td>
                          <td className="px-2 py-1.5 text-white/70 whitespace-nowrap">{isOpen ? <span className="text-sky-300 font-semibold">OPEN</span> : fmtTesterTime(t.exitTime)}</td>
                          <td className="px-2 py-1.5 text-white/85 whitespace-nowrap">{isOpen ? '-' : fmtTesterPrice(t.exitPrice)}</td>
                          <td className="px-2 py-1.5 text-white/60 whitespace-nowrap">{fmtTesterQty(t.qty)}</td>
                          <td className={`px-2 py-1.5 font-bold text-right whitespace-nowrap ${pnlCol}`}>{isOpen ? '…' : fmtTesterPnl(t.pnl)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <p className="text-[10px] text-white/35 leading-relaxed">
                {strategyTester.truncated && 'Menampilkan 500 trade terakhir. '}
                {strategyTester.openNow && 'Posisi masih terbuka — garis & PnL diperbarui otomatis saat trade ditutup. '}
                Klik baris untuk melompat ke trade di chart. Garis entry→exit + label harga & PnL digambar otomatis di chart.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---------- Dialog paywall upgrade ---------- */}
      <Dialog open={!!upgradeMsg} onOpenChange={(v) => !v && setUpgradeMsg(null)}>
        <DialogContent className="max-w-sm bg-[#0a0f16] border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-300">
              <GraduationCap className="w-5 h-5" /> Batas Gratis Tercapai
            </DialogTitle>
            <DialogDescription className="text-white/70 text-sm leading-relaxed pt-1">
              {upgradeMsg}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setUpgradeMsg(null)}>Nanti saja</Button>
            <Button size="sm" className="bg-amber-400 hover:bg-amber-300 text-black font-semibold" onClick={() => { window.location.href = '/#pricing' }}>
              Upgrade ke Pro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Dialog: Alert otomatis Pine (klik 🔔) ---------- */}
      <Dialog open={!!alertDlg} onOpenChange={(v) => !v && setAlertDialog(null)}>
        <DialogContent className="max-w-sm bg-[#0a0f16] border-white/10 max-h-[85vh] overflow-y-auto kscroll">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sky-300 text-base">
              <Bell className="w-4 h-4" /> Alert Otomatis — {alertDlg?.name}
            </DialogTitle>
            <DialogDescription className="text-white/60 text-xs leading-relaxed pt-0.5">
              Sinyal Entry/SL/TP skrip ini dicek server tiap 5 menit & muncul sebagai notifikasi di layar HP kamu — tanpa buka chart.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                value={alertSymbol}
                onChange={(e) => setAlertSymbol(e.target.value.toUpperCase())}
                placeholder="SIMBOL (mis. XAUUSD)"
                aria-label="Simbol alert"
                className="flex-1 min-w-0 text-xs bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-white/90 outline-none focus:border-sky-400/40"
              />
              <select
                value={alertInterval}
                onChange={(e) => setAlertInterval(e.target.value)}
                aria-label="Timeframe alert"
                className="text-xs bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-white/90 outline-none focus:border-sky-400/40"
              >
                {ALERT_TFS.map((t) => (
                  <option key={t.v} value={t.v} className="bg-[#0a0f16]">{t.label}</option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              className="w-full bg-sky-500 hover:bg-sky-400 text-black font-semibold"
              disabled={alertSaving || !alertDlg || alertSymbol.trim().length < 3}
              onClick={() => alertDlg && saveAlertSub({ scriptId: alertDlg.id, scriptKind: alertDlg.kind, symbol: alertSymbol.trim(), interval: alertInterval, enabled: true, withTest: true })}
            >
              {alertSaving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <>Aktifkan {alertSymbol.trim() || 'Alert'} · {ALERT_TFS.find((t) => t.v === alertInterval)?.label}</>}
            </Button>
            {alertDlgMsg && (
              <div className={`text-[11px] rounded-lg px-2.5 py-1.5 border ${alertDlgMsg.kind === 'ok' ? 'border-sky-400/30 bg-sky-400/10 text-sky-200' : alertDlgMsg.kind === 'warn' ? 'border-amber-400/30 bg-amber-400/10 text-amber-200' : 'border-red-400/30 bg-red-400/10 text-red-200'}`}>
                {alertDlgMsg.text}
              </div>
            )}
          </div>

          {alertDlg && alertSubs.filter((s) => s.scriptId === alertDlg.id).length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Langganan skrip ini</div>
              <div className="max-h-40 overflow-y-auto kscroll space-y-1 pr-0.5">
                {alertSubs.filter((s) => s.scriptId === alertDlg.id).map((s) => (
                  <div key={s.id} className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-2 py-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.enabled ? 'bg-sky-400' : 'bg-white/20'}`} aria-hidden="true" />
                    <span className="text-[11px] text-white/80 flex-1 truncate">{s.symbol} · {s.interval}</span>
                    <button
                      onClick={() => testAlertSub(s)}
                      disabled={alertSaving}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-sky-400/30 text-sky-200/90 hover:bg-sky-400/15 disabled:opacity-50"
                      title="Jalankan pengecekan sinyal sekarang"
                    >Test</button>
                    <button
                      onClick={() => saveAlertSub({ scriptId: s.scriptId, symbol: s.symbol, interval: s.interval, enabled: !s.enabled })}
                      disabled={alertSaving}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-white/60 hover:text-white disabled:opacity-50"
                    >{s.enabled ? 'Matikan' : 'Nyalakan'}</button>
                    <button onClick={() => deleteAlertSub(s.id)} disabled={alertSaving} aria-label={`Hapus langganan ${s.symbol} ${s.interval}`} className="text-white/35 hover:text-red-300 disabled:opacity-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- PUSAT NOTIFIKASI (tombol 🔔 Notifikasi di toolbar) ----------
          Permintaan Bos: "ga ada tombol aktifin notif untuk chart dan
          pine" → satu dialog untuk: (1) mengaktifkan alert utk skrip
          mana pun (Pine milik sendiri ATAU skrip eksklusif) dengan
          simbol/TF ikut chart yang sedang dibuka, dan (2) melihat
          semua langganan — termasuk langganan YATIM (skrip sudah
          dihapus) yang selama ini "dilewati diam-diam" oleh engine
          (run GHA #42) → bisa dibersihkan di sini. */}
      <Dialog open={notifDlg} onOpenChange={(v) => !v && setNotifDlg(false)}>
        <DialogContent className="max-w-sm bg-[#0a0f16] border-white/10 max-h-[85vh] overflow-y-auto kscroll">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sky-300 text-base">
              <Bell className="w-4 h-4" /> Notifikasi Sinyal
            </DialogTitle>
            <DialogDescription className="text-white/60 text-xs leading-relaxed pt-0.5">
              Pilih sinyal + simbol + timeframe, lalu aktifkan — Entry/SL/TP dikirim ke layar HP otomatis tiap 5 menit, 24 jam.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {/* Pilih sumber sinyal: Pine milik user / skrip eksklusif */}
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Sumber sinyal</div>
              <select
                value={notifScript}
                onChange={(e) => setNotifScript(e.target.value)}
                aria-label="Pilih skrip sumber sinyal"
                className="w-full text-xs bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-white/90 outline-none focus:border-sky-400/40"
              >
                {(pineScripts.length === 0 && visibleProtected.length === 0) && (
                  <option value="" className="bg-[#0a0f16]">— Belum ada skrip tersedia —</option>
                )}
                {pineScripts.length > 0 && (
                  <optgroup label="📐 Pine Script kamu">
                    {pineScripts.map((s) => (
                      <option key={`pine:${s.id}`} value={`pine:${s.id}`} className="bg-[#0a0f16]">{s.name}</option>
                    ))}
                  </optgroup>
                )}
                {visibleProtected.length > 0 && (
                  <optgroup label="🛡️ Skrip Eksklusif Pro">
                    {visibleProtected.map((s) => (
                      <option key={`protected:${s.id}`} value={`protected:${s.id}`} className="bg-[#0a0f16]">{s.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              {pineScripts.length === 0 && visibleProtected.length === 0 && (
                <div className="text-[10.5px] text-amber-200/80 mt-1">Belum ada skrip — buka <b>Pine Script</b> editor, simpan skripmu dulu, lalu aktifkan notifikasinya di sini.</div>
              )}
            </div>

            <div className="flex gap-2">
              <input
                value={alertSymbol}
                onChange={(e) => setAlertSymbol(e.target.value.toUpperCase())}
                placeholder="SIMBOL (mis. XAUUSD)"
                aria-label="Simbol alert"
                className="flex-1 min-w-0 text-xs bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-white/90 outline-none focus:border-sky-400/40"
              />
              <select
                value={alertInterval}
                onChange={(e) => setAlertInterval(e.target.value)}
                aria-label="Timeframe alert"
                className="text-xs bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-white/90 outline-none focus:border-sky-400/40"
              >
                {ALERT_TFS.map((t) => (
                  <option key={t.v} value={t.v} className="bg-[#0a0f16]">{t.label}</option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              className="w-full bg-sky-500 hover:bg-sky-400 text-black font-semibold"
              disabled={alertSaving || !notifScriptMeta || alertSymbol.trim().length < 3}
              onClick={() => notifScriptMeta && saveAlertSub({ scriptId: notifScriptMeta.id, scriptKind: notifScriptMeta.kind, symbol: alertSymbol.trim(), interval: alertInterval, enabled: true, withTest: true })}
            >
              {alertSaving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <>🔔 Aktifkan {alertSymbol.trim() || 'Alert'} · {ALERT_TFS.find((t) => t.v === alertInterval)?.label}</>}
            </Button>
            {!protectedIsPro && (
              <div className="text-[10.5px] text-amber-200/80 leading-relaxed">Notifikasi otomatis = fitur Pro. Kalau belum Pro, tombol akan membuka penawaran upgrade.</div>
            )}
            {alertDlgMsg && (
              <div className={`text-[11px] rounded-lg px-2.5 py-1.5 border ${alertDlgMsg.kind === 'ok' ? 'border-sky-400/30 bg-sky-400/10 text-sky-200' : alertDlgMsg.kind === 'warn' ? 'border-amber-400/30 bg-amber-400/10 text-amber-200' : 'border-red-400/30 bg-red-400/10 text-red-200'}`}>
                {alertDlgMsg.text}
              </div>
            )}
          </div>

          {alertSubs.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Semua langganan ({alertSubs.length})</div>
              <div className="max-h-44 overflow-y-auto kscroll space-y-1 pr-0.5">
                {alertSubs.map((s) => (
                  <div key={s.id} className="rounded-lg border border-white/5 bg-white/5 px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.enabled ? 'bg-sky-400' : 'bg-white/20'}`} aria-hidden="true" />
                      <span className="text-[11px] text-white/80 flex-1 min-w-0 truncate">
                        {s.orphan ? <span className="text-red-300/90">{s.scriptName} (skrip terhapus)</span> : s.scriptName}
                        <span className="text-white/45"> · {s.symbol} · {s.interval}</span>
                      </span>
                      {!s.orphan && (
                        <>
                          <button
                            onClick={() => testAlertSub(s)}
                            disabled={alertSaving}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-sky-400/30 text-sky-200/90 hover:bg-sky-400/15 disabled:opacity-50"
                            title="Jalankan pengecekan sinyal sekarang"
                          >Test</button>
                          <button
                            onClick={() => saveAlertSub({ scriptId: s.scriptId, scriptKind: s.scriptKind, symbol: s.symbol, interval: s.interval, enabled: !s.enabled })}
                            disabled={alertSaving}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-white/60 hover:text-white disabled:opacity-50"
                          >{s.enabled ? 'Off' : 'On'}</button>
                        </>
                      )}
                      <button onClick={() => deleteAlertSub(s.id)} disabled={alertSaving} aria-label={`Hapus langganan ${s.symbol} ${s.interval}`} className="text-white/35 hover:text-red-300 disabled:opacity-50 shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {!s.orphan && (() => {
                      const h = alertHealthLine(s)
                      return <div className={`text-[10px] leading-snug mt-1 pl-3 ${h.cls}`}>{h.text}</div>
                    })()}
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
