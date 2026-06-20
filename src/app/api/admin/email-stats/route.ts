import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const ADMIN_EMAILS = ['luxtradee@gmail.com']

export async function GET(request: NextRequest) {
  try {
    // Admin check
    const adminEmail = request.headers.get('x-admin-email')
    if (!adminEmail || !ADMIN_EMAILS.includes(adminEmail.toLowerCase())) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    // Run all counts in parallel
    const [total, verified, unverified, pro, free] = await Promise.all([
      db.profile.count({ where: { email: { not: null } } }),
      db.profile.count({ where: { emailVerified: true, email: { not: null } } }),
      db.profile.count({ where: { emailVerified: false, email: { not: null } } }),
      db.profile.count({ where: { is_pro: true, email: { not: null } } }),
      db.profile.count({ where: { is_pro: false, emailVerified: true, email: { not: null } } }),
    ])

    // Get recent broadcasts (last 10)
    const recentBroadcasts = await db.emailBroadcast.findMany({
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

    return NextResponse.json({
      total,
      verified,
      unverified,
      pro,
      free,
      recentBroadcasts,
    })
  } catch (error: unknown) {
    console.error('❌ Email stats error:', error)
    const msg = error instanceof Error ? error.message : 'Terjadi kesalahan server'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
