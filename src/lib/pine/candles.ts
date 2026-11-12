/**
 * candles.ts — sumber candle H1 bersama untuk PINE SIGNALS.
 * SATU fetch dibagi ke SEMUA user/script (aturan tugas): cache in-memory
 * per (symbol, timeframe, rentang bar) + rantai sumber yang sama dengan
 * chart user (TradingView -> TwelveData).
 *
 * Format internal Luxtradee candle: { time (ms UTC, waktu OPEN), open,
 * high, low, close } — lib market mengembalikan detik, di sini dikonversi.
 */
import {
  fetchTradingViewCandles,
} from '@/lib/market/tradingview';
import {
  fetchTwelveDataCandles,
} from '@/lib/market/twelvedata';
import type { PineCandle } from './types';

interface CacheEntry {
  candles: PineCandle[];
  fetchedAt: number;
}

const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000; // 1 menit — cukup untuk siklus live per jam + backtest manual

function cacheKey(symbol: string, timeframe: string, bars: number): string {
  return `${symbol}:${timeframe}:${bars}`;
}

function toMsCandles(raw: { time: number; open: number; high: number; low: number; close: number; volume?: number }[]): PineCandle[] {
  return raw
    .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close))
    .map((c) => ({
      // lib market memakai detik (Vela); konversi ke ms UTC waktu OPEN
      time: c.time < 1e12 ? c.time * 1000 : c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume ?? 0,
    }))
    .sort((a, b) => a.time - b.time);
}

/**
 * Ambil candle close (dipakai hanya untuk candle yang SUDAH close —
 * pemanggil bertanggung jawab membuang bar berjalan lewat lastClosedCandle()).
 */
export async function getSharedCandles(
  symbol: string,
  timeframe: string,
  bars: number
): Promise<PineCandle[]> {
  const key = cacheKey(symbol, timeframe, bars);
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.candles;

  let raw: { time: number; open: number; high: number; low: number; close: number; volume?: number }[] | null = null;
  try {
    raw = await fetchTradingViewCandles(symbol, timeframe, bars);
  } catch {
    raw = null;
  }
  if (!raw || raw.length === 0) {
    try {
      raw = await fetchTwelveDataCandles(symbol, timeframe, bars);
    } catch {
      raw = null;
    }
  }
  if (!raw || raw.length === 0) {
    if (hit) return hit.candles; // data basi lebih baik daripada gagal total
    throw new Error('Sumber candle tidak tersedia (TradingView & TwelveData gagal)');
  }

  const candles = toMsCandles(raw);
  CACHE.set(key, { candles, fetchedAt: Date.now() });
  return candles;
}

/**
 * Waktu OPEN (ms) candle H1 yang SUDAH close paling akhir:
 * floor waktu sekarang ke jam, minus 1 jam.
 */
export function lastClosedCandleTime(now: number = Date.now()): number {
  return Math.floor(now / 3_600_000) * 3_600_000 - 3_600_000;
}

/**
 * Buang candle yang belum close (bar berjalan) — wajib sebelum dipakai
 * engine: candle berjalan TIDAK BOLEH memicu event.
 */
export function dropOpenCandle(candles: PineCandle[], now: number = Date.now()): PineCandle[] {
  const lastClosed = lastClosedCandleTime(now);
  return candles.filter((c) => c.time <= lastClosed);
}

/** Ambil candle window terakhir siap pakai (sudah dibuang bar berjalan). */
export async function getClosedCandles(
  symbol: string,
  timeframe: string,
  bars: number,
  now: number = Date.now()
): Promise<PineCandle[]> {
  const raw = await getSharedCandles(symbol, timeframe, Math.min(bars + 2, 5000));
  const closed = dropOpenCandle(raw, now);
  return closed.length > bars ? closed.slice(closed.length - bars) : closed;
}
