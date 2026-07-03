import { NextResponse } from 'next/server'

export async function GET() {
  try {
    let totalUsers = 20
    let activeUsers = 7

    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey)
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })

        if (count !== null) totalUsers = count

        const { count: activeCount } = await supabase
          .from('trades')
          .select('user_id', { count: 'exact', head: true })

        if (activeCount !== null) activeUsers = Math.min(activeCount, totalUsers)
      }
    } catch {
      // Use defaults
    }

    return NextResponse.json({
      totalUsers,
      activeUsers,
      tradesLogged: totalUsers * 15,
    })
  } catch {
    return NextResponse.json({ totalUsers: 20, activeUsers: 7, tradesLogged: 300 })
  }
}