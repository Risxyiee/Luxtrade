import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable, ensureSchema } from '@/lib/db'

const ADMIN_EMAILS = ['luxtradee@gmail.com']

export async function GET(request: NextRequest) {
  try {
    // Admin check
    const adminEmail = request.headers.get('x-admin-email')
    if (!adminEmail || !ADMIN_EMAILS.includes(adminEmail.toLowerCase())) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    // Auto-migrate: ensure all tables exist before querying
    await ensureSchema()

    // Run profile counts in parallel
    const [total, verified, unverified, pro, free] = await Promise.all([
      db.profile.count({ where: { email: { not: null } } }),
      db.profile.count({ where: { emailVerified: true, email: { not: null } } }),
      db.profile.count({ where: { emailVerified: false, email: { not: null } } }),
      db.profile.count({ where: { is_pro: true, email: { not: null } } }),
      db.profile.count({ where: { is_pro: false, emailVerified: true, email: { not: null } } }),
    ])

    // Get recent broadcasts — wrapped in try/catch so missing table doesn't crash everything
    let recentBroadcasts: any[] = []
    try {
      recentBroadcasts = await db.emailBroadcast.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          target: true,
          subject: true,
          sentCount: true,
          failedCount: true,
          sentBy: true,
          createdAt: true,
        },
      })
    } catch (broadcastErr: any) {
      // Table might not exist yet — return empty instead of crashing
      console.warn('⚠️ [EMAIL-STATS] Could not fetch broadcasts (table may not exist):', broadcastErr?.message)
      recentBroadcasts = []
    }

    return NextResponse.json({
      total,
      verified,
      unverified,
      pro,
      free,
      recentBroadcasts,
      notice: recentBroadcasts.length === 0 ? 'Tabel email_broadcasts mungkin belum ada. Jalankan /api/admin/db-sync untuk membuatnya.' : undefined,
    })
  } catch (error: unknown) {
    console.error('❌ Email stats error:', error)
    const msg = error instanceof Error ? error.message : 'Terjadi kesalahan server'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}