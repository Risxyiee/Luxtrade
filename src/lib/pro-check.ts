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

// FREEMIUM BARU (9 Nov): limit jurnal free DIHAPUS — jurnal unlimited gratis selamanya
// (posisi produk Bos: "kita kan jurnal bukan jualan sinyal"). Tembok upgrade = fitur AI.