/**
 * ============================================================
 * pine-lab/config.ts — KONFIGURASI SATU TEMPAT (spek item 5)
 * ============================================================
 * Semua angka kuota & guardrail Pine Lab di file ini saja.
 * ============================================================
 */

export const PINE_LAB_CONFIG = {
  /** Maks script dengan active=true per user. */
  MAX_ACTIVE_SCRIPTS: 3,
  /** Maks TOTAL script (aktif + nonaktif) per user. */
  MAX_TOTAL_SCRIPTS: 10,
  /** Maks run manual per jam per user (dihitung dari pine_runs). */
  MAX_MANUAL_RUNS_PER_HOUR: 20,
  /** Ukuran source script maksimal (KB). */
  MAX_SOURCE_KB: 50,
  /** Jumlah candle H1 yang ditarik cron per simbol. */
  CRON_CANDLE_LIMIT: 1500,
  /** Jumlah candle untuk run manual (test). */
  MANUAL_CANDLE_LIMIT: 1500,
  /** Deadline mesin Lux per run (ms) — sandbox dalam engine. */
  ENGINE_DEADLINE_MS: 2000,
  /** Batas event per run yang disimpan/dipush. */
  MAX_EVENTS_PER_RUN: 50,
  /** Retensi log pine_runs (hari) — dibersihkan cron. */
  RUN_LOG_RETENTION_DAYS: 7,
  /** Simbol default (kanonik Luxtradee). */
  DEFAULT_SYMBOL: 'XAUUSD',
  /** Simbol yang boleh dipakai (kanonik). */
  ALLOWED_SYMBOLS: ['XAUUSD', 'XAGUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'GBPJPY', 'BTCUSDT'] as string[],
} as const

export const PINE_LAB_FLAG = 'pine_lab'

export function sourceTooLargeMessage(): string {
  return `Source script terlalu besar (maksimal ${PINE_LAB_CONFIG.MAX_SOURCE_KB} KB).`
}
export function activeLimitMessage(): string {
  return `Batas ${PINE_LAB_CONFIG.MAX_ACTIVE_SCRIPTS} script aktif tercapai. Matikan (nonaktifkan) salah satu script dulu.`
}
export function runLimitMessage(): string {
  return `Batas ${PINE_LAB_CONFIG.MAX_MANUAL_RUNS_PER_HOUR} run manual per jam tercapai. Coba lagi nanti.`
}
