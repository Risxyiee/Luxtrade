/**
 * Subscription Utility Functions
 * Handles PRO subscription status and expiry checking
 */

export interface UserSubscription {
  is_pro: boolean
  subscription_status: string
  subscription_until: string | null
}

/**
 * Check if user has active PRO subscription
 */
export function isProUser(subscription: UserSubscription | null | undefined): boolean {
  if (!subscription) return false
  if (!subscription.is_pro) return false
  if (subscription.subscription_status !== 'active') return false

  // Check if subscription is not expired
  if (!subscription.subscription_until) return false

  const now = new Date()
  const subscriptionUntil = new Date(subscription.subscription_until)
  return subscriptionUntil > now
}

/**
 * Get days remaining for PRO subscription
 */
export function getProDaysRemaining(subscription: UserSubscription | null | undefined): number {
  if (!isProUser(subscription)) return 0

  const subscriptionUntil = new Date(subscription!.subscription_until!)
  const now = new Date()
  const diff = subscriptionUntil.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

  return Math.max(0, days)
}

/**
 * Get formatted expiry date for PRO subscription
 */
export function getProExpiryDate(subscription: UserSubscription | null | undefined): string | null {
  if (!subscription?.subscription_until) return null
  return new Date(subscription.subscription_until).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

/**
 * Check if user has ever been PRO
 */
export function hasEverBeenPro(subscription: UserSubscription | null | undefined): boolean {
  return subscription?.has_ever_been_pro === true || subscription?.is_pro === true
}

/**
 * Get subscription status text for UI
 */
export function getSubscriptionStatusText(subscription: UserSubscription | null | undefined): string {
  if (isProUser(subscription)) {
    const days = getProDaysRemaining(subscription)
    return days > 0 ? `PRO (${days} hari tersisa)` : 'PRO (kedaluwarsa)'
  }

  if (hasEverBeenPro(subscription)) {
    return 'Expired'
  }

  return 'FREE'
}

/**
 * Check if user can access a PRO feature
 * Returns object with access status and reason
 */
export function canAccessProFeature(
  subscription: UserSubscription | null | undefined,
  featureName: string = 'fitur ini'
): { canAccess: boolean; reason: string; daysRemaining: number } {
  if (isProUser(subscription)) {
    const days = getProDaysRemaining(subscription)
    return {
      canAccess: true,
      reason: '',
      daysRemaining: days
    }
  }

  if (subscription?.subscription_until) {
    const now = new Date()
    const expiredDate = new Date(subscription.subscription_until)
    if (expiredDate <= now) {
      return {
        canAccess: false,
        reason: `Langganan PRO Anda telah kedaluwarsa pada ${getProExpiryDate(subscription)}`,
        daysRemaining: 0
      }
    }
  }

  return {
    canAccess: false,
    reason: `${featureName} hanya tersedia untuk pengguna PRO. Upgrade untuk mengakses semua fitur premium!`,
    daysRemaining: 0
  }
}

/**
 * Validate subscription from Supabase user metadata
 */
export function validateSubscriptionFromMetadata(metadata: any): UserSubscription {
  return {
    is_pro: metadata?.is_pro === true,
    subscription_status: metadata?.subscription_status || 'inactive',
    subscription_until: metadata?.subscription_until || null
  }
}
