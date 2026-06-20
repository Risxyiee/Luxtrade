import { NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClientForApi()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated', authError: authError?.message })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, plan, is_pro, subscription_until, proExpiry, full_name')
      .eq('id', user.id)
      .single()

    const now = new Date()
    const subUntil = profile?.subscription_until ? new Date(profile.subscription_until) : null
    const isValid = subUntil ? subUntil > now : false

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      profile,
      debug: {
        now: now.toISOString(),
        subscription_until_raw: profile?.subscription_until,
        subscription_until_parsed: subUntil?.toISOString(),
        is_valid: isValid,
        isProComputed: profile?.is_pro && isValid
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
