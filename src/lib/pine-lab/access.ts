/**
 * ============================================================
 * pine-lab/access.ts — GERBANG FEATURE FLAG (spek item 2 & 7)
 * ============================================================
 * Halaman & API /pine-lab hanya untuk user dengan flag
 * `pine_lab` (tabel user_flags — seed akun admin Bos di SQL).
 *
 * SEMUA route pine-lab WAJIB lewat sini:
 *   const gate = await requirePineLab(request)
 *   if (gate instanceof NextResponse) return gate
 *   const { user, admin } = gate
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { PINE_LAB_FLAG } from './config'
import type { User, SupabaseClient } from '@supabase/supabase-js'

export interface PineLabGate {
  user: User
  /** Service-role client (bypass RLS) — SELALU filter .eq('user_id', user.id). */
  admin: SupabaseClient
}

/**
 * Auth + flag check. Mengembalikan NextResponse error (401/403/500)
 * atau objek gate. Pola: `if (gate instanceof NextResponse) return gate`.
 */
export async function requirePineLab(
  request: NextRequest
): Promise<NextResponse | PineLabGate> {
  const { user } = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized — login dulu.' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  let allowed = false
  try {
    const { data, error } = await admin
      .from('user_flags')
      .select('flag')
      .eq('user_id', user.id)
      .eq('flag', PINE_LAB_FLAG)
      .maybeSingle()
    allowed = !error && !!data
  } catch {
    allowed = false
  }

  if (!allowed) {
    return NextResponse.json(
      { error: 'Forbidden — fitur Pine Lab belum dibuka untuk akun ini.' },
      { status: 403 }
    )
  }

  return { user, admin }
}

/** Cek flag tanpa auth (untuk UI page yang menampilkan pesan berbeda). */
export async function hasPineLabFlag(userId: string): Promise<boolean> {
  const admin = getSupabaseAdmin()
  if (!admin) return false
  try {
    const { data, error } = await admin
      .from('user_flags')
      .select('flag')
      .eq('user_id', userId)
      .eq('flag', PINE_LAB_FLAG)
      .maybeSingle()
    return !error && !!data
  } catch {
    return false
  }
}
