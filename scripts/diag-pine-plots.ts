/**
 * DIAGNOSTIK: kenapa Entry/SL/TP kadang tidak tampak?
 * Simulasi alur produksi END-TO-END:
 *   1. Ambil candle DARI /api/candles lokal (persis seperti chart Vela, limit 5000)
 *   2. Jalankan runDefaultStrategyPine (persis seperti /api/compile-pine, limit 2000)
 *   3. Bandingkan: jumlah trade, segmen plot non-null, dan
 *      KECOCOKAN waktu plot vs waktu bar chart (yang dipakai client m.get(b.time)).
 */
import { runDefaultStrategyPine } from '../src/lib/pine-protected'

const BASE = process.env.BASE || 'http://localhost:3000'

async function getCandles(interval: string, limit: number) {
  const res = await fetch(`${BASE}/api/candles?symbol=XAUUSD&interval=${interval}&limit=${limit}&_t=${Date.now()}`)
  const j = await res.json()
  return { data: j?.data || [], source: j?.source || '?' }
}

async function diag(interval: string) {
  console.log(`\n========== TF ${interval} ==========`)
  // 1) SEJARAH CHART (klien — 5000 bar)
  const chart = await getCandles(interval, 5000)
  console.log(`chart: ${chart.data.length} bars dari ${chart.source}, first=${chart.data[0]?.time} last=${chart.data[chart.data.length - 1]?.time}`)
  // 2) RUNNER SERVER (compile-pine — 2000 bar)
  const run = await getCandles(interval, 2000)
  const barsSec = run.data.map((b: any) => ({ time: Number(b.time), open: b.open, high: b.high, low: b.low, close: b.close }))
  const out = await runDefaultStrategyPine('XAUUSD', interval, barsSec)
  if (!out.ok) { console.log('RUN GAGAL:', out.error); return }
  const trades = (out as any).engineAlerts?.filter((a: any) => /entry/i.test(a.message)) || []
  const exits = (out as any).engineAlerts?.filter((a: any) => /exit/i.test(a.message)) || []
  console.log(`engineAlerts: entry=${trades.length} exit=${exits.length}`)
  // 3) COCOKKAN WAKTU PLOT vs WAKTU BAR CHART (kontrak client m.get(b.time))
  const chartTimes = new Set(chart.data.map((b: any) => Number(b.time) * 1000))
  for (const p of out.plots || []) {
    const hits = (p.data || []).filter((d: any) => d.value != null && chartTimes.has(d.time)).length
    const nonNull = (p.data || []).filter((d: any) => d.value != null).length
    const miss = nonNull - hits
    console.log(`plot "${p.title}": non-null=${nonNull}, MATCH dgn bar chart=${hits}, TIDAK MATCH=${miss}`)
  }
  // 4) rentang waktu plot vs rentang chart
  const runFirst = barsSec[0]?.time, runLast = barsSec[barsSec.length - 1]?.time
  console.log(`runner window: ${runFirst} → ${runLast} | chart window: ${chart.data[0]?.time} → ${chart.data[chart.data.length - 1]?.time}`)
  if (runFirst && chart.data[0] && runFirst < Number(chart.data[0].time)) {
    console.log('⚠️ Runner mulai LEBIH LAMA dari window chart 5000-bar → segmen di luar viewport bawah tak masalah')
  }
}

await diag('1h')
await diag('15m')
await diag('5m')
