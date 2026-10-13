import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'

export const dynamic9 = 'force-dynamic'

/**
 * PATCH /api/prop-firm/[id] — Update a prop firm rule
 *
 * All fields are editable. Verifies the rule belongs to the authenticated user.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const result = await createClientForApi(request)
    const supabase = result.supabase

    if (!supabase) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    // Use req.text() + JSON.parse() to avoid CF Workers stream consumed error
    const rawBody = await request.text()
    const body = JSON.parse(rawBody)

    // Verify the rule belongs to the authenticated user
    const { data: existing, error: findError } = await supabase
      .from('prop_firm_rules')
      .select('id, user_id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (findError || !existing) {
      return NextResponse.json(
        { error: 'Prop firm rule not found' },
        { status: 404 }
      )
    }

    // Build update object — only include fields that were provided
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.firm_name !== undefined) updateData.firm_name = String(body.firm_name)
    if (body.challenge_size !== undefined) updateData.challenge_size = parseFloat(String(body.challenge_size))
    if (body.phase !== undefined) updateData.phase = parseInt(String(body.phase), 10)
    if (body.max_drawdown !== undefined) updateData.max_drawdown = parseFloat(String(body.max_drawdown))
    if (body.max_daily_drawdown !== undefined) updateData.max_daily_drawdown = parseFloat(String(body.max_daily_drawdown))
    if (body.daily_drawdown_type !== undefined) updateData.daily_drawdown_type = String(body.daily_drawdown_type)
    if (body.profit_target !== undefined) updateData.profit_target = body.profit_target != null ? parseFloat(String(body.profit_target)) : null
    if (body.profit_target_percent !== undefined) updateData.profit_target_percent = parseFloat(String(body.profit_target_percent))
    if (body.min_trading_days !== undefined) updateData.min_trading_days = parseInt(String(body.min_trading_days), 10)
    if (body.profit_split !== undefined) updateData.profit_split = parseFloat(String(body.profit_split))
    if (body.start_date !== undefined) updateData.start_date = new Date(String(body.start_date)).toISOString()
    if (body.account_id !== undefined) updateData.account_id = body.account_id ? String(body.account_id) : null
    if (body.is_violated !== undefined) updateData.is_violated = Boolean(body.is_violated)
    if (body.current_drawdown !== undefined) updateData.current_drawdown = parseFloat(String(body.current_drawdown))
    if (body.current_daily_drawdown !== undefined) updateData.current_daily_drawdown = parseFloat(String(body.current_daily_drawdown))
    if (body.progress_percent !== undefined) updateData.progress_percent = parseFloat(String(body.progress_percent))
    if (body.days_traded !== undefined) updateData.days_traded = parseInt(String(body.days_traded), 10)
    if (body.peak_balance !== undefined) updateData.peak_balance = parseFloat(String(body.peak_balance))
    if (body.current_balance !== undefined) updateData.current_balance = parseFloat(String(body.current_balance))

    const { data: rule, error: updateError } = await supabase
      .from('prop_firm_rules')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      console.error('[prop-firm PATCH] Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update prop firm rule', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ rule })
  } catch (err) {
    console.error('[prop-firm PATCH] Error:', err)
    return NextResponse.json(
      { error: 'Failed to update prop firm rule', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/prop-firm/[id] — Delete a prop firm rule
 *
 * Verifies ownership before deletion.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const result = await createClientForApi(request)
    const supabase = result.supabase

    if (!supabase) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    // Verify ownership and delete in one operation (RLS also enforces this)
    const { error: deleteError } = await supabase
      .from('prop_firm_rules')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('[prop-firm DELETE] Delete error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete prop firm rule' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[prop-firm DELETE] Error:', err)
    return NextResponse.json(
      { error: 'Failed to delete prop firm rule', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
