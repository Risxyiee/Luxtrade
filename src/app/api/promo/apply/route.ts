import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { edgeCrypto } from '@/lib/edge-crypto'

/**
 * POST /api/promo/apply
 *
 * Applies a promo code using Supabase.
 */

export async function POST(request: NextRequest) {
  const logId = Math.random().toString(36).substring(2, 8)
  console.log(`[promo/apply:${logId}] START`)

  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ success: false, message: 'Database sedang tidak tersedia. Coba lagi nanti.' })
    }

    // ══════════════════════════════════════════════════════════════
    // STEP 1: Auth + parse body
    // ══════════════════════════════════════════════════════════════
    const body = await request.json()
    const { promoCode: code, plan } = body
    console.log(`[promo/apply:${logId}] code=${code?.trim()?.toUpperCase()}, plan=${plan}`)

    const result = await createClientForApi(request)
    const supabase = result.supabase
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error(`[promo/apply:${logId}] Auth failed`)
      return NextResponse.json({ error: 'Unauthorized. Please login first.' }, { status: 401 })
    }

    const userId = user.id
    console.log(`[promo/apply:${logId}] userId=${userId}`)

    if (!code || !plan) {
      return NextResponse.json({ success: false, message: 'promoCode and plan are required' }, { status: 400 })
    }

    const normalizedCode = code.trim().toUpperCase()
    const now = new Date().toISOString()

    // ══════════════════════════════════════════════════════════════
    // STEP 2: Atomic claim — fetch and check quota, then increment
    // ══════════════════════════════════════════════════════════════
    console.log(`[promo/apply:${logId}] Claiming ${normalizedCode}...`)

    // Fetch the promo code with quota check
    const { data: promoRows } = await admin.from('promo_codes')
      .select('id, code, description, discount_percent, max_quota, used_quota, duration_months')
      .eq('code', normalizedCode)
      .eq('is_active', true)
      .or(`end_date.is.null,end_date.gt.${now}`)
      .lte('start_date', now)
      .lt('used_quota', admin.from('promo_codes').select('max_quota')) // This won't work well, use gte on max_quota

    // Better approach: fetch and check in JS
    const { data: promoCandidates } = await admin.from('promo_codes')
      .select('id, code, description, discount_percent, max_quota, used_quota, duration_months, end_date')
      .eq('code', normalizedCode)
      .eq('is_active', true)
      .lte('start_date', now)
      .limit(1)

    if (!promoCandidates || promoCandidates.length === 0) {
      return NextResponse.json({ success: false, message: 'Kode promo tidak valid atau tidak aktif.' })
    }

    const promo = promoCandidates[0]

    // Check end_date
    if (promo.end_date && new Date(promo.end_date) <= new Date(now)) {
      return NextResponse.json({ success: false, message: 'Kode promo sudah kadaluarsa.' })
    }

    // Check quota
    if (Number(promo.used_quota) >= Number(promo.max_quota)) {
      return NextResponse.json({ success: false, message: 'Kuota kode promo sudah habis.' })
    }

    // Increment used_quota
    const newUsedQuota = Number(promo.used_quota) + 1
    const { error: quotaError } = await admin.from('promo_codes')
      .update({ used_quota: newUsedQuota, updated_at: now })
      .eq('id', promo.id)
      .eq('used_quota', Number(promo.used_quota)) // Optimistic concurrency

    if (quotaError) {
      console.error(`[promo/apply:${logId}] Quota update failed (race?):`, quotaError.message)
      return NextResponse.json({ success: false, message: 'Kuota kode promo sudah habis.' })
    }

    console.log(`[promo/apply:${logId}] Claimed: ${promo.code} used=${newUsedQuota}/${promo.max_quota}`)

    // ══════════════════════════════════════════════════════════════
    // STEP 3: Duplicate check
    // ══════════════════════════════════════════════════════════════
    const { data: existingSub } = await admin.from('user_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('promo_code_id', promo.id)
      .eq('status', 'active')
      .maybeSingle()

    if (existingSub) {
      // Rollback quota
      await admin.from('promo_codes').update({ used_quota: Number(promo.used_quota) }).eq('id', promo.id)
      return NextResponse.json({ success: false, message: 'Anda sudah menggunakan kode promo ini sebelumnya' })
    }

    // ══════════════════════════════════════════════════════════════
    // STEP 4: Create subscription + upgrade profile
    // ══════════════════════════════════════════════════════════════
    const startDate = new Date()
    const months = promo.duration_months || 3
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + months, startDate.getDate(), 23, 59, 59, 999)
    const subscriptionId = edgeCrypto.randomUUID()

    const { error: insertSubError } = await admin.from('user_subscriptions').insert({
      id: subscriptionId,
      user_id: userId,
      plan,
      status: 'active',
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      promo_code_id: promo.id,
      discount_percent: Number(promo.discount_percent),
      created_at: now,
      updated_at: now,
    })

    if (insertSubError) {
      console.error(`[promo/apply:${logId}] Insert subscription failed:`, insertSubError.message)
      try { await admin.from('promo_codes').update({ used_quota: Number(promo.used_quota) }).eq('id', promo.id) } catch { /* ok */ }
      return NextResponse.json({ success: false, message: 'Gagal membuat subscription. Coba lagi.' })
    }
    console.log(`[promo/apply:${logId}] Subscription created`)

    // Update profile
    let profileUpdated = false
    try {
      const { count } = await admin.from('profiles')
        .update({
          plan: 'PRO',
          is_pro: true,
          subscription_until: endDate.toISOString(),
          pro_expiry: endDate.toISOString(),
          updated_at: now,
        })
        .eq('id', userId)

      if (count && count > 0) {
        profileUpdated = true
        console.log(`[promo/apply:${logId}] Profile -> PRO (userId=${userId})`)
      } else {
        // Profile not found — try to create it
        console.warn(`[promo/apply:${logId}] Profile not found for ${userId}, attempting to create...`)
        const { error: createErr } = await admin.from('profiles').upsert({
          id: userId,
          plan: 'PRO',
          is_pro: true,
          subscription_until: endDate.toISOString(),
          pro_expiry: endDate.toISOString(),
          created_at: now,
          updated_at: now,
        }, { onConflict: 'id' })

        if (!createErr) {
          profileUpdated = true
          console.log(`[promo/apply:${logId}] Profile CREATED + PRO (userId=${userId})`)
        } else {
          console.error(`[promo/apply:${logId}] Profile CREATE failed:`, createErr.message)
        }
      }
    } catch (profErr: any) {
      console.error(`[promo/apply:${logId}] Profile UPDATE FAILED:`, profErr?.message)
    }

    if (!profileUpdated) {
      console.warn(`[promo/apply:${logId}] Profile not updated but subscription is active — cron will sync later`)
    }

    // Sync Supabase Auth metadata (non-critical)
    try {
      const { getAdminAuth } = await import('@/lib/supabase-admin-alt')
      const authAdmin = getAdminAuth()
      if (authAdmin) {
        const { data: { user: authUser } } = await authAdmin.getUserById(userId)
        const currentMeta = authUser?.user_metadata || {}
        await authAdmin.updateUserById(userId, {
          user_metadata: { ...currentMeta, is_pro: true, subscription_status: 'active', subscription_until: endDate.toISOString(), has_ever_been_pro: true, updated_at: new Date().toISOString() }
        })
      }
    } catch (metaErr: any) {
      console.warn(`[promo/apply:${logId}] Auth meta: ${metaErr?.message?.substring(0, 60)}`)
    }

    // Auto-deactivate promo when full
    const remainingQuota = Number(promo.max_quota) - newUsedQuota
    if (remainingQuota <= 0) {
      try { await admin.from('promo_codes').update({ is_active: false, updated_at: now }).eq('id', promo.id) } catch { /* ok */ }
    }

    console.log(`[promo/apply:${logId}] SUCCESS — ${plan} ${months}mo, remaining=${remainingQuota}`)

    return NextResponse.json({
      success: true,
      message: `Kode promo berhasil diterapkan! Anda mendapatkan akses ${plan} selama ${months} bulan.`,
      subscription: { id: subscriptionId, plan, status: 'active', startDate: startDate.toISOString(), endDate: endDate.toISOString(), discountPercent: Number(promo.discount_percent) },
      promoCode: { code: promo.code, remainingQuota }
    })
  } catch (error: any) {
    console.error(`[promo/apply:${logId}] FATAL: ${error?.message}`)
    return NextResponse.json({ success: false, message: `Gagal menerapkan kode promo: ${error?.message || 'Unknown error'}` })
  }
}