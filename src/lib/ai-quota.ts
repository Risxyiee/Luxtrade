import { db } from '@/lib/db'
import { Profile } from '@prisma/client'

const FREE_AI_QUOTA = 3

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
  const profile = await db.profile.findUnique({
    where: { id: userId },
    select: { is_pro: true, aiFreeQuotaUsed: true },
  })

  if (!profile) {
    return { hasQuota: false, remaining: 0, requiresUpgrade: true }
  }

  // PRO users have unlimited access
  if (profile.is_pro) {
    return { hasQuota: true, remaining: 999, requiresUpgrade: false }
  }

  // Check free quota
  const used = profile.aiFreeQuotaUsed || 0
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
    const profile = await db.profile.findUnique({
      where: { id: userId },
      select: { is_pro: true, aiFreeQuotaUsed: true },
    })

    if (!profile || profile.is_pro) {
      return true // PRO users don't need quota tracking
    }

    if (profile.aiFreeQuotaUsed >= FREE_AI_QUOTA) {
      return false // Quota exhausted
    }

    await db.profile.update({
      where: { id: userId },
      data: { aiFreeQuotaUsed: { increment: 1 } },
    })

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
  const profile = await db.profile.findUnique({
    where: { id: userId },
    select: { is_pro: true, aiFreeQuotaUsed: true },
  })

  if (!profile) {
    return { total: FREE_AI_QUOTA, used: 0, remaining: FREE_AI_QUOTA, isPro: false }
  }

  if (profile.is_pro) {
    return { total: 999, used: 0, remaining: 999, isPro: true }
  }

  const used = profile.aiFreeQuotaUsed || 0
  const remaining = Math.max(0, FREE_AI_QUOTA - used)

  return {
    total: FREE_AI_QUOTA,
    used,
    remaining,
    isPro: false,
  }
}