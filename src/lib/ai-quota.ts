import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

const FREE_AI_QUOTA = 10

/**
 * AI quota helpers — versi Supabase (F1 perf fix).
 *
 * DULU: pakai Prisma (`db.profile.*`) — di Cloudflare Workers Prisma di-stub
 * jadi proxy yang melempar error (lihat src/lib/db.ts) → endpoint quota
 * selalu 500. Sekarang pakai service-role Supabase client, aman di Workers.
 *
 * Fail-open: kalau service client tak tersedia, jangan blokir AI — cukup
 * log + perlakukan sebagai belum terlacak (degrade gracefully).
 */

interface ProfileQuota {
  is_pro: boolean | null
  ai_free_quota_used: number | null
}

async function fetchProfileQuota(userId: string): Promise<ProfileQuota | null> {
  const admin = getSupabaseAdmin()
  if (!admin) {
    console.warn('[ai-quota] Supabase service client tidak tersedia — fail-open')
    return null
  }
  const { data, error } = await admin
    .from('profiles')
    .select('is_pro, ai_free_quota_used')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.warn('[ai-quota] Gagal baca profile:', error.message)
    return null
  }
  return (data as ProfileQuota) ?? null
}

/**
 * Check if user has free AI quota remaining
 * @param userId - User ID
 * @returns { hasQuota: boolean, remaining: number, requiresUpgrade: boolean }
 */
export async function checkAIQuota(userId: string): Promise<{
  hasQuota: boolean
  remaining: number
  requiresUpgrade: boolean
}> {
  const profile = await fetchProfileQuota(userId)

  if (!profile) {
    // Fail-open: tak terlacak → izinkan (jangan blokir AI karena infra error)
    return { hasQuota: true, remaining: FREE_AI_QUOTA, requiresUpgrade: false }
  }

  // PRO users have unlimited access
  if (profile.is_pro) {
    return { hasQuota: true, remaining: 999, requiresUpgrade: false }
  }

  // Check free quota
  const used = profile.ai_free_quota_used || 0
  const remaining = Math.max(0, FREE_AI_QUOTA - used)

  return {
    hasQuota: remaining > 0,
    remaining,
    requiresUpgrade: remaining === 0,
  }
}

/**
 * Increment AI quota usage for free user
 * @param userId - User ID
 * @returns success or false
 */
export async function incrementAIQuota(userId: string): Promise<boolean> {
  try {
    const profile = await fetchProfileQuota(userId)

    if (!profile) return true // fail-open: tak bisa melacak, jangan blokir
    if (profile.is_pro) return true // PRO users don't need quota tracking

    const used = profile.ai_free_quota_used || 0
    if (used >= FREE_AI_QUOTA) return false // Quota exhausted

    const admin = getSupabaseAdmin()
    if (!admin) return true

    const { error } = await admin
      .from('profiles')
      .update({ ai_free_quota_used: used + 1 })
      .eq('id', userId)

    if (error) {
      console.error('[incrementAIQuota] Gagal update:', error.message)
      return false
    }

    return true
  } catch (error) {
    console.error('[incrementAIQuota] Error:', error)
    return false
  }
}

/**
 * Get remaining AI quota for user
 * @param userId - User ID
 * @returns remaining quota
 */
export async function getRemainingAIQuota(userId: string): Promise<number> {
  const { remaining } = await checkAIQuota(userId)
  return remaining
}

/**
 * Get AI quota info for display
 * @param userId - User ID
 * @returns { total: number, used: number, remaining: number, isPro: boolean }
 */
export async function getAIQuotaInfo(userId: string): Promise<{
  total: number
  used: number
  remaining: number
  isPro: boolean
}> {
  const profile = await fetchProfileQuota(userId)

  if (!profile) {
    return { total: FREE_AI_QUOTA, used: 0, remaining: FREE_AI_QUOTA, isPro: false }
  }

  if (profile.is_pro) {
    return { total: 999, used: 0, remaining: 999, isPro: true }
  }

  const used = profile.ai_free_quota_used || 0
  const remaining = Math.max(0, FREE_AI_QUOTA - used)

  return {
    total: FREE_AI_QUOTA,
    used,
    remaining,
    isPro: false,
  }
}
