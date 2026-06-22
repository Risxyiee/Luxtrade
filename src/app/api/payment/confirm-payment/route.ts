import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClientForApi } from '@/lib/supabase/server'
import { checkTransactionStatus, getTransactionHistory } from '@/lib/payment/sakura'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/payment/confirm-payment
 * Body: { invoiceNumber: string }
 *
 * Called when user clicks "Saya Sudah Bayar" button.
 * Actively checks SakuraPay for the real payment status.
 * - If SakuraPay says "berhasil" → mark order SUCCESS + activate subscription
 * - If SakuraPay says "pending" → return pending with message
 * - If SakuraPay unreachable → return current local DB status
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase } = createClientForApi(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { invoiceNumber } = body

    if (!invoiceNumber) {
      return NextResponse.json({ error: 'invoiceNumber is required' }, { status: 400 })
    }

    // Fetch order from DB
    const order = await db.paymentOrder.findUnique({
      where: { invoiceNumber },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // If already SUCCESS, return immediately
    if (order.status === 'SUCCESS') {
      return NextResponse.json({
        success: true,
        status: 'SUCCESS',
        message: 'Pembayaran sudah dikonfirmasi',
        paidAt: order.paidAt?.toISOString() || null,
      })
    }

    // If expired, don't proceed
    if (order.status === 'EXPIRED') {
      return NextResponse.json({
        success: false,
        status: 'EXPIRED',
        message: 'Invoice sudah kedaluwarsa',
      })
    }

    // ===== CHECK SAKURAPAY DIRECTLY =====
    let sakuraStatus: string | null = null
    let sakuraPaymentKode: string | null = null
    let sakuraTrxId: string | null = null

    try {
      // Method 1: Check by trx_id
      if (order.dokuTransactionId) {
        const trxResult = await checkTransactionStatus(order.dokuTransactionId)
        sakuraStatus = trxResult.status
        sakuraTrxId = order.dokuTransactionId
        console.log('✅ [Confirm Payment] SakuraPay trx check:', {
          trxId: order.dokuTransactionId,
          status: sakuraStatus,
        })
      }

      // Method 2: Check by merchant_ref
      if (!sakuraStatus || sakuraStatus === 'pending') {
        const txHistory = await getTransactionHistory({ merchantRef: invoiceNumber })
        if (txHistory.length > 0) {
          const latestTx = txHistory[0]
          sakuraStatus = latestTx.status
          sakuraTrxId = latestTx.trx_id
          sakuraPaymentKode = latestTx.payment_kode
          console.log('✅ [Confirm Payment] SakuraPay history check:', {
            merchantRef: invoiceNumber,
            status: sakuraStatus,
            trx_id: sakuraTrxId,
          })
        }
      }
    } catch (err: any) {
      console.error('❌ [Confirm Payment] SakuraPay check error:', err.message)
      return NextResponse.json({
        success: false,
        status: order.status,
        message: `Gagal terhubung ke SakuraPay: ${err.message}. Coba lagi dalam beberapa saat.`,
        sakuraReachable: false,
      })
    }

    // ===== HANDLE RESULTS =====
    if (sakuraStatus === 'berhasil') {
      // Payment confirmed by SakuraPay! Update local DB
      console.log('🎉 [Confirm Payment] SakuraPay confirms BERHASIL — activating!')

      await db.paymentOrder.update({
        where: { invoiceNumber },
        data: {
          status: 'SUCCESS',
          paidAt: new Date(),
          paymentChannel: sakuraPaymentKode || order.paymentChannel,
          dokuTransactionId: sakuraTrxId || order.dokuTransactionId,
        },
      })

      // Activate subscription
      if (order.userId) {
        await activateSubscription(order.userId, order.plan, order.durationMonths)
      }

      return NextResponse.json({
        success: true,
        status: 'SUCCESS',
        message: 'Pembayaran berhasil dikonfirmasi! Paket sedang diaktifkan...',
        paidAt: new Date().toISOString(),
        sakuraStatus,
      })
    }

    // SakuraPay still says pending
    if (sakuraStatus === 'pending') {
      return NextResponse.json({
        success: false,
        status: 'PENDING',
        message: 'Pembayaran belum terdeteksi oleh SakuraPay. Pastikan pembayaran sudah selesai di halaman SakuraPay.',
        sakuraStatus: 'pending',
        hint: 'Jika sudah bayar, tunggu 1-2 menit lalu coba lagi. QRIS kadang butuh waktu proses.',
      })
    }

    // SakuraPay says expired
    if (sakuraStatus === 'expired') {
      await db.paymentOrder.update({
        where: { invoiceNumber },
        data: { status: 'EXPIRED' },
      })

      return NextResponse.json({
        success: false,
        status: 'EXPIRED',
        message: 'Invoice sudah kedaluwarsa di SakuraPay.',
        sakuraStatus: 'expired',
      })
    }

    // Unknown status from SakuraPay
    return NextResponse.json({
      success: false,
      status: order.status,
      message: `Status dari SakuraPay: "${sakuraStatus || 'tidak ditemukan'}". Hubungi admin untuk bantuan.`,
      sakuraStatus,
    })
  } catch (error: any) {
    console.error('❌ [Confirm Payment] Error:', error.message)
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan saat konfirmasi pembayaran' },
      { status: 500 }
    )
  }
}

/**
 * Activate user subscription after successful payment
 */
async function activateSubscription(
  userId: string,
  plan: string,
  durationMonths: number | null
) {
  const months = durationMonths || (plan === 'LIFETIME' ? 1200 : 1)
  const startDate = new Date()
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + months, startDate.getDate(), 23, 59, 59, 999)

  await db.profile.update({
    where: { id: userId },
    data: {
      plan: plan === 'LIFETIME' ? 'LIFETIME' : 'PRO',
      is_pro: true,
      subscription_until: endDate,
      proExpiry: endDate,
    },
  })

  await db.userSubscription.create({
    data: {
      userId,
      plan,
      status: 'active',
      startDate,
      endDate,
      discountPercent: 0,
    },
  }).catch(() => {
    // Subscription might already exist
  })

  console.log(`🎉 [Confirm Payment] Activated ${plan} for user ${userId} until ${endDate.toISOString()}`)

  // Sync to Supabase Auth metadata
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
          updated_at: new Date().toISOString(),
        },
      })
      console.log('✅ [Confirm Payment] Synced Auth metadata')
    }
  } catch (syncErr) {
    console.warn('⚠️ [Confirm Payment] Failed to sync Auth metadata (non-critical)')
  }
}
