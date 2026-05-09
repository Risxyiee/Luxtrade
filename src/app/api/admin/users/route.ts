import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// ============================================
// AFFILIATE SYSTEM CONSTANTS
// ============================================
const ADMIN_IDS = ['8f7fe295-2df0-412d-ba91-8e6060f3ab08']
const ADMIN_EMAILS = ['luxtradee@gmail.com']
const PRO_PRICE = 49000 // Rp 49.000
const COMMISSION_RATE = 0.30 // 30%
const COMMISSION_AMOUNT = PRO_PRICE * COMMISSION_RATE // Rp 14.700

// Helper to check admin status
function isAdmin(userId: string | undefined, email: string | undefined): boolean {
  if (userId && ADMIN_IDS.includes(userId)) return true
  if (email && ADMIN_EMAILS.includes(email.toLowerCase())) return true
  return false
}

// GET - Fetch all users with subscription and referral info
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isAdmin(user.id, user.email)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // Fetch all users with referral info
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select(`
        id, 
        email, 
        full_name, 
        subscription_status, 
        is_pro, 
        subscription_until, 
        created_at,
        device_id,
        my_referral_code,
        referred_by_code,
        affiliate_balance,
        referral_status,
        has_ever_been_pro,
        commission_paid,
        referral_code_changes
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching profiles:', error)
      return NextResponse.json({ users: [] })
    }

    // Get referrer info for each user
    const referralCodes = (profiles || [])
      .filter(p => p.referred_by_code)
      .map(p => p.referred_by_code)

    const { data: referrers } = await supabase
      .from('profiles')
      .select('id, email, full_name, my_referral_code')
      .in('my_referral_code', referralCodes)

    const referrerMap = new Map((referrers || []).map(r => [r.my_referral_code, r]))

    // Check for duplicate devices
    const deviceCounts = new Map<string, number>()
    ;(profiles || []).forEach(p => {
      if (p.device_id) {
        deviceCounts.set(p.device_id, (deviceCounts.get(p.device_id) || 0) + 1)
      }
    })

    // Transform data with referral info
    const users = (profiles || []).map(p => {
      const referrer = p.referred_by_code ? referrerMap.get(p.referred_by_code) : null
      const hasDuplicateDevice = p.device_id ? (deviceCounts.get(p.device_id) || 0) > 1 : false
      
      return {
        id: p.id,
        email: p.email || '',
        full_name: p.full_name,
        subscription_status: p.subscription_status || 'FREE',
        is_pro: p.is_pro || false,
        subscription_until: p.subscription_until,
        created_at: p.created_at,
        // Affiliate info
        device_id: p.device_id,
        my_referral_code: p.my_referral_code,
        referred_by_code: p.referred_by_code,
        referred_by: referrer ? { email: referrer.email, name: referrer.full_name } : null,
        affiliate_balance: p.affiliate_balance || 0,
        referral_status: p.referral_status,
        has_ever_been_pro: p.has_ever_been_pro || false,
        commission_paid: p.commission_paid || false,
        has_duplicate_device: hasDuplicateDevice,
        referral_code_changes: p.referral_code_changes || 0
      }
    })

    return NextResponse.json({ users, count: users.length })
  } catch (error) {
    console.error('Admin API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Sync users (keep existing functionality)
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isAdmin(user.id, user.email)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const { data: existingProfiles } = await supabase
      .from('profiles')
      .select('id')
    
    const existingIds = new Set((existingProfiles || []).map(p => p.id))

    return NextResponse.json({ 
      message: 'Sync initiated. New users will be automatically added to profiles on signup.',
      existingProfiles: existingIds.size
    })
  } catch (error) {
    console.error('Sync API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Activate 30 Days PRO with Commission Logic
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isAdmin(user.id, user.email)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Get user's current info
    const { data: userProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (fetchError || !userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Calculate new subscription_until (30 days from now)
    const now = new Date()
    const subscriptionUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const subscriptionUntilISO = subscriptionUntil.toISOString()

    // ============================================
    // COMMISSION LOGIC: Check if commission should be paid
    // ============================================
    let commissionResult = {
      paid: false,
      amount: 0,
      referrerEmail: null as string | null,
      reason: null as string | null
    }

    // Only pay commission if:
    // 1. User was referred by someone
    // 2. User has never been PRO before (first time)
    // 3. Referral status is NOT fraud
    // 4. Commission hasn't been paid yet
    if (
      userProfile.referred_by_code &&
      !userProfile.has_ever_been_pro &&
      userProfile.referral_status !== 'fraud' &&
      !userProfile.commission_paid
    ) {
      // Get referrer info
      const { data: referrer } = await supabase
        .from('profiles')
        .select('id, email, affiliate_balance')
        .eq('my_referral_code', userProfile.referred_by_code)
        .single()

      if (referrer) {
        // Double-check: Verify referral tracking record is valid
        const { data: tracking } = await supabase
          .from('referral_tracking')
          .select('*')
          .eq('referee_id', userId)
          .single()

        if (tracking && tracking.status !== 'fraud') {
          // ============================================
          // TRANSACTION: Update referrer balance and mark commission paid
          // ============================================
          const newBalance = (referrer.affiliate_balance || 0) + COMMISSION_AMOUNT

          // Update referrer's balance
          const { error: referrerUpdateError } = await supabase
            .from('profiles')
            .update({
              affiliate_balance: newBalance,
              updated_at: now.toISOString()
            })
            .eq('id', referrer.id)

          if (!referrerUpdateError) {
            // Mark user as commission paid
            await supabase
              .from('profiles')
              .update({
                commission_paid: true,
                updated_at: now.toISOString()
              })
              .eq('id', userId)

            // Update referral tracking
            await supabase
              .from('referral_tracking')
              .update({
                status: 'commissioned',
                commission_amount: COMMISSION_AMOUNT,
                commissioned_at: now.toISOString()
              })
              .eq('referee_id', userId)

            commissionResult = {
              paid: true,
              amount: COMMISSION_AMOUNT,
              referrerEmail: referrer.email,
              reason: 'First-time PRO activation'
            }

            console.log(`✅ Commission paid: Rp ${COMMISSION_AMOUNT} to ${referrer.email}`)
          }
        }
      }
    } else if (userProfile.has_ever_been_pro) {
      commissionResult.reason = 'User was already PRO before'
    } else if (userProfile.referral_status === 'fraud') {
      commissionResult.reason = 'Fraudulent referral detected'
    } else if (userProfile.commission_paid) {
      commissionResult.reason = 'Commission already paid'
    }

    // ============================================
    // Update user PRO status
    // ============================================
    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        is_pro: true,
        subscription_status: 'active',
        subscription_until: subscriptionUntilISO,
        has_ever_been_pro: true, // Mark as having been PRO
        updated_at: now.toISOString()
      })
      .eq('id', userId)
      .select()

    if (error) {
      console.error('Error updating user:', error)
      return NextResponse.json({ error: 'Failed to activate PRO' }, { status: 500 })
    }

    // Build response message
    let message = `PRO activated until ${subscriptionUntil.toLocaleDateString('id-ID')}`
    if (commissionResult.paid) {
      message += `. Commission Rp ${COMMISSION_AMOUNT.toLocaleString('id-ID')} paid to ${commissionResult.referrerEmail}`
    }

    return NextResponse.json({ 
      success: true, 
      user: data[0],
      commission: commissionResult,
      message
    })
  } catch (error) {
    console.error('Admin PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Revoke PRO status
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isAdmin(user.id, user.email)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Revoke PRO status (but keep has_ever_been_pro true for commission logic)
    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        is_pro: false,
        subscription_status: 'FREE',
        subscription_until: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()

    if (error) {
      console.error('Error revoking PRO:', error)
      return NextResponse.json({ error: 'Failed to revoke PRO' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      user: data[0],
      message: 'PRO status revoked'
    })
  } catch (error) {
    console.error('Admin DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
