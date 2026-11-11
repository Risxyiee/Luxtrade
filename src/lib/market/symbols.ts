/**
 * ============================================================
 * symbols.ts — tabel simbol kanonik + utilitas bersama pasar
 * ============================================================
 * Satu sumber kebenaran untuk:
 *   - FOREX_SYMBOLS  : daftar simbol Luxtradee + presisi desimal
 *   - SYMBOL_ALIASES : alias → kanonik (GOLD→XAUUSD, NASDAQ→US100, …)
 *   - normalizeSymbol/validatePrice : normalisasi & sanity harga
 *   - OhlcvCandle    : bentuk candle generik { time(sec), o,h,l,c,v? }
 *
 * SEJARAH (Bos 2026-11-11: "data lain yahoo finance hapus aja"):
 *   Utilitas ini tadinya tinggal di yahoo.ts (dicampur fetcher Yahoo
 *   Finance). Yahoo Finance DIBUANG TOTAL dari seluruh rantai data —
 *   file yahoo.ts dihapus. Semua simbol & candle kini murni dari
 *   TradingView (utama, spot-grade) → TwelveData (cadangan spot).
 *   Rekatkan SEMUA pemanggil ke modul ini.
 */

/* ---------- Tabel simbol kanonik Luxtradee + presisi desimal ---------- */
export const FOREX_SYMBOLS: Record<string, { from: string; to: string; decimals: number }> = {
  'XAUUSD': { from: 'XAU', to: 'USD', decimals: 2 },
  'XAGUSD': { from: 'XAG', to: 'USD', decimals: 3 },
  'EURUSD': { from: 'EUR', to: 'USD', decimals: 5 },
  'GBPUSD': { from: 'GBP', to: 'USD', decimals: 5 },
  'USDJPY': { from: 'USD', to: 'JPY', decimals: 3 },
  'EURGBP': { from: 'EUR', to: 'GBP', decimals: 5 },
  'EURJPY': { from: 'EUR', to: 'JPY', decimals: 3 },
  'GBPJPY': { from: 'GBP', to: 'JPY', decimals: 3 },
  'AUDUSD': { from: 'AUD', to: 'USD', decimals: 5 },
  'NZDUSD': { from: 'NZD', to: 'USD', decimals: 5 },
  'USDCAD': { from: 'USD', to: 'CAD', decimals: 5 },
  'USDCHF': { from: 'USD', to: 'CHF', decimals: 5 },
  // Indeks — Nasdaq 100 (CFD US100, hampir 24 jam)
  'US100': { from: 'US100', to: 'USD', decimals: 1 },
  // Crypto (TradingView BINANCE:*)
  'BTCUSDT': { from: 'BTC', to: 'USDT', decimals: 2 },
  'ETHUSDT': { from: 'ETH', to: 'USDT', decimals: 2 },
  'SOLUSDT': { from: 'SOL', to: 'USDT', decimals: 2 },
  'XRPUSDT': { from: 'XRP', to: 'USDT', decimals: 4 },
  'DOGEUSDT': { from: 'DOGE', to: 'USDT', decimals: 5 },
  'ADAUSDT': { from: 'ADA', to: 'USDT', decimals: 4 },
  'LTCUSDT': { from: 'LTC', to: 'USDT', decimals: 2 },
  'BNBUSDT': { from: 'BNB', to: 'USDT', decimals: 2 },
  'LINKUSDT': { from: 'LINK', to: 'USDT', decimals: 3 },
  'AVAXUSDT': { from: 'AVAX', to: 'USDT', decimals: 3 },
}

/* ---------- Alias simbol / normalisasi ---------- */
export const SYMBOL_ALIASES: Record<string, string> = {
  // Indeks AS — Nasdaq 100 (US100 / NAS100 / USTEC / NDX / NASDAQ)
  'US100': 'US100', 'NAS100': 'US100', 'USTEC': 'US100', 'NDX': 'US100',
  'NASDAQ': 'US100', 'US100/USD': 'US100', 'USTEC100': 'US100',
  // Gold
  'XAU': 'XAUUSD', 'GOLD': 'XAUUSD', 'XAU/USD': 'XAUUSD',
  // Silver
  'XAG': 'XAGUSD', 'SILVER': 'XAGUSD', 'XAG/USD': 'XAGUSD',
  // Forex shorthand (popular with traders)
  'EUR/USD': 'EURUSD', 'GBP/USD': 'GBPUSD', 'USD/JPY': 'USDJPY',
  'EUR/GBP': 'EURGBP', 'EUR/JPY': 'EURJPY', 'GBP/JPY': 'GBPJPY',
  'AUD/USD': 'AUDUSD', 'NZD/USD': 'NZDUSD', 'USD/CAD': 'USDCAD', 'USD/CHF': 'USDCHF',
  // Crypto shorthand
  'BTC': 'BTCUSDT', 'BTC/USD': 'BTCUSDT', 'BTCUSD': 'BTCUSDT',
  'ETH': 'ETHUSDT', 'ETH/USD': 'ETHUSDT', 'ETHUSD': 'ETHUSDT',
  'SOL': 'SOLUSDT', 'SOL/USD': 'SOLUSDT', 'SOLUSD': 'SOLUSDT',
  'XRP': 'XRPUSDT', 'XRP/USD': 'XRPUSDT', 'XRPUSD': 'XRPUSDT',
  'DOGE': 'DOGEUSDT', 'DOGE/USD': 'DOGEUSDT', 'DOGEUSD': 'DOGEUSDT',
  'ADA': 'ADAUSDT', 'ADA/USD': 'ADAUSDT', 'ADAUSD': 'ADAUSDT',
  'LTC': 'LTCUSDT', 'LTC/USD': 'LTCUSDT', 'LTCUSD': 'LTCUSDT',
  'BNB': 'BNBUSDT', 'BNB/USD': 'BNBUSDT', 'BNBUSD': 'BNBUSDT',
  'LINK': 'LINKUSDT', 'LINK/USD': 'LINKUSDT', 'LINKUSD': 'LINKUSDT',
  'AVAX': 'AVAXUSDT', 'AVAX/USD': 'AVAXUSDT', 'AVAXUSD': 'AVAXUSDT',
}

export function normalizeSymbol(rawSymbol: string): string {
  const cleaned = rawSymbol.trim().toUpperCase()
  if (!cleaned) return 'EURUSD' // blank → default
  if (SYMBOL_ALIASES[cleaned]) return SYMBOL_ALIASES[cleaned]
  if (FOREX_SYMBOLS[cleaned]) return cleaned
  return cleaned // unknown symbol — caller must handle
}

/* ---------- Sanity check harga (tolak data basi/salah) ---------- */
export function validatePrice(symbol: string, price: number): number | null {
  const info = FOREX_SYMBOLS[symbol]
  if (!info) return price

  if (isNaN(price) || price <= 0) return null

  // Gold (XAU/USD) — 2026 emas ~4000. Di bawah 2000 = basi/salah.
  if (info.from === 'XAU' && price < 2000) return null
  // Silver — ~30+. Di bawah 10 = basi/salah.
  if (info.from === 'XAG' && price < 10) return null
  // Pasangan JPY: puluhan–ratusan
  if (info.to === 'JPY' && price < 50) return null
  // Crypto: cukup pastikan positif (PEPE dkk sangat kecil)
  if (info.to === 'USDT') return price > 0 ? price : null
  // Indeks US100 — rentang luas: futures/NDX ~25rb, QQQ (ETF proxy) ~600
  if (info.from === 'US100') {
    if (price < 100 || price > 100000) return null
    return price
  }
  // Forex non-JPY: 0.1–100
  if (info.to !== 'JPY' && info.from !== 'XAU' && info.from !== 'XAG') {
    if (price < 0.1 || price > 100) return null
  }

  return price
}

/* ---------- Bentuk candle generik Luxtradee ---------- */
export interface OhlcvCandle {
  time: number // epoch detik
  open: number
  high: number
  low: number
  close: number
  volume?: number
}
