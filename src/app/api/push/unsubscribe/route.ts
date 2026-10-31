import { NextRequest, NextResponse } from 'next/server'
import { createAdminClientAsync } from '@/lib/supabase/admin'
import { getAuthenticatedUser } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { endpoint } = body

    if (!endpoint) {
      return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
    }

    // 🔒 FIX (audit E2E): dulu route ini TANPA AUTH — siapa pun yang tahu
    // URL endpoint push bisa menghapus subscription user lain. Sekarang
    // wajib login & hanya boleh hapus milik sendiri. (Client hook tidak
    // membaca respons ini, jadi UX tidak berubah.)
    const authResult = await getAuthenticatedUser(req)
    if (!authResult.user) {
      return NextResponse.json({ error: 'Unauthorized — login dulu untuk unsubscribe' }, { status: 401 })
    }

    const adminClient = await createAdminClientAsync()
    if (!adminClient) {
      console.error('[push/unsubscribe] Supabase admin client unavailable')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { error: delErr } = await adminClient
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_id', authResult.user.id)

    if (delErr) {
      console.error('[push/unsubscribe] Delete failed:', delErr.message)
      return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[push/unsubscribe] Error:', error.message)
    return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 })
  }
}
