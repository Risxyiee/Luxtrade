/**
 * Pricing Configuration for LuxTradee
 *
 * All pricing must be updated in this central location
 * to ensure consistency across the entire application.
 */

export const PRICING = {
  // PRO Subscription Plans
  PRO_30_DAYS: 49000,      // Rp49.000 / Bulan (diskon dari Rp100.000)
  PRO_30_DAYS_ORIGINAL: 100000, // Harga normal bulanan — tampil DICORET (anchor diskon, Bos: "awal 100 rb terus dicoret diskon")
  PRO_180_DAYS: 199000,    // Rp199.000 / 6 Bulan (Bos: "ubah aja biar ga aneh" — dulu admin tampil 749rb & tagihan URL 120rb, sama2 aneh vs tahunan 390rb)
  PRO_ANNUAL: 390000,     // Rp390.000 / Tahun (hemat ~5 bulan vs bulanan baru)
  PRO_LIFETIME: 299000,    // Rp299.000 (Lifetime - Founding Member, 30 slot)

  // Legacy pricing — CATATAN SEJARAH harga lama (tidak dipakai lagi utk tagihan baru)
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
  // Legacy plan aliases — map ke harga modern (tagihan baru SEMUA dari PRICING utama)
  if (plan === 'LIFETIME_ULTRA') return PRICING.PRO_LIFETIME
  if (plan === 'PRO_180_DAYS') return PRICING.PRO_180_DAYS

  return PRICING[plan]
}

/**
 * Harga normal (sebelum diskon) utk tampilan coret — Bos: bulanan
 * ditampilkan "Rp100.000 dicoret → Rp49.000" biar menarik.
 * Tangga harga resmi: 49rb/1bln → 199rb/6bln → 390rb/12bln → 299rb lifetime.
 */
export function getPlanOriginalPrice(plan: PricingPlan): number | null {
  if (plan === 'PRO_30_DAYS') return PRICING.PRO_30_DAYS_ORIGINAL
  return null
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