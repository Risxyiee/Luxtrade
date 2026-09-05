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
    if (amount > affiliate.balance) {
      return NextResponse.json(
        { error: `Insufficient balance. Current balance: Rp${affiliate.balance.toLocaleString('id-ID')}` },
        { status: 400 }
      )
    }

    // Create withdrawal and deduct balance
    // Supabase doesn't support transactions natively in JS client, so we do sequential operations
    const { data: withdrawal, error: withdrawError } = await admin.from('affiliate_withdrawals').insert({
      affiliate_id: affiliate.id,
      amount,
      bank_account_info: bankAccountInfo.trim(),
      status: 'REQUESTED',
    }).select().single()

    if (withdrawError) {
      console.error('Failed to create withdrawal:', withdrawError)
      return NextResponse.json({ error: 'Failed to create withdrawal' }, { status: 500 })
    }

    // Deduct from current balance
    const newBalance = (affiliate.balance ?? 0) - amount
    await admin.from('affiliates').update({ balance: newBalance }).eq('id', affiliate.id)

    return NextResponse.json({
      success: true,
      withdrawal: {
        id: withdrawal.id,
        amount: withdrawal.amount,
        status: withdrawal.status,
        requestedAt: withdrawal.created_at,
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
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

    const { data: withdrawals } = await admin.from('affiliate_withdrawals')
      .select('*')
      .eq('affiliate_id', affiliate.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    return NextResponse.json({
      withdrawals: (withdrawals || []).map((w) => ({
        id: w.id,
        amount: w.amount,
        status: w.status,
        bankAccountInfo: w.bank_account_info,
        requestedAt: w.created_at,
        paidAt: w.paid_at,
      })),
    })
  } catch (error) {
    console.error('Affiliate withdraw GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}