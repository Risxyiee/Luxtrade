export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { isUserPro } from '@/lib/pro-check'

/** Get a Supabase client with user session (cookie or Bearer token) */
function getClientWithAuth(request: NextRequest) {
  // Try cookie-based first
  const { supabase: cookieClient } = createClientForApi(request)
  // Also create a Bearer-based client as fallback
  const authHeader = request.headers.get('Authorization')
  let bearerClient: ReturnType<typeof createClient> | null = null
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    bearerClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    // Store token for later use
    ;(bearerClient as any)._bearerToken = token
  }
  return { cookieClient, bearerClient }
}

async function getUserWithSession(request: NextRequest) {
  const { cookieClient, bearerClient } = getClientWithAuth(request)

  // Try cookie-based
  let { data: { user }, error } = await cookieClient.auth.getUser()
  if (user) return { user, client: cookieClient }

  // Try Bearer token
  if (bearerClient) {
    const token = (bearerClient as any)._bearerToken
    const result = await bearerClient.auth.getUser(token)
    if (result.data.user) return { user: result.data.user, client: bearerClient }
  }

  return { user: null, client: cookieClient }
}

// GET - Fetch watchlist
export async function GET(request: NextRequest) {
  try {
    const { user, client } = await getUserWithSession(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await client
      .from('watchlist')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      console.error('[watchlist GET] Supabase error:', error)
      return NextResponse.json({ items: [] })
    }

    const items = (data || []).map(item => ({
      id: item.id,
      symbol: item.symbol,
      name: item.name,
      target_price: item.target_price,
      notes: item.notes,
      created_at: item.created_at,
    }))

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[watchlist GET] Error:', error)
    return NextResponse.json({ items: [] })
  }
}

// POST - Add to watchlist
export async function POST(request: NextRequest) {
  try {
    const { user, client } = await getUserWithSession(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pro = await isUserPro(user.id)
    if (!pro) {
      return NextResponse.json({ error: 'PRO_REQUIRED', code: 'PRO_REQUIRED' }, { status: 403 })
    }

    const body = await request.json()

    if (!body.symbol || !body.symbol.trim()) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 })
    }

    const { data: item, error } = await client
      .from('watchlist')
      .insert([{
        user_id: user.id,
        symbol: body.symbol.toUpperCase(),
        name: body.name || body.symbol.toUpperCase(),
        target_price: body.target_price ? parseFloat(body.target_price) : null,
        notes: body.notes || null,
      }])
      .select()
      .single()

    if (error) {
      console.error('[watchlist POST] Supabase error:', error)
      return NextResponse.json({ error: 'Failed to add to watchlist' }, { status: 500 })
    }

    return NextResponse.json({
      item: {
        id: item.id,
        symbol: item.symbol,
        name: item.name,
        target_price: item.target_price,
        notes: item.notes,
        created_at: item.created_at,
      }
    })
  } catch (error: any) {
    console.error('[watchlist POST] Error:', error)
    return NextResponse.json({ error: 'Failed to add to watchlist' }, { status: 500 })
  }
}

// DELETE - Remove from watchlist
export async function DELETE(request: NextRequest) {
  try {
    const { user, client } = await getUserWithSession(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
    }

    // Delete with user_id guard ensures ownership (also enforced by RLS)
    const { error } = await client
      .from('watchlist')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('[watchlist DELETE] Supabase error:', error)
      return NextResponse.json({ error: 'Failed to remove from watchlist' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[watchlist DELETE] Error:', error)
    return NextResponse.json({ error: 'Failed to remove from watchlist' }, { status: 500 })
  }
}
