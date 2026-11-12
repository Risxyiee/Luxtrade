/**
 * ============================================================
 * LUX ENGINE — types.ts
 * ============================================================
 * Modul Mandiri Luxtradee (paket internal terisolasi).
 *
 * ATURAN MODUL:
 *   - TIDAK BOLEH meng-import kode Luxtradee di luar folder ini.
 *   - NOL dependensi eksternal (TypeScript murni, stdlib saja).
 *   - CLEAN-ROOM: ditulis dari nol untuk subset bahasa Pine Script
 *     ("Lux Script"). TIDAK memuat kode PineTS / AGPL / LuxAlgo
 *     apa pun — struktur data & algoritma ditulis sendiri.
 *   - Portable: jalan di CF Workers, Node, Bun (tanpa API Node).
 * ============================================================
 */

/** Satu candle OHLCV standar (time = epoch DETIK, UTC). */
export interface LuxCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

/** Event sinyal yang dipancarkan script (alertcondition / alert). */
export interface LuxEvent {
  /** Epoch DETIK candle tempat event terjadi. */
  time: number
  /** Bar index (0-based) tempat event terjadi. */
  bar: number
  /** Judul alert (argumen title alertcondition / id call-site alert). */
  title: string
  /** Pesan alert dari script (sudah dipotong biar aman ditampilkan). */
  message: string
}

/** Satu garis plot (untuk digambar UI, opsional). */
export interface LuxPlot {
  title: string
  /** Nilai per bar (NaN = na). Panjang = jumlah bar. */
  values: number[]
}

/** Opsi eksekusi (sandbox guardrails). */
export interface LuxRunOptions {
  /** Batas wall-clock TOTAL eksekusi (ms). Default 2000. */
  deadlineMs?: number
  /** Batas jumlah bar yang dieksekusi. Default 3000. */
  maxBars?: number
  /** Batas jumlah event yang dikumpulkan. Default 100. */
  maxEvents?: number
}

export interface LuxRunResult {
  ok: boolean
  /** Jumlah bar yang benar-benar dieksekusi. */
  bars: number
  events: LuxEvent[]
  plots: LuxPlot[]
  /** Durasi eksekusi (ms). */
  durationMs: number
  /** Diisi bila ok === false. */
  error?: string
  /** Kode error mesin (stabilitas diag). */
  errorCode?:
    | 'PARSE_ERROR'
    | 'TIMEOUT'
    | 'TOO_MANY_BARS'
    | 'RUNTIME_ERROR'
    | 'STEP_BUDGET'
}

/** Nilai runtime Lux: angka (NaN = na), boolean, atau string. */
export type LuxValue = number | boolean | string
