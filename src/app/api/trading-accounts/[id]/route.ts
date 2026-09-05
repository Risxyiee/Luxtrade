/**
 * API Route: Trading Account by ID
 * GET - Get a specific trading account
 * PATCH - Update a trading account
 * DELETE - Delete a trading account
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { getAuthenticatedUser } from '@/lib/api-auth'

// GET: Fetch a specific trading account
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const authResult = await getAuthenticatedUser(req)
    const authUser = authResult.user

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: account } = await admin.from('trading_accounts')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', authUser.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!account) {
      return NextResponse.json({ error: 'Trading account not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: account })
  } catch (error) {
    console.error('Error fetching trading account:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trading account' },
      { status: 500 }
    )
  }
}

// PATCH: Update a trading account
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const authResult = await getAuthenticatedUser(req)
    const authUser = authResult.user

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const updates: Record<string, any> = {}

    if (body.name !== undefined) updates.name = body.name
    if (body.broker !== undefined) updates.broker = body.broker
    if (body.account_type !== undefined) updates.account_type = body.account_type
    if (body.account_number !== undefined) updates.account_number = body.account_number
    if (body.initial_balance !== undefined) updates.initial_balance = Number(body.initial_balance)
    if (body.current_balance !== undefined) updates.current_balance = Number(body.current_balance)
    if (body.leverage !== undefined) updates.leverage = Number(body.leverage)
    if (body.currency !== undefined) updates.currency = body.currency
    if (body.is_default !== undefined) updates.is_default = body.is_default
    if (body.is_active !== undefined) updates.is_active = body.is_active

    // First verify the account belongs to the user
    const { data: existing } = await admin.from('trading_accounts')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', authUser.id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Trading account not found' }, { status: 404 })
    }

    const { data: updatedAccount } = await admin.from('trading_accounts')
      .update(updates)
      .eq('id', params.id)
      .eq('user_id', authUser.id)
      .select()
      .single()

    return NextResponse.json({ success: true, data: updatedAccount })
  } catch (error) {
    console.error('Error updating trading account:', error)
    return NextResponse.json(
      { error: 'Failed to update trading account' },
      { status: 500 }
    )
  }
}

// DELETE: Delete a trading account
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const authResult = await getAuthenticatedUser(req)
    const authUser = authResult.user

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the account to be deleted first (to check if it's default)
    const { data: accountToDelete } = await admin.from('trading_accounts')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', authUser.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!accountToDelete) {
      return NextResponse.json({ error: 'Trading account not found' }, { status: 404 })
    }

    // Check if this is the last account - prevent deletion
    const { data: allAccounts } = await admin.from('trading_accounts')
      .select('id')
      .eq('user_id', authUser.id)
      .eq('is_active', true)

    if (!allAccounts || allAccounts.length <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last account. At least 1 account is required.' }, { status: 400 })
    }

    // Delete the account
    await admin.from('trading_accounts').delete().eq('id', params.id)

    // If we deleted the default account, set another account as default
    if (accountToDelete.is_default) {
      const { data: remainingAccounts } = await admin.from('trading_accounts')
        .select('id')
        .eq('user_id', authUser.id)
        .eq('is_active', true)
        .limit(1)

      if (remainingAccounts && remainingAccounts.length > 0) {
        await admin.from('trading_accounts').update({ is_default: true }).eq('id', remainingAccounts[0].id)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Trading account "${accountToDelete.name}" deleted${accountToDelete.is_default ? ' and a new default account has been set' : ''}`
    })
  } catch (error) {
    console.error('Error deleting trading account:', error)
    return NextResponse.json(
      { error: 'Failed to delete trading account' },
      { status: 500 }
    )
  }
}
