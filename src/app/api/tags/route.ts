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

// GET - Fetch all user tags
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ tags: [] })
    }

    return NextResponse.json({ tags: data || [] })
  } catch {
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
        color: color || '#a855f7'
      }])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tag: data })
  } catch {
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
  }
}
