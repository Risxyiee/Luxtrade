'use client'

/**
 * TEMPORARY TEST PAGE (diagnosa "pine ga tampil di chart") — HAPUS SETELAH DIAGNOSA.
 * Boot VelaWorkspace dgn data offline sintetis + jalankan skrip Pine uji
 * (plot/plotshape/plotchar/bgcolor/label.new/table.new/line.new) satu per satu,
 * tampilkan ok/error/warnings + chart supaya hasil gambar bisa di-screenshot.
 */
import { useEffect, useRef, useState } from 'react'

interface TestDef { id: string; label: string; src: string }

const TESTS: TestDef[] = [
  {
    id: 't1', label: '1. plot() garis biasa',
    src: `//@version=6
indicator("T1 plot", overlay=true)
plot(close, title="Close", color=color.orange, linewidth=2)`,
  },
  {
    id: 't2', label: '2. plotshape BUY/SELL (triangle)',
    src: `//@version=6
indicator("T2 shapes", overlay=true)
plotshape(close > open, style=shape.triangleup, location=location.belowbar, color=color.green, size=size.small, title="Sinyal BUY")
plotshape(close < open, style=shape.triangledown, location=location.abovebar, color=color.red, size=size.small, title="Sinyal SELL")`,
  },
  {
    id: 't3', label: '3. plotchar + ta.pivothigh (fractal)',
    src: `//@version=6
indicator("T3 char", overlay=true)
ph = ta.pivothigh(high, 5, 5)
pl = ta.pivotlow(low, 5, 5)
plotchar(not na(ph), char="x", location=location.abovebar, color=color.aqua, title="Fractal high")
plotchar(not na(pl), char="o", location=location.belowbar, color=color.fuchsia, title="Fractal low")`,
  },
  {
    id: 't4', label: '4. bgcolor (di luar sesi)',
    src: `//@version=6
indicator("T4 bg", overlay=true)
bgcolor(close > open ? color.new(color.green, 80) : na, title="Bg hijau")`,
  },
  {
    id: 't5', label: '5. label.new (signal labels)',
    src: `//@version=6
indicator("T5 label", overlay=true)
if bar_index % 40 == 0
    label.new(bar_index, high, "ENTRY", style=label.style_label_up, color=color.green, textcolor=color.white, title="Lbl")`,
  },
  {
    id: 't6', label: '6. table.new (tabel pojok)',
    src: `//@version=6
indicator("T6 table", overlay=true)
var table t = table.new(position.top_right, 2, 2)
if barstate.islast
    table.cell(t, 0, 0, "Net PnL", text_color=color.white, bgcolor=color.new(color.purple, 20))
    table.cell(t, 1, 0, "+1540", text_color=color.green, bgcolor=color.new(color.purple, 20))`,
  },
  {
    id: 't7', label: '7. line.new (level retest)',
    src: `//@version=6
indicator("T7 line", overlay=true)
if bar_index % 60 == 0
    line.new(bar_index - 10, high, bar_index + 10, high, color=color.aqua, width=2, title="Ln")`,
  },
  {
    id: 't8', label: '8. strategy() + plotshape',
    src: `//@version=6
strategy("T8 strat", overlay=true)
long = ta.crossover(close, ta.sma(close, 10))
if long
    strategy.entry("Buy", strategy.long)
if ta.crossunder(close, ta.sma(close, 10))
    strategy.close("Buy")
plotshape(long, style=shape.triangleup, location=location.belowbar, color=color.green, title="Sinyal BUY")`,
  },
  {
    id: 't9', label: '9. time() sesi (di luar sesi)',
    src: `//@version=6
indicator("T9 session", overlay=true)
inSess = not na(time(timeframe.period, "0800-1600", "Asia/Jakarta"))
bgcolor(not inSess ? color.new(color.gray, 70) : na, title="Di luar sesi")
plot(inSess ? 1 : 0, title="Sess", display=display.none)`,
  },
  {
    id: 't10', label: '10. input.int/bool/session',
    src: `//@version=6
indicator("T10 inputs", overlay=true)
len = input.int(14, "Panjang", minval=1)
showSig = input.bool(true, "Tampilkan sinyal")
sess = input.session("0800-1700", "Jam sesi")
plot(ta.sma(close, len), title="SMA", color=color.orange)
plotshape(showSig and close > open ? true : false, style=shape.triangleup, location=location.belowbar, color=color.lime, title="Sinyal BUY")`,
  },
  {
    id: 't11', label: '11. var/array/for (logika Champion)',
    src: `//@version=6
indicator("T11 array", overlay=true)
var float lastLevel = na
var array<float> vals = array.new<float>()
if bar_index % 30 == 0
    array.push(vals, high)
    if array.size(vals) > 5
        array.shift(vals)
    lastLevel := array.get(vals, array.size(vals) - 1)
plot(lastLevel, title="Level", color=color.yellow, style=plot.style_linebr)
for i = 0 to 4
    continue
plot(close, title="C", display=display.none)`,
  },
  {
    id: 't12', label: '12. request.security (HTF)',
    src: `//@version=6
indicator("T12 security", overlay=true)
htf = request.security(syminfo.tickerid, "240", close)
plot(htf, title="HTF close", color=color.red, linewidth=2)`,
  },
  {
    id: 't13', label: '13. CHAMPION v4 (tiran lengkap)',
    src: `//@version=6
indicator("Champion v4", overlay=true, max_labels_count=500, max_lines_count=500)

grpS = "Sinyal"
len = input.int(14, "Panjang EMA", minval=1, group=grpS)
showSig = input.bool(true, "Tampilkan Sinyal", group=grpS)
sessStr = input.session("0800-1700", "Jam Trading", group=grpS)
tz = input.string("Asia/Jakarta", "Timezone", options=["Asia/Jakarta", "UTC"], group=grpS)

emaFast = ta.ema(close, len)
emaSlow = ta.ema(close, len * 3)

// Sesi
inSession = not na(time(timeframe.period, sessStr, tz))

// Fractal
ph = ta.pivothigh(high, 5, 5)
pl = ta.pivotlow(low, 5, 5)
var float fractalHigh = na
var float fractalLow = na
if not na(ph)
    fractalHigh := ph
if not na(pl)
    fractalLow := pl

// Entry ala champion
buyCond = showSig and ta.crossover(close, emaFast) and close > emaSlow and inSession
sellCond = showSig and ta.crossunder(close, emaFast) and close < emaSlow and inSession

var float entryPrice = na
var int dir = 0
if buyCond
    entryPrice := close
    dir := 1
if sellCond
    entryPrice := close
    dir := -1

// Level retest (line.new)
var line retestLine = na
if not na(fractalHigh) and barstate.isconfirmed
    if not na(retestLine)
        line.delete(retestLine)
    retestLine := line.new(bar_index - 5, fractalHigh, bar_index + 10, fractalHigh, color=color.teal, style=line.style_dashed, width=1)

// Harga entry (plot)
plot(entryPrice, title="Harga entry", color=color.new(color.gray, 20), style=plot.style_linebr, linewidth=1)
plot(fractalHigh, title="Fractal high", color=color.new(color.aqua, 40), style=plot.style_linebr)
plot(fractalLow, title="Fractal low", color=color.new(color.orange, 40), style=plot.style_linebr)

// Sinyal BUY/SELL
plotshape(buyCond, style=shape.triangleup, location=location.belowbar, color=color.new(color.green, 0), size=size.small, title="Sinyal BUY")
plotshape(sellCond, style=shape.triangledown, location=location.abovebar, color=color.new(color.red, 0), size=size.small, title="Sinyal SELL")

// Di luar sesi
bgcolor(not inSession ? color.new(color.gray, 85) : na, title="Di luar sesi")

// Signal labels + qty
if buyCond
    label.new(bar_index, low, "BUY\\n" + str.tostring(close, format.mintick), style=label.style_label_up, color=color.new(color.green, 10), textcolor=color.white, size=size.small)
if sellCond
    label.new(bar_index, high, "SELL\\n" + str.tostring(close, format.mintick), style=label.style_label_down, color=color.new(color.red, 10), textcolor=color.white, size=size.small)

// Tabel performa (Trades on chart)
var table perf = table.new(position.bottom_right, 2, 4, bgcolor=color.new(color.black, 20), border_width=1)
if barstate.islast
    table.cell(perf, 0, 0, "Total Trade", text_color=color.white, text_size=size.small)
    table.cell(perf, 1, 0, str.tostring(0), text_color=color.white, text_size=size.small)
    table.cell(perf, 0, 1, "Win Rate", text_color=color.white, text_size=size.small)
    table.cell(perf, 1, 1, "0%", text_color=color.white, text_size=size.small)

alertcondition(buyCond, "Champion BUY", "Champion v4: sinyal BUY")
alertcondition(sellCond, "Champion SELL", "Champion v4: sinyal SELL")`,
  },
  {
    id: 't14', label: '14. switch/method/type (Pine modern)',
    src: `//@version=6
indicator("T14 modern", overlay=true)
type Piv
    float price
    int idx
method up(Piv this) => this.idx >= 0
var Piv p = Piv.new(na, -1)
switchDir = switch bar_index % 3
    0 => 1
    1 => 2
    => 3
plot(switchDir, title="Switch", display=display.none)
plot(close, title="C", color=color.orange)`,
  },
  {
    id: 't15', label: '15. tuple macd + array<label> + box',
    src: `//@version=6
indicator("T15 adv", overlay=true, max_labels_count=500, max_lines_count=500)
[m, s, h] = ta.macd(close, 12, 26, 9)
plot(m, title="MACD", display=display.none)
var array<label> lbls = array.new<label>()
if bar_index % 50 == 0
    lbl = label.new(bar_index, low, "SIG", yloc=yloc.belowbar, style=label.style_label_up, color=color.green, textcolor=color.white)
    array.push(lbls, lbl)
    if array.size(lbls) > 10
        old = array.get(lbls, 0)
        label.delete(old)
        array.remove(lbls, 0)
if bar_index % 80 == 0
    box.new(bar_index - 5, high, bar_index + 5, low, border_color=color.purple, bgcolor=color.new(color.purple, 88))
ln = line.new(bar_index - 20, close, bar_index + 20, close, color=color.red, extend=extend.none, style=line.style_dotted)
line.delete(ln)
plot(close, title="C", color=color.orange)`,
  },
  {
    id: 't16', label: '16. strategy() params lengkap',
    src: `//@version=6
strategy("T16 strat params", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=10, commission_type=strategy.commission.percent, commission_value=0.1, pyramiding=0, calc_on_every_tick=false)
fast = ta.ema(close, 9)
slow = ta.ema(close, 21)
if ta.crossover(fast, slow)
    strategy.entry("L", strategy.long)
if ta.crossunder(fast, slow)
    strategy.close("L")
plot(fast, title="Fast", color=color.green)
plot(slow, title="Slow", color=color.red)`,
  },
  {
    id: 't17', label: '17. varip + timenow + mintick + format',
    src: `//@version=6
indicator("T17 misc", overlay=true)
varip cnt = bar_index
tickSz = syminfo.mintick
txt = str.format("Harga: {0}", close)
now = timenow
hr = hour(time, "Asia/Jakarta")
plot(cnt, title="Cnt", display=display.none)
plot(hr, title="Hour", display=display.none)
labelout = bar_index % 45 == 0 ? txt : ""
plot(tickSz, title="Tick", display=display.none)
plot(close, title="C", color=color.aqua)`,
  },
]

interface TestResult { ok: boolean; error?: string; warnings: string[]; kind?: string; plots?: string[] }

function makeBars(n = 480) {
  const out: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }> = []
  let px = 4120
  const t0 = Date.now() - n * 3_600_000
  let seed = 7
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  for (let i = 0; i < n; i++) {
    const drift = (rnd() - 0.5) * 6
    const open = px
    const close = px + drift
    const high = Math.max(open, close) + rnd() * 2
    const low = Math.min(open, close) - rnd() * 2
    out.push({ time: t0 + i * 3_600_000, open, high, low, close, volume: 100 + rnd() * 900 })
    px = close
  }
  return out
}

export default function TestPinePage() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const wsRef = useRef<any>(null)
  const currentRef = useRef<string>('')
  const [boot, setBoot] = useState<'pending' | 'ok' | 'err'>('pending')
  const [bootErr, setBootErr] = useState('')
  const [results, setResults] = useState<Record<string, TestResult>>({})
  const [active, setActive] = useState('')

  useEffect(() => {
    let dead = false
    ;(async () => {
      try {
        const [{ VelaWorkspace: WS }, { PineEngine }] = await Promise.all([
          import('@luxalgo/vela/workspace'),
          import('@luxalgo/vela-pinets'),
        ])
        if (dead || !hostRef.current) return
        const ws = new WS(hostRef.current, {
          layout: false,
          symbol: 'XAUUSD',
          timeframe: '60',
          live: false,
          theme: 'dark',
          watermark: false,
          indicatorPicker: false,
          drawingToolbar: false,
          data: makeBars(),
          engines: { pine: () => new PineEngine() },
        } as any)
        wsRef.current = ws
        // tangkap warnings + kind dari script:run
        try {
          const chart = ws.chart
          chart.on('script:run', (run: any) => {
            const warns = (Array.isArray(run?.warnings) ? run.warnings : [])
              .map((w: any) => String(w?.message || w?.warning || w || '').trim()).filter(Boolean)
            setResults((prev) => {
              const id = currentRef.current
              if (!id) return prev
              return { ...prev, [id]: { ...(prev[id] || { ok: true }), warnings: warns, kind: String(run?.kind || ''), plots: Object.keys(run?.plots || {}) } }
            })
          })
        } catch { /* diam */ }
        setBoot('ok')
      } catch (x: any) {
        if (!dead) { setBootErr(String(x?.message || x).slice(0, 200)); setBoot('err') }
      }
    })()
    return () => { dead = true; try { wsRef.current?.destroy() } catch {} wsRef.current = null }
  }, [])

  const applyTest = async (t: TestDef) => {
    const chart = wsRef.current?.chart
    if (!chart) return
    // hapus indikator pine sebelumnya
    try {
      for (const h of (typeof chart.indicators === 'function' ? chart.indicators() : []) || []) {
        try { h.remove() } catch { /* diam */ }
      }
    } catch { /* diam */ }
    currentRef.current = t.id
    setActive(t.id)
    setResults((p) => ({ ...p, [t.id]: { ok: true, warnings: [] } }))
    try {
      const r = await chart.runIndicator(t.src)
      const ok = !!r?.ok
      const err = r?.error ? String(r.error).slice(0, 220) : undefined
      setResults((p) => ({ ...p, [t.id]: { ...(p[t.id] || { warnings: [], ok }), ok, error: err } }))
    } catch (x: any) {
      setResults((p) => ({ ...p, [t.id]: { ok: false, error: String(x?.message || x).slice(0, 220), warnings: [] } }))
    }
  }

  return (
    <main style={{ padding: 12, background: '#0b0e11', color: '#e5e7eb', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 16, fontWeight: 700 }}>Tes Gambar Pine di Chart (diagnosa sementara)</h1>
      <div style={{ margin: '8px 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {TESTS.map((t) => {
          const r = results[t.id]
          return (
            <div key={t.id} style={{ border: '1px solid #273', borderRadius: 8, padding: 6, minWidth: 260 }}>
              <button
                onClick={() => applyTest(t)}
                style={{ cursor: 'pointer', background: active === t.id ? '#1f2937' : '#111827', color: '#a7f3d0', border: '1px solid #334', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}
              >
                {t.label}
              </button>
              <div style={{ fontSize: 11, marginTop: 4 }}>
                {r ? (
                  <>
                    <span style={{ color: r.ok ? '#34d399' : '#f87171' }}>{r.ok ? 'RUN OK' : 'GAGAL'}</span>
                    {r.error ? <span style={{ color: '#f87171' }}> — {r.error}</span> : null}
                    {r.kind ? <span style={{ color: '#9ca3af' }}> · kind={r.kind}</span> : null}
                    {r.plots?.length ? <span style={{ color: '#9ca3af' }}> · plots={r.plots.join(',')}</span> : null}
                    {r.warnings?.length ? <div style={{ color: '#fbbf24' }}>warn: {r.warnings.join(' | ').slice(0, 200)}</div> : null}
                  </>
                ) : <span style={{ color: '#6b7280' }}>belum dijalankan</span>}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 12, marginBottom: 6 }}>
        boot: <span style={{ color: boot === 'ok' ? '#34d399' : boot === 'err' ? '#f87171' : '#9ca3af' }}>{boot}{bootErr ? ` — ${bootErr}` : ''}</span>
      </div>
      <div ref={hostRef} style={{ height: '62vh', border: '1px solid #334', borderRadius: 8, overflow: 'hidden' }} />
    </main>
  )
}
