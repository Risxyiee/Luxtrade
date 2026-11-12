import { NextRequest, NextResponse } from 'next/server'
import { verifyMidtransSignature } from '@/lib/payment/midtrans'
import { getAdminAuth, getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { applyActivationCommission } from '@/lib/affiliate-commission'
import { invalidateUserProCache } from '@/lib/pro-check'

export const dynamic = 'force-dynamic'

/** Rate komisi affiliate (selaras jalur admin activate). */
const AFFILIATE_COMMISSION_RATE = 0.20 // 20% untuk PRO berulang
const AFFILIATE_LIFETIME_RATE = 0.15  // 15% sekali bayar untuk Lifetime

/**
 * POST /api/midtrans/webhook
 *
 * Midtrans HTTP Notification (Webhook)
 * Uses Supabase only — no Prisma (CF Workers compatible).
 *
 * AUDIT 2026-11 (hardening kontrak respons — kontrak Midtrans):
 *   - Sukses diproses            → 200 (gateway berhenti retry)
 *   - Error SEMENTARA / config   → 5xx (gateway RETRY — status tak tertinggal)
 *   - Signature invalid          → 401 (tidak diproses)
 *   - Order belum ada di DB      → 404 (race create-transaction → retry)
 *   - Nominal < harga order      → order FAILED, aktivasi DITOLAK
 *   - Aktivasi gagal             → 500 + jalur idempoten mengulang saat retry
 *
 * Komisi affiliate lewat lib bersama applyActivationCommission (dedupe via
 * activation_key + unique index migrasi 022) — satu sumber kebenaran dengan
 * jalur admin activate. Gagal komisi TIDAK menggagalkan webhook (fail-open).
 */
export async function POST(request: NextRequest) {
  try {
    // ── 1. Parse notification body ──────────────────────────────
    const body = await request.json()

    const {
      order_id: orderId,
      transaction_status: transactionStatus,
      transaction_time: transactionTime,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      payment_type: paymentType,
      fraud_status: fraudStatus,
    } = body as {
      order_id: string
      transaction_status: string
      transaction_time: string
      status_code: string
      gross_amount: string
      signature_key: string
      payment_type: string
      fraud_status?: string
    }

    // ── 2. Verify signature ────────────────────────────────────
    // Error konfigurasi = 500 (Midtrans retry), BUKAN 200-ok.
    const serverKey = process.env.MIDTRANS_SERVER_KEY
    if (!serverKey) {
      console.error('❌ [Midtrans Webhook] MIDTRANS_SERVER_KEY not set')
      return NextResponse.json({ status: 'error', error: 'Server key not configured' }, { status: 500 })
    }

    const isValid = await verifyMidtransSignature(orderId, statusCode, grossAmount, serverKey, signatureKey)

    if (!isValid) {
      console.error('❌ [Midtrans Webhook] Invalid signature for order:', orderId)
      return NextResponse.json({ status: 'error', error: 'Invalid signature' }, { status: 401 })
    }

    // ── 3. Determine final status ──────────────────────────────
    let finalStatus: string
    let shouldUpgrade = false

    if (transactionStatus === 'capture') {
      if (fraudStatus === 'accept') {
        finalStatus = 'SUCCESS'
        shouldUpgrade = true
      } else if (fraudStatus === 'challenge') {
        finalStatus = 'PENDING'
      } else {
        finalStatus = 'FAILED'
      }
    } else if (transactionStatus === 'settlement') {
      finalStatus = 'SUCCESS'
      shouldUpgrade = true
    } else if (transactionStatus === 'pending') {
      finalStatus = 'PENDING'
    } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'failure') {
      finalStatus = 'FAILED'
    } else if (transactionStatus === 'expire') {
      finalStatus = 'EXPIRED'
    } else if (transactionStatus === 'refund') {
      finalStatus = 'REFUNDED'
    } else if (transactionStatus === 'partial_refund') {
      finalStatus = 'PARTIAL_REFUND'
    } else {
      finalStatus = transactionStatus?.toUpperCase() || 'UNKNOWN'
    }

    // ── 4. Find the payment order in Supabase ──────────────────
    const svc = getSupabaseAdmin()
    if (!svc) {
      console.error('❌ [Midtrans Webhook] Supabase admin client not available')
      return NextResponse.json({ status: 'error', error: 'DB not configured' }, { status: 500 })
    }

    const { data: paymentOrder, error: orderFetchError } = await svc
      .from('payment_orders')
      .select('*')
      .eq('invoice_number', orderId)
      .single()

    if (orderFetchError && orderFetchError.code === 'PGRST116') {
      // Order belum ada di DB (race dgn create-transaction) → 404 agar
      // Midtrans RETRY sampai order tercatat.
      return NextResponse.json({ status: 'error', message: 'Order not found' }, { status: 404 })
    }
    if (orderFetchError || !paymentOrder) {
      console.error('❌ [Midtrans Webhook] Gagal fetch order:', orderFetchError?.message)
      return NextResponse.json({ status: 'error', error: 'DB read failed' }, { status: 500 })
    }

    // ── 4b. Cross-check nominal — AUDIT 2026-11: ENFORCED (bukan cuma log)
    // Nominal dibayar dijamin signature Midtrans (tak bisa dipalsukan),
    // tapi nominal lebih KECIL dari harga order = ketidaksesuaian
    // (diskon flow tak tercatat / data order melenceng) → PRO TIDAK AKTIF.
    // Toleransi Rp1 untuk pembulatan.
    const paidAmount = Number(grossAmount)
    const orderAmount = Number(paymentOrder.amount)
    const nominalMismatch =
      shouldUpgrade &&
      Number.isFinite(paidAmount) && Number.isFinite(orderAmount) &&
      orderAmount > 0 && paidAmount + 1 < orderAmount

    if (nominalMismatch) {
      console.warn(
        `⚠️ [Midtrans Webhook] NOMINAL MISMATCH: dibayar ${paidAmount} < order ${orderAmount} utk ${orderId} — aktivasi DITOLAK, order = FAILED`
      )
      await svc.from('payment_orders').update({
        status: 'FAILED',
        payment_channel: paymentType || paymentOrder.payment_channel,
        updated_at: new Date().toISOString(),
      }).eq('invoice_number', orderId)
      return NextResponse.json({
        status: 'ok',
        message: 'Nominal pembayaran tidak sesuai order — aktivasi ditolak',
      })
    }

    // ── 5. Idempotensi pintar (AUDIT 2026-11) ──────────────────
    // Order sudah final & notifikasi ini BUKAN sukses baru → ack saja.
    // Order sudah SUCCESS dan notifikasi SUCCESS lagi → JANGAN early-return
    // buta: blok aktivasi di bawah tetap dijalankan (idempotent) supaya
    // retry setelah kegagalan aktivasi bisa menyembuhkan diri sendiri.
    if (paymentOrder.status === 'SUCCESS' && finalStatus !== 'SUCCESS') {
      return NextResponse.json({ status: 'ok', message: 'Order already final' })
    }

    // ── 6. Update payment order status ─────────────────────────
    // Error DB = 500 agar Midtrans retry (bukan 200-ok).
    const { error: orderUpdateError } = await svc.from('payment_orders').update({
      status: finalStatus,
      payment_channel: paymentType || paymentOrder.payment_channel,
      ...(shouldUpgrade && transactionTime ? { paid_at: transactionTime } : {}),
      updated_at: new Date().toISOString(),
    }).eq('invoice_number', orderId)
    if (orderUpdateError) {
      console.error('❌ [Midtrans Webhook] Gagal update order:', orderUpdateError.message)
      return NextResponse.json({ status: 'error', error: 'DB update failed' }, { status: 500 })
    }

    // ── 7. Upgrade user to PRO on successful payment ───────────
    if (shouldUpgrade) {
      const userId = paymentOrder.user_id
      if (!userId) {
        console.error('❌ [Midtrans Webhook] Order SUCCESS tanpa user_id:', orderId)
        return NextResponse.json({ status: 'error', error: 'Order without user_id' }, { status: 500 })
      }
      const durationMonths = paymentOrder.duration_months || 1

      // Calculate subscription end date
      const now = new Date()
      const subscriptionUntil = new Date(now)

      // If user already has active subscription, extend from current expiry
      const { data: existingProfile } = await svc
        .from('profiles')
        .select('subscription_until, is_pro')
        .eq('id', userId)
        .single()

      if (existingProfile?.is_pro && existingProfile?.subscription_until && new Date(existingProfile.subscription_until) > now) {
        subscriptionUntil.setTime(new Date(existingProfile.subscription_until).getTime())
      }

      if (paymentOrder.plan === 'LIFETIME') {
        subscriptionUntil.setFullYear(subscriptionUntil.getFullYear() + 50)
      } else {
        subscriptionUntil.setMonth(subscriptionUntil.getMonth() + durationMonths)
      }

      const subUntilIso = subscriptionUntil.toISOString()

      // Update profile — gagal = 500 agar Midtrans retry; retry berikutnya
      // lewat jalur idempoten (langkah 5) dan mengulang aktivasi.
      const { error: profileUpdateError } = await svc.from('profiles').update({
        is_pro: true,
        subscription_until: subUntilIso,
        pro_expiry: subUntilIso,
        plan: paymentOrder.plan === 'LIFETIME' ? 'LIFETIME' : 'PRO',
        subscription_status: 'active',
        pro_status: 'active',
        has_ever_been_pro: true,
        email_verified: true,
        updated_at: new Date().toISOString(),
      }).eq('id', userId)
      if (profileUpdateError) {
        console.error('❌ [Midtrans Webhook] Gagal update profile PRO:', profileUpdateError.message)
        return NextResponse.json({ status: 'error', error: 'Profile update failed' }, { status: 500 })
      }

      // F2: PRO cache 60 dtk harus dibuang agar akses PRO aktif seketika
      invalidateUserProCache(userId)

      // Also create UserSubscription record for tracking
      const { error: subInsertError } = await svc.from('user_subscriptions').insert({
        user_id: userId,
        plan: paymentOrder.plan === 'LIFETIME' ? 'LIFETIME' : 'PRO',
        status: 'active',
        start_date: now.toISOString(),
        end_date: subUntilIso,
        created_at: now.toISOString(),
      })
      if (subInsertError) {
        // Duplicate (retry) = wajar; error lain hanya dicatat (non-kritikal —
        // profil sudah PRO, ini tabel pelengkap).
        console.warn('⚠️ [Midtrans Webhook] user_subscriptions insert:', subInsertError.message)
      }

      // Auto-verify email in Supabase Auth so user can login
      try {
        const authAdmin = getAdminAuth()
        if (authAdmin) {
          await authAdmin.updateUserById(userId, {
            email_confirm: true,
            user_metadata: {
              email_verified: true,
              is_pro: true,
              subscription_status: 'active',
              subscription_until: subUntilIso,
              has_ever_been_pro: true,
              updated_at: new Date().toISOString(),
            }
          })
        }
      } catch (verifyErr) {
        console.error('⚠️ [Midtrans Webhook] Failed to auto-verify email (non-critical):', verifyErr)
      }

      // ── 7b. Komisi affiliate (unified, dedupe via activation_key) ──
      // Jalur payment kini memakai lib yang sama dengan jalur admin activate:
      // ledger affiliate_referrals + saldo affiliates + profiles. Fail-open:
      // error komisi tidak pernah menggagalkan upgrade/user.
      try {
        const isLifetime = paymentOrder.plan === 'LIFETIME'
        const commission = await applyActivationCommission(svc, {
          userId,
          planType: isLifetime ? 'PRO_LIFETIME' : 'PRO',
          planName: isLifetime
            ? 'PRO Lifetime (Midtrans)'
            : `PRO ${durationMonths} Bulan (Midtrans)`,
          price: Number(paymentOrder.amount) || 0,
          commissionRate: isLifetime ? AFFILIATE_LIFETIME_RATE : AFFILIATE_COMMISSION_RATE,
          subscriptionUntil: subUntilIso,
        })
        console.log('💰 [Midtrans Webhook] Komisi affiliate:', JSON.stringify(commission))
      } catch (commErr) {
        console.error('⚠️ [Midtrans Webhook] Komisi affiliate gagal (non-blocking):', commErr)
      }
    }

    // ── 8. Return 200 to acknowledge ───────────────────────────
    return NextResponse.json({ status: 'ok' })
  } catch (error: any) {
    // AUDIT 2026-11: error internal = 500 agar Midtrans RETRY.
    // (Dulu 200-ok → gateway menganggap selesai → status/aktivasi tertinggal.)
    console.error('❌ [Midtrans Webhook] Error:', error)
    return NextResponse.json({ status: 'error', error: 'Internal error' }, { status: 500 })
  }
}
