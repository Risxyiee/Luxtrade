/**
 * Streak tracking — client-safe, calls API routes instead of importing Prisma directly.
 * This file must NOT import from `@/lib/db` to avoid leaking Prisma into client bundles.
 */

/**
 * Update user's login streak when they login.
 * Calls the profile/me API which handles streak logic server-side.
 */
export async function updateLoginStreak(userId: string): Promise<number> {
  try {
    const res = await fetch('/api/profile/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-streak' }),
    })
    if (res.ok) {
      const data = await res.json()
      return data.streakCount || 0
    }
    return 0
  } catch (error) {
    console.error('[Streak Tracker] Error updating login streak:', error)
    return 0
  }
}

/**
 * Check and update achievements based on login streak.
 * Calls an API route server-side to avoid importing Prisma in client.
 */
export async function checkStreakAchievements(userId: string, streak: number): Promise<void> {
  try {
    await fetch('/api/achievements/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, streak, type: 'login_streak' }),
    })
  } catch (error) {
    console.error('[Streak Tracker] Error checking streak achievements:', error)
  }
}
