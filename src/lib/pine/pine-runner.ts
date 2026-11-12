/**
 * pine-runner.ts — API main-thread untuk menjalankan Pine Script user.
 *
 * Keamanan (source user TIDAK DIPERCAYA):
 *  - Dijalankan di Worker Thread terpisah dengan timeout hard (terminate).
 *  - resourceLimits memori (dihormati Node.js; best-effort di Bun).
 *  - Tanpa akses jaringan: import resolver tidak dipasang + fetch/XHR/WS
 *    dimatikan di realm worker (lihat pine-worker.mjs).
 *  - Batas ukuran source, jumlah bar, dan loop (maxLoops PineTS).
 *  - Rate limit per user (sliding window in-memory).
 *
 * Catatan runtime: Worker Thread tersedia di Node.js/Bun (server). Pada
 * runtime tanpa worker_threads (mis. Cloudflare Workers edge), gunakan
 * runPineInline() — tanpa timeout hard, hanya loop guard (lihat README).
 */
import { Worker as WTFWorker } from 'node:worker_threads';
import path from 'node:path';
import {
  PineCandle,
  PineRawRunResult,
  PineEvent,
  PineRunResult,
  PINE_LIMITS,
} from './types';
import { normalizeRunResult } from './normalize';

export class PineRateLimitError extends Error {
  constructor(public retryAfterSec: number) {
    super('Rate limit Pine runner terlampaui, coba lagi nanti');
    this.name = 'PineRateLimitError';
  }
}

// ---------------- rate limit (sliding window in-memory) ---------------------
const runTimestamps = new Map<string, number[]>();

export function checkRateLimit(
  userId: string,
  limits: { RUNS_PER_MINUTE: number; RUNS_PER_HOUR: number } = PINE_LIMITS
): void {
  const now = Date.now();
  const arr = (runTimestamps.get(userId) || []).filter(
    (t) => now - t < 3_600_000
  );
  const perMin = arr.filter((t) => now - t < 60_000).length;
  if (perMin >= limits.RUNS_PER_MINUTE) {
    throw new PineRateLimitError(60);
  }
  if (arr.length >= limits.RUNS_PER_HOUR) {
    throw new PineRateLimitError(600);
  }
  arr.push(now);
  runTimestamps.set(userId, arr);
}

// ---------------- hygiene input candle (Uji D) ------------------------------
/**
 * Validasi + urutkan + buang duplikat/out-of-order.
 * Aturan: time harus finite & strictly increasing; duplikat -> dipakai yang
 * pertama; bar tidak monoton -> dibuang. Batasi jumlah bar (ambil terakhir).
 */
export function sanitizeCandles(
  input: PineCandle[],
  maxBars: number = PINE_LIMITS.MAX_BARS
): { candles: PineCandle[]; droppedDup: number; droppedOrder: number } {
  const sorted = [...input].sort((a, b) => a.time - b.time);
  const seen = new Set<number>();
  const candles: PineCandle[] = [];
  let droppedDup = 0;
  let droppedOrder = 0;
  for (const c of sorted) {
    if (![c.time, c.open, c.high, c.low, c.close].every(Number.isFinite)) {
      droppedOrder += 1;
      continue;
    }
    if (c.high < c.low || c.high < Math.max(c.open, c.close) - 1e-9 || c.low > Math.min(c.open, c.close) + 1e-9) {
      droppedOrder += 1;
      continue;
    }
    if (seen.has(c.time)) {
      droppedDup += 1;
      continue;
    }
    seen.add(c.time);
    candles.push({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume ?? 0 });
  }
  const trimmed = candles.length > maxBars ? candles.slice(candles.length - maxBars) : candles;
  return { candles: trimmed, droppedDup, droppedOrder };
}

// ---------------- worker execution ------------------------------------------
const WORKER_PATH =
  process.env.PINE_WORKER_PATH || path.join(process.cwd(), 'src', 'lib', 'pine', 'pine-worker.mjs');

export interface RunPineOptions {
  source: string;
  candles: PineCandle[];
  inputs?: Record<string, unknown>;
  scriptId?: string;
  scriptName?: string;
  symbol?: string;
  timeframe?: string;
  timeoutMs?: number;
  maxLoops?: number;
  maxBars?: number;
  /** skip sanitize bila pemanggil sudah membersihkan */
  skipSanitize?: boolean;
}

export interface RunPineOutcome {
  result: PineRunResult;
  events: PineEvent[];
  droppedDup: number;
  droppedOrder: number;
  barCount: number;
}

function runInWorker(payload: Record<string, unknown>, timeoutMs: number): Promise<PineRunResult> {
  return new Promise((resolve) => {
    let settled = false;
    const started = Date.now();
    let worker: WTFWorker;
    try {
      worker = new WTFWorker(WORKER_PATH, {
        resourceLimits: {
          maxOldGenerationSizeMb: 256,
          maxYoungGenerationSizeMb: 64,
        },
      });
    } catch (e) {
      resolve({
        ok: false,
        error: {
          name: 'WorkerSpawnError',
          message:
            'Runtime ini tidak mendukung worker_threads (mis. Cloudflare Workers edge). ' +
            'Pine Signals harus dijalankan di runtime Node.js/Bun. ' +
            `Detail: ${e instanceof Error ? e.message : String(e)}`,
        },
        durationMs: 0,
      });
      return;
    }

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { worker.terminate(); } catch { /* noop */ }
      resolve({
        ok: false,
        error: {
          name: 'TimeoutError',
          message: `Eksekusi script melebihi batas waktu ${timeoutMs} ms dan dihentikan`,
        },
        durationMs: Date.now() - started,
      });
    }, timeoutMs);

    worker.on('message', (msg: PineRunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { worker.terminate(); } catch { /* noop */ }
      resolve(msg);
    });
    worker.on('error', (err: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const e = err as { name?: string; message?: string };
      resolve({
        ok: false,
        error: { name: e?.name || 'WorkerError', message: e?.message || String(err) },
        durationMs: Date.now() - started,
      });
    });
    worker.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: false,
        error: { name: 'WorkerExitError', message: `Worker keluar tanpa hasil (code ${code})` },
        durationMs: Date.now() - started,
      });
    });

    worker.postMessage({ op: 'run', ...payload });
  });
}

/** Jalankan script Pine pada array candle (semua sudah close). */
export async function runPine(opts: RunPineOptions): Promise<RunPineOutcome> {
  const timeoutMs = opts.timeoutMs ?? PINE_LIMITS.TIMEOUT_MS;
  const maxBars = opts.maxBars ?? PINE_LIMITS.MAX_BARS;

  let candles: PineCandle[];
  let droppedDup = 0;
  let droppedOrder = 0;
  if (opts.skipSanitize) {
    candles = opts.candles;
  } else {
    const s = sanitizeCandles(opts.candles, maxBars);
    candles = s.candles;
    droppedDup = s.droppedDup;
    droppedOrder = s.droppedOrder;
  }

  const payload = {
    source: opts.source,
    candles,
    inputs: opts.inputs || {},
    maxLoops: opts.maxLoops ?? PINE_LIMITS.MAX_LOOPS,
    symbol: opts.symbol || 'XAUUSD',
    timeframe: opts.timeframe || '1h',
  };

  const result: PineRunResult = await runInWorker(payload, timeoutMs);

  const kind =
    result.ok && result.strategy ? 'strategy' : result.ok ? 'indicator' : 'unknown';

  const events =
    result.ok
      ? normalizeRunResult(result, {
          scriptId: opts.scriptId || 'pine',
          scriptName: opts.scriptName,
          symbol: opts.symbol || 'XAUUSD',
          timeframe: opts.timeframe || 'H1',
          kind,
        })
      : [];

  return { result, events, droppedDup, droppedOrder, barCount: candles.length };
}

/**
 * Fallback tanpa worker (runtime edge): loop guard PineTS tetap aktif,
 * TAPI tidak ada timeout hard — hanya untuk lingkungan tanpa worker_threads.
 * Plot/ringkasan strategy dikosongkan; alerts tetap diekstrak.
 */
export async function runPineInline(opts: RunPineOptions): Promise<PineRunResult> {
  const started = Date.now();
  try {
    const mod = (await Function('return import("pinets")')()) as typeof import('pinets');
    const s = opts.skipSanitize
      ? { candles: opts.candles }
      : sanitizeCandles(opts.candles, opts.maxBars ?? PINE_LIMITS.MAX_BARS);
    const klines = s.candles.map((c) => ({
      openTime: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume ?? 0,
      closeTime: c.time + 3_599_999,
    }));
    const pineTS = new mod.PineTS(klines, opts.symbol || 'XAUUSD', opts.timeframe || '1h');
    pineTS.setAlertMode('all');
    pineTS.setMaxLoops(opts.maxLoops ?? PINE_LIMITS.MAX_LOOPS);
    const indicator = new mod.Indicator(opts.source, opts.inputs || {});
    const ctx = await pineTS.run(indicator);
    const alerts = ((ctx.alerts || []) as PineRawRunResult['alerts']);
    return {
      ok: true,
      alerts,
      plots: {},
      strategy: ctx.strategy
        ? {
            kind: 'strategy' as const,
            position_size: Number(ctx.strategy.position_size ?? 0),
            opentrades: [],
            closedtrades: [],
            pending_orders: [],
          }
        : null,
      warnings: [],
      durationMs: Date.now() - started,
    };
  } catch (e) {
    const err = e as { name?: string; message?: string; method?: string };
    return {
      ok: false,
      error: { name: err.name || 'Error', message: err.message || String(e), method: err.method },
      durationMs: Date.now() - started,
    };
  }
}

// ---------------- validasi script (dipakai saat user menyimpan) -------------
export interface PineValidationIssue {
  severity: 'error' | 'warning';
  line?: number;
  col?: number;
  message: string;
}

export interface PineValidationResult {
  ok: boolean;
  errors: PineValidationIssue[];
  warnings: PineValidationIssue[];
}

let capsPromise: Promise<Record<string, string[]>> | null = null;

/** Ambil daftar fungsi yang didukung PineTS per namespace (diprobe sekali). */
export function getCapabilities(): Promise<Record<string, string[]>> {
  if (capsPromise) return capsPromise;
  capsPromise = (async () => {
    try {
      const outcome = await runPine({
        source: `//@version=6\nindicator("caps")\nplot(1)\n`,
        candles: [1, 2, 3].map((i) => ({ time: 1731384000000 + i * 3_600_000, open: 2000, high: 2001, low: 1999, close: 2000 })),
        skipSanitize: true,
        timeoutMs: 4_000,
      });
      if (outcome.result.ok && outcome.result.capabilities) {
        return outcome.result.capabilities;
      }
    } catch { /* ignore */ }
    return {};
  })();
  return capsPromise;
}

const SCAN_NAMESPACES = ['ta', 'math', 'str', 'array', 'input', 'strategy'];

/**
 * Validasi source Pine sebelum disimpan:
 *  1. Statik: ukuran, //@version, deklarasi indicator()/strategy(), import,
 *     fungsi namespace yang tidak dikenal (dengan nomor baris).
 *  2. Dry-run: jalankan pada candle sintetis kecil untuk menangkap error
 *     sintaks (line:col dari transpiler PineTS) dan error runtime.
 * Script yang gagal validasi TIDAK disimpan.
 */
export async function validatePineSource(source: string, opts?: { candles?: PineCandle[] }): Promise<PineValidationResult> {
  const errors: PineValidationIssue[] = [];
  const warnings: PineValidationIssue[] = [];

  if (source.length > PINE_LIMITS.MAX_SOURCE_BYTES) {
    errors.push({ severity: 'error', message: `Ukuran source ${source.length} byte melebihi batas ${PINE_LIMITS.MAX_SOURCE_BYTES} byte` });
    return { ok: false, errors, warnings };
  }

  const lines = source.split('\n');
  const versionLine = lines.findIndex((l) => l.trim().startsWith('//@version='));
  if (versionLine === -1) {
    errors.push({ severity: 'error', line: 1, message: 'Wajib ada anotasi //@version=5 atau //@version=6 di baris pertama' });
  } else {
    const v = lines[versionLine].replace('//@version=', '').trim();
    if (v !== '5' && v !== '6') {
      errors.push({ severity: 'error', line: versionLine + 1, message: `Versi Pine "${v}" tidak didukung (hanya 5 / 6)` });
    }
  }

  const declRe = /\b(indicator|strategy)\s*\(/;
  if (!declRe.test(source)) {
    errors.push({ severity: 'error', message: 'Wajib ada deklarasi indicator() atau strategy()' });
  }

  lines.forEach((l, i) => {
    if (/^\s*import\s+\w/.test(l)) {
      errors.push({ severity: 'error', line: i + 1, message: 'Import library tidak diizinkan di pine-runner (sandbox tanpa akses jaringan)' });
    }
    if (/\brequest\.\w+\s*\(/.test(l)) {
      warnings.push({ severity: 'warning', line: i + 1, message: 'request.* hanya bisa memakai data candle yang sama; timeframe berbeda akan gagal saat runtime' });
    }
    if (/\bsecurity\s*\(/.test(l) && !/request\./.test(l)) {
      warnings.push({ severity: 'warning', line: i + 1, message: 'security() versi lama tidak didukung, gunakan request.security()' });
    }
  });

  // pindai fungsi namespace tidak dikenal (best-effort, tanpa false positive)
  const caps = await getCapabilities();
  if (Object.keys(caps).length > 0) {
    const fnRe = /\b(ta|math|str|array|matrix|map|input|color|request|strategy)\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    lines.forEach((l, i) => {
      const trimmed = l.replace(/\/\/.*$/, '');
      let m: RegExpExecArray | null;
      fnRe.lastIndex = 0;
      while ((m = fnRe.exec(trimmed)) !== null) {
        const ns = m[1];
        const fn = m[2];
        const allowed = caps[ns];
        if (allowed && allowed.length > 0 && !allowed.includes(fn)) {
          errors.push({
            severity: 'error',
            line: i + 1,
            col: m.index + 1,
            message: `Fungsi ${ns}.${fn}() tidak didukung runtime pine-runner`,
          });
        }
      }
    });
  } else {
    warnings.push({ severity: 'warning', message: 'Daftar fungsi runtime tidak tersedia, pemeriksaan fungsi dilewati' });
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  // dry-run pada data sintetis kecil (atau data yang diberikan pemanggil)
  const dryCandles =
    opts?.candles && opts.candles.length >= 10
      ? opts.candles.slice(0, PINE_LIMITS.VALIDATION_BARS)
      : Array.from({ length: PINE_LIMITS.VALIDATION_BARS }, (_, i) => {
          const base = 2000 + Math.sin(i / 8) * 6;
          return {
            time: 1731384000000 + i * 3_600_000,
            open: Number(base.toFixed(2)),
            high: Number((base + 3 + (i % 5)).toFixed(2)),
            low: Number((base - 3 - ((i + 2) % 4)).toFixed(2)),
            close: Number((base + ((i % 7) - 3) * 0.8).toFixed(2)),
          };
        });

  const outcome = await runPine({
    source,
    candles: dryCandles,
    skipSanitize: false,
    timeoutMs: PINE_LIMITS.VALIDATION_TIMEOUT_MS,
  });

  if (!outcome.result.ok) {
    const e = outcome.result.error;
    let line: number | undefined;
    let col: number | undefined;
    const m = /\bat (\d+):(\d+)/.exec(e.message);
    if (m) {
      line = Number(m[1]);
      col = Number(m[2]);
    }
    errors.push({
      severity: 'error',
      line,
      col,
      message: line
        ? `${e.name}: ${e.message}`
        : `${e.name}: ${e.message}${e.method ? ` (method: ${e.method})` : ''}`,
    });
    return { ok: false, errors, warnings };
  }

  if (outcome.result.ok) {
    for (const w of outcome.result.warnings.slice(0, 10)) {
      warnings.push({ severity: 'warning', message: `Runtime: ${w.message}${w.method ? ` (${w.method})` : ''}` });
    }
  }

  return { ok: true, errors, warnings };
}
