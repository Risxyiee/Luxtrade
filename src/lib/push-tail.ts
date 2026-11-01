/**
 * Helper identik untuk PUSHTAIL + platform — DIPAKAI DI DUA SISI:
 *   • API (/api/push/test, /api/push/devices): label + tail dari DB
 *   • Service worker (src/sw.ts): tail endpoint saat lapor receipt
 * HARUS persis sama — UI mencocokkan receipt ep ↔ device ep.
 * (Pisah file biar sw.ts gak ikut tarik dependensi Next/server.)
 */

/** Tail endpoint (16 char alfanumerik terakhir) — stabil utk cocok receipt. */
export function endpointTail(endpoint: string): string {
  return endpoint.replace(/[^a-zA-Z0-9_-]/g, '').slice(-16) || 'unknown'
}

/** Label platform dari host endpoint — FCM=Chrome/Android, Apple=iOS PWA. */
export function platformOf(endpoint: string): string {
  try {
    const host = new URL(endpoint).host
    if (host.includes('push.apple.com')) return 'ios'
    if (host.includes('fcm.googleapis.com') || host.includes('android.googleapis.com')) return 'chrome'
    if (host.includes('mozilla')) return 'firefox'
    return 'other'
  } catch {
    return 'other'
  }
}
