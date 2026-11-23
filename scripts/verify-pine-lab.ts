/**
 * Verifikasi lokal: Pine Lab engine BENERAN JALAN.
 * Jalankan: bun scripts/verify-pine-lab.ts
 */
import { runLuxScript } from '../src/engine/lux/index'
import type { LuxCandle } from '../src/engine/lux/index'

// Candle sintetis 200 bar — pola naik-turun realistis biar ada cross EMA
function makeCandles(n: number): LuxCandle[] {
  const out: LuxCandle[] = []
  let price = 2000
  for (let i = 0; i < n; i++) {
    const drift = Math.sin(i / 12) * 4 + Math.sin(i / 40) * 8
    const open = price
    const close = open + drift + (i % 5 === 0 ? 1.5 : -0.8)
    const high = Math.max(open, close) + 1.2
    const low = Math.min(open, close) - 1.2
    out.push({ time: 1737000000 + i * 3600, open, high, low, close, volume: 1000 + i })
    price = close
  }
  return out
}

const SCRIPT = `
//@version=5
indicator("EMA Cross Signal", overlay=true)

fast = ta.ema(close, 9)
slow = ta.ema(close, 21)

buySignal = ta.crossover(fast, slow)
sellSignal = ta.crossunder(fast, slow)

if buySignal
    alert("BUY signal — EMA9 cross up EMA21")
if sellSignal
    alert("SELL signal — EMA9 cross down EMA21")

plot(fast, "EMA Fast", color=color.blue)
plot(slow, "EMA Slow", color=color.red)
`

const candles = makeCandles(1500)
console.log(`Candle siap: ${candles.length} bar`)

const t0 = Date.now()
const run = runLuxScript(SCRIPT, candles, { deadlineMs: 5000, maxBars: 1500, maxEvents: 50 })
console.log(`Engine selesai dalam ${Date.now() - t0}ms (internal: ${run.durationMs}ms)`)
console.log(`ok: ${run.ok} | bars: ${run.bars} | events: ${run.events.length} | plots: ${run.plots.length}`)
if (!run.ok) {
  console.log(`ERROR [${run.errorCode}]: ${run.error}`)
  process.exit(1)
}
for (const ev of run.events.slice(0, 5)) {
  console.log(`  🔔 [${ev.time}] ${ev.title}: ${ev.message}`)
}
console.log('✅ PINE LAB ENGINE JALAN — events & plot dihasilkan')
