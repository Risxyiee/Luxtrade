'use strict';
/**
 * pine-worker.mjs — worker thread sandbox untuk menjalankan Pine Script user.
 *
 * ISOLASI:
 *  - Source Pine user TIDAK DIPERCAYA. PineTS mentranspile DSL Pine (bukan JS
 *    arbitrer) sehingga tidak ada require/fs/network dari bahasa Pine itu sendiri.
 *  - Import resolver TIDAK dipasang → statement `import ...` selalu gagal
 *    (tidak ada fetch GitHub/URL).
 *  - fetch/XHR/WebSocket dinonaktifkan di realm worker (defense in depth).
 *  - Loop guard PineTS (setMaxLoops) + timeout terminate() dari main thread
 *    + resourceLimits (best-effort di Bun, dihormati penuh di Node.js).
 *
 * Protokol:
 *  main -> worker : { op: 'run', source, candles, inputs, maxLoops, symbol, timeframe }
 *  worker -> main : PineRawRunResult | PineRunError (lihat src/lib/pine/types.ts)
 */
import { parentPort, workerData } from 'worker_threads';
import { PineTS, Indicator } from 'pinets';

// --- defense in depth: matikan jaringan di realm worker (best-effort) -------
try { globalThis.fetch = undefined; } catch { /* noop */ }
try { globalThis.XMLHttpRequest = undefined; } catch { /* noop */ }
try { globalThis.WebSocket = undefined; } catch { /* noop */ }

function toKlines(candles) {
  const out = new Array(candles.length);
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    out[i] = {
      openTime: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: Number.isFinite(c.volume) ? c.volume : 0,
      closeTime: c.time + 3_599_999,
      quoteAssetVolume: 0,
      numberOfTrades: 0,
      takerBuyBaseAssetVolume: 0,
      takerBuyQuoteAssetVolume: 0,
      ignore: 0,
    };
  }
  return out;
}

function extractPlots(ctx) {
  const plots = {};
  const src = ctx.plots || {};
  let count = 0;
  for (const name of Object.keys(src)) {
    if (count >= 40) break;
    const plot = src[name];
    const data = plot && Array.isArray(plot.data) ? plot.data : null;
    if (!data) continue;
    plots[name] = data.map((d) => ({
      time: d && typeof d.time === 'number' ? d.time : null,
      value: d && 'value' in d ? (d.value === undefined ? null : d.value) : null,
    }));
    count += 1;
  }
  return plots;
}

function extractCapabilities(ctx) {
  const caps = {};
  try {
    const pine = ctx.pine || {};
    for (const ns of Object.keys(pine)) {
      const v = pine[ns];
      if (v && typeof v === 'object') {
        const fns = Object.keys(v).filter((k) => typeof v[k] === 'function');
        if (fns.length) caps[ns] = fns;
      }
    }
  } catch { /* best-effort */ }
  return caps;
}

function summarizeStrategy(ctx) {
  if (!ctx.strategy) return null;
  const s = ctx.strategy;
  const slimTrade = (t) => ({
    id: t.id,
    entry_id: t.entry_id,
    entry_price: t.entry_price,
    entry_bar_index: t.entry_bar_index,
    entry_time: t.entry_time,
    exit_id: t.exit_id,
    exit_price: t.exit_price,
    exit_bar_index: t.exit_bar_index,
    exit_time: t.exit_time,
    size: t.size,
    status: t.status,
  });
  const slimOrder = (o) => ({
    id: o.id,
    direction: o.direction,
    qty: o.qty,
    type: o.type,
    limit: o.limit,
    stop: o.stop,
    bar: o.bar,
    time: o.time,
    status: o.status,
    category: o.category,
    from_entry: o.from_entry,
    comment: o.comment,
  });
  return {
    kind: 'strategy',
    position_size: s.position_size,
    opentrades: (s.opentrades || []).map(slimTrade),
    closedtrades: (s.closedtrades || []).map(slimTrade),
    pending_orders: (s.pending_orders || []).map(slimOrder),
  };
}

async function run(payload) {
  const started = Date.now();
  const { source, candles, inputs, maxLoops, symbol, timeframe } = payload;

  const klines = toKlines(candles);
  const pineTS = new PineTS(klines, symbol || 'XAUUSD', timeframe || '1h');
  // mode 'all': alert() & alertcondition() fire di SEMUA bar historis
  // (dipakai untuk ekstraksi sinyal historis; dedup idempoten di lapisan servis)
  pineTS.setAlertMode('all');
  pineTS.setMaxLoops(Number.isFinite(maxLoops) ? maxLoops : 500000);
  // Tidak memasang import resolver -> `import` user selalu ditolak.

  const indicator = new Indicator(source, inputs || {});
  const ctx = await pineTS.run(indicator);

  const result = {
    ok: true,
    alerts: (ctx.alerts || []).map((a) => ({
      type: a.type,
      id: a.id,
      message: typeof a.message === 'string' ? a.message : String(a.message ?? ''),
      title: a.title,
      freq: a.freq,
      bar_index: a.bar_index,
      time: a.time,
    })),
    plots: extractPlots(ctx),
    strategy: summarizeStrategy(ctx),
    warnings: (ctx.warnings || []).map((w) => ({ message: w.message, method: w.method, bar: w.bar })),
    capabilities: extractCapabilities(ctx),
    durationMs: Date.now() - started,
  };
  return result;
}

if (parentPort) {
  parentPort.on('message', async (msg) => {
    if (!msg || msg.op !== 'run') return;
    try {
      const result = await run(msg);
      parentPort.postMessage(result);
    } catch (err) {
      const e = err || {};
      parentPort.postMessage({
        ok: false,
        error: {
          name: e.name || 'Error',
          message: e.message || String(e),
          method: e.method,
        },
        durationMs: 0,
      });
    } finally {
      // worker satu-pemakaian: selesai setelah satu run
      process.exit(0);
    }
  });
}

// dukung mode inline fallback (worker_threads tidak tersedia, mis. edge runtime)
if (!parentPort && workerData) {
  run(workerData)
    .then((r) => console.log(JSON.stringify(r)))
    .catch((e) => console.log(JSON.stringify({ ok: false, error: { name: e.name, message: e.message }, durationMs: 0 })));
}
