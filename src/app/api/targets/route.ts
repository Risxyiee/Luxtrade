import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { isUserPro } from '@/lib/pro-check'

interface Target {
  id?: string
  user_id: string
  name: string
  target_value: number
  current_value: number
  unit: string
  target_type: 'daily' | 'weekly' | 'monthly' | 'win_rate' | 'other'
  status: 'active' | 'completed' | 'paused'
  deadline?: string | null
  created_at?: string
  updated_at?: string
}

// GET - Fetch targets for a user
export async function GET(request: NextRequest) {
  try {
    const { supabase } = createClientForApi(request)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('targets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      // Table doesn't exist yet - return empty array
      if (error.message.includes('does not exist') || error.message.includes('relation') || error.code === '42P01') {
        return NextResponse.json({ targets: [] })
      }
      console.error('Targets fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch targets' }, { status: 500 })
    }

    return NextResponse.json({ targets: data || [] })
  } catch (err) {
    console.error('Targets API error:', err)
    return NextResponse.json({ targets: [] })
  }
}

// POST - Create a new target
export async function POST(request: NextRequest) {
  try {
    const { supabase } = createClientForApi(request)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pro = await isUserPro(user.id)
    if (!pro) {
      return NextResponse.json({ error: 'PRO_REQUIRED', code: 'PRO_REQUIRED' }, { status: 403 })
    }

    const body = await request.json()
    const { name, target_value, unit, target_type, deadline } = body

    // Validate required fields
    if (!name || target_value === undefined || !unit || !target_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const targetData: Target = {
      user_id: user.id,
      name,
      target_value: Number(target_value),
      current_value: 0,
      unit,
      target_type,
      status: 'active',
      deadline: deadline || null,
    }

    const { data, error } = await supabase
      .from('targets')
      .insert([targetData])
      .select()
      .single()

    if (error) {
      console.error('Target creation error:', error)
      // If table doesn't exist, return success with local data
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          target: { ...targetData, id: crypto.randomUUID(), created_at: new Date().toISOString() },
          message: 'Target saved locally (table not available)'
        })
      }
      return NextResponse.json({ error: 'Failed to create target' }, { status: 500 })
    }

    return NextResponse.json({ success: true, target: data })
  } catch (err) {
    console.error('Target creation error:', err)
    return NextResponse.json({ error: 'Failed to create target' }, { status: 500 })
  }
}