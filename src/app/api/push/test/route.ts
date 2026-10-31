import { NextRequest, NextResponse } from 'next/server'
import { createAdminClientAsync } from '@/lib/supabase/admin'
import { sendPushToUser, type PushPayload } from '@/lib/web-push'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/push/test — kirim notifikasi push TES ke diri sendiri (FASE 5A).
 *
 * Latar: infra push sudah lengkap sejak lama (subscribe, sw.js handler,
 * 3 cron pengirim) tapi TIDAK PERNAH punya cara buat user memverifikasi
 * notif benar-benar sampai ke HP-nya — makanya Bos menyimpulkan
 * "notifikasi gabisa". Endpoint ini menutup lubang itu.
 *
 * Desain:
 *   • Auth WAJIB (getAuthenticatedUser) — kirim ke DIRI SENDIRI saja,
 *     tidak ada parameter userId (beda dengan /api/push/send yang
 *     khusus cron/admin).
 *   • Rate limit per-IP 5/menit (anti spam push).
 *   • Tanpa cek Pro eksplisit: user free memang tidak punya subscription
 *     (endpoint subscribe menolaknya) → otomatis dapat jawaban jujur
 *     "belum ada perangkat terdaftar".
 *   • Subscription expired (410/404) ikut dibersihkan.
 */

export async function POST(request: NextRequest) {
  const limited = checkRateLimit(request, 'push-test', {
    maxRequests: 5,
    windowMs: 60_000,
    message: 'Terlalu banyak tes notifikasi — tunggu satu menit lagi.',
  }, 'ip')
  if (limited) return limited

  try {
    const { user } = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized — login dulu untuk mengirim notifikasi tes' },
        { status: 401 }
      )
    }
    const userId = user.id

    const adminClient = await createAdminClientAsync()
    if (!adminClient) {
      console.error('[push/test] Supabase admin client unavailable')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Semua perangkat milik user INI saja
    const { data: subscriptions, error: subErr } = await adminClient
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (subErr) {
      console.error('[push/test] Fetch subscriptions failed:', subErr.message)
      return NextResponse.json({ error: 'Gagal membaca data perangkat' }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        sent: 0,
        total: 0,
        message: 'Belum ada perangkat terdaftar — aktifkan notifikasi dulu.',
      })
    }

    const payload: PushPayload = {
      title: '🔔 Notifikasi Tes — LuxTradee',
      body: 'Mantap! Notifikasi HP-mu aktif. Alert trade & price alert bakal masuk ke sini.',
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      url: '/dashboard',
      tag: 'push-test',
      type: 'general',
    }

    const result = await sendPushToUser(subscriptions, payload)

    // Bersihkan HANYA subscription yang benar-benar mati (410/404).
    // FIX F5: dulu SEMUA kegagalan dianggap expired → subscription hidup
    // ikut terhapus → tes berikutnya selalu "Belum ada perangkat" (loop neraka).
    if (result.expired.length > 0) {
      await adminClient
        .from('push_subscriptions')
        .delete()
        .in('endpoint', result.expired)
    }

    const total = subscriptions.length
    const failedCount = result.failed.length
    if (failedCount > 0) {
      console.error(`[push/test] user=${userId} failures:`, result.errors.slice(0, 3))
    }

    // reason = penyebab sent=0, biar client & Bos tahu LANGKAH BERIKUTNYA
    let reason: 'ok' | 'no_devices' | 'devices_expired' | 'send_failed'
    if (result.sent > 0) {
      reason = 'ok'
    } else if (total === 0) {
      reason = 'no_devices'
    } else if (failedCount === 0 && result.expired.length > 0) {
      reason = 'devices_expired' // semua perangkat mati → client bakal resync otomatis
    } else {
      reason = 'send_failed' // server push-nya yang bermasalah → resync gak akan nolong
    }

    console.log(`[push/test] user=${userId} sent=${result.sent}/${total} expired=${result.expired.length} failed=${failedCount} reason=${reason}`)
    return NextResponse.json({
      sent: result.sent,
      expired: result.expired.length,
      failed: failedCount,
      total,
      reason,
      message: result.sent > 0
        ? 'Notifikasi tes terkirim — cek HP kamu!'
        : reason === 'send_failed'
          ? 'Server belum bisa mengirim push — bukan salah perangkatmu.'
          : 'Belum ada perangkat valid — coba matikan lalu aktifkan lagi notifikasinya.',
    })
  } catch (error: any) {
    console.error('[push/test] Error:', error.message)
    return NextResponse.json({ error: 'Gagal mengirim notifikasi tes' }, { status: 500 })
  }
}
