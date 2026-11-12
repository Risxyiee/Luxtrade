/**
 * ============================================================
 * LUX ENGINE — index.ts (pintu masuk tunggal modul)
 * ============================================================
 * Modul Mandiri Luxtradee — SATU-SATUNYA file yang perlu diimport
 * kode luar. Lihat types.ts untuk aturan modul (nol dependensi,
 * clean-room, tanpa AGPL/PineTS).
 *
 * PAKAI:
 *   import { runLuxScript } from '@/engine/lux'
 *   const r = runLuxScript(source, candles, { deadlineMs: 2000 })
 * ============================================================
 */

export { runLuxScript } from './interpreter'
export { LuxError } from './interpreter'
export type {
  LuxCandle,
  LuxEvent,
  LuxPlot,
  LuxRunOptions,
  LuxRunResult,
  LuxValue,
} from './types'
