/**
 * KUANTIFIKASI dampak perbedaan aturan tie fractal (ta.pivothigh vs engine JS)
 * terhadap SINYAL longSig yang sebenarnya.
 *
 * longSig direplikasi persis dari formula script asli:
 *   allowLong && close>open && brkUp && bodyOk && adxOk && diUp && fracUp && inSess
 * dengan ADX/DI dari engine (terbukti identik) dan fractal dari dua sumber:
 *   (a) lastPH engine JS (loop manual, kanan non-strict)
 *   (b) lastPH Pine asli (plot "Fractal high", ta.pivothigh)
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { runPine } from '../src/lib/pine/pine-runner';

const require = createRequire(import.meta.url);
const { ChampionEngine } = require('../src/lib/signals/champion-signal.js');

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
function genCandles(n: number, seed: number, opts: Record<string, number> = {}) {
  const rnd = mulberry32(seed);
  const out: { time: number; open: number; high: number; low: number; close: number }[] = [];
  let price = 2350, drift = 0, vol = 2.0, regimeLeft = 0;
  for (let i = 0; i < n; i++) {
    if (regimeLeft <= 0) {
      regimeLeft = 30 + Math.floor(rnd() * 70);
      drift = (rnd() < 0.5 ? -1 : 1) * (0.15 + rnd() * 0.85) * (opts.driftScale ?? 1);
      vol = (1.2 + rnd() * 2.8) * (opts.volScale ?? 1);
    }
    regimeLeft -= 1;
    const gap = gauss(rnd) * 0.09 * (opts.gapScale ?? 1);
    const open = price + gap;
    const close = open + drift + gauss(rnd) * vol;
    const high = Math.max(open, close) + Math.abs(gauss(rnd)) * vol * 0.32 + 0.08;
    const low = Math.min(open, close) - Math.abs(gauss(rnd)) * vol * 0.32 + 0.08 - 0.16;
    const r2 = (x: number) => Number(x.toFixed(2));
    out.push({ time: 1731384000000 + i * 3_600_000, open: r2(open), high: r2(high), low: r2(low), close: r2(close) });
    price = close;
  }
  return out;
}

async function main() {
  const origSource = readFileSync(path.join(process.cwd(), 'src/lib/pine/champion-v6-original.pine'), 'utf8');
  const scenarios = [
    { name: 'baseline', seed: 20241112, opts: {} },
    { name: 'impulse-a', seed: 44, opts: { driftScale: 1.8, volScale: 0.8 } },
    { name: 'moonshot-a', seed: 101, opts: { driftScale: 2.5, volScale: 0.5, gapScale: 20 } },
    { name: 'gappy-a', seed: 91, opts: { driftScale: 1.4, volScale: 0.9, gapScale: 8 } },
    { name: 'moonshot-c', seed: 103, opts: { driftScale: 2.2, volScale: 0.55, gapScale: 24 } },
  ];

  let totalFlip = 0;
  for (const sc of scenarios) {
    const candles = genCandles(3000, sc.seed, sc.opts);
    const engine = new ChampionEngine({ qtyOz: 7 });

    // fractal dari pine asli
    const orig = await runPine({ source: origSource, candles, scriptId: 'orig', symbol: 'XAUUSD', timeframe: 'H1' });
    if (!orig.result.ok) {
      console.log(`${sc.name}: pine gagal`, orig.result.error.message.slice(0, 100));
      continue;
    }
    const pineFH = new Map<number, number | null>();
    for (const d of orig.result.plots['Fractal high'] || []) pineFH.set(d.time, d.value);
    const pineFL = new Map<number, number | null>();
    for (const d of orig.result.plots['Fractal low'] || []) pineFL.set(d.time, d.value);

    let flips = 0;
    let flipSamples: string[] = [];
    let pineSignals = 0;
    let jsSignals = 0;
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      // state fractal JS pada bar i = nilai engine SETELAH onCandleClosed(bar i)
      engine.setPositionOpen(false);
      engine.onCandleClosed(c);
      const jsPH = engine.lastPH;
      const jsPL = engine.lastPL;
      const pinePH = pineFH.has(c.time) ? pineFH.get(c.time) : null;
      const pinePL = pineFL.has(c.time) ? pineFL.get(c.time) : null;

      // replika formula longSig (fractal baru diupdate sebelum cek — sama dgn engine)
      const h1 = candles[i - 1]?.high ?? NaN;
      const h2 = candles[i - 2]?.high ?? NaN;
      const brkUp = c.close > Math.max(h1, h2);
      const rng = c.high - c.low;
      const bodyPct = rng > 0 ? Math.abs(c.close - c.open) / rng * 100 : 0;
      const bodyOk = bodyPct >= 83;
      const adxOk = (engine.adx ?? 0) >= 17;
      const diUp = (engine.diPlus ?? 0) > (engine.diMinus ?? -1);
      const minuteOfDay = (((Math.floor(c.time / 60000) + 420) % 1440) + 1440) % 1440;
      const inSess = minuteOfDay >= 450 && minuteOfDay < 1320;

      const fracUpJs = jsPH === null || c.close > jsPH;
      const fracUpPine = pinePH === null || pinePH === undefined || Number.isNaN(pinePH) || c.close > pinePH;

      const sigJs = c.close > c.open && brkUp && bodyOk && adxOk && diUp && fracUpJs && inSess;
      const sigPine = c.close > c.open && brkUp && bodyOk && adxOk && diUp && fracUpPine && inSess;
      if (sigJs) jsSignals += 1;
      if (sigPine) pineSignals += 1;
      if (sigJs !== sigPine) {
        flips += 1;
        if (flipSamples.length < 3) {
          flipSamples.push(`bar ${i}: jsPH=${jsPH?.toFixed(2)} pinePH=${pinePH?.toFixed(2)} close=${c.close.toFixed(2)} -> ${sigJs ? 'js-saja' : 'pine-saja'}`);
        }
      }
    }
    totalFlip += flips;
    console.log(`${sc.name}: sinyal js-fractal=${jsSignals}, pine-fractal=${pineSignals}, FLIP=${flips} bar${flipSamples.length ? '\n   ' + flipSamples.join('\n   ') : ''}`);
  }
  console.log(`\nTOTAL bar sinyal yang flip karena aturan tie fractal: ${totalFlip} dari ${scenarios.length * 3000} bar`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
