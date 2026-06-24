import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { db, ensureSchema } from '@/lib/db'

/**
 * Apply promo code to user subscription
 * POST /api/promo/apply
 * Body: { promoCode: string, plan?: string }
 */
export async function POST(request: NextRequest) {
  try {
    await ensureSchema()
    const body = await request.json()
    console.log('🔍 [Promo Apply] Request body:', JSON.stringify(body))

    const { promoCode: code, plan } = body
    console.log('🔍 [Promo Apply] Extracted - code:', code, 'plan:', plan)

    // Get authenticated user from session
    const { supabase } = createClientForApi(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    console.log('🔍 [Promo Apply] Auth result:', { user, authError })

    if (authError || !user) {
      console.error('❌ [Promo Apply] Unauthorized:', authError)
      return NextResponse.json(
        { error: 'Unauthorized. Please login first.' },
        { status: 401 }
      )
    }

    const userId = user.id
    console.log('🔍 [Promo Apply] User ID (UUID):', userId)

    if (!code || !plan) {
      console.error('❌ [Promo Apply] Missing required fields - code:', code, 'plan:', plan)
      return NextResponse.json(
        { error: 'promoCode and plan are required' },
        { status: 400 }
      )
    }

    // Normalize code to uppercase
    const normalizedCode = code.trim().toUpperCase()

    // Validate promo code
    const promoCode = await db.promoCode.findUnique({
      where: { code: normalizedCode }
    })

    if (!promoCode) {
      return NextResponse.json({
        success: false,
        message: 'Kode promo tidak valid'
      })
    }

    // Validate promo code status
    if (!promoCode.isActive) {
      return NextResponse.json({
        success: false,
        message: 'Kode promo tidak aktif'
      })
    }

    // Check quota
    if (promoCode.usedQuota >= promoCode.maxQuota) {
      return NextResponse.json({
        success: false,
        message: 'Kuota kode promo sudah habis'
      })
    }

    // Check if promo code has expired
    const now = new Date()
    if (promoCode.endDate && now > promoCode.endDate) {
      return NextResponse.json({
        success: false,
        message: 'Kode promo sudah kadaluarsa'
      })
    }

    // Check if promo code has started
    if (now < promoCode.startDate) {
      return NextResponse.json({
        success: false,
        message: 'Kode promo belum aktif'
      })
    }

    // Check if user already has an active subscription with this promo code
    const existingSubscription = await db.userSubscription.findFirst({
      where: {
        userId,
        promoCodeId: promoCode.id,
        status: 'active'
      }
    })

    if (existingSubscription) {
      return NextResponse.json({
        success: false,
        message: 'Anda sudah menggunakan kode promo ini sebelumnya'
      })
    }

    // Calculate end date based on duration months
    const startDate = new Date()
    const months = promoCode.durationMonths || 3
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + months, startDate.getDate(), 23, 59, 59, 999)

    // Create new subscription with promo code
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

    // Increment used quota for promo code
    await db.promoCode.update({
      where: { id: promoCode.id },
      data: {
        usedQuota: promoCode.usedQuota + 1
      }
    })

    // Update user profile to Pro (Prisma - source of truth)
    await db.profile.update({
      where: { id: userId },
      data: {
        plan: 'PRO',
        is_pro: true,
        subscription_until: endDate,
        proExpiry: endDate
      }
    })

    // Also update Supabase Auth user_metadata to keep admin panel in sync
    try {
      const { supabaseAdmin: adminClient } = await import('@/lib/supabase-admin-alt')
      if (adminClient) {
        const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(userId)
        const currentMeta = authUser?.user_metadata || {}
        await adminClient.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...currentMeta,
            is_pro: true,
            subscription_status: 'active',
            subscription_until: endDate.toISOString(),
            has_ever_been_pro: true,
            updated_at: new Date().toISOString()
          }
        })
        console.log('✅ [Promo Apply] Also synced Auth metadata')
      }
    } catch (syncErr) {
      console.warn('⚠️ [Promo Apply] Failed to sync Auth metadata (non-critical):', syncErr)
    }

    const remainingQuota = promoCode.maxQuota - (promoCode.usedQuota + 1)

    return NextResponse.json({
      success: true,
      message: `Kode promo berhasil diterapkan! Anda mendapatkan akses ${plan} selama ${promoCode.durationMonths} bulan.`,
      subscription: {
        id: subscription.id,
        plan: subscription.plan,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        discountPercent: subscription.discountPercent
      },
      promoCode: {
        code: promoCode.code,
        remainingQuota
      }
    })
  } catch (error: any) {
    console.error('❌ [Apply Promo Code] Error:', error)
    console.error('❌ [Apply Promo Code] Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      meta: error.meta
    })
    return NextResponse.json(
      {
        error: 'Gagal menerapkan kode promo',
        details: error.message,
        name: error.name,
        code: error.code || 'UNKNOWN'
      },
      { status: 500 }
    )
  }
}