import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAdmin(req)
    if (error) return error

    const email = req.nextUrl.searchParams.get('email')
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 })
    }
    
    const { data: user, error: dbError } = await admin
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single()

    if (dbError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    return NextResponse.json(user)
  } catch (error) {
    console.error('Search user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}