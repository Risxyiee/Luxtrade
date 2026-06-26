/**
 * API Route: Trading Account by ID
 * GET - Get a specific trading account
 * PATCH - Update a trading account
 * DELETE - Delete a trading account
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClientForApi } from '@/lib/supabase/server'

// Helper: Get authenticated user from request
async function getAuthUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
  try {
    const { supabase } = createClientForApi(request)
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      console.error('❌ [API] Supabase auth error:', error.message)
      return null
    }

    if (!user) {
      console.log('❌ [API] No user found in session')
      return null
    }

    console.log('✅ [API] Authenticated user:', { id: user.id, email: user.email })
    return { id: user.id, email: user.email || '' }
  } catch (error) {
    console.error('❌ [API] Auth error:', error)
    return null
  }
}

// GET: Fetch a specific trading account
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const authUser = await getAuthUser(req)

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const account = await db.tradingAccount.findFirst({
      where: {
        id: params.id,
        user_id: authUser.id,
        is_active: true
      }
    })

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
    const authUser = await getAuthUser(req)

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const updates: Record<string, any> = {}

    if (body.name !== undefined) {
      updates.name = body.name
    }
    if (body.broker !== undefined) {
      updates.broker = body.broker
    }
    if (body.account_type !== undefined) {
      updates.account_type = body.account_type
    }
    if (body.account_number !== undefined) {
      updates.account_number = body.account_number
    }
    if (body.initial_balance !== undefined) {
      updates.initial_balance = Number(body.initial_balance)
    }
    if (body.current_balance !== undefined) {
      updates.current_balance = Number(body.current_balance)
    }
    if (body.leverage !== undefined) {
      updates.leverage = Number(body.leverage)
    }
    if (body.currency !== undefined) {
      updates.currency = body.currency
    }
    if (body.is_default !== undefined) {
      updates.is_default = body.is_default
    }
    if (body.is_active !== undefined) {
      updates.is_active = body.is_active
    }

    const account = await db.tradingAccount.updateMany({
      where: {
        id: params.id,
        user_id: authUser.id
      },
      data: updates
    })

    if (account.count === 0) {
      return NextResponse.json({ error: 'Trading account not found' }, { status: 404 })
    }

    // Fetch updated account
    const updatedAccount = await db.tradingAccount.findUnique({
      where: { id: params.id }
    })

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
    const authUser = await getAuthUser(req)

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the account to be deleted first (to check if it's default)
    const accountToDelete = await db.tradingAccount.findFirst({
      where: {
        id: params.id,
        user_id: authUser.id,
        is_active: true
      }
    })

    if (!accountToDelete) {
      return NextResponse.json({ error: 'Trading account not found' }, { status: 404 })
    }

    // Check if this is the last account - prevent deletion
    const allAccounts = await db.tradingAccount.findMany({
      where: {
        user_id: authUser.id,
        is_active: true
      }
    })

    if (allAccounts.length <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last account. At least 1 account is required.' }, { status: 400 })
    }

    // Delete the account
    await db.tradingAccount.delete({
      where: { id: params.id }
    })

    // If we deleted the default account, set another account as default
    if (accountToDelete.is_default) {
      // Get the first remaining account
      const remainingAccounts = await db.tradingAccount.findMany({
        where: {
          user_id: authUser.id,
          is_active: true
        },
        take: 1
      })

      if (remainingAccounts.length > 0) {
        // Set it as default
        await db.tradingAccount.update({
          where: { id: remainingAccounts[0].id },
          data: { is_default: true }
        })
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
