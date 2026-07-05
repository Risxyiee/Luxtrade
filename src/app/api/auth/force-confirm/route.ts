import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getSupabaseAdminAuthFromClient } from '@/lib/supabase'

/**
 * POST /api/auth/force-confirm
 * Body: { email: string }
 *
 * If a user exists in Supabase Auth but their email is NOT confirmed,
 * force-confirm them. This handles the case where our custom verification
 * system confirmed the user in the profiles DB but `email_confirm: true`
 * failed in Supabase Auth (or was never called).
 *
 * Returns { confirmed: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ confirmed: false }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ confirmed: false }, { status: 500 })
    }

    const authAdmin = getSupabaseAdminAuthFromClient()
    if (!authAdmin) {
      return NextResponse.json({ confirmed: false }, { status: 500 })
    }

    // List users to find by email
    const { data: { users }, error: listErr } = await authAdmin.listUsers({
      page: 1,
      perPage: 1000,
    })

    if (listErr || !users) {
      console.warn('[force-confirm] listUsers error:', listErr?.message)
      return NextResponse.json({ confirmed: false })
    }

    const user = users.find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    )

    if (!user) {
      // No user found — not our job
      return NextResponse.json({ confirmed: false })
    }

    // Already confirmed — nothing to do
    if (user.email_confirmed_at) {
      return NextResponse.json({ confirmed: true })
    }

    // Force confirm
    const { error: updateErr } = await authAdmin.updateUserById(user.id, {
      email_confirm: true,
    })

    if (updateErr) {
      console.error('[force-confirm] updateUserById error:', updateErr.message)
      return NextResponse.json({ confirmed: false })
    }

    console.log(`✅ [force-confirm] Confirmed user ${user.email} (${user.id})`)
    return NextResponse.json({ confirmed: true })
  } catch (err: any) {
    console.error('[force-confirm] error:', err)
    return NextResponse.json({ confirmed: false })
  }
}