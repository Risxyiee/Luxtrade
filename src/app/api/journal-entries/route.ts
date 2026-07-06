import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/api-auth'
import { isUserPro, countUserJournalsThisMonth, FREE_JOURNAL_LIMIT } from '@/lib/pro-check'

// GET - Fetch journal entries
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { supabase } = createClientForApi(request)
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

    // Check PRO status - free users limited to N journals per month
    const isPro = await isUserPro(authUser.id)
    if (!isPro) {
      const journalCount = await countUserJournalsThisMonth(authUser.id)
      if (journalCount >= FREE_JOURNAL_LIMIT) {
        return NextResponse.json({
          error: `Pengguna Free dibatasi maksimal ${FREE_JOURNAL_LIMIT} jurnal per bulan. Upgrade ke PRO untuk akses UNLIMITED!`,
          code: 'JOURNAL_LIMIT_EXCEEDED',
          limit: FREE_JOURNAL_LIMIT,
          current: journalCount,
          requiresUpgrade: true
        }, { status: 403 })
      }
    }

    const { supabase } = createClientForApi(request)
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

    if (!id) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 })
    }

    if (updates.tags) {
      updates.tags = JSON.stringify(updates.tags)
    }

    const { supabase } = createClientForApi(request)
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

    const { supabase } = createClientForApi(request)
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