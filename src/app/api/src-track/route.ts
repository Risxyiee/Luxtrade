import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { trackEvent, trackSignupFromCookies, sanitizeSrc, SRC_COOKIE, SRC_DAY_COOKIE, SRC_USED_COOKIE, SRC_COOKIE_OPTS, SRC_DAY_COOKIE_OPTS, SRC_USED_COOKIE_OPTS, wibDayStr } from '@/lib/src-track'

/**
 * GET/POST /api/src-track — PENCATAT SUMBER KUNJUNGAN & PENDAFTAR.
 *
 * Data ini bahan LOOP BELAJAR (lib/ceo-loop.ts): rapat mingguan memakai
 * "sumber trafik 7 hari" sebagai FAKTA, dan taruhan bisa bermetrik
 * signups:<sumber> / visits:<sumber> yang diukur otomatis.
 *
 * Pemakaian:
 *   ?src=tiktok          → catat 1 kunjungan dari tiktok (dedup 1×/hari via
 *                          cookie lux_src_day) + pasang cookie lux_src (30 hari)
 *                          yang akan dipakai sebagai atribusi saat pendaftaran.
 *   ?signup=1            → catat 1 pendaftar dari cookie lux_src
 *                          (dedup via cookie lux_src_used). Dipanggil client
 *                          setelah signUp sukses (alur auth-context) — alur
 *                          /api/auth/register mencatat langsung server-side.
 *
 * Tanpa src → sumber 'direct'. Semua nilai dibersihkan [a-z0-9_-], maks 32.
 * Publik (tanpa auth) — angka cuma statistik agregat; rate limit ringan
 * per IP mencegah pengisian liar.
 */

export const dynamic = 'force-dynamic'

async function handle(req: NextRequest): Promise<NextResponse> {
  const rl = checkRateLimit(req, 'src-track', { maxRequests: 40, windowMs: 15 * 60 * 1000 })
  if (rl) return rl

  const q = new URL(req.url).searchParams
  const isSignup = q.get('signup') === '1' || q.get('event') === 'signup'

  /* ---- PENDAFTAR ---- */
  if (isSignup) {
    const r = await trackSignupFromCookies(req.cookies, q.get('src') || '')
    const res = NextResponse.json({ ok: true, kind: 'signup', recorded: r.recorded, dup: r.dup, src: r.src || undefined })
    if (!r.dup) res.cookies.set(SRC_USED_COOKIE, '1', SRC_USED_COOKIE_OPTS)
    return res
  }

  /* ---- KUNJUNGAN ---- */
  const src = sanitizeSrc(q.get('src') || q.get('utm_source') || q.get('ref') || '')
  const today = wibDayStr()
  const counted = req.cookies.get(SRC_DAY_COOKIE)?.value !== today
  if (counted) await trackEvent(src, 'visit')

  const res = NextResponse.json({ ok: true, kind: 'visit', recorded: counted, src })
  /* Sumber terakhir selalu diperbarui (last-touch) — dipakai saat pendaftar. */
  res.cookies.set(SRC_COOKIE, src, SRC_COOKIE_OPTS)
  if (counted) res.cookies.set(SRC_DAY_COOKIE, today, SRC_DAY_COOKIE_OPTS)
  return res
}

export const GET = handle
export const POST = handle
