/**
 * Seed Promo Code - TRADERCEPAT
 * Diskon 100% selama 3 bulan untuk 30 user pertama
 */

import { db } from '../src/lib/db'

async function seedPromoCode() {
  console.log('🎫 Seeding promo code: TRADERCEPAT')

  try {
    // Check if promo code already exists
    const existingPromo = await db.promoCode.findUnique({
      where: { code: 'TRADERCEPAT' }
    })

    if (existingPromo) {
      console.log('⚠️ Promo code TRADERCEPAT already exists')
      console.log('📊 Current status:', {
        code: existingPromo.code,
        maxQuota: existingPromo.maxQuota,
        usedQuota: existingPromo.usedQuota,
        remainingQuota: existingPromo.maxQuota - existingPromo.usedQuota,
        discountPercent: existingPromo.discountPercent,
        durationMonths: existingPromo.durationMonths,
        isActive: existingPromo.isActive
      })

      // Ask if user wants to reset
      console.log('\n💡 If you want to reset the quota, use the API or delete and recreate')
      return existingPromo
    }

    // Create new promo code
    const promoCode = await db.promoCode.create({
      data: {
        code: 'TRADERCEPAT',
        description: 'Diskon 100% untuk 3 bulan - Khusus 30 trader pertama!',
        discountPercent: 100,
        maxQuota: 30,
        usedQuota: 0,
        durationMonths: 3,
        startDate: new Date(),
        endDate: null, // No expiry date
        isActive: true
      }
    })

    console.log('✅ Promo code created successfully!')
    console.log('📊 Details:', {
      code: promoCode.code,
      description: promoCode.description,
      discountPercent: `${promoCode.discountPercent}%`,
      maxQuota: promoCode.maxQuota,
      usedQuota: promoCode.usedQuota,
      remainingQuota: promoCode.maxQuota - promoCode.usedQuota,
      durationMonths: promoCode.durationMonths,
      isActive: promoCode.isActive
    })

    console.log('\n🎯 Usage:')
    console.log('   User akan mendapatkan akses PREMIUM selama 3 bulan GRATIS')
    console.log('   Setelah kuota 30 habis, kode otomatis tidak bisa digunakan lagi')

    return promoCode
  } catch (error) {
    console.error('❌ Error seeding promo code:', error)
    throw error
  }
}

// Run seed
seedPromoCode()
  .then(() => {
    console.log('\n✅ Seed complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Seed failed:', error)
    process.exit(1)
  })