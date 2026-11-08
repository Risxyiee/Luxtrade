/**
 * instrumentation-node — bootstrap Node-only saat server Next start.
 * HANYA di-import dari src/instrumentation.ts di balik guard
 * NEXT_RUNTIME === 'nodejs' (di-tree-shake di Edge Runtime).
 *
 * Isi: Real-time Alert Engine (Sinyal VIP) — WebSocket listener
 * Twelve Data tick-by-tick → indikator custom → push user PRO.
 * Di Cloudflare Workers file ini tidak pernah dieksekusi; produksi
 * memakai jalur cron REST /api/cron/vip-signals (lihat
 * src/services/marketListener.ts).
 */
export async function register(): Promise<void> {
  try {
    const { startMarketListener } = await import('@/services/marketListener')
    await startMarketListener()
  } catch (e) {
    console.warn(
      '[Instrumentation] marketListener gagal start:',
      e instanceof Error ? e.message : e
    )
  }
}
