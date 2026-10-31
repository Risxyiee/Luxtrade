import { NextRequest, NextResponse } from 'next/server'
import { pushCapability, probePush } from '@/lib/web-push'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * GET /api/push/capability — diagnostik infra push (FASE 5A debug).
 *
 * Kenapa ADA (tanpa auth): selama ini push produksi gak bisa diverifikasi —
 * Bos di HP cuma lihat "Belum kekirim" tanpa tahu PENYEBABNYA. Endpoint ini
 * menjawab 3 pertanyaan penentu:
 *   1. library web-push bisa load di runtime ini? (di CF Workers pernah dicurigai gagal)
 *   2. VAPID public + PRIVATE tersedia? (private sempat masuk daftar "USER MUST set")
 *   3. probe: pipa crypto+HTTPS ke push service (Apple) jalan? — kirim ke
 *      endpoint PALSU, harusnya dapat HTTP 4xx; itu bukti pipa OK.
 *
 * Yang dibocorkan HANYA boolean status & kode HTTP — tanpa secret, tanpa
 * data user. Rate limit 10/menit per IP.
 */
export async function GET(request: NextRequest) {
  const limited = checkRateLimit(request, 'push-capability', {
    maxRequests: 10,
    windowMs: 60_000,
    message: 'Terlalu banyak cek diagnostik — tunggu satu menit.',
  }, 'ip')
  if (limited) return limited

  try {
    const capability = await pushCapability()
    const probe = await probePush()

    // Interpretasi cepat biar gak perlu jadi ahli buat baca hasilnya
    let verdict: string
    if (capability.library === 'unavailable') {
      verdict = 'BROKEN: library web-push gagal dimuat di runtime ini — perlu pengirim CF-native'
    } else if (!capability.vapidPrivateKey) {
      verdict = 'BROKEN: VAPID_PRIVATE_KEY tidak tersedia — push tidak akan pernah terkirim sampai secret dipasang'
    } else if (probe.outcome === 'http_response') {
      verdict = 'OK: pipa push jalan (crypto+HTTPS+VAPID diterima push service)'
    } else if (probe.outcome === 'skipped') {
      verdict = `SKIPPED: ${probe.error}`
    } else if (probe.outcome === 'timeout') {
      verdict = 'SUSPECT: probe timeout — network ke push service terblokir?'
    } else {
      verdict = `BROKEN: probe gagal sebelum HTTP — ${probe.error}`
    }

    return NextResponse.json({
      ...capability,
      probe,
      verdict,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[push/capability] Error:', error?.message)
    return NextResponse.json({ error: 'Diagnostik gagal' }, { status: 500 })
  }
}
