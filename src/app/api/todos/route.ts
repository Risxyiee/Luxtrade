export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ todos: [] })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ todos: [] })

    const { data: profile } = await supabase
      .from('profiles')
      .select('achievements')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ todos: [] })

    const achievements = (profile?.achievements as Record<string, unknown>) || {}
    const todos = achievements.trading_todos || []

    return NextResponse.json({ todos })
  } catch {
    return NextResponse.json({ todos: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { action, todoId, text, todos: syncTodos } = body

    const { data: profile } = await supabase
      .from('profiles')
      .select('achievements')
      .eq('id', user.id)
      .single()

    const achievements = ((profile?.achievements as Record<string, unknown>) || {}) as Record<string, unknown>
    let todos: Array<{ id: string; text: string; completed: boolean }> =
      (achievements.trading_todos as Array<{ id: string; text: string; completed: boolean }>) || []

    if (action === 'add' && text) {
      todos.push({ id: Date.now().toString(), text, completed: false })
    } else if (action === 'toggle' && todoId) {
      todos = todos.map(t => t.id === todoId ? { ...t, completed: !t.completed } : t)
    } else if (action === 'delete' && todoId) {
      todos = todos.filter(t => t.id !== todoId)
    } else if (action === 'sync' && Array.isArray(syncTodos)) {
      todos = syncTodos
    }

    achievements.trading_todos = todos

    await supabase
      .from('profiles')
      .update({ achievements })
      .eq('id', user.id)

    return NextResponse.json({ todos })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}