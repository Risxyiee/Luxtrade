import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

// PERF (F2): cache PRO-status 60 dtk per user — SATU request dashboard
// memanggil isUserPro dari 5+ endpoint berbeda (analytics, watchlist,
// trading-accounts, profile/me, ...) → dulu 5+ query profiles IDENTIK
// per page-load. Downgrade/upgrade tetap instan lewat invalidateUserProCache
// yang dipanggil di titik tulis (webhook midtrans, promo, admin, reward).
const PRO_CACHE_TTL_MS = 60_000
const proCache = new Map<string, { value: boolean; expiry: number }>()

/** Hapus cache PRO untuk 1 user (panggil SETELAH menulis is_pro di profiles) */
export function invalidateUserProCache(userId: string): void {
  proCache.delete(userId)
}

/**
 * Check if a user has an active PRO subscription.
 * Reads directly from Supabase profiles table (source of truth — same as admin activate writes to).
 * Returns true if user is PRO and subscription hasn't expired.
 * Cached 60s — WAJIB panggil invalidateUserProCache(userId) setelah update is_pro.
 */
export async function isUserPro(userId: string): Promise<boolean> {
  const cached = proCache.get(userId)
  if (cached && Date.now() < cached.expiry) {
    return cached.value
  }
  const value = await computeIsUserPro(userId)
  proCache.set(userId, { value, expiry: Date.now() + PRO_CACHE_TTL_MS })
  return value
}

async function computeIsUserPro(userId: string): Promise<boolean> {
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