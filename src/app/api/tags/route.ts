import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/api-auth'

// GET - Fetch all user tags
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { supabase } = createClientForApi(request)

    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ tags: [] })
    }

    return NextResponse.json({ tags: data || [] })
  } catch (error) {
    console.error('[API /tags GET] Error:', error)
    return NextResponse.json({ tags: [] })
  }
}

// POST - Create new tag
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { supabase } = createClientForApi(request)

    const body = await request.json()
    const { name, color } = body

    if (!name) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('tags')
      .insert([{
        user_id: authUser.id,
        name,
        color: color || '#3b82f6'
      }])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
    }

    return NextResponse.json({ tag: data })
  } catch (error) {
    console.error('[API /tags POST] Error:', error)
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
  }
}
