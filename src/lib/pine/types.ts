/**
 * Tipe bersama untuk fitur Pine Signals.
 * Format event standar = format champion-signal.js (sumber kebenaran).
 */

export type PineEventType =
  | 'PLACE_LIMIT'
  | 'REPLACE_LIMIT'
  | 'CANCEL_PENDING'
  | 'CLOSE_POSITION'
  | 'SIGNAL';

export interface PineEvent {
  /** Kunci idempotensi: `${scriptId}:${candleTime}:${side}:${event}` */
  id: string;
  event: PineEventType;
  strategy?: string;
  symbol: string;
  timeframe: string;
  /** Waktu OPEN candle pemicu, milidetik UTC (sama dengan champion-signal.js) */
  candleTime: number;
  candleTimeISO?: string;
  side?: 'BUY' | 'SELL' | null;
  orderType?: 'LIMIT' | 'MARKET';
  entry?: number;
  sl?: number;
  tp?: number;
  qtyOz?: number;
  lot?: number;
  reason?: string;
  orderRef?: string;
  maxBarsToFill?: number;
  meta?: Record<string, unknown>;
  /** Dari saluran mana event ini berasal */
  source: 'alert-json' | 'alertcondition' | 'alert-text' | 'strategy-order';
}

export interface PineCandle {
  /** Waktu OPEN candle, ms UTC */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** Hasil mentah dari pine-worker (sebelum dinormalisasi) */
export interface PineRawRunResult {
  ok: true;
  /** Jalur eksekusi: 'worker' = worker_threads (Node/Bun), 'inline' = fallback tanpa worker */
  mode?: 'worker' | 'inline';
  /** alerts dari alert()/alertcondition() — urutan bar */
  alerts: {
    type: string;
    id: string;
    message: string;
    title?: string;
    freq?: string;
    bar_index: number;
    time: number;
  }[];
  /** Plot output: nama plot -> deret {time, value} */
  plots: Record<string, { time: number; value: number | null }[]>;
  /** Ringkasan state strategy akhir */
  strategy: {
    kind: 'strategy' | 'indicator' | 'unknown';
    position_size: number;
    opentrades: Record<string, unknown>[];
    closedtrades: Record<string, unknown>[];
    pending_orders: Record<string, unknown>[];
  } | null;
  /** Peringatan runtime non-fatal (akses OOB dsb.) */
  warnings: { message: string; method?: string; bar: number }[];
  /** Nama-nama fungsi yang didukung per namespace (untuk validasi) */
  capabilities?: Record<string, string[]>;
  durationMs: number;
}

export interface PineRunError {
  ok: false;
  error: {
    name: string;
    message: string;
    method?: string;
    /** baris Pine bila diketahui (dari transpiler) */
    line?: number;
    col?: number;
  };
  durationMs: number;
}

export type PineRunResult = PineRawRunResult | PineRunError;

export const PINE_EVENT_TYPES: PineEventType[] = [
  'PLACE_LIMIT',
  'REPLACE_LIMIT',
  'CANCEL_PENDING',
  'CLOSE_POSITION',
  'SIGNAL',
];

/** Batas default pine-runner */
export const PINE_LIMITS = {
  MAX_SOURCE_BYTES: 50_000,
  MAX_BARS: 20_000,
  MIN_WARMUP_BARS: 500,
  /** dry-run validasi */
  VALIDATION_BARS: 300,
  TIMEOUT_MS: 5_000,
  VALIDATION_TIMEOUT_MS: 4_000,
  MAX_LOOPS: 500_000,
  MAX_PLOTS: 40,
  /** rate limit per user */
  RUNS_PER_MINUTE: 12,
  RUNS_PER_HOUR: 60,
} as const;

/** Buat kunci idempotensi standar */
export function pineEventId(
  scriptId: string,
  candleTime: number,
  side: string | null | undefined,
  event: string
): string {
  return `${scriptId}:${candleTime}:${side ?? 'NONE'}:${event}`;
}
