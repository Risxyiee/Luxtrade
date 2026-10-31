import { getClientBrowser } from '@/lib/supabase-browser'

/**
 * Resolver tampilan screenshot trade — pendamping hardening bucket
 * `trade-screenshots` (security audit #7).
 *
 * Latar belakang: bucket ini di-flip PRIVATE. URL yang tersimpan di
 * trades.screenshot_url ada 3 bentuk:
 *   1. Public URL lama    : .../object/public/trade-screenshots/{path}
 *   2. Signed URL (mati)  : .../object/sign/trade-screenshots/{path}?token=...
 *      (dibuat /api/trade-upload, TTL 7 hari — kadaluarsa di DB)
 *   3. Path mentah        : {userId}/{file}
 *
 * Setelah flip, bentuk (1) dan signed URL kadaluarsa (2) TIDAK bisa
 * dirender lagi. Resolver mengekstrak path-nya lalu minta signed URL BARU
 * via browser client (user JWT) — storage RLS policy "owner select"
 * (migrasi 030) mengizinkan pemiliknya. Kalau signing gagal (mis. file
 * legacy tanpa pemilik), fallback ke URL asli agar tidak crash.
 */

const BUCKET = 'trade-screenshots'
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`
const SIGN_MARKER = `/storage/v1/object/sign/${BUCKET}/`

/** TTL signed URL baru: 1 jam (cukup untuk sesi edit, memperkecil kebocoran) */
const SIGN_TTL_SECONDS = 3600
/** Re-sign 5 menit sebelum kadaluarsa */
const SIGN_MARGIN_MS = 5 * 60 * 1000

const cache = new Map<string, { url: string; expiresAt: number }>()

/** Ekstrak path objek dari URL storage apa pun bentuknya; null kalau bukan. */
export function extractTradeScreenshotPath(screenshotUrl: string): string | null {
  if (!screenshotUrl) return null
  const marker =
    screenshotUrl.indexOf(PUBLIC_MARKER) !== -1
      ? PUBLIC_MARKER
      : screenshotUrl.indexOf(SIGN_MARKER) !== -1
        ? SIGN_MARKER
        : null
  if (!marker) return null
  const raw = screenshotUrl.slice(screenshotUrl.indexOf(marker) + marker.length)
  const path = decodeURIComponent(raw.split('?')[0]).trim()
  return path || null
}

/**
 * Balikkan URL yang SIAP dirender <img>:
 * signed URL segar untuk path milik user, atau URL asli sebagai fallback.
 */
export async function resolveTradeScreenshotSrc(screenshotUrl: string): Promise<string> {
  if (!screenshotUrl) return screenshotUrl

  const path = extractTradeScreenshotPath(screenshotUrl)
  if (!path) return screenshotUrl // blob:, data:, atau URL asing → biarkan

  const cached = cache.get(path)
  if (cached && cached.expiresAt > Date.now() + SIGN_MARGIN_MS) {
    return cached.url
  }

  try {
    const client = getClientBrowser()
    if (!client) return screenshotUrl

    const { data, error } = await client.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGN_TTL_SECONDS)

    if (error || !data?.signedUrl) {
      // Bukan milik user / policy menolak / file legacy root → fallback asli
      return screenshotUrl
    }

    cache.set(path, {
      url: data.signedUrl,
      expiresAt: Date.now() + SIGN_TTL_SECONDS * 1000,
    })
    return data.signedUrl
  } catch {
    return screenshotUrl
  }
}
