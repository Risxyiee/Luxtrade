import { db } from './src/lib/db'

async function testDatabase() {
  try {
    console.log('=== Testing Database ===\n')

    // Check profiles
    const profiles = await db.profile.findMany()
    console.log(`✅ Found ${profiles.length} profiles`)
    if (profiles.length > 0) {
      profiles.forEach((p, i) => {
        console.log(`\nProfile ${i + 1}:`)
        console.log(`  ID: ${p.id}`)
        console.log(`  Email: ${p.email}`)
        console.log(`  Plan: ${p.plan}`)
        console.log(`  Is PRO: ${p.is_pro}`)
        console.log(`  Role: ${p.role}`)
      })
    }

    // Check trading accounts
    const accounts = await db.tradingAccount.findMany()
    console.log(`\n✅ Found ${accounts.length} trading accounts`)
    if (accounts.length > 0) {
      accounts.forEach((a, i) => {
        console.log(`\nAccount ${i + 1}:`)
        console.log(`  ID: ${a.id}`)
        console.log(`  Name: ${a.name}`)
        console.log(`  User ID: ${a.user_id}`)
        console.log(`  Broker: ${a.broker}`)
        console.log(`  Type: ${a.account_type}`)
        console.log(`  Balance: ${a.initial_balance}`)
        console.log(`  Currency: ${a.currency}`)
        console.log(`  Is Default: ${a.is_default}`)
      })
    }

    // Check if profiles have matching accounts
    console.log('\n=== Checking Profile-Account Relations ===')
    for (const profile of profiles) {
      const userAccounts = await db.tradingAccount.findMany({
        where: { user_id: profile.id }
      })
      console.log(`\nProfile ${profile.email || profile.id}:`)
      console.log(`  Has ${userAccounts.length} trading accounts`)
    }

    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

testDatabase()