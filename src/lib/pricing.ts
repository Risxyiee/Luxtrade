/**
 * Pricing Configuration for LuxTrade
 *
 * All pricing must be updated in this central location
 * to ensure consistency across the entire application.
 */

export const PRICING = {
  // PRO Subscription Plans (PROMO PRICES)
  PRO_30_DAYS: 48000,      // Rp48.000 (Promo Price)
  PRO_180_DAYS: 250000,     // Rp250.000
  PRO_LIFETIME: 52000,      // Rp52.000 (Lifetime Promo Price)

  // Legacy pricing (for reference)
  LEGACY: {
    PRO_30_DAYS: 149000,     // Old price
    PRO_180_DAYS: 749000,    // Old price
    PRO_365_DAYS: 1499000,   // Old price
    LIFETIME_ULTRA: 100000,   // Old price (Rp100.000)
  },
} as const

export type PricingPlan = 'PRO_30_DAYS' | 'PRO_180_DAYS' | 'PRO_LIFETIME' | 'LIFETIME_ULTRA'

/**
 * Get duration in days for a pricing plan
 */
export function getPlanDuration(plan: PricingPlan): number {
  switch (plan) {
    case 'PRO_30_DAYS':
      return 30
    case 'PRO_180_DAYS':
      return 180
    case 'PRO_LIFETIME':
      return 365 * 5 // 5 years for lifetime
    case 'LIFETIME_ULTRA':
      return 365 * 5 // 5 years for lifetime
  }
}

/**
 * Get price in Rupiah for a pricing plan
 */
export function getPlanPrice(plan: PricingPlan): number {
  // Map LIFETIME_ULTRA to PRO_LIFETIME for backward compatibility
  if (plan === 'LIFETIME_ULTRA') {
    return PRICING.PRO_LIFETIME
  }
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
