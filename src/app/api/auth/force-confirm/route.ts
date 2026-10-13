import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { getSupabaseAdminAuth } from '@/lib/supabase/admin'

/**
 * POST /api/auth/force-confirm
 * Body: { email: string }
 *
 * If a user exists in Supabase Auth but their email is NOT confirmed,
 * force-confirm them. This handles the case where our custom verification
 * system confirmed the user in the profiles DB but `email_confirm: true`
 * failed in Supabase Auth (or was never called).
 *
 * Lookup strategy (fast → slow):
 * 1. Query Supabase profiles table by email to get user ID
 * 2. Then call updateUserById to confirm
 *
 * Returns { confirmed: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ confirmed: false }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ confirmed: false }, { status: 500 })
    }

    const authAdmin = getSupabaseAdminAuth(admin as any)
    if (!authAdmin) {
      return NextResponse.json({ confirmed: false }, { status: 500 })
    }

    const emailLower = email.toLowerCase()
    let userId: string | null = null

    // Strategy 1: Get user ID from Supabase profiles table
    try {
      const { data } = await admin
        .from('profiles')
        .select('id')
        .eq('email', emailLower)
        .limit(1)
        .single()
      if (data?.id) userId = data.id
    } catch { /* ignore */ }

    // Strategy 2: Last resort — listUsers (slow)
    if (!userId) {
      try {
        const { data: { users }, error: listErr } = await authAdmin.listUsers({
          page: 1,
          perPage: 1000,
        })
        if (!listErr && users) {
          const found = users.find(
            (u: any) => u.email?.toLowerCase() === emailLower
          )
          if (found) userId = found.id
        }
      } catch { /* ignore */ }
    }

    if (!userId) {
      return NextResponse.json({ confirmed: false })
    }

    // Check current confirmation status
    try {
      const { data: userData } = await authAdmin.getUserById(userId)
      if (userData?.email_confirmed_at) {
        return NextResponse.json({ confirmed: true })
      }
    } catch { /* will try to confirm anyway */ }

    // Force confirm the user
    const { error: updateErr } = await authAdmin.updateUserById(userId, {
      email_confirm: true,
    })

    if (updateErr) {
      console.error('[force-confirm] updateUserById error:', updateErr.message)
      return NextResponse.json({ confirmed: false })
    }

    console.log(`✅ [force-confirm] Confirmed user ${emailLower} (${userId})`)
    return NextResponse.json({ confirmed: true })
  } catch (err: any) {
    console.error('[force-confirm] error:', err)
    return NextResponse.json({ confirmed: false })
  }
}
