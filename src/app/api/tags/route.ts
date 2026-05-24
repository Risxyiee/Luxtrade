import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'

async function getAuthUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
  try {
    const supabase = createClientForApi(request)
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
