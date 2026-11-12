/**
 * browser-runner.ts — eksekusi Pine Script user di BROWSER (Web Worker).
 *
 * Fallback untuk deploy Cloudflare Workers edge yang tidak mendukung
 * worker_threads: PineTS build browser dijalankan di Web Worker terpisah
 * dengan timeout terminate() (protokol identik pine-worker.mjs).
 * Dipanggil dari PineSignalsTab saat server menjawab `workerUnsupported`
 * atau `mode: 'inline'` (plots/strategy tidak tersedia dari server edge).
 */
import { PineRunResult, PINE_LIMITS } from './types';

export interface RunPineBrowserOptions {
  source: string;
  candles: { time: number; open: number; high: number; low: number; close: number; volume?: number }[];
  inputs?: Record<string, unknown>;
  maxLoops?: number;
  symbol?: string;
  timeframe?: string;
  timeoutMs?: number;
}

/** Jalankan script Pine pada array candle di Web Worker browser (satu-pemakaian). */
export function runPineBrowser(opts: RunPineBrowserOptions): Promise<PineRunResult> {
  const timeoutMs = opts.timeoutMs ?? PINE_LIMITS.TIMEOUT_MS;
  return new Promise((resolve) => {
    let settled = false;
    const started = Date.now();
    let worker: Worker | null = null;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { worker?.terminate(); } catch { /* noop */ }
      resolve({
        ok: false,
        error: {
          name: 'TimeoutError',
          message: `Eksekusi script melebihi batas waktu ${timeoutMs} ms dan dihentikan`,
        },
        durationMs: Date.now() - started,
      });
    }, timeoutMs);

    const finish = (r: PineRunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { worker?.terminate(); } catch { /* noop */ }
      resolve(r);
    };

    try {
      // webpack/turbopack mem-bundle file ini sebagai worker chunk terpisah
      worker = new Worker(new URL('./browser-worker.mjs', import.meta.url));
    } catch (e) {
      finish({
        ok: false,
        error: {
          name: 'WorkerSpawnError',
          message: `Web Worker browser gagal dibuat: ${e instanceof Error ? e.message : String(e)}`,
        },
        durationMs: 0,
      });
      return;
    }

    worker.onmessage = (ev: MessageEvent) => {
      finish((ev.data as PineRunResult) || {
        ok: false,
        error: { name: 'WorkerError', message: 'Worker membalas tanpa hasil' },
        durationMs: Date.now() - started,
      });
    };
    worker.onerror = (ev) => {
      try { ev.preventDefault(); } catch { /* noop */ }
      finish({
        ok: false,
        error: { name: 'WorkerError', message: ev.message || 'Worker error (lihat console)' },
        durationMs: Date.now() - started,
      });
    };

    worker.postMessage({
      op: 'run',
      source: opts.source,
      candles: opts.candles,
      inputs: opts.inputs || {},
      maxLoops: opts.maxLoops ?? PINE_LIMITS.MAX_LOOPS,
      symbol: opts.symbol || 'XAUUSD',
      timeframe: opts.timeframe || '1h',
    });
  });
}
