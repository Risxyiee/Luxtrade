'use client'

/**
 * ============================================================
 * TradingViewChart — widget chart RESMI TradingView (tv.js)
 * ============================================================
 * Direktif Bos (2026-11-11): "chart dan semua elemen chartnya
 * ganti ke https://github.com/tradingview/awesome-tradingview —
 * data chart juga ambil dari situ, mau xau kek gbpusd kek semua."
 *
 * Yang dipakai dari daftar awesome-tradingview:
 *   "Advanced Real-Time Chart" (embed resmi via tv.js).
 *
 * KEUNGGULAN vs datafeed lama:
 *   - Data feed DITARIK LANGSUNG oleh chart TradingView dari server
 *     TradingView (OANDA/FX/BINANCE) di BROWSER user → tidak melewati
 *     server Luxtradee lagi → tidak ada lagi skenario rantai
 *     TwelveData→TV→Yahoo 503 (Yahoo 422, TV WS ditolak IP datacenter,
 *     kuota TD habis, dsb.).
 *   - Semua elemen chart bawaan TradingView: indikator, drawing tools,
 *     timeframe, ganti simbol, screenshot, daterange, dsb.
 *
 * Peta simbol kanonik Luxtradee → simbol TradingView (skala sama
 * dengan feed internal: logam/forex spot OANDA-FX, US100 = NDX,
 * crypto = pasangan USDT Binance).
 *
 * Komponen CLIENT-ONLY (dipakai di dalam ChartTab yang sudah
 * dynamic + ssr:false).
 * ============================================================
 */

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    TradingView?: any
  }
}

const TV_SCRIPT_SRC = 'https://s3.tradingview.com/tv.js'

/* ---------- Simbol kanonik → simbol TradingView ---------- */
export const TV_WIDGET_SYMBOLS: Record<string, string> = {
  'XAUUSD': 'OANDA:XAUUSD',
  'XAGUSD': 'OANDA:XAGUSD',
  'US100': 'NASDAQ:NDX',
  'EURUSD': 'FX:EURUSD',
  'GBPUSD': 'FX:GBPUSD',
  'USDJPY': 'FX:USDJPY',
  'EURGBP': 'FX:EURGBP',
  'EURJPY': 'FX:EURJPY',
  'GBPJPY': 'FX:GBPJPY',
  'AUDUSD': 'FX:AUDUSD',
  'NZDUSD': 'FX:NZDUSD',
  'USDCAD': 'FX:USDCAD',
  'USDCHF': 'FX:USDCHF',
  'BTCUSDT': 'BINANCE:BTCUSDT',
  'ETHUSDT': 'BINANCE:ETHUSDT',
  'SOLUSDT': 'BINANCE:SOLUSDT',
  'XRPUSDT': 'BINANCE:XRPUSDT',
  'DOGEUSDT': 'BINANCE:DOGEUSDT',
  'ADAUSDT': 'BINANCE:ADAUSDT',
  'LTCUSDT': 'BINANCE:LTCUSDT',
  'BNBUSDT': 'BINANCE:BNBUSDT',
  'LINKUSDT': 'BINANCE:LINKUSDT',
  'AVAXUSDT': 'BINANCE:AVAXUSDT',
}

/* ---------- Interval kanonik → format widget TradingView ---------- */
const TV_WIDGET_INTERVALS: Record<string, string> = {
  '5m': '5', '15m': '15', '30m': '30', '1h': '60',
  '2h': '120', '4h': '240', '1d': 'D', '1w': 'W',
}

/* Muat tv.js SEKALI per sesi browser (promise di-cache modul) */
let tvScriptPromise: Promise<void> | null = null
function loadTvScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('client-only'))
  if (window.TradingView) return Promise.resolve()
  if (tvScriptPromise) return tvScriptPromise
  tvScriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = TV_SCRIPT_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      tvScriptPromise = null
      reject(new Error('Gagal memuat tv.js TradingView'))
    }
    document.head.appendChild(s)
  })
  return tvScriptPromise
}

interface TradingViewChartProps {
  /** Simbol kanonik Luxtradee (XAUUSD, GBPUSD, BTCUSDT, …) */
  symbol?: string
  /** Interval kanonik (5m, 15m, 30m, 1h, 2h, 4h, 1d, 1w) */
  interval?: string
  className?: string
}

export default function TradingViewChart({
  symbol = 'XAUUSD',
  interval = '1h',
  className = '',
}: TradingViewChartProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const holderIdRef = useRef(`tv_chart_${Math.random().toString(36).slice(2, 10)}`)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const host = hostRef.current
    if (!host) return

    setFailed(false)

    loadTvScript()
      .then(() => {
        if (cancelled || !host) return
        /* Container FRESH tiap perubahan simbol/interval — widget tv.js
           menulis iframe-nya sendiri ke dalam holder dan tidak punya API
           destroy publik; kosongkan & bikin ulang = bersih. */
        host.innerHTML = ''
        const holder = document.createElement('div')
        holder.id = holderIdRef.current
        holder.style.width = '100%'
        holder.style.height = '100%'
        host.appendChild(holder)

        const upper = String(symbol || '').toUpperCase()
        const tvSymbol = TV_WIDGET_SYMBOLS[upper] || `OANDA:${upper}`
        const tvInterval = TV_WIDGET_INTERVALS[interval] || '60'

        new window.TradingView.widget({
          container_id: holder.id,
          autosize: true,
          symbol: tvSymbol,
          interval: tvInterval,
          timezone: 'Asia/Jakarta',
          theme: 'dark',
          style: '1',
          locale: 'id',
          toolbar_bg: '#0f0f16',
          backgroundColor: '#0b0b12',
          gridColor: 'rgba(255,255,255,0.06)',
          enable_publishing: false,
          allow_symbol_change: true,
          withdateranges: true,
          hide_side_toolbar: false,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: true,
          details: false,
          hotlist: false,
          calendar: false,
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [symbol, interval])

  return (
    <div className={`relative w-full h-full ${className}`} aria-label={`Chart TradingView ${symbol}`}>
      <div ref={hostRef} className="w-full h-full" />
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0b0b12]">
          <div className="text-center px-6">
            <p className="text-white/70 text-sm font-medium">Chart TradingView gagal dimuat</p>
            <p className="text-white/40 text-xs mt-1">
              Cek koneksi internet lalu refresh halaman — data feed berasal langsung dari TradingView.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
