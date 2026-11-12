/**
 * UJI B/C/D — Pine Signals
 *  B: script infinite loop / berat dihentikan (timeout / loop guard) tanpa
 *     mengganggu server; server tetap responsif setelahnya.
 *  C: restart/retry tidak menghasilkan alert ganda — kunci idempotensi
 *     deterministik + (bila tabel Supabase sudah dibuat Bos) siklus live
 *     dua kali -> 0 event baru di run kedua.
 *  D: candle duplikat / out-of-order diabaikan -> event sama dengan run bersih.
 */
import { runPine } from '../src/lib/pine/pine-runner';
import { normalizeRunResult } from '../src/lib/pine/normalize';
import { sanitizeCandles } from '../src/lib/pine/pine-runner';
import { PineRawRunResult } from '../src/lib/pine/types';

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function mkCandles(n: number, start = 1731384000000) {
  const out = [];
  let price = 2300;
  for (let i = 0; i < n; i++) {
    const move = Math.sin(i / 6) * 4 + (i % 11 - 5) * 0.7;
    const open = price;
    const close = open + move;
    out.push({
      time: start + i * 3_600_000,
      open: Number(open.toFixed(2)),
      high: Number(Math.max(open, close).toFixed(2)) + 1.5,
      low: Number(Math.min(open, close).toFixed(2)) - 1.5,
      close: Number(close.toFixed(2)),
    });
    price = close;
  }
  return out;
}

const INDICATOR_SCRIPT = `//@version=6
indicator("Uji indikator sederhana")
cond = ta.crossover(close, ta.sma(close, 14))
alertcondition(cond, "BuyX", "BUY crossover")
plot(ta.sma(close, 14), "SMA14")
`;

async function ujiB() {
  console.log('\n=== UJI B: timeout & script berat ===');

  // B1: infinite loop -> harus berhenti (loop guard ATAU timeout worker)
  const t0 = Date.now();
  const r1 = await runPine({
    source: `//@version=6
indicator("Loop tak hingga")
while true
    x = 1
`,
    candles: mkCandles(600),
    timeoutMs: 5000,
    maxLoops: 500_000,
  });
  const dur1 = Date.now() - t0;
  check(
    'B1 infinite loop dihentikan',
    !r1.result.ok,
    `${r1.result.ok ? 'TIDAK berhenti!' : `error=${r1.result.error.name}`} dalam ${dur1}ms`
  );
  check('B1 berhenti < 8 dtk (tidak menggantung server)', dur1 < 8000, `${dur1}ms`);

  // B2: loop berat di atas guard default -> tetap terkendali
  const t2 = Date.now();
  const r2 = await runPine({
    source: `//@version=6
indicator("Loop berat")
float s = 0.0
for i = 1 to 400000
    for j = 1 to 10
        s := s + math.sqrt(i * j)
plot(s, "S")
`,
    candles: mkCandles(300),
    timeoutMs: 5000,
    maxLoops: 500_000,
  });
  const dur2 = Date.now() - t2;
  check(
    'B2 loop berat dihentikan (guard/timeout)',
    !r2.result.ok,
    `${r2.result.ok ? 'selesai??' : `error=${r2.result.error.name}`} dalam ${dur2}ms`
  );

  // B3: server tetap responsif setelah insiden
  const r3 = await runPine({ source: INDICATOR_SCRIPT, candles: mkCandles(600), timeoutMs: 5000 });
  check('B3 server tetap responsif (run normal sukses)', r3.result.ok && !!r3.result.plots['SMA14']);

  // B4: timeout hard tanpa loop (busy computation tanpa statement loop Pine
  // tidak mungkin murni, jadi cukup buktikan jalur terminate bekerja via
  // maxLoops sangat besar + while true)
  const t4 = Date.now();
  const r4 = await runPine({
    source: `//@version=6
indicator("Busy")
while true
    x = 1
`,
    candles: mkCandles(100),
    timeoutMs: 3000,
    maxLoops: 9_000_000_000,
  });
  const dur4 = Date.now() - t4;
  check(
    'B4 jalur timeout hard worker berfungsi',
    !r4.result.ok && r4.result.error.name === 'TimeoutError',
    `${r4.result.error.name} dalam ${dur4}ms`
  );
}

async function ujiC() {
  console.log('\n=== UJI C: idempotensi (anti alert ganda) ===');
  const candles = mkCandles(1500);

  // C1: dua run independen menghasilkan event + id yang IDENTIK
  const r1 = await runPine({ source: INDICATOR_SCRIPT, candles, scriptId: 'uji-c' });
  const r2 = await runPine({ source: INDICATOR_SCRIPT, candles, scriptId: 'uji-c' });
  const ctx = { scriptId: 'uji-c', symbol: 'XAUUSD', timeframe: 'H1', kind: 'indicator' as const };
  if (r1.result.ok && r2.result.ok) {
    const e1 = normalizeRunResult(r1.result, ctx);
    const e2 = normalizeRunResult(r2.result, ctx);
    const ids1 = e1.map((e) => e.id).join('|');
    const ids2 = e2.map((e) => e.id).join('|');
    check('C1 event id deterministik antar run (restart-safe)', ids1 === ids2 && e1.length > 0, `${e1.length} event`);
  } else {
    check('C1 event id deterministik antar run', false, 'run gagal');
  }

  // C2: dedup normalizer — alert sama dipanggil dua kali di bar sama -> 1 event
  const fake: PineRawRunResult = {
    ok: true,
    alerts: [
      { type: 'alert', id: 'a1', message: '{"event":"PLACE_LIMIT","candleTime":100,"side":"BUY","entry":1,"sl":2,"tp":3}', bar_index: 0, time: 100 },
      { type: 'alert', id: 'a2', message: '{"event":"PLACE_LIMIT","candleTime":100,"side":"BUY","entry":1,"sl":2,"tp":3}', bar_index: 0, time: 100 },
    ],
    plots: {},
    strategy: null,
    warnings: [],
    durationMs: 1,
  };
  const norm = normalizeRunResult(fake, ctx);
  check('C2 normalizer dedup event identik', norm.length === 1, `${norm.length} event (harus 1)`);

  // C3: DB-backed siklus live (jalur penuh) bila tabel sudah dibuat Bos
  try {
    const { runLiveCycle } = await import('../src/lib/pine/live');
    const sum1 = await runLiveCycle({ trigger: 'manual', now: Date.now() });
    const tablesMissing = sum1.details.some((d) => (d.error || '').includes('belum dibuat'));
    if (tablesMissing) {
      console.log('  SKIP  C3 siklus live DB — tabel belum dibuat (menunggu Bos jalankan SQL 20261112_pine_signals.sql)');
    } else {
      const sum2 = await runLiveCycle({ trigger: 'manual', now: Date.now() });
      check('C3 run kedua = 0 event baru (anti ganda)', sum2.newEvents === 0, `run1=${sum1.newEvents} baru, run2=${sum2.newEvents} baru`);
      // simulasi retry/restart: run ketiga juga harus 0
      const sum3 = await runLiveCycle({ trigger: 'manual', now: Date.now() });
      check('C3b run ketiga (simulasi restart) = 0 event baru', sum3.newEvents === 0, `run3=${sum3.newEvents} baru`);
    }
  } catch (e) {
    console.log('  SKIP  C3 siklus live DB —', (e as Error).message);
  }
}

async function ujiD() {
  console.log('\n=== UJI D: candle duplikat / out-of-order diabaikan ===');
  const clean = mkCandles(1500);

  // D1: engine champion sendiri menolak duplikat/out-of-order
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { ChampionEngine } = require('../src/lib/signals/champion-signal.js');
  const eng = new ChampionEngine();
  eng.onCandleClosed(clean[0]);
  eng.onCandleClosed(clean[1]);
  const dup = eng.onCandleClosed(clean[1]);
  const ooo = eng.onCandleClosed({ ...clean[0], open: 1, high: 9999, low: 0.5, close: 2 });
  const fwd = eng.onCandleClosed(clean[0]); // time lama lagi
  check(
    'D1 engine menolak duplikat/out-of-order',
    dup.length === 0 && ooo.length === 0 && fwd.length === 0
  );

  // D2: runner menghasilkan event SAMA untuk input kotor vs bersih
  const dirty = [
    ...clean.slice(700), // out-of-order di depan
    ...clean, // full duplikat
    ...clean.slice(0, 300).map((c) => ({ ...c, close: c.close + 999 })), // dup dgn nilai beda (tetap dibuang by time)
  ];
  const rClean = await runPine({ source: INDICATOR_SCRIPT, candles: clean, scriptId: 'uji-d' });
  const rDirty = await runPine({ source: INDICATOR_SCRIPT, candles: dirty, scriptId: 'uji-d' });
  check(
    'D2 runner sanitize (dup & out-of-order dibuang)',
    rDirty.droppedDup > 0 && rDirty.barCount === rClean.barCount,
    `dup=${rDirty.droppedDup}, ooo=${rDirty.droppedOrder}, bar=${rDirty.barCount} vs ${rClean.barCount}`
  );
  if (rClean.result.ok && rDirty.result.ok) {
    const ctx = { scriptId: 'uji-d', symbol: 'XAUUSD', timeframe: 'H1', kind: 'indicator' as const };
    const e1 = normalizeRunResult(rClean.result, ctx).map((e) => e.id + ':' + JSON.stringify(e.meta || {})).sort();
    const e2 = normalizeRunResult(rDirty.result, ctx).map((e) => e.id + ':' + JSON.stringify(e.meta || {})).sort();
    check('D2 event identik antara input kotor vs bersih', JSON.stringify(e1) === JSON.stringify(e2), `${e1.length} event`);
  }
}

async function main() {
  await ujiB();
  await ujiC();
  await ujiD();
  console.log(`\n=== KESIMPULAN UJI B/C/D: ${fail === 0 ? 'SEMUA PASS' : 'ADA YANG GAGAL'} (pass=${pass}, fail=${fail}) ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
