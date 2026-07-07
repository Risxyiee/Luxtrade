import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

/**
 * Check if a user has an active PRO subscription.
 * Reads directly from Supabase profiles table (source of truth — same as admin activate writes to).
 * Returns true if user is PRO and subscription hasn't expired.
 */
export async function isUserPro(userId: string): Promise<boolean> {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      console.error('❌ [isUserPro] Supabase admin client not available')
      return false
    }

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('is_pro, subscription_until, pro_status, pro_expiry')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('❌ [isUserPro] Failed to query profiles table:', error.message)
      return false
    }

    if (!profile) {
      console.warn(`[isUserPro] No profile found for user ${userId}`)
      return false
    }

    if (!profile.is_pro) return false

    // Check expiry from subscription_until or pro_expiry
    const untilStr = profile.subscription_until || profile.pro_expiry
    if (!untilStr) return false

    const until = new Date(untilStr)
    const isActive = until > new Date()

    if (!isActive) {
      console.log(`[isUserPro] User ${userId} PRO expired at ${untilStr}`)
    }

    return isActive
  } catch (error) {
    console.error('❌ [isUserPro] Unexpected error for user', userId, ':', error)
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

    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      console.error('❌ [countUserJournalsThisMonth] Supabase admin client not available')
      return 0
    }

    const { count, error } = await supabaseAdmin
      .from('journal_entries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString())

    if (error) {
      console.error('❌ [countUserJournalsThisMonth] Failed to query journal_entries:', error.message)
      return 0
    }

    return count ?? 0
  } catch (error) {
    console.error('❌ [countUserJournalsThisMonth] Unexpected error for user', userId, ':', error)
    return 0
  }
}

/** Free user limits */
export const FREE_JOURNAL_LIMIT = 10