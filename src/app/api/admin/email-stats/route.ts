import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'
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

    // Default stats
    let stats = { total: 0, verified: 0, unverified: 0, pro: 0, free: 0 }
    let recentBroadcasts: any[] = []

    // Try Prisma (single query to minimize connections)
    if (isDatabaseAvailable()) {
      try {
        const allProfiles = await db.profile.findMany({
          where: { email: { not: null } },
          select: { emailVerified: true, is_pro: true },
        })

        stats.total = allProfiles.length
        stats.verified = allProfiles.filter(p => p.emailVerified).length
        stats.unverified = allProfiles.filter(p => !p.emailVerified).length
        stats.pro = allProfiles.filter(p => p.is_pro).length
        stats.free = allProfiles.filter(p => !p.is_pro && p.emailVerified).length
      } catch (prismaErr: any) {
        console.warn('⚠️ Prisma email-stats failed, falling back to Supabase:', prismaErr?.message?.substring(0, 100))
      }

      try {
        recentBroadcasts = await db.emailBroadcast.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, target: true, subject: true, sentCount: true, failedCount: true, sentBy: true, createdAt: true },
        })
      } catch { /* table may not exist */ }
    }

    // If Prisma returned 0 (DB unavailable or empty), try Supabase
    if (stats.total === 0) {
      const svc = getSupabaseAdmin()
      if (svc) {
        try {
          const { count: total } = await svc.from('profiles').select('*', { count: 'exact', head: true }).neq('email', null)
          const { count: verified } = await svc.from('profiles').select('*', { count: 'exact', head: true }).eq('email_verified', true).neq('email', null)
          const { count: pro } = await svc.from('profiles').select('*', { count: 'exact', head: true }).eq('is_pro', true)
          stats = {
            total: total || 0,
            verified: verified || 0,
            unverified: Math.max(0, (total || 0) - (verified || 0)),
            pro: pro || 0,
            free: Math.max(0, (verified || 0) - (pro || 0)),
          }
        } catch { /* skip */ }
      }
    }

    return NextResponse.json({ ...stats, recentBroadcasts })
  } catch (error: unknown) {
    console.error('❌ Email stats error:', error)
    const msg = error instanceof Error ? error.message : 'Terjadi kesalahan server'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}