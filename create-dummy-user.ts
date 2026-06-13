import { db } from './src/lib/db'
import { randomUUID } from 'crypto'

async function createDummyUser() {
  try {
    const dummyUserId = randomUUID()
    const dummyEmail = 'test-user@example.com'

    console.log('=== Creating Dummy User for Testing ===\n')
    console.log('User ID:', dummyUserId)
    console.log('Email:', dummyEmail)

    // Create profile
    const profile = await db.profile.create({
      data: {
        id: dummyUserId,
        email: dummyEmail,
        full_name: 'Test User',
        plan: 'FREE',
        is_pro: false,
        role: 'USER',
        streakCount: 0,
        bestStreak: 0,
        achievements: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    })

    console.log('\n✅ Profile created successfully!')

    // Create a default trading account
    const account = await db.tradingAccount.create({
      data: {
        user_id: dummyUserId,
        name: 'Demo Account',
        broker: 'Exness',
        account_type: 'DEMO',
        account_number: '12345678',
        initial_balance: 1000,
        current_balance: 1000,
        leverage: 100,
        currency: 'USD',
        is_default: true,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      }
    })

    console.log('✅ Trading account created successfully!')

    console.log('\n=== Summary ===')
    console.log('User ID:', dummyUserId)
    console.log('Email:', dummyEmail)
    console.log('Account ID:', account.id)
    console.log('Account Name:', account.name)
    console.log('\nYou can now use this User ID to test the API:')
    console.log(`POST /api/trading-accounts/test-create`)
    console.log(`Body: { "user_id": "${dummyUserId}", "name": "My Account", "account_type": "REAL", "initial_balance": 5000, "currency": "USD" }`)

    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

createDummyUser()