#!/usr/bin/env node
/**
 * Generate VAPID Keys for LuxTradee Push Notifications
 *
 * Usage:
 *   node scripts/generate-vapid-keys.js
 *
 * This will output the keys you need to add to your .env file:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
 *   VAPID_PRIVATE_KEY=...
 *   VAPID_SUBJECT=mailto:support@luxtradee.web.id
 */

try {
  const webpush = require('web-push')
  const keys = webpush.generateVAPIDKeys()

  console.log('\n🔑 VAPID Keys Generated Successfully!\n')
  console.log('Add these to your .env file:\n')
  console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`)
  console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
  console.log('VAPID_SUBJECT=mailto:support@luxtradee.web.id\n')
  console.log('⚠️  Keep VAPID_PRIVATE_KEY secret — never commit it to version control!')
  console.log('    NEXT_PUBLIC_VAPID_PUBLIC_KEY is safe to expose (client-side).\n')
} catch (err) {
  console.error('❌ Failed to generate VAPID keys. Make sure web-push is installed:')
  console.error('   npm install web-push')
  console.error('   or: bun add web-push')
  process.exit(1)
}
