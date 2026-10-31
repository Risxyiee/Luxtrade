/**
 * ============================================================
 * GET /api/forex-batch — harga live BANYAK simbol sekaligus
 * ============================================================
 * FASE 2 PERF: WatchlistTab dulu melakukan N fetch per-simbol
 * setiap 15 detik dengan nocache=true → N hit Yahoo Finance
 * per user per 15s dan SEMUA cache server dilewati.
 *
 * Sekarang: SATU request → server resolve semua simbol lewat
 * lapisan cache bersama (mem + KV, lihat src/lib/market/
 * forex-cache.ts). Hanya cache-miss yang memukul Yahoo, dan
 * hasilnya di-share ke semua user (KV cross-isolate).
 *
 * Nama endpoint SENGAJA bukan prefix /api/forex yang di-cache
 * service worker (PUBLIC_GET_API_PREFIXES) — harga alert harus
 * fresh, jangan pernah dilayani SW cache.
 *
 * Kontrak respons:
 *   { success, prices: { [simbolClient]: number }, unavailable: string[], fetchedAt }
 * Kunci prices = simbol APA ADANYA dari client (bukan hasil
 * normalisasi) agar client bisa merge langsung ke priceMap-nya.
 */

import { NextRequest, NextResponse } from 'next/server'
import { FOREX_SYMBOLS, normalizeSymbol, fetchYahooChart } from '@/lib/market/yahoo'
import {
  getCached,
  setCache,
  getForexKVCache,
  setForexKVCache,
  PRICE_FRESH_MS,
} from '@/lib/market/forex-cache'

export const dynamic = 'force-dynamic'

const MAX_SYMBOLS = 30 // guard — watchlist wajar < 30 simbol
const INTERVAL = '1h'
const LIMIT = 1 // price check (live tick dari meta Yahoo)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const raw = searchParams.get('symbols') || ''
    const nocache = searchParams.get('nocache') === 'true'

    const symbols = [...new Set(
      raw.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    )].slice(0, MAX_SYMBOLS)

    if (symbols.length === 0) {
      return NextResponse.json(
        { success: false, prices: {}, unavailable: [], message: 'Parameter symbols wajib, contoh: ?symbols=XAUUSD,EURUSD', fetchedAt: new Date().toISOString() },
        { status: 400 }
      )
    }

    const cacheKeyFor = (symbol: string) => `${symbol}:${INTERVAL}:${LIMIT}`

    const results = await Promise.all(symbols.map(async (rawSym): Promise<[string, number | null]> => {
      try {
        const symbol = normalizeSymbol(rawSym)
        if (!FOREX_SYMBOLS[symbol]) return [rawSym, null]

        const cacheKey = cacheKeyFor(symbol)

        if (!nocache) {
          // Lapis 1 — mem-cache (hanya jika <= 15 dtk, aturan freshness harga live)
          const cached = getCached(cacheKey, INTERVAL, LIMIT)
          if (cached && Date.now() - cached.timestamp <= PRICE_FRESH_MS) {
            const last = cached.data[cached.data.length - 1]
            if (last && typeof last.close === 'number') return [rawSym, last.close]
          }

          // Lapis 2 — KV cross-isolate
          const kv = await getForexKVCache(cacheKey)
          if (kv && Date.now() - kv.timestamp <= PRICE_FRESH_MS) {
            setCache(cacheKey, kv.data, kv.source)
            const last = kv.data[kv.data.length - 1]
            if (last && typeof last.close === 'number') return [rawSym, last.close]
          }
        }

        // Cache miss → Yahoo (satu hit per simbol, hasil di-cache utk semua)
        const yf = await fetchYahooChart(symbol, INTERVAL, LIMIT, true)
        if (yf && yf.length > 0) {
          setCache(cacheKey, yf, 'yahoo-finance')
          await setForexKVCache(cacheKey, yf, 'yahoo-finance', 30)
          const last = yf[yf.length - 1]
          if (last && typeof last.close === 'number') return [rawSym, last.close]
        }
        return [rawSym, null]
      } catch {
        return [rawSym, null]
      }
    }))

    const prices: Record<string, number> = {}
    const unavailable: string[] = []
    for (const [sym, price] of results) {
      if (price !== null && Number.isFinite(price)) prices[sym] = price
      else unavailable.push(sym)
    }

    return NextResponse.json({
      success: true,
      prices,
      unavailable,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[ForexBatch] Unhandled error:', error)
    return NextResponse.json(
      {
        success: false,
        prices: {},
        unavailable: [],
        message: 'Gagal mengambil harga batch. Coba beberapa saat lagi.',
        error: error instanceof Error ? error.message : String(error),
        fetchedAt: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
