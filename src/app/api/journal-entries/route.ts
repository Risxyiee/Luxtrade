export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/api-auth'
import { isUserPro, countUserJournalsThisMonth, FREE_JOURNAL_LIMIT } from '@/lib/pro-check'
import { rateLimitByUser } from '@/lib/rate-limit'

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
      console.error('[journal-entries GET] Supabase query error:', error.message)
      return NextResponse.json({ entries: [] })
    }

    return NextResponse.json({ entries: data || [] })
  } catch (error) {
    console.error('[journal-entries GET] Unexpected error:', error)
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

    // Rate limit: 10 writes per minute per user
    const rl = rateLimitByUser('journal-write', authUser.id, {
      maxRequests: 10,
      windowMs: 60_000,
      message: 'Terlalu banyak permintaan. Tunggu 1 menit.',
    })
    if (rl) return rl

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
      console.error('[journal-entries] DB error:', error.message)
      return NextResponse.json({ error: 'Failed to process journal entry' }, { status: 500 })
    }

    return NextResponse.json({ entry: data })
  } catch (error) {
    console.error('[journal-entries POST] Failed to create journal entry:', error)
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
    const { id, title, content, mood, market_condition, tags, image_url } = body

    if (!id) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 })
    }

    // SECURITY: Only allow updating specific fields (prevent mass assignment)
    const updates: Record<string, unknown> = {}
    if (title !== undefined) updates.title = title
    if (content !== undefined) updates.content = content
    if (mood !== undefined) updates.mood = mood
    if (market_condition !== undefined) updates.market_condition = market_condition
    if (tags !== undefined) updates.tags = JSON.stringify(tags)
    if (image_url !== undefined) updates.image_url = image_url

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
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
      console.error('[journal-entries] DB error:', error.message)
      return NextResponse.json({ error: 'Failed to process journal entry' }, { status: 500 })
    }

    return NextResponse.json({ entry: data })
  } catch (error) {
    console.error('[journal-entries PUT] Failed to update journal entry:', error)
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
      console.error('[journal-entries] DB error:', error.message)
      return NextResponse.json({ error: 'Failed to process journal entry' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[journal-entries DELETE] Failed to delete entry:', error)
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 })
  }
}