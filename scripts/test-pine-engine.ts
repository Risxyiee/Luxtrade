/**
 * TEST — jalankan Pine default (headless) langsung di server-side runtime.
 * Tujuan: diagnosa kenapa chip "Eksklusif" tidak menggambar Entry/SL/TP.
 * Jalankan: bun scripts/test-pine-engine.ts [path-source-pine-opsional]
 */
import { DEFAULT_PINE_SOURCE } from '../src/lib/pine-default-script'
import { fetchTradingViewCandles } from '../src/lib/market/tradingview'

async function main() {
  const src = process.argv[2]
    ? await Bun.file(process.argv[2]).text()
    : DEFAULT_PINE_SOURCE

  console.log('--- fetch candles XAUUSD 1h (2000) ---')
  const bars = await fetchTradingViewCandles('XAUUSD', '1h', 2000)
  if (!bars?.length) {
    console.error('GAGAL: tidak ada candle dari TradingView')
    process.exit(1)
  }
  console.log(`candle: ${bars.length} bar | oldest=${new Date(bars[0].time * 1000).toISOString()} newest=${new Date(bars[bars.length - 1].time * 1000).toISOString()}`)

  console.log('--- load engine ---')
  const { PineEngine } = await import('@luxalgo/vela-pinets')
  const engine = new PineEngine()

  console.log('--- prepare ---')
  const prepared = await engine.prepare(src, 'test-default')
  console.log('prepare OK')

  console.log('--- execute ---')
  const alerts: any[] = []
  const barsMs = bars.map((b: any) => ({ ...b, time: b.time * 1000 }))
  const session = engine.execute(
    { prepared, market: { symbol: 'XAUUSD', timeframe: '1h' }, bars: barsMs, mode: 'static' } as any,
    {
      onModel: () => {},
      onAlert: (a: any) => alerts.push(a),
      onError: (e: any) => console.error('ENGINE ERROR:', String(e?.message || e).slice(0, 300)),
      onDone: () => console.log('onDone fired'),
    } as any,
  )

  // poll getContext sampai plots ada (maks 25 detik)
  let snap: any = null
  const t0 = Date.now()
  while (Date.now() - t0 < 25000) {
    try {
      snap = await session.getContext(['plots', 'meta', 'trades'])
      if (snap?.plots && Object.keys(snap.plots).length) break
    } catch { /* belum siap */ }
    await new Promise((r) => setTimeout(r, 500))
  }

  if (!snap?.plots || !Object.keys(snap.plots).length) {
    console.error('GAGAL: tidak ada plot setelah 25s. meta=', JSON.stringify(snap?.meta || null))
    process.exit(2)
  }

  const keys = Object.keys(snap.plots)
  console.log(`\n=== RESULT (${((Date.now() - t0) / 1000).toFixed(1)}s) ===`)
  console.log('meta:', JSON.stringify(snap.meta || {}))
  for (const k of keys) {
    const pts = Array.isArray(snap.plots[k]) ? snap.plots[k] : []
    const valid = pts.filter((p: any) => p?.value != null && Number.isFinite(Number(p.value)))
    // hitung segmen (run nilai valid yang dipisah gap na/null)
    let segments = 0
    let inSeg = false
    for (const p of pts) {
      const v = p?.value
      const ok = v != null && Number.isFinite(Number(v))
      if (ok && !inSeg) { segments++; inSeg = true } else if (!ok) inSeg = false
    }
    console.log(`plot "${k}": ${pts.length} pts, ${valid.length} valid, ${segments} segmen`)
  }
  const trades = Array.isArray(snap.trades) ? snap.trades : []
  console.log(`trades: ${trades.length}`)
  if (trades.length) {
    const t0x = trades[0]
    console.log('trade[0]:', JSON.stringify({ side: t0x.side, entry: t0x.entry, exit: t0x.exit, pnl: t0x.pnl }).slice(0, 260))
  }
  console.log(`engine alerts: ${alerts.length}`)
  try { session.stop?.() } catch {}
}

main().catch((x) => { console.error('FATAL:', x); process.exit(99) })
