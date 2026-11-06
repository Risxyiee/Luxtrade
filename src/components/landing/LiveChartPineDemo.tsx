'use client'

/**
 * ============================================================
 * LiveChartPineDemo — simulator trading XAUUSD live (SVG murni)
 * ============================================================
 * Demo ringan terinspirasi app.investabl.ai:
 *   - Candlestick XAUUSD live (random walk ±$1 per tick)
 *   - Tombol Buy / Sell mock -> tampilkan garis Entry/TP/SL
 *   - Timer detik (desimal) selama trade berlangsung
 *   - Outcome: 60% Take Profit (+$50) / 40% Stop Loss (-$30)
 *   - Card hasil dengan count-up number + tombol Trade Again
 *   - CTA daftar LuxTradee di bawah
 *
 * TEKNIS (penting):
 *   - SVG murni (tanpa lib chart berat) -> mobile-friendly, no hydration issue
 *   - Tick 1.5s update candle terakhir; tiap 5 tick -> candle baru (shift)
 *   - framer-motion untuk fade-in result card + AnimatePresence overlay
 *   - prefers-reduced-motion dihormati
 *   - IntersectionObserver -> animasi jalan hanya saat terlihat (hemat CPU)
 *   - WCAG AA kontras; aria-label di tombol & SVG
 *   - TIDAK ada warna indigo/blue sebagai aksen primary.
 *     Bull=#10b981 (emerald), Bear=#ef4444 (red), TP=#fbbf24 (amber),
 *     SL=#06b6d4 (cyan dipakai untuk entry line sesuai spec chart trading).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RotateCcw, TrendingUp, TrendingDown, Timer, Info } from 'lucide-react'

/* ============================================================
 * Konstanta simulasi
 * ============================================================ */
const TICK_MS = 1500           // 1.5 detik per tick
const TICKS_PER_CANDLE = 5     // tiap 5 tick -> candle baru
const MAX_CANDLES = 40         // jumlah candle yang ditampilkan
const START_PRICE = 2050       // harga awal XAUUSD
const VOLATILITY = 1.1         // ±$ per tick (random walk)

const TP_DELTA = 50            // +$50 take profit
const SL_DELTA = 30            // -$30 stop loss

const MIN_DURATION_S = 3       // durasi trade minimal (detik)
const MAX_DURATION_S = 8       // durasi trade maksimal (detik)
const TP_PROBABILITY = 0.6     // 60% TP hit, 40% SL hit

/* Range harga tampil di sumbu Y */
const PRICE_MIN = 2020
const PRICE_MAX = 2080

/* Viewport SVG (16:7) */
const VIEW_W = 800
const VIEW_H = 350
const PAD_LEFT = 12
const PAD_RIGHT = 70   // ruang label harga kanan
const PAD_TOP = 16
const PAD_BOTTOM = 28  // ruang label waktu bawah
const CHART_W = VIEW_W - PAD_LEFT - PAD_RIGHT
const CHART_H = VIEW_H - PAD_TOP - PAD_BOTTOM

const CANDLE_GAP = 2
const CANDLE_W = Math.max(4, Math.floor((CHART_W - CANDLE_GAP * (MAX_CANDLES - 1)) / MAX_CANDLES))

/* Warna chart (boleh standar market — spec eksplisit mengizinkan) */
const COLOR_BULL = '#10b981'
const COLOR_BEAR = '#ef4444'
const COLOR_ENTRY = '#06b6d4'  // cyan (SL spec uses cyan untuk entry)
const COLOR_TP = '#fbbf24'     // amber
const COLOR_SL = '#f43f5e'     // rose (lebih merah dari bear)

/* ============================================================
 * Tipe data
 * ============================================================ */
interface Candle {
  open: number
  high: number
  low: number
  close: number
  bornAt: number  // timestamp saat candle dibuat
}

type TradeState = 'idle' | 'active' | 'resolved'
type TradeDirection = 'buy' | 'sell'
type Outcome = 'tp' | 'sl'

/* ============================================================
 * Helper: random walk harga
 * ============================================================ */
function nextPrice(prev: number): number {
  const delta = (Math.random() - 0.5) * 2 * VOLATILITY
  const next = prev + delta
  // soft clamp agar tetap di range tampil
  if (next < PRICE_MIN + 5) return prev + Math.abs(delta)
  if (next > PRICE_MAX - 5) return prev - Math.abs(delta)
  return next
}

function genInitialCandles(): Candle[] {
  const out: Candle[] = []
  let price = START_PRICE - 8 // mulai sedikit di bawah agar ada ruah naik
  const now = Date.now()
  for (let i = 0; i < MAX_CANDLES; i++) {
    const open = price
    let high = open
    let low = open
    let close = open
    for (let t = 0; t < TICKS_PER_CANDLE; t++) {
      close = nextPrice(close)
      if (close > high) high = close
      if (close < low) low = close
    }
    out.push({ open, high, low, close, bornAt: now - (MAX_CANDLES - i) * TICK_MS * TICKS_PER_CANDLE })
    price = close
  }
  return out
}

/* Helper: map harga -> koordinat Y di SVG */
function priceToY(price: number): number {
  const clamped = Math.max(PRICE_MIN, Math.min(PRICE_MAX, price))
  const ratio = (clamped - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)
  return PAD_TOP + (1 - ratio) * CHART_H
}

/* Helper: map index candle -> koordinat X tengah */
function indexToX(i: number): number {
  return PAD_LEFT + i * (CANDLE_W + CANDLE_GAP) + CANDLE_W / 2
}

/* Helper: format harga dengan 2 desimal */
function fmtPrice(p: number): string {
  return p.toFixed(2)
}

/* Helper: format detik dengan 1 desimal */
function fmtSeconds(ms: number): string {
  return (ms / 1000).toFixed(1)
}

/* ============================================================
 * Hook: count-up number animation
 * ============================================================ */
function useCountUp(target: number, durationMs: number, run: boolean): number {
  const [val, setVal] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (!run) {
      setVal(0)
      startRef.current = null
      return
    }
    const animate = (ts: number) => {
      if (startRef.current === null) startRef.current = ts
      const progress = Math.min((ts - startRef.current) / durationMs, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setVal(target * eased)
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      startRef.current = null
    }
  }, [target, durationMs, run])

  return val
}

/* ============================================================
 * Komponen utama
 * ============================================================ */
interface LiveChartPineDemoProps {
  language?: 'id' | 'en'
}

function LiveChartPineDemo({ language = 'id' }: LiveChartPineDemoProps) {
  const isId = language === 'id'

  const t = useMemo(() => ({
    badge: isId ? 'DEMO LIVE · SIMULASI' : 'LIVE DEMO · SIMULATION',
    title: isId ? 'Live Trading Simulator' : 'Live Trading Simulator',
    sub: isId
      ? 'Visualisasi strategi Pine Script — demo XAUUSD realtime'
      : 'Pine Script strategy visualization — XAUUSD demo',
    pair: 'XAUUSD · GOLD',
    timeframe: isId ? '1s tick' : '1s tick',
    live: 'LIVE',
    buy: 'Buy',
    sell: 'Sell',
    demoNote: isId
      ? 'Demo only — simulated trading. Real trading di dashboard setelah daftar.'
      : 'Demo only — simulated trading. Real trading in dashboard after signup.',
    tradeAgain: isId ? 'Trade again' : 'Trade again',
    seconds: isId ? 'detik' : 'seconds',
    tpHit: isId ? 'Take profit hit' : 'Take profit hit',
    slHit: isId ? 'Stop loss hit' : 'Stop loss hit',
    inLbl: isId ? 'dalam' : 'in',
    ctaTitle: isId
      ? 'Coba strategi Pine Script Anda sendiri — daftar gratis'
      : 'Try your own Pine Script strategy — sign up free',
    ctaBtn: isId ? 'Daftar Gratis Sekarang' : 'Sign Up Free Now',
    ctaNote: isId ? 'Gratis — tanpa kartu kredit' : 'Free — no credit card required',
    entry: 'ENTRY',
    tp: 'TP',
    sl: 'SL',
    ariaChart: isId
      ? 'Chart candlestick XAUUSD live simulasi dengan garis entry, take profit, dan stop loss'
      : 'Simulated live XAUUSD candlestick chart with entry, take profit, and stop loss lines',
    ariaBuy: isId
      ? 'Buka posisi Buy di demo simulator'
      : 'Open Buy position in demo simulator',
    ariaSell: isId
      ? 'Buka posisi Sell di demo simulator'
      : 'Open Sell position in demo simulator',
    ariaAgain: isId
      ? 'Reset demo dan mulai trade lagi'
      : 'Reset demo and trade again',
    waitingTrade: isId ? 'Klik Buy atau Sell untuk mulai demo' : 'Click Buy or Sell to start demo',
    tradeActive: isId ? 'Trade berlangsung' : 'Trade in progress',
  }), [isId])

  /* ---------- State ---------- */
  const [candles, setCandles] = useState<Candle[]>(() => genInitialCandles())
  const [tradeState, setTradeState] = useState<TradeState>('idle')
  const [direction, setDirection] = useState<TradeDirection | null>(null)
  const [entryPrice, setEntryPrice] = useState<number | null>(null)
  const [tpPrice, setTpPrice] = useState<number | null>(null)
  const [slPrice, setSlPrice] = useState<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [pnl, setPnl] = useState<number | null>(null)
  const [outcomeMs, setOutcomeMs] = useState(0)

  /* Refs untuk logika trade */
  const tradeStartRef = useRef<number>(0)
  const tradeDurationRef = useRef<number>(0)
  const plannedOutcomeRef = useRef<Outcome>('tp')
  const tickCountRef = useRef(0)
  const inViewRef = useRef(false)
  const [inView, setInView] = useState(false)
  const hostRef = useRef<HTMLDivElement>(null)
  const reducedMotionRef = useRef(false)

  /* Detect prefers-reduced-motion */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotionRef.current = mq.matches
    const handler = (e: MediaQueryListEvent) => { reducedMotionRef.current = e.matches }
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])

  /* IntersectionObserver — pause animation saat keluar viewport */
  useEffect(() => {
    const el = hostRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      inViewRef.current = true
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          inViewRef.current = e.isIntersecting
          if (e.isIntersecting) setInView(true)
        })
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  /* ---------- Tick: update candle terakhir setiap TICK_MS ---------- */
  useEffect(() => {
    if (!inView) return
    const id = setInterval(() => {
      if (!inViewRef.current) return
      setCandles((prev) => {
        if (prev.length === 0) return prev
        const next = [...prev]
        const last = { ...next[next.length - 1] }
        const newClose = nextPrice(last.close)
        last.close = newClose
        if (newClose > last.high) last.high = newClose
        if (newClose < last.low) last.low = newClose
        next[next.length - 1] = last

        tickCountRef.current += 1
        if (tickCountRef.current >= TICKS_PER_CANDLE) {
          tickCountRef.current = 0
          // buka candle baru, geser bila melebihi MAX
          next.push({
            open: newClose,
            high: newClose,
            low: newClose,
            close: newClose,
            bornAt: Date.now(),
          })
          while (next.length > MAX_CANDLES) next.shift()
        }
        return next
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [inView])

  /* ---------- Timer trade berjalan ---------- */
  useEffect(() => {
    if (tradeState !== 'active') return
    let raf: number | null = null
    const loop = () => {
      const elapsed = Date.now() - tradeStartRef.current
      setElapsedMs(elapsed)
      if (elapsed >= tradeDurationRef.current) {
        finalizeTrade()
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { if (raf) cancelAnimationFrame(raf) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeState])

  /* ---------- Mulai trade ---------- */
  const startTrade = useCallback((dir: TradeDirection) => {
    if (tradeState === 'active') return
    const last = candles[candles.length - 1]
    if (!last) return
    const entry = last.close
    const tp = dir === 'buy' ? entry + TP_DELTA : entry - TP_DELTA
    const sl = dir === 'buy' ? entry - SL_DELTA : entry + SL_DELTA
    const duration = (MIN_DURATION_S + Math.random() * (MAX_DURATION_S - MIN_DURATION_S)) * 1000
    const planned: Outcome = Math.random() < TP_PROBABILITY ? 'tp' : 'sl'

    setDirection(dir)
    setEntryPrice(entry)
    setTpPrice(tp)
    setSlPrice(sl)
    setOutcome(null)
    setPnl(null)
    setOutcomeMs(0)
    setElapsedMs(0)
    tradeStartRef.current = Date.now()
    tradeDurationRef.current = duration
    plannedOutcomeRef.current = planned
    setTradeState('active')
  }, [candles, tradeState])

  /* ---------- Finalisasi trade ---------- */
  const finalizeTrade = useCallback(() => {
    const planned = plannedOutcomeRef.current
    const elapsed = Date.now() - tradeStartRef.current
    // paksa harga ke level target agar visual konsisten
    const targetPrice = planned === 'tp' ? tpPrice! : slPrice!
    setCandles((prev) => {
      if (prev.length === 0) return prev
      const next = [...prev]
      const last = { ...next[next.length - 1] }
      last.close = targetPrice
      if (targetPrice > last.high) last.high = targetPrice
      if (targetPrice < last.low) last.low = targetPrice
      next[next.length - 1] = last
      return next
    })
    setOutcome(planned)
    setPnl(planned === 'tp' ? TP_DELTA : -SL_DELTA)
    setOutcomeMs(elapsed)
    setElapsedMs(elapsed)
    setTradeState('resolved')
  }, [tpPrice, slPrice])

  /* ---------- Reset demo ---------- */
  const resetTrade = useCallback(() => {
    setTradeState('idle')
    setDirection(null)
    setEntryPrice(null)
    setTpPrice(null)
    setSlPrice(null)
    setElapsedMs(0)
    setOutcome(null)
    setPnl(null)
    setOutcomeMs(0)
  }, [])

  /* Count-up number untuk hasil */
  const animatedPnl = useCountUp(pnl ?? 0, 900, tradeState === 'resolved' && pnl !== null)

  /* ---------- Render helpers ---------- */
  const lastCandle = candles[candles.length - 1]
  const currentPrice = lastCandle?.close ?? START_PRICE

  /* Y-axis price labels */
  const priceTicks = useMemo(() => {
    const ticks: { price: number; y: number }[] = []
    const step = 10
    for (let p = PRICE_MIN; p <= PRICE_MAX; p += step) {
      ticks.push({ price: p, y: priceToY(p) })
    }
    return ticks
  }, [])

  /* Time labels (mock) */
  const timeTicks = useMemo(() => {
    const ticks: { x: number; label: string }[] = []
    const step = Math.floor(MAX_CANDLES / 5)
    for (let i = 0; i < MAX_CANDLES; i += step) {
      ticks.push({ x: indexToX(i), label: `T-${(MAX_CANDLES - i) * TICKS_PER_CANDLE}s` })
    }
    return ticks
  }, [])

  const isWin = outcome === 'tp'
  const showOverlay = tradeState !== 'idle'

  return (
    <section
      ref={hostRef}
      className="relative py-16 md:py-24 px-4 sm:px-6 border-b border-white/5 bg-gradient-to-b from-[#0a0a0f] to-[#050507]"
      aria-label="Live Trading Simulator XAUUSD demo"
    >
      {/* Glow latar */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[360px] rounded-full bg-emerald-500/[0.06] blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto">
        {/* ============ Header ============ */}
        <div className="text-center mb-10 md:mb-14">
          <span className="inline-block text-[11px] font-bold tracking-widest px-3 py-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 mb-5">
            {t.badge}
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight text-white">
            {t.title}
          </h2>
          <p className="mt-4 text-white/50 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            {t.sub}
          </p>
        </div>

        {/* ============ Card chart + action ============ */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-[0_30px_80px_-20px_rgba(16,185,129,0.18)]">
          {/* Bar judul terminal */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400/70" aria-hidden="true" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-300/70" aria-hidden="true" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" aria-hidden="true" />
            <span className="ml-3 text-[11px] text-white/60 font-medium tracking-wide font-mono">
              {t.pair} · {t.timeframe}
            </span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-400/25 text-emerald-300 flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                aria-hidden="true"
                style={{ animation: 'lpd-pulse 1.4s ease-in-out infinite' }}
              />
              {t.live}
            </span>
          </div>

          {/* ============ Chart container ============ */}
          <div className="relative bg-[#06070d]">
            <div className="relative w-full aspect-[16/9] md:aspect-[16/7]">
              <svg
                viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                preserveAspectRatio="xMidYMid meet"
                className="absolute inset-0 w-full h-full"
                role="img"
                aria-label={t.ariaChart}
              >
                <defs>
                  <linearGradient id="lpd-grid-fade" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.04)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0.015)" />
                  </linearGradient>
                </defs>

                {/* Background grid */}
                {priceTicks.map((tk) => (
                  <line
                    key={`h${tk.price}`}
                    x1={PAD_LEFT}
                    x2={VIEW_W - PAD_RIGHT}
                    y1={tk.y}
                    y2={tk.y}
                    stroke="url(#lpd-grid-fade)"
                    strokeWidth="1"
                  />
                ))}
                {timeTicks.map((tk, i) => (
                  <line
                    key={`v${i}`}
                    y1={PAD_TOP}
                    y2={VIEW_H - PAD_BOTTOM}
                    x1={tk.x}
                    x2={tk.x}
                    stroke="rgba(255,255,255,0.03)"
                    strokeWidth="1"
                  />
                ))}

                {/* Watermark */}
                <text
                  x={PAD_LEFT + CHART_W / 2}
                  y={PAD_TOP + CHART_H / 2}
                  textAnchor="middle"
                  fontSize="36"
                  fontWeight="800"
                  letterSpacing="8"
                  fill="rgba(255,255,255,0.025)"
                >
                  LUXTRADEE
                </text>

                {/* Candles */}
                {candles.map((c, i) => {
                  const x = indexToX(i)
                  const yHigh = priceToY(c.high)
                  const yLow = priceToY(c.low)
                  const yOpen = priceToY(c.open)
                  const yClose = priceToY(c.close)
                  const isBull = c.close >= c.open
                  const color = isBull ? COLOR_BULL : COLOR_BEAR
                  const bodyTop = Math.min(yOpen, yClose)
                  const bodyH = Math.max(1, Math.abs(yClose - yOpen))
                  return (
                    <g key={`c${i}-${c.bornAt}`} aria-hidden="true">
                      {/* Sumbu (wick) */}
                      <line
                        x1={x}
                        x2={x}
                        y1={yHigh}
                        y2={yLow}
                        stroke={color}
                        strokeWidth="1"
                        opacity={i === candles.length - 1 ? 1 : 0.85}
                      />
                      {/* Body */}
                      <rect
                        x={x - CANDLE_W / 2}
                        y={bodyTop}
                        width={CANDLE_W}
                        height={bodyH}
                        fill={color}
                        opacity={i === candles.length - 1 ? 1 : 0.85}
                        rx="0.5"
                      />
                    </g>
                  )
                })}

                {/* Garis harga saat ini (live price line) */}
                <line
                  x1={PAD_LEFT}
                  x2={VIEW_W - PAD_RIGHT}
                  y1={priceToY(currentPrice)}
                  y2={priceToY(currentPrice)}
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                {/* Label harga kanan untuk harga live */}
                <g>
                  <rect
                    x={VIEW_W - PAD_RIGHT + 2}
                    y={priceToY(currentPrice) - 8}
                    width={PAD_RIGHT - 4}
                    height="16"
                    rx="3"
                    fill="rgba(255,255,255,0.92)"
                  />
                  <text
                    x={VIEW_W - PAD_RIGHT + (PAD_RIGHT - 4) / 2 + 2}
                    y={priceToY(currentPrice) + 4}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="#06070d"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    {fmtPrice(currentPrice)}
                  </text>
                </g>

                {/* Y-axis price labels (samping kanan, kecuali yang overlap dgn live) */}
                {priceTicks.filter((tk) => Math.abs(tk.y - priceToY(currentPrice)) > 12).map((tk) => (
                  <text
                    key={`p${tk.price}`}
                    x={VIEW_W - PAD_RIGHT + 6}
                    y={tk.y + 3.5}
                    fill="rgba(255,255,255,0.4)"
                    fontSize="10"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    {tk.price}
                  </text>
                ))}

                {/* X-axis time labels */}
                {timeTicks.map((tk, i) => (
                  <text
                    key={`t${i}`}
                    x={tk.x}
                    y={VIEW_H - PAD_BOTTOM + 16}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.3)"
                    fontSize="9"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    {tk.label}
                  </text>
                ))}

                {/* Baseline bottom */}
                <line
                  x1={PAD_LEFT}
                  x2={VIEW_W - PAD_RIGHT}
                  y1={VIEW_H - PAD_BOTTOM}
                  y2={VIEW_H - PAD_BOTTOM}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="1"
                />

                {/* ============ Trade overlay lines ============ */}
                <AnimatePresence>
                  {showOverlay && entryPrice !== null && tpPrice !== null && slPrice !== null && (
                    <motion.g
                      key="trade-overlay"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      {/* Entry line */}
                      <line
                        x1={PAD_LEFT}
                        x2={VIEW_W - PAD_RIGHT}
                        y1={priceToY(entryPrice)}
                        y2={priceToY(entryPrice)}
                        stroke={COLOR_ENTRY}
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <LineLabel
                        x={VIEW_W - PAD_RIGHT - 4}
                        y={priceToY(entryPrice)}
                        text={`${t.entry} ${fmtPrice(entryPrice)}`}
                        color={COLOR_ENTRY}
                        align="end"
                      />

                      {/* TP line */}
                      <line
                        x1={PAD_LEFT}
                        x2={VIEW_W - PAD_RIGHT}
                        y1={priceToY(tpPrice)}
                        y2={priceToY(tpPrice)}
                        stroke={COLOR_TP}
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <LineLabel
                        x={VIEW_W - PAD_RIGHT - 4}
                        y={priceToY(tpPrice)}
                        text={`${t.tp} +$${TP_DELTA}`}
                        color={COLOR_TP}
                        align="end"
                      />

                      {/* SL line */}
                      <line
                        x1={PAD_LEFT}
                        x2={VIEW_W - PAD_RIGHT}
                        y1={priceToY(slPrice)}
                        y2={priceToY(slPrice)}
                        stroke={COLOR_SL}
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <LineLabel
                        x={VIEW_W - PAD_RIGHT - 4}
                        y={priceToY(slPrice)}
                        text={`${t.sl} -$${SL_DELTA}`}
                        color={COLOR_SL}
                        align="end"
                      />

                      {/* Entry marker (dot di candle terakhir) */}
                      <circle
                        cx={indexToX(candles.length - 1)}
                        cy={priceToY(entryPrice)}
                        r="3.5"
                        fill={COLOR_ENTRY}
                        stroke="#06070d"
                        strokeWidth="1.5"
                      />
                    </motion.g>
                  )}
                </AnimatePresence>

                {/* Timer overlay (active trade) */}
                <AnimatePresence>
                  {tradeState === 'active' && (
                    <motion.g
                      key="timer"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                    >
                      <rect
                        x={PAD_LEFT + 8}
                        y={PAD_TOP + 6}
                        width="120"
                        height="26"
                        rx="6"
                        fill="rgba(6,7,13,0.78)"
                        stroke="rgba(255,255,255,0.12)"
                        strokeWidth="1"
                      />
                      <text
                        x={PAD_LEFT + 16}
                        y={PAD_TOP + 23}
                        fill="#06b6d4"
                        fontSize="11"
                        fontWeight="700"
                        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                      >
                        {direction === 'buy' ? 'BUY' : 'SELL'} · {fmtSeconds(elapsedMs)}s
                      </text>
                    </motion.g>
                  )}
                </AnimatePresence>
              </svg>

              {/* ============ HTML overlay: result card ============ */}
              <AnimatePresence>
                {tradeState === 'resolved' && outcome && pnl !== null && (
                  <motion.div
                    key="result-card"
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[88%] max-w-sm"
                  >
                    <div
                      className={`rounded-xl border backdrop-blur-md p-5 md:p-6 text-center shadow-2xl ${
                        isWin
                          ? 'bg-emerald-950/80 border-emerald-400/40'
                          : 'bg-rose-950/80 border-rose-400/40'
                      }`}
                    >
                      <div
                        className={`inline-flex items-center justify-center w-10 h-10 rounded-full mb-3 ${
                          isWin ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}
                        aria-hidden="true"
                      >
                        {isWin ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                      </div>
                      <p
                        className={`text-xs font-bold tracking-widest uppercase mb-1 ${
                          isWin ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {isWin ? t.tpHit : t.slHit}
                      </p>
                      <p
                        className={`text-3xl md:text-4xl font-extrabold font-mono tabular-nums ${
                          isWin ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {pnl >= 0 ? '+' : '-'}${Math.abs(animatedPnl).toFixed(2)}
                      </p>
                      <p className="mt-2 text-xs text-white/60 font-mono">
                        {t.inLbl} {fmtSeconds(outcomeMs)} {t.seconds}
                      </p>
                      <button
                        type="button"
                        onClick={resetTrade}
                        aria-label={t.ariaAgain}
                        className="mt-5 inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-lg bg-white text-[#06070d] font-semibold text-sm hover:bg-white/90 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" aria-hidden="true" />
                        {t.tradeAgain}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ============ Action bar ============ */}
          <div className="border-t border-white/[0.06] bg-white/[0.02] p-4 md:p-5">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <button
                  type="button"
                  onClick={() => startTrade('buy')}
                  disabled={tradeState === 'active'}
                  aria-label={t.ariaBuy}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-[#06070d] font-bold text-sm transition-colors cursor-pointer"
                >
                  <TrendingUp className="w-4 h-4" aria-hidden="true" />
                  {t.buy}
                </button>
                <button
                  type="button"
                  onClick={() => startTrade('sell')}
                  disabled={tradeState === 'active'}
                  aria-label={t.ariaSell}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors cursor-pointer"
                >
                  <TrendingDown className="w-4 h-4" aria-hidden="true" />
                  {t.sell}
                </button>
              </div>
              {/* Status pill */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 min-w-[180px] justify-center">
                {tradeState === 'idle' && (
                  <span className="text-xs text-white/50 font-medium flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" aria-hidden="true" />
                    {t.waitingTrade}
                  </span>
                )}
                {tradeState === 'active' && (
                  <span className="text-xs text-cyan-300 font-mono flex items-center gap-1.5">
                    <Timer className="w-3.5 h-3.5" aria-hidden="true" />
                    {t.tradeActive} · {fmtSeconds(elapsedMs)}s
                  </span>
                )}
                {tradeState === 'resolved' && (
                  <span
                    className={`text-xs font-mono flex items-center gap-1.5 ${
                      isWin ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {isWin ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {isWin ? `+$${TP_DELTA}.00` : `-$${SL_DELTA}.00`}
                  </span>
                )}
              </div>
            </div>
            <p className="mt-3 text-[11px] text-white/40 leading-relaxed">
              {t.demoNote}
            </p>
          </div>
        </div>

        {/* ============ CTA section ============ */}
        <div className="mt-10 md:mt-14 text-center">
          <p className="text-base md:text-lg text-white/80 font-medium mb-4">
            {t.ctaTitle}
          </p>
          <a
            href="/auth/signup"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-400 text-[#06070d] font-bold text-sm hover:from-emerald-400 hover:to-cyan-300 transition-colors cursor-pointer"
          >
            {t.ctaBtn}
          </a>
          <p className="mt-2 text-xs text-white/40">{t.ctaNote}</p>
        </div>
      </div>

      {/* Keyframe for live dot pulse (scoped via styled element) */}
      <style>{`
        @keyframes lpd-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes lpd-pulse { 0%, 100% { opacity: 1; transform: scale(1); } }
        }
      `}</style>
    </section>
  )
}

/* ============================================================
 * Helper komponen: label garis dengan background semi-transparan
 * ============================================================ */
function LineLabel({
  x,
  y,
  text,
  color,
  align = 'start',
}: {
  x: number
  y: number
  text: string
  color: string
  align?: 'start' | 'middle' | 'end'
}) {
  // Perkiraan lebar label berdasarkan panjang teks (font 10px monospace ~6px/char)
  const padding = 6
  const estW = text.length * 6 + padding * 2
  const estH = 16
  const labelX = align === 'end' ? x - estW : align === 'middle' ? x - estW / 2 : x
  return (
    <g aria-hidden="true">
      <rect
        x={labelX}
        y={y - estH / 2}
        width={estW}
        height={estH}
        rx="3"
        fill="rgba(6,7,13,0.85)"
        stroke={color}
        strokeWidth="1"
        opacity="0.95"
      />
      <text
        x={labelX + padding}
        y={y + 3.5}
        fill={color}
        fontSize="10"
        fontWeight="700"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {text}
      </text>
    </g>
  )
}

export default LiveChartPineDemo
