import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * Check if a user has an active PRO subscription.
 * Uses Prisma (same as trades API) for consistency.
 */
export async function isUserPro(userId: string): Promise<boolean> {
  try {
    const profile = await db.profile.findUnique({
      where: { id: userId },
      select: { is_pro: true, subscription_until: true }
    })

    if (!profile) return false

    // Check if subscription is still valid
    if (profile.is_pro && profile.subscription_until) {
      const until = new Date(profile.subscription_until)
      return until > new Date()
    }

    // Also check for LIFETIME plan (no expiry)
    if (profile.is_pro && !profile.subscription_until) {
      return true
    }

    return false
  } catch {
    return false
  }
}

/**
 * Require PRO — checks auth + PRO status.
 * Returns { error, user } — if error is set, return it immediately.
 * 
 * Usage:
 *   const { error, user } = await requirePro(request)
 *   if (error) return error
 *   // ... PRO-protected logic
 */
export async function requirePro(request: Request) {
  // Import dynamically to avoid circular deps
  const { getAuthUser } = await import('@/lib/api-auth')
  const user = await getAuthUser(request as any)

  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized', requiresAuth: true },
        { status: 401 }
      ),
      user: null,
    }
  }

  const pro = await isUserPro(user.id)
  if (!pro) {
    return {
      error: NextResponse.json(
        {
          error: 'Fitur ini hanya untuk pengguna PRO',
          requiresUpgrade: true,
        },
        { status: 403 }
      ),
      user,
    }
  }

  return { error: null, user, isPro: true }
}