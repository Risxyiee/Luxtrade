import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { db } from '@/lib/db'

// Simple promo apply - no middleware, no edge runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', hint: 'Send { "promoCode": "TRADERCEPAT", "plan": "PRO" }' },
        { status: 400 }
      )
    }

    const code = body.promoCode || body.promo_code || body.code
    const plan = body.plan || 'PRO'

    console.log('🎯 [Simple Promo] Body:', JSON.stringify(body))
    console.log('🎯 [Simple Promo] code:', code, 'plan:', plan)

    if (!code) {
      return NextResponse.json(
        { error: 'promoCode is required', received: Object.keys(body) },
        { status: 400 }
      )
    }

    // Get user from session
    const { supabase } = createClientForApi(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message },
        { status: 401 }
      )
    }

    const userId = user.id
    const normalizedCode = code.trim().toUpperCase()

    // Get promo code
    const promoCode = await db.promoCode.findUnique({
      where: { code: normalizedCode }
    })

    if (!promoCode) {
      return NextResponse.json({ success: false, message: 'Kode promo tidak valid' })
    }

    if (!promoCode.isActive) {
      return NextResponse.json({ success: false, message: 'Kode promo tidak aktif' })
    }

    if (promoCode.usedQuota >= promoCode.maxQuota) {
      return NextResponse.json({ success: false, message: 'Kuota kode promo sudah habis' })
    }

    // Check existing
    const existing = await db.userSubscription.findFirst({
      where: { userId, promoCodeId: promoCode.id, status: 'active' }
    })

    if (existing) {
      return NextResponse.json({ success: false, message: 'Anda sudah menggunakan kode promo ini' })
    }

    // Create subscription
    const startDate = new Date()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + promoCode.durationMonths)

    const subscription = await db.userSubscription.create({
      data: {
        userId,
        plan,
        status: 'active',
        startDate,
        endDate,
        promoCodeId: promoCode.id,
        discountPercent: promoCode.discountPercent
      }
    })

    // Update quota
    await db.promoCode.update({
      where: { id: promoCode.id },
      data: { usedQuota: promoCode.usedQuota + 1 }
    })

    // Update profile
    try {
      await db.profile.update({
        where: { id: userId },
        data: {
          plan: 'PRO',
          is_pro: true,
          subscription_until: endDate,
          proExpiry: endDate
        }
      })
    } catch (e: any) {
      console.warn('⚠️ [Simple Promo] Could not update profile:', e.message)
    }

    return NextResponse.json({
      success: true,
      message: `Kode promo berhasil! Anda mendapatkan akses ${plan} selama ${promoCode.durationMonths} bulan.`,
      subscription: {
        id: subscription.id,
        plan: subscription.plan,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate
      },
      promoCode: {
        code: promoCode.code,
        remainingQuota: promoCode.maxQuota - (promoCode.usedQuota + 1)
      }
    })
  } catch (error: any) {
    console.error('❌ [Simple Promo] Error:', error)
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    )
  }
}