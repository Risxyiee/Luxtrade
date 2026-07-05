import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { db } from '@/lib/db'

/**
 * Require admin authentication.
 * Returns { error, user } — if error is non-null, return it immediately.
 *
 * Usage:
 *   const { error, user } = await requireAdmin(request)
 *   if (error) return error
 */
export async function requireAdmin(request: NextRequest) {
  const user = await getAuthUser(request)

  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null,
    }
  }

  try {
    const profile = await db.profile.findUnique({
      where: { id: user.id },
      select: { role: true },
    })

    if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN')) {
      return {
        error: NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 }),
        user: null,
      }
    }

    return { error: null, user }
  } catch {
    return {
      error: NextResponse.json({ error: 'Internal error' }, { status: 500 }),
      user: null,
    }
  }
}