import { NextRequest, NextResponse } from 'next/server'
import { createAdminClientAsync } from '@/lib/supabase/admin'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { endpointTail, platformOf } from '@/lib/push-tail'

/**
 * GET /api/push/devices — daftar perangkat push milik user (FASE 5 debug).
 *
 * Kenapa perlu: kasus "notif gak muncul di HP padahal toggle hijau" nyaris
 * selalu = token HP tidak ada / basi di DB, sementara push dikirim ke token
 * device LAIN (desktop). Tanpa daftar ini, mustahil user tahu token HP-nya
 * benar-benar terdaftar. UI (NotificationSetup) menampilkan daftarnya
 * → Bos langsung lihat: "iPhone ✗ tidak ada → toggle di HP-nya ulang".
 */

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = await createAdminClientAsync()
    if (!adminClient) {
      console.error('[push/devices] Supabase admin client unavailable')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { data, error } = await adminClient
      .from('push_subscriptions')
      .select('endpoint, user_agent, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('[push/devices] Fetch failed:', error.message)
      return NextResponse.json({ error: 'Gagal membaca data perangkat' }, { status: 500 })
    }

    const devices = (data || []).map((s: { endpoint: string; user_agent?: string | null; created_at?: string | null; updated_at?: string | null }) => ({
      ep: endpointTail(s.endpoint),
      platform: platformOf(s.endpoint),
      ua: (s.user_agent || '').slice(0, 120),
      created: s.created_at || null,
      updated: s.updated_at || null,
    }))

    return NextResponse.json({ devices, total: devices.length })
  } catch (error: any) {
    console.error('[push/devices] Error:', error?.message)
    return NextResponse.json({ error: 'Gagal membaca data perangkat' }, { status: 500 })
  }
}
