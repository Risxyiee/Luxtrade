import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

async function getAuthUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (!error && user) {
        return { id: user.id, email: user.email || '' }
      }
    }
    return null
  } catch {
    return null
  }
}

// GET - Fetch journal entries
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')

    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ entries: [] })
    }

    return NextResponse.json({ entries: data || [] })
  } catch {
    return NextResponse.json({ entries: [] })
  }
}

// POST - Create journal entry
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, content, mood, market_condition, tags, image_url } = body

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('journal_entries')
      .insert([{
        user_id: authUser.id,
        title,
        content,
        mood,
        market_condition,
        tags: tags ? JSON.stringify(tags) : null,
        image_url
      }])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ entry: data })
  } catch {
    return NextResponse.json({ error: 'Failed to create journal entry' }, { status: 500 })
  }
}

// PUT - Update journal entry
export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (updates.tags) {
      updates.tags = JSON.stringify(updates.tags)
    }

    const { data, error } = await supabase
      .from('journal_entries')
      .update(updates)
      .eq('id', id)
      .eq('user_id', authUser.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ entry: data })
  } catch {
    return NextResponse.json({ error: 'Failed to update journal entry' }, { status: 500 })
  }
}

// DELETE - Delete journal entry
export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', authUser.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 })
  }
}
