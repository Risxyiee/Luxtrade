import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { isUserPro } from '@/lib/pro-check'

// GET - Fetch a single target by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase } = createClientForApi(request)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('targets')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Target not found' }, { status: 404 })
      }
      console.error('Target fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch target' }, { status: 500 })
    }

    return NextResponse.json({ target: data })
  } catch (err) {
    console.error('Target fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch target' }, { status: 500 })
  }
}

// PATCH - Update a target
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const { name, target_value, current_value, unit, target_type, status, deadline } = body

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (name !== undefined) updateData.name = name
    if (target_value !== undefined) updateData.target_value = Number(target_value)
    if (current_value !== undefined) updateData.current_value = Number(current_value)
    if (unit !== undefined) updateData.unit = unit
    if (target_type !== undefined) updateData.target_type = target_type
    if (status !== undefined) updateData.status = status
    if (deadline !== undefined) updateData.deadline = deadline

    const { data, error } = await supabase
      .from('targets')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Target update error:', error)
      return NextResponse.json({ error: 'Failed to update target' }, { status: 500 })
    }

    return NextResponse.json({ success: true, target: data })
  } catch (err) {
    console.error('Target update error:', err)
    return NextResponse.json({ error: 'Failed to update target' }, { status: 500 })
  }
}

// DELETE - Delete a target
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { error } = await supabase
      .from('targets')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Target delete error:', error)
      return NextResponse.json({ error: 'Failed to delete target' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Target deleted successfully' })
  } catch (err) {
    console.error('Target delete error:', err)
    return NextResponse.json({ error: 'Failed to delete target' }, { status: 500 })
  }
}