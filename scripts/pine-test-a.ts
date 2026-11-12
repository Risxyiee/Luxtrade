/**
 * UJI A — Parity Champion v6: champion-signal.js (JS engine) vs
 * champion-v6.pine (PineTS runner) pada 3000 candle H1 yang sama.
 *
 * Simulator broker di sisi JS meniru model fill broker PineTS yang sudah
 * diprobe secara empiris (probe P1/P7/P13/P23/Q3/S1-S3):
 *   - order limit aktif mulai bar SETELAH dipasang
 *   - BUY limit fill saat low <= level (harga fill = min(open, level))
 *   - SELL limit fill saat high >= level (harga fill = max(open, level))
 *   - setelah fill di bar yang sama: stop dicek dulu (low <= sl utk BUY),
 *     lalu TP
 *   - posisi terbuka: stop diprioritaskan di atas TP bila keduanya kena
 *   - CLOSE_POSITION (close_all) -> fill di OPEN bar berikutnya
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { runPine, sanitizeCandles } from '../src/lib/pine/pine-runner';
import { PineEvent } from '../src/lib/pine/types';

const require = createRequire(import.meta.url);
const { ChampionEngine } = require('../src/lib/signals/champion-signal.js');

// ---------------- generator candle sintetis (seeded, deterministik) ---------
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
  let u = 0;
  let v = 0;
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
  const candles: { time: number; open: number; high: number; low: number; close: number }[] = [];
  let price = 2350;
  let drift = 0;
  let vol = 2.0;
  let regimeLeft = 0;
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
    candles.push({
      time: baseTime + i * 3_600_000,
      open: r2(open),
      high: r2(high),
      low: r2(low),
      close: r2(close),
    });
    price = close;
  }
  return candles;
}

// ---------------- simulator broker sisi JS (mirror PineTS) ------------------
interface SimOrder { side: 'BUY' | 'SELL'; entry: number; sl: number; tp: number; placedBar: number }

function runJsSide(candles: ReturnType<typeof genCandles>) {
  const engine = new ChampionEngine({ qtyOz: 7 });
  const jsEvents: (PineEvent & { _bar?: number })[] = [];
  let posOpen = false;
  let posSide: 'BUY' | 'SELL' | null = null;
  let order: SimOrder | null = null;
  let pendingClose = false;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];

    // 1) close_all dari bar sebelumnya -> fill di open bar ini
    if (pendingClose) {
      posOpen = false;
      posSide = null;
      pendingClose = false;
    }

    // 2) fill entry limit (aktif mulai bar setelah placement)
    //    PineTS: BUY fill saat low <= level (harga = min(open, level));
    //    SELL fill saat high >= level (harga = max(open, level)).
    if (!posOpen && order && i > order.placedBar) {
      const filled =
        order.side === 'BUY'
          ? c.low <= order.entry
          : c.high >= order.entry;
      if (filled) {
        posOpen = true;
        posSide = order.side;
        // exit legs dicek di bar fill juga (probe P13/P23)
        const hitSl =
          order.side === 'BUY' ? c.low <= order.sl : c.high >= order.sl;
        const hitTp =
          order.side === 'BUY' ? c.high >= order.tp : c.low <= order.tp;
        if (hitSl) {
          posOpen = false;
          posSide = null;
          order = null;
        } else if (hitTp) {
          posOpen = false;
          posSide = null;
          order = null;
        }
      }
    }

    // 3) posisi terbuka: stop dulu, lalu TP
    if (posOpen && order) {
      const hitSl =
        order.side === 'BUY' ? c.low <= order.sl : c.high >= order.sl;
      const hitTp =
        order.side === 'BUY' ? c.high >= order.tp : c.low <= order.tp;
      if (hitSl || hitTp) {
        posOpen = false;
        posSide = null;
        order = null;
      }
    }

    // 4) status broker -> engine (kontrak champion-signal.js)
    engine.setPositionOpen(posOpen);
    const evs = engine.onCandleClosed(c) as Record<string, unknown>[];
    for (const ev of evs) {
      const e = ev as PineEvent & { _bar?: number };
      e._bar = i;
      if (ev.event === 'PLACE_LIMIT' || ev.event === 'REPLACE_LIMIT') {
        order = {
          side: ev.side as 'BUY' | 'SELL',
          entry: ev.entry as number,
          sl: ev.sl as number,
          tp: ev.tp as number,
          placedBar: i,
        };
      } else if (ev.event === 'CANCEL_PENDING') {
        order = null;
      } else if (ev.event === 'CLOSE_POSITION') {
        pendingClose = true;
      }
      jsEvents.push(e);
    }
  }
  return jsEvents;
}

// ---------------- pembanding -------------------------------------------------
function cmpKey(e: PineEvent): string {
  const base = `${e.event}|${e.candleTime}|${e.side ?? 'NONE'}`;
  if (e.event === 'CANCEL_PENDING') return `${base}|${e.reason ?? ''}`;
  if (e.event === 'PLACE_LIMIT' || e.event === 'REPLACE_LIMIT') {
    return `${base}|${e.entry}|${e.sl}|${e.tp}|${e.qtyOz}`;
  }
  return base;
}

function cmpKeyPine(e: PineEvent): string {
  // engine id bawaan diabaikan (sudah dinormalisasi); pakai field inti saja
  const base = `${e.event}|${e.candleTime}|${e.side ?? 'NONE'}`;
  if (e.event === 'CANCEL_PENDING') return `${base}|${e.reason ?? ''}`;
  if (e.event === 'PLACE_LIMIT' || e.event === 'REPLACE_LIMIT') {
    return `${base}|${e.entry}|${e.sl}|${e.tp}|${e.qtyOz}`;
  }
  return base;
}

async function runScenario(
  name: string,
  seed: number,
  opts: { driftScale?: number; volScale?: number; gapScale?: number },
  pineSource: string,
  total: number
): Promise<boolean> {
  const candles = genCandles(total, seed, opts);

  // ---- sisi JS (champion-signal.js, TIDAK diubah) ----
  const jsEvents = runJsSide(candles);

  // ---- sisi Pine (pine-runner worker) ----
  const { result, events: pineEventsRaw } = await runPine({
    source: pineSource,
    candles,
    scriptId: 'champion-v6',
    scriptName: 'ChampionXAUUSD_H1_v6',
    symbol: 'XAUUSD',
    timeframe: 'H1',
  });
  if (!result.ok) {
    console.error(`[${name}] PINE GAGAL:`, result.error);
    return false;
  }

  const stat = (arr: PineEvent[]) => {
    const m: Record<string, number> = {};
    for (const e of arr) m[e.event] = (m[e.event] || 0) + 1;
    return m;
  };
  const reasons = (arr: PineEvent[]) => {
    const m: Record<string, number> = {};
    for (const e of arr) if (e.event === 'CANCEL_PENDING') m[e.reason || '?'] = (m[e.reason || '?'] || 0) + 1;
    return m;
  };

  const jsKeys = jsEvents.map(cmpKey);
  const pineKeys = pineEventsRaw.map(cmpKeyPine);
  let seqMismatchAt = -1;
  for (let i = 0; i < Math.max(jsKeys.length, pineKeys.length); i++) {
    if (jsKeys[i] !== pineKeys[i]) {
      seqMismatchAt = i;
      break;
    }
  }
  const setJ = new Map<string, number>();
  for (const k of jsKeys) setJ.set(k, (setJ.get(k) || 0) + 1);
  const setP = new Map<string, number>();
  for (const k of pineKeys) setP.set(k, (setP.get(k) || 0) + 1);
  const onlyJs: string[] = [];
  const onlyPine: string[] = [];
  for (const [k, n] of setJ) if (n - (setP.get(k) || 0) > 0) onlyJs.push(k);
  for (const [k, n] of setP) if (n - (setJ.get(k) || 0) > 0) onlyPine.push(k);

  const pass = onlyJs.length === 0 && onlyPine.length === 0 && seqMismatchAt === -1;
  console.log(
    `\n=== SKENARIO ${name} (seed=${seed}) -> ${pass ? 'PASS' : 'GAGAL'} ===`
  );
  console.log(`  js=${jsEvents.length} event ${JSON.stringify(stat(jsEvents))} cancelReasons=${JSON.stringify(reasons(jsEvents))}`);
  console.log(`  pine=${pineEventsRaw.length} event ${JSON.stringify(stat(pineEventsRaw))} cancelReasons=${JSON.stringify(reasons(pineEventsRaw))}`);
  console.log(`  broker pine: closed=${result.strategy?.closedtrades.length} open=${result.strategy?.opentrades.length} durasi=${result.durationMs}ms`);
  if (!pass) {
    if (seqMismatchAt >= 0) {
      console.log(`  urutan beda pada index ${seqMismatchAt}:`);
      console.log(`    js  : ${jsKeys[seqMismatchAt]}`);
      console.log(`    pine: ${pineKeys[seqMismatchAt]}`);
    }
    for (const k of onlyJs.slice(0, 6)) console.log(`  hanya-js  : ${k}`);
    for (const k of onlyPine.slice(0, 6)) console.log(`  hanya-pine: ${k}`);
  }
  return pass;
}

async function main() {
  const total = 3000;
  const pineSource = readFileSync(path.join(process.cwd(), 'src/lib/pine/champion-v6.pine'), 'utf8');

  // sanity hygiene input (Uji D di level runner)
  const dupGen = genCandles(50, 1);
  const dirty = [...dupGen, ...dupGen.slice(10), { ...dupGen[0], open: 1, high: 2, low: 0.5, close: 1.5 }];
  const san = sanitizeCandles(dirty as PineEvent['candleTime'][] extends never ? never : any[]);
  console.log(`[hygiene] ${dirty.length} candle mentah -> ${san.candles.length} bersih (dup=${san.droppedDup}, out-of-order=${san.droppedOrder})`);

  const scenarios: { name: string; seed: number; opts: { driftScale?: number; volScale?: number; gapScale?: number } }[] = [
    { name: 'baseline', seed: 20241112, opts: {} },
    { name: 'impulse-a', seed: 44, opts: { driftScale: 1.8, volScale: 0.8 } },
    { name: 'impulse-b', seed: 55, opts: { driftScale: 2.2, volScale: 0.7 } },
    { name: 'choppy-a', seed: 11, opts: { driftScale: 0.3, volScale: 1.6 } },
    { name: 'choppy-b', seed: 22, opts: { driftScale: 0.25, volScale: 2.0 } },
    { name: 'quiet-a', seed: 33, opts: { driftScale: 0.6, volScale: 0.5 } },
    { name: 'mixed-a', seed: 77, opts: { driftScale: 1.1, volScale: 1.2 } },
    { name: 'gappy-a', seed: 91, opts: { driftScale: 1.4, volScale: 0.9, gapScale: 8 } },
    { name: 'gappy-b', seed: 92, opts: { driftScale: 0.8, volScale: 1.1, gapScale: 12 } },
    { name: 'gappy-c', seed: 93, opts: { driftScale: 1.9, volScale: 0.6, gapScale: 6 } },
    { name: 'moonshot-a', seed: 101, opts: { driftScale: 2.5, volScale: 0.5, gapScale: 20 } },
    { name: 'moonshot-b', seed: 102, opts: { driftScale: 3.0, volScale: 0.45, gapScale: 16 } },
    { name: 'moonshot-c', seed: 103, opts: { driftScale: 2.2, volScale: 0.55, gapScale: 24 } },
  ];

  let allPass = true;
  let anyCancel = false;
  let anyReplace = false;
  for (const sc of scenarios) {
    const ok = await runScenario(sc.name, sc.seed, sc.opts, pineSource, total);
    allPass = allPass && ok;
  }

  // deteksi coverage jenis event di seluruh skenario (jalankan ulang cepat sisi JS)
  for (const sc of scenarios) {
    const evs = runJsSide(genCandles(total, sc.seed, sc.opts));
    if (evs.some((e) => e.event === 'CANCEL_PENDING')) anyCancel = true;
    if (evs.some((e) => e.event === 'REPLACE_LIMIT')) anyReplace = true;
  }

  console.log('\n=== KESIMPULAN UJI A ===');
  console.log(`Semua skenario: ${allPass ? 'PASS' : 'GAGAL'}`);
  console.log(`Coverage CANCEL_PENDING: ${anyCancel ? 'ada' : 'TIDAK ada di dataset ini'}`);
  console.log(`Coverage REPLACE_LIMIT : ${anyReplace ? 'ada' : 'TIDAK ada di dataset ini'}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
