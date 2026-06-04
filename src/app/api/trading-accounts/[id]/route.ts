/**
 * API Route: Trading Account by ID
 * GET - Get a specific trading account
 * PATCH - Update a trading account
 * DELETE - Delete a trading account
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// GET: Fetch a specific trading account
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignore in route handlers
            }
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create admin client
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabaseAdmin
      .from('trading_accounts')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Trading account not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data })
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
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignore in route handlers
            }
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const updates: Record<string, any> = {}

    if (body.metaapi_account_id !== undefined) {
      updates.metaapi_account_id = body.metaapi_account_id
    }
    if (body.status !== undefined) {
      updates.status = body.status
    }

    // Create admin client
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabaseAdmin
      .from('trading_accounts')
      .update(updates)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating trading account:', error)
      return NextResponse.json({ error: 'Failed to update trading account' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
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
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignore in route handlers
            }
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create admin client
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get the account to be deleted first (to check if it's default)
    const { data: accountToDelete, error: fetchError } = await supabaseAdmin
      .from('trading_accounts')
      .select('id, name, is_default')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !accountToDelete) {
      return NextResponse.json({ error: 'Trading account not found' }, { status: 404 })
    }

    // Check if this is the last account - prevent deletion
    const { data: allAccounts, error: countError } = await supabaseAdmin
      .from('trading_accounts')
      .select('id')
      .eq('user_id', user.id)

    if (countError) {
      return NextResponse.json({ error: 'Failed to check account count' }, { status: 500 })
    }

    if (allAccounts && allAccounts.length <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last account. At least 1 account is required.' }, { status: 400 })
    }

    // Delete the account
    const { error: deleteError } = await supabaseAdmin
      .from('trading_accounts')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting trading account:', deleteError)
      return NextResponse.json({ error: 'Failed to delete trading account' }, { status: 500 })
    }

    // If we deleted the default account, set another account as default
    if (accountToDelete.is_default) {
      // Get the first remaining account
      const { data: remainingAccounts } = await supabaseAdmin
        .from('trading_accounts')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)

      if (remainingAccounts && remainingAccounts.length > 0) {
        // Set it as default
        await supabaseAdmin
          .from('trading_accounts')
          .update({ is_default: true })
          .eq('id', remainingAccounts[0].id)
          .eq('user_id', user.id)
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
