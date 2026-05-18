/**
 * Script to cleanup stuck trading accounts
 * Run with: bun run scripts/cleanup-stuck-accounts.ts
 */

const API_URL = process.env.API_URL || 'https://your-domain.vercel.app'

async function cleanupStuckAccounts() {
  console.log('🧹 Starting cleanup of stuck trading accounts...')

  try {
    const response = await fetch(`${API_URL}/api/trading-accounts/cleanup`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Cleanup failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    console.log('✅ Cleanup completed successfully!')
    console.log(`📊 Deleted ${data.deleted} stuck account(s)`)

    if (data.accounts && data.accounts.length > 0) {
      console.log('\n📋 Deleted accounts:')
      data.accounts.forEach((acc: any) => {
        console.log(`  - Account ${acc.account_number} (created: ${acc.created_at})`)
      })
    }

    return data
  } catch (error) {
    console.error('🔴 Error during cleanup:', error)
    throw error
  }
}

// Run cleanup if this script is executed directly
if (import.meta.main || require.main === module) {
  cleanupStuckAccounts()
    .then(() => {
      console.log('\n✨ Cleanup script finished')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 Cleanup script failed:', error)
      process.exit(1)
    })
}

export { cleanupStuckAccounts }
