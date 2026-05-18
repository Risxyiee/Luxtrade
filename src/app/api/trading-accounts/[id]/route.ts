/**
 * API Route: Individual Trading Account Operations
 * PATCH - Update a trading account (status, metaapi_account_id)
 * DELETE - Delete a trading account
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { deleteTradingAccount, updateTradingAccount } from '@/lib/trading-account'

// PATCH: Update trading account
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const accountId = params.id

    // Parse request body
    const body = await req.json()
    const { metaapi_account_id, status } = body

    // Validate that at least one field is being updated
    if (!metaapi_account_id && !status) {
      return NextResponse.json(
        {
          error: 'No fields to update',
          valid_fields: ['metaapi_account_id', 'status']
        },
        { status: 400 }
      )
    }

    // Validate status if provided
    if (status && !['CONNECTED', 'DISCONNECTED', 'PENDING', 'ERROR'].includes(status)) {
      return NextResponse.json(
        {
          error: 'Invalid status',
          valid_statuses: ['CONNECTED', 'DISCONNECTED', 'PENDING', 'ERROR']
        },
        { status: 400 }
      )
    }

    // Verify ownership
    const { data: account } = await supabase
      .from('trading_accounts')
      .select('user_id')
      .eq('id', accountId)
      .single()

    if (!account) {
      return NextResponse.json(
        { error: 'Trading account not found' },
        { status: 404 }
      )
    }

    if (account.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - You can only update your own accounts' },
        { status: 403 }
      )
    }

    // Update the account
    const updatedAccount = await updateTradingAccount(accountId, {
      metaapi_account_id,
      status
    })

    return NextResponse.json({
      success: true,
      data: updatedAccount
    })
  } catch (error) {
    console.error('Error updating trading account:', error)
    return NextResponse.json(
      {
        error: 'Failed to update trading account',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// DELETE: Delete trading account
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const accountId = params.id

    // Verify ownership
    const { data: account } = await supabase
      .from('trading_accounts')
      .select('user_id')
      .eq('id', accountId)
      .single()

    if (!account) {
      return NextResponse.json(
        { error: 'Trading account not found' },
        { status: 404 }
      )
    }

    if (account.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - You can only delete your own accounts' },
        { status: 403 }
      )
    }

    // Delete the account
    await deleteTradingAccount(accountId, user.id)

    return NextResponse.json({
      success: true,
      message: 'Trading account deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting trading account:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete trading account',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
