import { db } from '@/lib/db'

/**
 * Check if a user has an active PRO subscription.
 * Returns true if user is PRO and subscription hasn't expired.
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

    return false
  } catch {
    return false
  }
}

/**
 * Count user's journal entries for current month.
 */
export async function countUserJournalsThisMonth(userId: string): Promise<number> {
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const count = await db.journalEntry.count({
      where: {
        user_id: userId,
        created_at: {
          gte: startOfMonth
        }
      }
    })

    return count
  } catch {
    return 0
  }
}

/** Free user limits */
export const FREE_JOURNAL_LIMIT = 10