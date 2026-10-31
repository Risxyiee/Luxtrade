import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { getAuthenticatedUser } from '@/lib/api-auth'

const MIN_WITHDRAWAL = 100000 // Rp100.000

// POST /api/affiliate/withdraw - Request a withdrawal
export async function POST(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const authResult = await getAuthenticatedUser(request)
    const authUser = authResult.user
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { amount, bankAccountInfo } = body as {
      amount: number
      bankAccountInfo: string
    }

    // Validate input
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid withdrawal amount' },
        { status: 400 }
      )
    }

    if (!bankAccountInfo || typeof bankAccountInfo !== 'string' || bankAccountInfo.trim().length === 0) {
      return NextResponse.json(
        { error: 'Bank account information is required' },
        { status: 400 }
      )
    }

    // Find the affiliate record
    const { data: affiliate } = await admin.from('affiliates').select('*').eq('user_id', authUser.id).single()

    if (!affiliate) {
      return NextResponse.json(
        { error: 'No affiliate account found' },
        { status: 404 }
      )
    }

    // Validate minimum withdrawal
    if (amount < MIN_WITHDRAWAL) {
      return NextResponse.json(
        { error: `Minimum withdrawal is Rp${MIN_WITHDRAWAL.toLocaleString('id-ID')}` },
        { status: 400 }
      )
    }

    // Validate sufficient balance
    // ⚠️ KOLOM SALDO YANG BENAR = current_balance (kolom `balance` TIDAK ADA —
    // probe produksi 42703; audit worklog 2026-10-30). Komisi selalu masuk ke
    // current_balance, jadi cek saldo HARUS pakai kolom yang sama.
    const currentBalance = Number(affiliate.current_balance ?? 0)
    if (amount > currentBalance) {
      return NextResponse.json(
        { error: `Insufficient balance. Current balance: Rp${currentBalance.toLocaleString('id-ID')}` },
        { status: 400 }
      )
    }

    // 🛡️ Anti double-spend: hanya BOLEH ada SATU pengajuan REQUESTED per
    // affiliate. Tanpa ini, N request paralel semuanya lolos cek saldo.
    const { data: pendingDup } = await admin
      .from('affiliate_withdrawals')
      .select('id')
      .eq('affiliate_id', affiliate.id)
      .eq('status', 'REQUESTED')
      .limit(1)
    if (pendingDup && pendingDup.length > 0) {
      return NextResponse.json(
        { error: 'Kamu masih punya pengajuan penarikan yang menunggu diproses. Tunggu sampai diproses dulu ya.' },
        { status: 400 }
      )
    }

    // 💰 POTONG SALDO DULU (CAS atomik di level DB): UPDATE ... WHERE
    // current_balance >= amount. Kalau baris kosong = saldo berubah di
    // antara read & write (race) → tolak. Supabase JS tak dukung transaksi,
    // tapi UPDATE tunggal dgn filter PostgREST ini atomik per baris.
    const { data: deducted, error: deductError } = await admin
      .from('affiliates')
      .update({ current_balance: currentBalance - amount })
      .eq('id', affiliate.id)
      .gte('current_balance', amount)
      .select('current_balance')

    if (deductError) {
      console.error('Failed to deduct balance:', deductError)
      return NextResponse.json({ error: 'Gagal memotong saldo, coba lagi' }, { status: 500 })
    }
    if (!deducted || deducted.length === 0) {
      return NextResponse.json(
        { error: 'Insufficient balance. Current balance: Rp' + currentBalance.toLocaleString('id-ID') },
        { status: 400 }
      )
    }

    // Create withdrawal record (saldo sudah terpotong — kalau ini gagal,
    // REFUND saldo biar duit user tidak hilang)
    const { data: withdrawal, error: withdrawError } = await admin.from('affiliate_withdrawals').insert({
      affiliate_id: affiliate.id,
      amount,
      bank_account_info: bankAccountInfo.trim(),
      status: 'REQUESTED',
    }).select().single()

    if (withdrawError) {
      console.error('Failed to create withdrawal (refund saldo):', withdrawError)
      await admin
        .from('affiliates')
        .update({ current_balance: currentBalance })
        .eq('id', affiliate.id)
      return NextResponse.json({ error: 'Failed to create withdrawal' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      withdrawal: {
        id: withdrawal.id,
        amount: withdrawal.amount,
        status: withdrawal.status,
        requestedAt: withdrawal.requested_at,
      },
    })
  } catch (error) {
    console.error('Affiliate withdraw POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/affiliate/withdraw - Get user's withdrawal history
export async function GET(request: NextRequest) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const authResult = await getAuthenticatedUser(request)
    const authUser = authResult.user
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find the affiliate record
    const { data: affiliate } = await admin.from('affiliates').select('id').eq('user_id', authUser.id).maybeSingle()

    if (!affiliate) {
      return NextResponse.json({ withdrawals: [] })
    }

    // Get withdrawals for this affiliate (with limit)
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '50') || 50, 200)

    // ⚠️ Kolom waktu = requested_at (kolom `created_at` TIDAK ADA — probe
    // produksi 42703; tanpa ini seluruh riwayat withdraw 42703).
    const { data: withdrawals } = await admin.from('affiliate_withdrawals')
      .select('*')
      .eq('affiliate_id', affiliate.id)
      .order('requested_at', { ascending: false })
      .limit(limit)

    return NextResponse.json({
      withdrawals: (withdrawals || []).map((w) => ({
        id: w.id,
        amount: w.amount,
        status: w.status,
        bankAccountInfo: w.bank_account_info,
        requestedAt: w.requested_at,
        paidAt: w.paid_at,
      })),
    })
  } catch (error) {
    console.error('Affiliate withdraw GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}