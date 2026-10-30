import { NextRequest, NextResponse } from 'next/server'
// P1 lanjutan (2026-10-30): pakai ASYNC admin client — pola PREFERRED utk CF
// Workers (dokumentasi lib: cek process.env DAN CF ctx.env). Sync dulu dipakai
// dan insert gagal di produksi (500) padahal tabel contact_messages terbukti
// ada + RLS deny-all jalan (dicek via anon key: 'permission denied' bukan
// 'does not exist') — curiga env source/key; async menutup sisi kode.
import { getSupabaseAdminAsync } from '@/lib/supabase-admin-alt'
import { rateLimitByEmail } from '@/lib/rate-limit'

/**
 * POST /api/contact — form kontak publik (P1 fix).
 * Dulu form /contact cuma buka mailto: — pesan tidak tersimpan di mana pun,
 * gampang hilang. Sekarang disimpan ke tabel contact_messages (Supabase)
 * lewat service role, dengan validasi + rate limit + honeypot anti-spam.
 *
 * Body: { name, email, subject?, message, website? }  ← website = honeypot
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON tidak valid' }, { status: 400 })
    }

    // Honeypot: bot mengisi field tersembunyi "website" → pura-pura sukses
    // (dicek duluan — tidak perlu DB/env untuk membuang bot)
    const honeypot = String(body.website || '')
    if (honeypot) {
      return NextResponse.json({ success: true, message: 'Pesan terkirim.' })
    }

    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const subject = String(body.subject || '').trim().slice(0, 200)
    const message = String(body.message || '').trim()
    const userAgent = request.headers.get('user-agent') || ''

    // Validasi (sebelum cek env — murah dan tidak butuh koneksi)
    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ error: 'Nama wajib 2–100 karakter.' }, { status: 400 })
    }
    if (!EMAIL_RE.test(email) || email.length > 200) {
      return NextResponse.json({ error: 'Email tidak valid.' }, { status: 400 })
    }
    if (message.length < 10 || message.length > 5000) {
      return NextResponse.json({ error: 'Pesan wajib 10–5000 karakter.' }, { status: 400 })
    }

    // Rate limit: 3 pesan per 15 menit per email
    const rl = rateLimitByEmail('contact-form', email, {
      maxRequests: 3,
      windowMs: 15 * 60 * 1000,
      message: 'Terlalu banyak pesan terkirim. Tunggu 15 menit.',
    })
    if (rl) return rl

    const admin = await getSupabaseAdminAsync()
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { error: insertErr } = await admin.from('contact_messages').insert({
      name,
      email,
      subject: subject || '(tanpa subjek)',
      message,
      user_agent: userAgent,
    })

    if (insertErr) {
      // Log kode + hint utk diagnosis (42501 RLS/grant vs 401 key invalid)
      console.error('[contact] insert failed:', insertErr.code, insertErr.message, insertErr.hint)
      return NextResponse.json(
        { error: 'Gagal menyimpan pesan. Coba lagi atau email langsung ke luxtradee@gmail.com' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Pesan terkirim! Tim kami akan membalas via email.',
    })
  } catch (err) {
    console.error('[contact] Error:', err)
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}
