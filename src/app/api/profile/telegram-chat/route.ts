/**
 * ============================================================
 * /api/profile/telegram-chat — Chat ID Telegram milik user
 * (Task 37 — halaman settings/telegram)
 * ============================================================
 * GET  → { chatId: string | null, chatBound: boolean }
 * PUT  { chatId: string }  — simpan / hapus ("" = clear)
 *
 * Nilai ini dipakai /api/send-alert sebagai tujuan alert Telegram
 * user (prioritas: body.chatId > profiles.telegram_chat_id > env
 * TELEGRAM_CHAT_ID default Bos).
 *
 * Kolom: profiles.telegram_chat_id (lihat SQL di bawah / docs/
 * SUPABASE_QUOTA_TABLES.sql).
 * Penulisan via service role — kolom baru belum tentu tercakup
 * policy RLS update milik profiles.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

export const dynamic = 'force-dynamic'

/* Chat ID Telegram: personal = angka (mis. 123456789), grup/channel
   = negatif (mis. -1001234567890). 4–32 digit cukup longgar. */
const CHAT_ID_RE = /^-?\d{4,32}$/

function admin() {
  const supabase = getSupabaseAdmin()
  if (!supabase) throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diset — cek Cloudflare → Variables & Secrets')
  return supabase
}

/* ---------- GET: status koneksi + userId (untuk deep link) ---------- */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth?.user || !auth.client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = auth.user.id

    /* userId TIDAK butuh DB — berasal dari sesi login sendiri. Supaya
       deep link t.me/luxtradeebot?start=<USER_ID> tetap berfungsi
       meski migrasi kolom belum dijalankan / service role bermasalah,
       kegagalan baca chat id di-degrade jadi `warning` (bukan error). */
    let chatId = ''
    let warning: string | null = null

    /* Prioritas: service role → client user sendiri (RLS select own) */
    const supabase = getSupabaseAdmin() || auth.client
    const { data, error } = await supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      const colMissing = error.code === 'PGRST204' || /column/i.test(error.message || '')
      warning = colMissing
        ? 'Kolom telegram_chat_id belum ada — jalankan SQL ALTER TABLE dulu (lihat chat Bos). Sementara status koneksi belum bisa ditampilkan, tapi tombol hubungkan tetap aktif.'
        : error.message.slice(0, 140)
    } else {
      chatId = String(data?.telegram_chat_id || '').trim()
    }

    return NextResponse.json({
      userId,
      chatId: chatId || null,
      chatBound: !!chatId,
      warning,
    })
  } catch (x: any) {
    return NextResponse.json({ error: String(x?.message || x).slice(0, 160) }, { status: 500 })
  }
}

/* ---------- PUT: simpan / hapus ---------- */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = auth.user.id

    const body = await request.json().catch(() => null) as { chatId?: string } | null
    const raw = String(body?.chatId ?? '').trim()
    if (raw && !CHAT_ID_RE.test(raw)) {
      return NextResponse.json(
        { error: 'Format Chat ID tidak valid — harus angka saja (contoh: 123456789). Chat @userinfobot di Telegram untuk melihat ID-mu.' },
        { status: 400 },
      )
    }

    const value = raw || null // "" = hapus binding
    const { error } = await admin()
      .from('profiles')
      .update({ telegram_chat_id: value, updated_at: new Date().toISOString() })
      .eq('id', userId)
    if (error) {
      const colMissing = error.code === 'PGRST204' || /column/i.test(error.message || '')
      return NextResponse.json(
        { error: colMissing ? 'Kolom telegram_chat_id belum ada — jalankan SQL ALTER TABLE dulu (lihat chat Bos / docs/SUPABASE_QUOTA_TABLES.sql)' : error.message.slice(0, 140) },
        { status: 500 },
      )
    }
    return NextResponse.json({ ok: true, chatId: value, chatBound: !!value })
  } catch (x: any) {
    return NextResponse.json({ error: String(x?.message || x).slice(0, 160) }, { status: 500 })
  }
}
