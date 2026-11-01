import { NextRequest, NextResponse } from 'next/server'
import { createAdminClientAsync } from '@/lib/supabase/admin'
import { isUserPro } from '@/lib/pro-check'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { requireAdmin } from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, endpoint, p256dh, auth, userAgent } = body

    if (!userId || !endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // P0 HARDENING: verifikasi identitas — dulu siapapun bisa menanam
    // subscription push untuk user APAPUN (cukup tahu userId-nya).
    // Sekarang: hanya boleh untuk diri sendiri, kecuali admin.
    const authResult = await getAuthenticatedUser(req)
    if (!authResult.user) {
      return NextResponse.json({ error: 'Unauthorized — login dulu untuk mengaktifkan notifikasi' }, { status: 401 })
    }
    if (authResult.user.id !== userId) {
      const { error: adminErr } = await requireAdmin(req)
      if (adminErr) {
        return NextResponse.json({ error: 'Forbidden — hanya bisa subscribe untuk akun sendiri' }, { status: 403 })
      }
    }

    // Verify user is Pro — push notifications require a Pro account
    const proStatus = await isUserPro(userId)
    if (!proStatus) {
      return NextResponse.json(
        { error: 'Push notifications require a Pro account' },
        { status: 403 }
      )
    }

    // Use Supabase admin client (service role) — Prisma is NOT available on
    // Cloudflare Workers (its engine requires fs.readdir). The admin client
    // bypasses RLS and works in edge/worker runtimes.
    const adminClient = await createAdminClientAsync()
    if (!adminClient) {
      console.error('[push/subscribe] Supabase admin client unavailable — service role key missing')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Upsert — if endpoint already exists, update keys & userId
    const { data: subscription, error: upsertErr } = await adminClient
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'endpoint' })
      .select()
      .single()

    if (upsertErr) {
      console.error('[push/subscribe] Upsert failed:', upsertErr.message)
      return NextResponse.json({ error: 'Failed to save subscription', detail: upsertErr.message }, { status: 500 })
    }

    // FIX STALE-DUPLICATE (rotasi token iOS): Apple me-rotate endpoint push
    // (reinstall PWA / app di-swipe-kill / update iOS) → endpoint baru =
    // baris baru (upsert onConflict endpoint), endpoint LAMA tetap numpuk.
    // Push ke endpoint lama ditelan Apple diam-diam → "sent>0" tapi HP kosong.
    // Device yang sama teridentifikasi dari user_agent yang persis identik →
    // semua endpoint lain milik UA itu dibuang. Aman utk desktop juga
    // (rotasi Chrome jarang, tapi bila terjadi logikanya sama).
    if (userAgent) {
      const { data: sameDevice, error: listErr } = await adminClient
        .from('push_subscriptions')
        .select('endpoint')
        .eq('user_id', userId)
        .eq('user_agent', userAgent)
        .neq('endpoint', endpoint)
      if (!listErr && sameDevice && sameDevice.length > 0) {
        const stale = sameDevice.map((r: { endpoint: string }) => r.endpoint)
        await adminClient
          .from('push_subscriptions')
          .delete()
          .in('endpoint', stale)
        console.log(`[push/subscribe] Cleanup ${stale.length} stale endpoint(s) dari device yang sama`)
      }
    }

    return NextResponse.json({ success: true, id: subscription?.id })
  } catch (error: any) {
    console.error('[push/subscribe] Error:', error.message)
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }
}
