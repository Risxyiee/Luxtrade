'use client'

/**
 * ============================================================
 * SignalChart — chart candlestick + marker sinyal ala Strategy
 * Tester TradingView untuk hasil Run Test Pine Lab.
 * ============================================================
 * Data candle datang dari respons run (array-of-arrays
 * [time, open, high, low, close] — hemat payload). Marker sinyal
 * digambar di bar ke-`bar` (index sama dengan array candle).
 * Canvas murni (tanpa library) supaya ringan & tidak kena CSP.
 * ============================================================
 */

import { useEffect, useRef } from 'react'

export interface ChartMarker {
  bar: number
  dir: 'long' | 'short' | 'info'
  title: string
  price?: number
  message?: string
}

interface SignalChartProps {
  candles: number[][] // [time, open, high, low, close][]
  markers: ChartMarker[]
  height?: number
}

const UP = '#26a69a'
const DOWN = '#ef5350'
const INFO = '#f59e0b'

export default function SignalChart({ candles, markers, height = 340 }: SignalChartProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hoverRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap || candles.length === 0) return

    let raf = 0
    const draw = () => {
      raf = 0
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const W = wrap.clientWidth
      const H = height
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      canvas.style.width = `${W}px`
      canvas.style.height = `${H}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      const padL = 8
      const padR = 64 // ruang label harga
      const padT = 10
      const padB = 22 // label tanggal
      const plotW = Math.max(10, W - padL - padR)
      const plotH = Math.max(10, H - padT - padB)
      const n = candles.length

      // rentang harga
      let lo = Infinity
      let hi = -Infinity
      for (const c of candles) {
        if (c[3] < lo) lo = c[3]
        if (c[2] > hi) hi = c[2]
      }
      for (const m of markers) {
        if (typeof m.price === 'number' && Number.isFinite(m.price)) {
          if (m.price < lo) lo = m.price
          if (m.price > hi) hi = m.price
        }
      }
      const span = hi - lo || 1
      lo -= span * 0.04
      hi += span * 0.04
      const yOf = (p: number) => padT + ((hi - p) / (hi - lo)) * plotH
      const barW = plotW / n
      const bodyW = Math.max(1, Math.min(barW * 0.66, 14))
      const xOf = (i: number) => padL + i * barW + barW / 2

      // grid harga kanan (5 level)
      ctx.font = '10px ui-monospace, monospace'
      ctx.textBaseline = 'middle'
      for (let g = 0; g <= 4; g++) {
        const p = lo + ((hi - lo) * g) / 4
        const y = yOf(p)
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(padL, y)
        ctx.lineTo(W - padR, y)
        ctx.stroke()
        ctx.fillStyle = 'rgba(255,255,255,0.45)'
        ctx.textAlign = 'left'
        ctx.fillText(p.toFixed(p > 1000 ? 1 : 2), W - padR + 6, y)
      }

      // candlestick
      for (let i = 0; i < n; i++) {
        const [, o, h, l, c] = candles[i]
        const up = c >= o
        ctx.strokeStyle = up ? UP : DOWN
        ctx.fillStyle = up ? UP : DOWN
        const x = xOf(i)
        ctx.beginPath()
        ctx.moveTo(x, yOf(h))
        ctx.lineTo(x, yOf(l))
        ctx.lineWidth = 1
        ctx.stroke()
        const yO = yOf(o)
        const yC = yOf(c)
        const top = Math.min(yO, yC)
        const bh = Math.max(1, Math.abs(yC - yO))
        ctx.fillRect(x - bodyW / 2, top, bodyW, bh)
      }

      // label tanggal bawah (5 titik)
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.textAlign = 'center'
      for (let g = 0; g < 5; g++) {
        const i = Math.min(n - 1, Math.round(((n - 1) * g) / 4))
        const d = new Date(candles[i][0] * 1000)
        const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
        ctx.fillText(label, xOf(i), H - padB / 2)
      }

      // marker sinyal (segitiga/lingkaran)
      for (const m of markers) {
        if (m.bar < 0 || m.bar >= n) continue
        const x = xOf(m.bar)
        const [, , h, l] = candles[m.bar]
        if (m.dir === 'long') {
          const y = yOf(l) + 7
          ctx.fillStyle = UP
          ctx.beginPath()
          ctx.moveTo(x, y - 6)
          ctx.lineTo(x - 5, y + 3)
          ctx.lineTo(x + 5, y + 3)
          ctx.closePath()
          ctx.fill()
        } else if (m.dir === 'short') {
          const y = yOf(h) - 7
          ctx.fillStyle = DOWN
          ctx.beginPath()
          ctx.moveTo(x, y + 6)
          ctx.lineTo(x - 5, y - 3)
          ctx.lineTo(x + 5, y - 3)
          ctx.closePath()
          ctx.fill()
        } else {
          ctx.fillStyle = INFO
          ctx.beginPath()
          ctx.arc(x, yOf(l) + 8, 2.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // crosshair + panel info hover
      const hv = hoverRef.current
      if (hv && hv.x >= padL && hv.x <= padL + plotW) {
        const idx = Math.max(0, Math.min(n - 1, Math.floor((hv.x - padL) / barW)))
        const x = xOf(idx)
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(x, padT)
        ctx.lineTo(x, padT + plotH)
        ctx.stroke()
        ctx.setLineDash([])
        const [time, o, h, l, c] = candles[idx]
        const evs = markers.filter((m) => m.bar === idx)
        const t = new Date(time * 1000).toLocaleString('id-ID', {
          timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        })
        const lines = [
          `${t} WIB`,
          `O ${o.toFixed(2)}  H ${h.toFixed(2)}`,
          `L ${l.toFixed(2)}  C ${c.toFixed(2)}`,
          ...evs.map((m) => `${m.dir === 'long' ? 'BUY' : m.dir === 'short' ? 'SELL' : 'SINYAL'} · ${m.title}${typeof m.price === 'number' ? ` @ ${m.price.toFixed(2)}` : ''}`),
        ]
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        const boxW = 210
        const boxH = 14 * lines.length + 10
        const bx = x + 12 + boxW > W - padR ? x - boxW - 12 : x + 12
        ctx.fillStyle = 'rgba(10,10,18,0.92)'
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'
        ctx.beginPath()
        ctx.roundRect(bx, padT + 4, boxW, boxH, 6)
        ctx.fill()
        ctx.stroke()
        lines.forEach((ln, li) => {
          ctx.fillStyle = li === 0 ? 'rgba(255,255,255,0.6)' : li >= 4 ? '#7dd3fc' : 'rgba(255,255,255,0.85)'
          ctx.fillText(ln, bx + 8, padT + 10 + li * 14)
        })
      }
    }

    const schedule = () => { if (!raf) raf = requestAnimationFrame(draw) }
    schedule()
    const ro = new ResizeObserver(schedule)
    ro.observe(wrap)
    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      hoverRef.current = { x: e.clientX - r.left, y: e.clientY - r.top }
      schedule()
    }
    const onLeave = () => { hoverRef.current = null; schedule() }
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
    }
  }, [candles, markers, height])

  if (!candles.length) return null
  return (
    <div ref={wrapRef} className="w-full rounded-xl border border-white/10 bg-[#0a0a12] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-1.5 px-3 py-2 bg-white/[0.03] border-b border-white/5">
        <span className="text-[11px] font-bold text-white/70">Chart Sinyal (Strategy Tester)</span>
        <span className="flex items-center gap-3 text-[10px] text-white/45">
          <span className="flex items-center gap-1"><span className="inline-block w-0 h-0 border-l-[5px] border-r-[5px] border-b-[7px] border-l-transparent border-r-transparent border-b-emerald-400" /> Sinyal BUY</span>
          <span className="flex items-center gap-1"><span className="inline-block w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-red-400" /> Sinyal SELL</span>
          <span className="hidden sm:inline">arahkan kursor untuk detail candle</span>
        </span>
      </div>
      <canvas ref={canvasRef} className="block w-full cursor-crosshair" aria-label="Chart candlestick dengan penanda sinyal" />
    </div>
  )
}
