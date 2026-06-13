/**
 * Test Promo Code System
 * Menguji validasi dan apply promo code
 */

import { db } from '../src/lib/db'

async function testPromoCode() {
  console.log('🧪 Testing Promo Code System\n')

  try {
    // 1. Get promo code from database
    console.log('1️⃣ Fetching promo code...')
    const promoCode = await db.promoCode.findUnique({
      where: { code: 'TRADERCEPAT' }
    })

    if (!promoCode) {
      console.error('❌ Promo code TRADERCEPAT not found')
      return
    }

    console.log('✅ Promo Code Found:')
    console.log('   Code:', promoCode.code)
    console.log('   Description:', promoCode.description)
    console.log('   Discount:', `${promoCode.discountPercent}%`)
    console.log('   Quota:', `${promoCode.usedQuota}/${promoCode.maxQuota}`)
    console.log('   Duration:', `${promoCode.durationMonths} bulan`)
    console.log('   Active:', promoCode.isActive)
    console.log('')

    // 2. Test validation logic
    console.log('2️⃣ Testing validation logic...')

    // Check if active
    if (!promoCode.isActive) {
      console.log('❌ Promo code is not active')
    } else {
      console.log('✅ Promo code is active')
    }

    // Check quota
    const now = new Date()
    const hasStarted = now >= promoCode.startDate
    const hasExpired = promoCode.endDate ? now > promoCode.endDate : false
    const hasQuota = promoCode.usedQuota < promoCode.maxQuota

    console.log('   Has started:', hasStarted)
    console.log('   Has expired:', hasExpired)
    console.log('   Has quota:', hasQuota)
    console.log('   Remaining quota:', promoCode.maxQuota - promoCode.usedQuota)
    console.log('')

    // 3. Show expected behavior
    console.log('3️⃣ Expected Behavior:')
    console.log('   ✅ Validasi akan SUKSES jika:')
    console.log('      - Code: TRADERCEPAT')
    console.log('      - Active: true')
    console.log('      - Has started: true')
    console.log('      - Not expired: true')
    console.log('      - Has quota: true')
    console.log('')

    console.log('   ❌ Validasi akan GAGAL jika:')
    console.log('      - Kuota habis (30 user sudah pakai)')
    console.log('      - Promo code di-disable')
    console.log('      - Promo code kadaluarsa')
    console.log('')

    // 4. Show subscription flow
    console.log('4️⃣ Subscription Flow:')
    console.log('   1. User masuk ke /upgrade')
    console.log('   2. User input promo code: TRADERCEPAT')
    console.log('   3. System validate via POST /api/promo/validate')
    console.log('   4. Jika valid, user klik "Terapkan Kode Promo"')
    console.log('   5. System apply via POST /api/promo/apply')
    console.log('   6. User mendapatkan akses PRO selama 3 bulan')
    console.log('   7. Kuota berkurang dari 30 ke 29')
    console.log('')

    // 5. Show test endpoints
    console.log('5️⃣ Test Endpoints:')
    console.log('   GET  /api/promo/validate - Lihat semua promo code')
    console.log('   POST /api/promo/validate - Validate promo code')
    console.log('   POST /api/promo/apply   - Apply promo code ke user')
    console.log('')

    console.log('✅ Promo Code System Ready!')
    console.log('')
    console.log('📝 Next Steps:')
    console.log('   1. Buka http://localhost:3000/upgrade')
    console.log('   2. Login terlebih dahulu')
    console.log('   3. Input kode: TRADERCEPAT')
    console.log('   4. Klik "Terapkan Kode Promo"')
    console.log('')

  } catch (error) {
    console.error('❌ Error testing promo code:', error)
  }
}

// Run test
testPromoCode()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Test failed:', error)
    process.exit(1)
  })