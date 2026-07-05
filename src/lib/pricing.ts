/**
 * Pricing Configuration for LuxTrade
 *
 * All pricing must be updated in this central location
 * to ensure consistency across the entire application.
 */

export const PRICING = {
  // PRO Subscription Plans
  PRO_30_DAYS: 39000,      // Rp39.000 / Bulan
  PRO_ANNUAL: 390000,     // Rp390.000 / Tahun (hemat 2 bulan)
  PRO_LIFETIME: 299000,    // Rp299.000 (Lifetime - Founding Member, 30 slot)

  // Legacy pricing (for grandfathering existing subscribers)
  LEGACY: {
    PRO_30_DAYS: 25000,
    PRO_180_DAYS: 120000,
    PRO_LIFETIME: 52000,
    LIFETIME_ULTRA: 100000,
    PRO_365_DAYS: 1499000,
  },
} as const

export type PricingPlan = 'PRO_30_DAYS' | 'PRO_ANNUAL' | 'PRO_LIFETIME' | 'LIFETIME_ULTRA' | 'PRO_180_DAYS'

/**
 * Get duration in days for a pricing plan
 */
export function getPlanDuration(plan: PricingPlan): number {
  switch (plan) {
    case 'PRO_30_DAYS':
      return 30
    case 'PRO_ANNUAL':
      return 365
    case 'PRO_LIFETIME':
      return 365 * 50 // 50 years for lifetime
    case 'LIFETIME_ULTRA':
      return 365 * 50 // 50 years for lifetime
    case 'PRO_180_DAYS':
      return 180
  }
}

/**
 * Get price in Rupiah for a pricing plan
 */
export function getPlanPrice(plan: PricingPlan): number {
  // Legacy plans — return old prices for existing subscribers
  if (plan === 'LIFETIME_ULTRA') return PRICING.PRO_LIFETIME
  if (plan === 'PRO_180_DAYS') return PRICING.LEGACY.PRO_180_DAYS

  return PRICING[plan]
}

/**
 * Format price to Rupiah string
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Get formatted price for a pricing plan
 */
export function getPlanPriceFormatted(plan: PricingPlan): string {
  return formatRupiah(getPlanPrice(plan))
}