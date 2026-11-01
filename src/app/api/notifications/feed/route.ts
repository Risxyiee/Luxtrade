import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

/**
 * GET/POST /api/notifications/feed — Pusat Notifikasi in-app (Bell dashboard)
 *
 * GET  → 30 notifikasi terbaru milik user + jumlah unread.
 *        Isi = riwayat SEMUA alert otomatis yang dikirim server:
 *        🚨 guard prop firm, 📈 sinyal Pine, 🎯 price alert,
 *        💥 big win/loss/streak/daily-limit, 🌅 reminder harian,
 *        📊 rekap mingguan (ditulis otomatis oleh push-notify.ts).
 * POST → tandai dibaca: { action: 'read-all' } ATAU { id: '<uuid>' }.
 *
 * Tabel: notification_log (SQL 20261101). Belum dijalankan? Degradasi
 * anggun: kembalikan feed kosong — UI tetap jalan.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { user } = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [feedRes, unreadRes] = await Promise.all([
      admin
        .from('notification_log')
        .select('id, title, body, type, url, read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30),
      admin
        .from('notification_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false),
    ])

    // 42P01 (tabel belum ada) dsb → degradasi anggun, bukan 500
    if (feedRes.error) {
      console.warn('[notifications/feed] query gagal (tabel belum ada?):', feedRes.error.message)
      return NextResponse.json({ items: [], unread: 0 })
    }

    return NextResponse.json({
      items: feedRes.data ?? [],
      unread: unreadRes.count ?? 0,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { user } = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))

    if (body?.id) {
      const { error } = await admin
        .from('notification_log')
        .update({ read: true })
        .eq('id', String(body.id))
        .eq('user_id', user.id) // guard: user hanya boleh miliknya
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    } else {
      const { error } = await admin
        .from('notification_log')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
