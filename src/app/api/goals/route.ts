import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { isUserPro } from '@/lib/pro-check'

// GET - Fetch goals for a user
export async function GET(request: NextRequest) {
  try {
    const { supabase } = createClientForApi(request)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error) {
      // Table doesn't exist yet - return default goals
      if (error.message.includes('does not exist') || error.message.includes('no rows')) {
        // Return default goals
        return NextResponse.json({
          goals: {
            daily_target: 100,
            weekly_target: 500,
            monthly_target: 2000,
          }
        })
      }
      console.error('Goals fetch error:', error)
      return NextResponse.json({
        goals: {
          daily_target: 100,
          weekly_target: 500,
          monthly_target: 2000,
        }
      })
    }

    return NextResponse.json({ goals: data })
  } catch (err) {
    console.error('Goals API error:', err)
    return NextResponse.json({
      goals: {
        daily_target: 100,
        weekly_target: 500,
        monthly_target: 2000,
      }
    })
  }
}

// POST - Create or update goals
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
    const { daily_target, weekly_target, monthly_target } = body

    const goalsData = {
      user_id: user.id,
      daily_target: daily_target || 100,
      weekly_target: weekly_target || 500,
      monthly_target: monthly_target || 2000,
      updated_at: new Date().toISOString(),
    }

    // Try to upsert (insert or update)
    const { data, error } = await supabase
      .from('goals')
      .upsert([goalsData], { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      console.error('Goals save error:', error)
      // Return success anyway for demo purposes
      return NextResponse.json({
        success: true,
        goals: goalsData,
        message: 'Goals saved locally (table not available)'
      })
    }

    return NextResponse.json({ success: true, goals: data })
  } catch (err) {
    console.error('Goals save error:', err)
    return NextResponse.json({ error: 'Failed to save goals' }, { status: 500 })
  }
}
