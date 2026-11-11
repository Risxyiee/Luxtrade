/**
 * ============================================================
 * source-sticky — ingat SUMBER CANDLE terakhir yang sukses
 * ============================================================
 * FIX "chart kek setan — kadang ilang kadang kebawah":
 * rantai multi-sumber punya potensi LEVEL HARGA BEDA antar sumber.
 * Kalau antar-request sumber bergantian (TV suka gagal dari IP
 * datacenter), chart berganti skala → candle terlihat
 * lompat/ilang/kebawah. (Yahoo GC=F futures — penyebab historis —
 * sudah dihapus total dari rantai, keputusan Bos.)
 *
 * Solusi: sumber terakhir yang SUKSES utk (symbol,interval) diingat
 * 15 menit (in-memory per-isolate + KV Cloudflare cross-isolate) dan
 * DICOBA DULU di request berikutnya — chart konsisten satu skala,
 * failover tetap jalan kalau sumber sticky benar-benar mati.
 *
 * Dipakai bersama oleh /api/candles dan server-candles supaya SEMUA
 * konsumen candle dihitung pada skala harga yang SAMA (spot).
 */

const SOURCE_STICKY_TTL_MS = 15 * 60 * 1000
const stickySources = new Map<string, { source: string; at: number }>()

export function getStickySourceMem(key: string): string | null {
  const hit = stickySources.get(key)
  if (hit && Date.now() - hit.at < SOURCE_STICKY_TTL_MS) return hit.source
  stickySources.delete(key)
  return null
}

export function setStickySourceMem(key: string, source: string) {
  stickySources.set(key, { source, at: Date.now() })
  if (stickySources.size > 400) {
    const oldest = [...stickySources.entries()].sort((a, b) => a[1].at - b[1].at)[0]
    if (oldest) stickySources.delete(oldest[0])
  }
}

async function getKv(): Promise<any | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    return (getCloudflareContext() as any)?.env?.luxtradee_kv ?? null
  } catch {
    return null
  }
}

export async function getStickySourceKv(key: string): Promise<string | null> {
  try {
    const kv = await getKv()
    if (!kv) return null
    return await kv.get(`candles:src:${key}`, 'text')
  } catch {
    return null
  }
}

export async function setStickySourceKv(key: string, source: string): Promise<void> {
  try {
    const kv = await getKv()
    if (!kv) return
    await kv.put(`candles:src:${key}`, source, { expirationTtl: 900 })
  } catch {
    /* diam — sticky bersifat optimasi */
  }
}

/** Baca sticky (mem dulu, lalu KV) */
export async function readStickySource(key: string): Promise<string | null> {
  return getStickySourceMem(key) || (await getStickySourceKv(key))
}

/** Catat sticky ke mem + KV (best-effort) */
export async function writeStickySource(key: string, source: string): Promise<void> {
  setStickySourceMem(key, source)
  await setStickySourceKv(key, source)
}
