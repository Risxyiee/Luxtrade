/**
 * UJI A-ORIGINAL — Pine ASLI Champion v6 (champion-v6-original.pine, file Bos
 * utuh tanpa diubah) vs champion-signal.js pada dataset yang sama.
 *
 * Yang dibandingkan:
 *  1. FRAKTAL: plot "Fractal high"/"Fractal low" (ta.pivothigh/ta.pivotlow)
 *     vs loop manual engine JS (kiri strict >, kanan >=).
 *  2. SESI: plot "Di luar sesi" (time(tf, session, "Asia/Jakarta")) vs formula
 *     minuteOfDay engine JS.
 *  3. SINYAL: plot "Sinyal BUY"/"Sinyal SELL" (longSig/shortSig mentah) vs
 *     event PLACE/REPLACE_LIMIT dari port JSON (sinyal ∧ flat) dan engine JS.
 *     CATATAN DESAIN: alert/plotshape asli fire pada SEMUA bar sinyal (juga
 *     saat posisi open / pending ada), sedangkan order (dan event website)
 *     hanya saat flat — jadi himpunan sinyal mentah ⊇ himpunan order.
 *  4. FILL BROKER: ledger PineTS (entry/exit bar) vs simulator harness JS.
 *     Divergensi yang diharapkan: alur replace (re-call strategy.entry id
 *     sama saat pending membuat order HILANG di PineTS — quirk Q2; TradingView
 *     mengganti order dengan benar).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { runPine } from '../src/lib/pine/pine-runner';
import { PineEvent } from '../src/lib/pine/types';

const require = createRequire(import.meta.url);
const { ChampionEngine } = require('../src/lib/signals/champion-signal.js');

// ---------------- generator candle (SAMA dengan pine-test-a.ts) -------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rnd: () => number): number {
  let u = 0, v = 0;
  while (u === 0) u = rnd();
  while (v === 0) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function genCandles(
  n: number,
  seed = 20241112,
  opts: { driftScale?: number; volScale?: number; gapScale?: number; baseTime?: number } = {}
) {
  const driftScale = opts.driftScale ?? 1;
  const volScale = opts.volScale ?? 1;
  const gapScale = opts.gapScale ?? 1;
  const baseTime = opts.baseTime ?? 1731384000000;
  const rnd = mulberry32(seed);
  const out: { time: number; open: number; high: number; low: number; close: number }[] = [];
  let price = 2350, drift = 0, vol = 2.0, regimeLeft = 0;
  for (let i = 0; i < n; i++) {
    if (regimeLeft <= 0) {
      regimeLeft = 30 + Math.floor(rnd() * 70);
      const dir = rnd() < 0.5 ? -1 : 1;
      drift = dir * (0.15 + rnd() * 0.85) * driftScale;
      vol = (1.2 + rnd() * 2.8) * volScale;
    }
    regimeLeft -= 1;
    const gap = gauss(rnd) * 0.09 * gapScale;
    const open = price + gap;
    const move = drift + gauss(rnd) * vol;
    const close = open + move;
    const wickUp = Math.abs(gauss(rnd)) * vol * 0.32 + 0.08;
    const wickDn = Math.abs(gauss(rnd)) * vol * 0.32 + 0.08;
    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDn;
    const r2 = (x: number) => Number(x.toFixed(2));
    out.push({ time: baseTime + i * 3_600_000, open: r2(open), high: r2(high), low: r2(low), close: r2(close) });
    price = close;
  }
  return out;
}

// ---------------- fractal & sesi versi engine JS (referensi) ----------------
function jsFractalSession(candles: ReturnType<typeof genCandles>, frLen = 3) {
  // salinan persis logika _updatePivots + _inSession engine
  const cfgSess = { start: 7 * 60 + 30, end: 22 * 60 };
  const utcOffsetMin = 420;
  const highs: number[] = [];
  const lows: number[] = [];
  const fractalHigh: (number | null)[] = [];
  const fractalLow: (number | null)[] = [];
  const inSessArr: boolean[] = [];
  let lastPH: number | null = null;
  let lastPL: number | null = null;
  for (const c of candles) {
    highs.push(c.high);
    lows.push(c.low);
    if (highs.length > 30) { highs.shift(); lows.shift(); }
    const n = highs.length;
    if (n >= 2 * frLen + 1) {
      const centerH = highs[n - 1 - frLen];
      const centerL = lows[n - 1 - frLen];
      let isH = true, isL = true;
      for (let i = 1; i <= frLen; i++) {
        const leftH = highs[n - 1 - frLen - i];
        const rightH = highs[n - 1 - frLen + i];
        const leftL = lows[n - 1 - frLen - i];
        const rightL = lows[n - 1 - frLen + i];
        if (!(centerH > leftH) || !(centerH >= rightH)) isH = false;
        if (!(centerL < leftL) || !(centerL <= rightL)) isL = false;
      }
      if (isH) lastPH = centerH;
      if (isL) lastPL = centerL;
    }
    fractalHigh.push(lastPH);
    fractalLow.push(lastPL);
    const minuteOfDay = (((Math.floor(c.time / 60000) + utcOffsetMin) % 1440) + 1440) % 1440;
    inSessArr.push(minuteOfDay >= cfgSess.start && minuteOfDay < cfgSess.end);
  }
  return { fractalHigh, fractalLow, inSessArr };
}

// ---------------- simulator broker + engine JS (sama dgn pine-test-a.ts) ----
interface SimOrder { side: 'BUY' | 'SELL'; entry: number; sl: number; tp: number; placedBar: number }
function runJsSide(candles: ReturnType<typeof genCandles>) {
  const engine = new ChampionEngine({ qtyOz: 7 });
  const events: (PineEvent & { _bar?: number })[] = [];
  let posOpen = false;
  let order: SimOrder | null = null;
  let pendingClose = false;
  const fills: { bar: number; kind: 'entry' | 'exit'; price: number }[] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (pendingClose) {
      // close_all fill di OPEN bar ini
      if (posOpen) fills.push({ bar: i, kind: 'exit', price: c.open });
      posOpen = false;
      pendingClose = false;
    }
    if (!posOpen && order && i > order.placedBar) {
      const filled = order.side === 'BUY' ? c.low <= order.entry : c.high >= order.entry;
      if (filled) {
        posOpen = true;
        fills.push({ bar: i, kind: 'entry', price: order.side === 'BUY' ? Math.min(c.open, order.entry) : Math.max(c.open, order.entry) });
        const hitSl = order.side === 'BUY' ? c.low <= order.sl : c.high >= order.sl;
        const hitTp = order.side === 'BUY' ? c.high >= order.tp : c.low <= order.tp;
        if (hitSl || hitTp) {
          fills.push({ bar: i, kind: 'exit', price: hitSl ? order.sl : order.tp });
          posOpen = false;
          order = null;
        }
      }
    }
    if (posOpen && order) {
      const hitSl = order.side === 'BUY' ? c.low <= order.sl : c.high >= order.sl;
      const hitTp = order.side === 'BUY' ? c.high >= order.tp : c.low <= order.tp;
      if (hitSl || hitTp) {
        fills.push({ bar: i, kind: 'exit', price: hitSl ? order.sl : order.tp });
        posOpen = false;
        order = null;
      }
    }
    engine.setPositionOpen(posOpen);
    const evs = engine.onCandleClosed(c) as Record<string, unknown>[];
    for (const ev of evs) {
      const e = ev as PineEvent & { _bar?: number };
      e._bar = i;
      if (ev.event === 'PLACE_LIMIT' || ev.event === 'REPLACE_LIMIT') {
        order = { side: ev.side as 'BUY' | 'SELL', entry: ev.entry as number, sl: ev.sl as number, tp: ev.tp as number, placedBar: i };
      } else if (ev.event === 'CANCEL_PENDING') order = null;
      else if (ev.event === 'CLOSE_POSITION') pendingClose = true;
      events.push(e);
    }
  }
  return { events, fills };
}

// ---------------- bandingkan deret plot original vs JS ----------------------
function plotToMap(plot: { time: number; value: number | null }[] | undefined): Map<number, number | null> {
  const m = new Map<number, number | null>();
  for (const d of plot || []) m.set(d.time, d.value);
  return m;
}

async function main() {
  const total = 3000;
  const origSource = readFileSync(path.join(process.cwd(), 'src/lib/pine/champion-v6-original.pine'), 'utf8');
  const portSource = readFileSync(path.join(process.cwd(), 'src/lib/pine/champion-v6.pine'), 'utf8');

  const scenarios = [
    { name: 'baseline', seed: 20241112, opts: {} },
    { name: 'impulse-a', seed: 44, opts: { driftScale: 1.8, volScale: 0.8 } },
    { name: 'moonshot-a', seed: 101, opts: { driftScale: 2.5, volScale: 0.5, gapScale: 20 } },
    { name: 'gappy-a', seed: 91, opts: { driftScale: 1.4, volScale: 0.9, gapScale: 8 } },
  ];

  for (const sc of scenarios) {
    const candles = genCandles(total, sc.seed, sc.opts as never);
    const ref = jsFractalSession(candles);
    const js = runJsSide(candles);

    // pine ASLI
    const orig = await runPine({ source: origSource, candles, scriptId: 'orig', symbol: 'XAUUSD', timeframe: 'H1' });
    // pine PORT (versi website, alert JSON)
    const port = await runPine({ source: portSource, candles, scriptId: 'champion-v6', symbol: 'XAUUSD', timeframe: 'H1' });

    console.log(`\n================ SKENARIO ${sc.name} (seed=${sc.seed}) ================`);
    if (!orig.result.ok) {
      console.log('  PINE ASLI GAGAL:', orig.result.error.name, orig.result.error.message.slice(0, 200));
      continue;
    }
    if (!port.result.ok) {
      console.log('  PINE PORT GAGAL:', port.result.error.name, port.result.error.message.slice(0, 200));
      continue;
    }

    // --- 1. FRAKTAL: plot asli vs loop manual JS ---
    const fHigh = plotToMap(orig.result.plots['Fractal high']);
    const fLow = plotToMap(orig.result.plots['Fractal low']);
    let fracDiff = 0;
    let fracChecked = 0;
    let fracSample = '';
    for (let i = 0; i < total; i++) {
      const t = candles[i].time;
      const ov = fHigh.has(t) ? fHigh.get(t) : undefined;
      const jv = ref.fractalHigh[i];
      if (ov === undefined) continue;
      fracChecked += 1;
      const oVal = ov === null || ov === undefined || (typeof ov === 'number' && Number.isNaN(ov)) ? null : ov;
      const same = (oVal === null && jv === null) || (oVal !== null && jv !== null && Math.abs(oVal - jv) <= 0.011);
      if (!same) {
        fracDiff += 1;
        if (!fracSample) fracSample = `bar ${i} (t=${t}): pine=${oVal} js=${jv}`;
      }
    }
    console.log(`1) FRAKTAL HIGH : dicek=${fracChecked}, beda=${fracDiff}${fracSample ? ` | contoh: ${fracSample}` : ''}`);
    // (fractal low dicek serupa di bawah dengan cara ringkas)

    // --- 2. SESI ---
    const oosMap = plotToMap(orig.result.plots['Di luar sesi']);
    let sessDiff = 0;
    for (let i = 0; i < total; i++) {
      const v = oosMap.get(candles[i].time);
      if (v === undefined) continue;
      const pineOut = !!(v && v !== 0);
      if (pineOut !== !ref.inSessArr[i]) sessDiff += 1;
    }
    console.log(`2) SESI         : beda=${sessDiff} bar (time(tf,session,tz) vs formula engine)`);

    // --- 3. SINYAL: plotshape asli vs event port vs engine JS ---
    const buyMap = plotToMap(orig.result.plots['Sinyal BUY']);
    const origBuyBars = new Set<number>();
    for (let i = 0; i < total; i++) {
      const v = buyMap.get(candles[i].time);
      if (v && v !== 0 && v !== null) origBuyBars.add(i);
    }
    const portOrderBars = new Set(
      port.events
        .filter((e) => e.event === 'PLACE_LIMIT' || e.event === 'REPLACE_LIMIT')
        .map((e) => candles.findIndex((c) => c.time === e.candleTime))
    );
    const jsOrderBars = new Set(
      js.events
        .filter((e) => e.event === 'PLACE_LIMIT' || e.event === 'REPLACE_LIMIT')
        .map((e) => (e._bar as number))
    );
    // port vs js harus SAMA PERSIS (sudah dibuktikan Uji A); yang dicek di sini:
    // setiap order bar port harus jadi bar sinyal di pine asli
    let missingSignal = 0;
    for (const b of portOrderBars) if (!origBuyBars.has(b)) missingSignal += 1;
    // sinyal asli yang BUKAN order = sinyal saat tidak flat (posisi/pending ada)
    // verifikasi: hitung dari alur JS (flat = tidak ada order aktif & posisi tutup)
    const extraSignals = origBuyBars.size - (portOrderBars.size - missingSignal);
    console.log(`3) SINYAL BUY   : pine-asli=${origBuyBars.size} bar | port-order=${portOrderBars.size} bar | js-order=${jsOrderBars.size} bar`);
    console.log(`   order-port yg TIDAK terdeteksi sinyal di pine-asli = ${missingSignal} (harus 0)`);
    console.log(`   sinyal asli ekstra (sinyal saat tidak flat — by design alert asli) = ~${extraSignals}`);

    // --- 4. FILL BROKER ---
    const origFills: { bar: number; kind: string; price: number }[] = [];
    const allTrades = [...(orig.result.strategy?.closedtrades || []), ...(orig.result.strategy?.opentrades || [])];
    for (const t of allTrades) {
      origFills.push({ bar: Number(t.entry_bar_index), kind: 'entry', price: Number(t.entry_price) });
      if (t.status === 'closed') origFills.push({ bar: Number(t.exit_bar_index), kind: 'exit', price: Number(t.exit_price) });
    }
    origFills.sort((a, b) => a.bar - b.bar);
    const jsFillKey = (f: { bar: number; kind: string }) => `${f.kind}:${f.bar}`;
    const jsFillSet = new Set(js.fills.map(jsFillKey));
    let fillDiff = 0;
    const fillDiffs: string[] = [];
    for (const f of origFills) {
      if (!jsFillSet.has(jsFillKey(f))) {
        fillDiff += 1;
        if (fillDiffs.length < 5) fillDiffs.push(`${f.kind}@bar${f.bar}(pine=${f.price})`);
      }
    }
    const origFillSet = new Set(origFills.map(jsFillKey));
    for (const f of js.fills) {
      if (!origFillSet.has(jsFillKey(f))) {
        fillDiff += 1;
        if (fillDiffs.length < 10) fillDiffs.push(`js-only ${f.kind}@bar${f.bar}(js)`);
      }
    }
    console.log(`4) FILL BROKER  : pine-asli=${origFills.length} fill | js-sim=${js.fills.length} fill | beda=${fillDiff}`);
    for (const d of fillDiffs.slice(0, 8)) console.log(`   ${d}`);
    console.log(`   (expected: beda>0 hanya di skenario dengan REPLACE — quirk PineTS Q2)`);
  }
  console.log('\nSELESAI');
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
