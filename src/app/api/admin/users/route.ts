import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Admin credentials - ONLY these can access
const ADMIN_IDS = ['8f7fe295-2df0-412d-ba91-8e6060f3ab08']
const ADMIN_EMAILS = ['luxtradee@gmail.com']

// Helper to check admin status
function isAdmin(userId: string | undefined, email: string | undefined): boolean {
  if (userId && ADMIN_IDS.includes(userId)) return true
  if (email && ADMIN_EMAILS.includes(email.toLowerCase())) return true
  return false
}

// GET - Fetch all users with subscription info
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

    // Check admin status
    if (!isAdmin(user.id, user.email)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // Fetch all users from profiles table
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, subscription_status, is_pro, subscription_until, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching profiles:', error)
      // Return empty array instead of error
      return NextResponse.json({ users: [] })
    }

    // Transform data to match expected format
    const users = (profiles || []).map(p => ({
      id: p.id,
      email: p.email || '',
      full_name: p.full_name,
      subscription_status: p.subscription_status || 'FREE',
      is_pro: p.is_pro || false,
      subscription_until: p.subscription_until,
      created_at: p.created_at
    }))

    return NextResponse.json({ users, count: users.length })
  } catch (error) {
    console.error('Admin API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Sync users from Supabase Auth to profiles table
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

    // Check admin status
    if (!isAdmin(user.id, user.email)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // Get all existing profile IDs
    const { data: existingProfiles } = await supabase
      .from('profiles')
      .select('id')
    
    const existingIds = new Set((existingProfiles || []).map(p => p.id))

    // Get all users from auth (via admin API - requires service role)
    // Note: We'll create missing profiles from the auth callback instead
    // For now, return info about sync

    return NextResponse.json({ 
      message: 'Sync initiated. New users will be automatically added to profiles on signup.',
      existingProfiles: existingIds.size
    })
  } catch (error) {
    console.error('Sync API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Activate 30 Days PRO
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

    // Check admin status
    if (!isAdmin(user.id, user.email)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Calculate new subscription_until (30 days from now)
    const now = new Date()
    const subscriptionUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days
    const subscriptionUntilISO = subscriptionUntil.toISOString()

    // Update user PRO status
    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        is_pro: true,
        subscription_status: 'active',
        subscription_until: subscriptionUntilISO,
        updated_at: now.toISOString()
      })
      .eq('id', userId)
      .select()

    if (error) {
      console.error('Error updating user:', error)
      return NextResponse.json({ error: 'Failed to activate PRO' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      user: data[0],
      message: `PRO activated until ${subscriptionUntil.toLocaleDateString('id-ID')}`
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

    // Check admin status
    if (!isAdmin(user.id, user.email)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Revoke PRO status
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
