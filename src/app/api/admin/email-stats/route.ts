import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    let stats = { total: 0, verified: 0, unverified: 0, pro: 0, free: 0 }
    let recentBroadcasts: any[] = []

    const svc = getSupabaseAdmin()
    if (svc) {
      try {
        // Single query to get all profiles, count in-memory (1 connection)
        const { data: profiles } = await svc
          .from('profiles')
          .select('email_verified, is_pro')
          .not('email', 'is', null)

        if (profiles && profiles.length > 0) {
          stats.total = profiles.length
          stats.verified = profiles.filter(p => p.email_verified).length
          stats.unverified = profiles.filter(p => !p.email_verified).length
          stats.pro = profiles.filter(p => p.is_pro).length
          stats.free = profiles.filter(p => !p.is_pro && p.email_verified).length
        }
      } catch (err) {
        console.warn('⚠️ Supabase email-stats profiles failed:', err)
      }

      try {
        const { data: broadcasts } = await svc
          .from('email_broadcasts')
          .select('id, target, subject, sent_count, failed_count, sent_by, created_at')
          .order('created_at', { ascending: false })
          .limit(10)

        if (broadcasts) {
          recentBroadcasts = broadcasts.map(b => ({
            id: b.id,
            target: b.target,
            subject: b.subject,
            sentCount: b.sent_count,
            failedCount: b.failed_count,
            sentBy: b.sent_by,
            createdAt: b.created_at,
          }))
        }
      } catch { /* table may not exist */ }
    }

    return NextResponse.json({ ...stats, recentBroadcasts })
  } catch (error: unknown) {
    console.error('❌ Email stats error:', error)
    const msg = error instanceof Error ? error.message : 'Terjadi kesalahan server'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}