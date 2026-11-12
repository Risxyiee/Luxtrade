'use strict';
/**
 * browser-worker.mjs — Web Worker browser untuk menjalankan Pine Script user.
 *
 * Fallback dari pine-worker.mjs (node:worker_threads) untuk deploy utama
 * Cloudflare Workers edge yang tidak mendukung worker_threads: eksekusi
 * dipindah ke browser user lewat Web Worker. Bundler (webpack) mem-bundle
 * file ini sebagai worker chunk dan memilih build BROWSER pinets
 * (tanpa dependensi node:fs/path/url).
 *
 * ISOLASI (browser):
 *  - fetch/XHR/WebSocket dinonaktifkan di realm worker (defense in depth —
 *    request worker tetap membawa cookie situs bila tidak dimatikan).
 *  - Import resolver tidak dipasang -> `import ...` Pine selalu ditolak.
 *  - Loop guard PineTS (setMaxLoops) + timeout terminate() dari main thread.
 *
 * Protokol (identik pine-worker.mjs):
 *  main -> worker : { op: 'run', source, candles, inputs, maxLoops, symbol, timeframe }
 *  worker -> main : PineRawRunResult | PineRunError (lihat src/lib/pine/types.ts)
 */
import { PineTS, Indicator } from 'pinets';

// --- defense in depth: matikan jaringan di realm worker (best-effort) -------
try { self.fetch = undefined; } catch { /* noop */ }
try { self.XMLHttpRequest = undefined; } catch { /* noop */ }
try { self.WebSocket = undefined; } catch { /* noop */ }

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
  pineTS.setAlertMode('all');
  pineTS.setMaxLoops(Number.isFinite(maxLoops) ? maxLoops : 500000);

  const indicator = new Indicator(source, inputs || {});
  const ctx = await pineTS.run(indicator);

  return {
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
    durationMs: Date.now() - started,
  };
}

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (!msg || msg.op !== 'run') return;
  try {
    const result = await run(msg);
    self.postMessage(result);
  } catch (err) {
    const e = err || {};
    self.postMessage({
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
    self.close();
  }
};
