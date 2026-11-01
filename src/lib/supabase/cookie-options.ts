import type { CookieOptions } from '@supabase/ssr'

/**
 * SECURITY (audit #5): hardening cookie sesi Supabase.
 *
 * Default @supabase/ssr = { httpOnly:false, secure:undefined, sameSite:'lax',
 * maxAge: 400 hari } — tidak ada satu pun pemanggil di repo ini yang
 * meng-override, jadi cookie sesi (JWT berumur sangat panjang) bisa dibaca
 * JS (document.cookie) dan dikirim tanpa HTTPS.
 *
 * Catatan jujur soal httpOnly: dengan arsitektur @supabase/ssr, token sesi
 * HARUS bisa ditulis/dibaca oleh browser (refresh token berjalan di client),
 * dan JS memang tidak bisa menyetel atribut httpOnly — memaksakan
 * httpOnly:true merusak refresh flow. Mitigasi yang benar:
 *   - secure:true di produksi (cookie tak dikirim via HTTP)
 *   - sameSite:'lax' (anti-CSRF dasar)
 *   - CSP enforcing sebagai lapisan anti-XSS (audit #16, terpisah)
 *
 * secure hanya dimatikan di NODE_ENV=development (localhost/preview) supaya
 * login di lingkungan non-HTTPS lokal tetap jalan.
 */
export function getSecureCookieOptions(): CookieOptions {
  return {
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax',
  }
}
