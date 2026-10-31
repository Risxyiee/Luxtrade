/**
 * background.ts — jalankan tugas non-kritis TANPA memblokir response.
 *
 * Di Cloudflare Workers, floating promise (tanpa await) DIBATALKAN begitu
 * response terkirim → cache invalidation / update saldo bisa hilang diam-diam
 * (bug "saldo drift"). Solusi resminya `ctx.waitUntil()` dari OpenNext:
 * Workers tetap hidup sampai promise selesai, response tidak menunggu.
 *
 * Di luar Workers (dev/lokal), fallback ke floating promise yang di-guard.
 */
export function runInBackground(task: () => Promise<unknown>): void {
  void (async () => {
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare')
      getCloudflareContext().ctx.waitUntil(
        task().catch((err) => console.warn('[background] task failed:', err))
      )
    } catch {
      // Bukan di lingkungan Workers (mis. `next dev`) — jalankan floating + guard
      task().catch((err) => console.warn('[background] task failed:', err))
    }
  })()
}
