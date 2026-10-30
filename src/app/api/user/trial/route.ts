import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
// P1 lanjutan (2026-10-30): ASYNC admin client — pola PREFERRED utk CF Workers
// (proses env dari process.env DAN CF ctx.env), senada dgn fix /api/contact.
import { getSupabaseAdminAsync } from '@/lib/supabase-admin-alt'

/**
 * Trial PRO 7 hari — SERVER-SIDE (P1 fix).
 * Dulu trial disimpan di localStorage ('luxtrade_pro_trial_started_at') —
 * gampang dibypass (hapus localStorage = trial tak terbatas) dan hilang
 * saat ganti device. Sekarang state trial tersimpan di kolom
 * profiles.trial_started_at (per user, satu-satunya sumber kebenaran).
 *
 * GET  → status trial user yang login
 * POST → mulai trial (sekali seumur akun; kalau sudah pernah → 409)
 */

export const TRIAL_DAYS = 7

function trialPayload(trialStartedAt: string | null) {
  if (!trialStartedAt) {
    return { trialStartedAt: null, trialEndsAt: null, trialActive: false, trialUsed: false }
  }
  const start = new Date(trialStartedAt)
  const end = new Date(start)
  end.setDate(end.getDate() + TRIAL_DAYS)
  return {
    trialStartedAt: start.toISOString(),
    trialEndsAt: end.toISOString(),
    trialActive: end.getTime() > Date.now(),
    trialUsed: true,
  }
}

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = await getSupabaseAdminAsync()
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const { data, error } = await admin
    .from('profiles')
    .select('trial_started_at')
    .eq('id', auth.user.id)
    .single()

  if (error && (error as { code?: string }).code !== 'PGRST116') {
    // PGRST116 = row tidak ditemukan → biarkan dianggap belum mulai trial
    console.error('[user/trial] read failed:', error.message)
    return NextResponse.json({ error: 'Gagal membaca status trial' }, { status: 500 })
  }

  return NextResponse.json(trialPayload(data?.trial_started_at ?? null))
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = await getSupabaseAdminAsync()
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  // Atomic: update ... where trial_started_at is null returning → anti
  // double-start walau double-click / dua tab bersamaan.
  const { data, error } = await admin
    .from('profiles')
    .update({ trial_started_at: new Date().toISOString() })
    .eq('id', auth.user.id)
    .is('trial_started_at', null)
    .select('trial_started_at')
    .single()

  if (error || !data) {
    // Sudah pernah mulai trial (atau race) → kembalikan status saat ini
    const { data: existing } = await admin
      .from('profiles')
      .select('trial_started_at')
      .eq('id', auth.user.id)
      .single()

    return NextResponse.json(
      { ...trialPayload(existing?.trial_started_at ?? null), alreadyStarted: true },
      { status: 200 }
    )
  }

  return NextResponse.json({ ...trialPayload(data.trial_started_at), alreadyStarted: false })
}
