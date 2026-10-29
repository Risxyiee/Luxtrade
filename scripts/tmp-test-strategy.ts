/**
 * TEMP TEST — apakah strategy verbatim Bos bisa jalan di engine PineTS headless.
 * Dipanggil: bun scripts/tmp-test-strategy.ts  (hapus setelah selesai)
 */
import { PineEngine } from '@luxalgo/vela-pinets'
import { readFileSync } from 'node:fs'

async function main() {
  const res = await fetch('http://localhost:3000/api/candles?symbol=XAUUSD&interval=1h&limit=2000')
  const json = await res.json() as any
  const rows: any[] = json?.data || []
  console.log('candles:', rows.length, 'oldest:', rows[0]?.time, 'newest:', rows[rows.length - 1]?.time)
  const bars = rows.map((r) => ({ ...r, time: r.time * 1000 }))

  const source = readFileSync('/home/z/tmp/impulsive-v5.pine', 'utf8')
  const engine = new PineEngine() as any
  let prepared: any
  try {
    prepared = await engine.prepare(source, 'test-verbatim-v5')
    console.log('✅ COMPILE OK')
  } catch (x: any) {
    console.log('❌ COMPILE GAGAL:', String(x?.message || x).slice(0, 400))
    return
  }

  const alerts: any[] = []
  let done = false
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => { if (!done) { console.log('⏱️ TIMEOUT 20s'); resolve() } }, 20000)
    try {
      const session = engine.execute(
        { prepared, market: { symbol: 'XAUUSD', timeframe: '1h' }, bars, mode: 'static' } as any,
        {
          onModel: () => {},
          onAlert: (a: any) => alerts.push(a),
          onError: (e: any) => { console.log('❌ ENGINE ERROR:', String(e?.message || e).slice(0, 300)); done = true; clearTimeout(timer); resolve() },
          onDone: async () => {
            done = true
            try {
              const snap = await session.getContext(['plots', 'meta', 'trades'])
              const plots = snap?.plots || {}
              const keys = Object.keys(plots)
              const trades: any[] = Array.isArray(snap?.trades) ? snap.trades : []
              console.log('✅ DONE — plot keys:', keys.length ? keys.join(', ') : '(KOSONG)')
              console.log('   trades:', trades.length)
              for (const t of trades.slice(0, 5)) {
                console.log('   →', JSON.stringify({ side: t.side, entry: t.entry?.price, entryT: t.entry?.time, exit: t.exit?.price, exitT: t.exit?.time, pnl: t.pnl }))
              }
              console.log('   alerts:', alerts.length, alerts.slice(0, 3))
              console.log('   meta:', JSON.stringify(snap?.meta || {}).slice(0, 200))
            } catch (x: any) {
              console.log('getContext gagal:', String(x?.message || x).slice(0, 200))
            }
            clearTimeout(timer)
            resolve()
          },
        } as any,
      )
      // poll fallback seperti runPineHeadless
      const poll = setInterval(async () => {
        if (done) { clearInterval(poll); return }
        try {
          const snap = await session.getContext(['plots'])
          if (snap?.plots && Object.keys(snap.plots).length) { clearInterval(poll); if (!done) { done = true; clearTimeout(timer); resolve() } }
        } catch { /* belum siap */ }
      }, 500)
      setTimeout(() => clearInterval(poll), 20000)
    } catch (x: any) {
      console.log('❌ execute throw:', String(x?.message || x).slice(0, 300))
      clearTimeout(timer)
      resolve()
    }
  })
}

main().then(() => process.exit(0)).catch((x) => { console.error('FATAL', x); process.exit(1) })
