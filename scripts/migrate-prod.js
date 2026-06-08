#!/usr/bin/env bun
// Production migration script
// Usage: bun run migrate-prod

import { execSync } from 'child_process'

console.log('🚀 Starting production migration...\n')

try {
  // Check DATABASE_URL
  const dbUrl = process.env.DATABASE_URL

  if (!dbUrl) {
    console.error('❌ DATABASE_URL not found in environment')
    process.exit(1)
  }

  if (dbUrl.startsWith('file://') || dbUrl.startsWith('sqlite:')) {
    console.error('❌ DATABASE_URL is using SQLite, not PostgreSQL')
    console.error('Current:', dbUrl)
    console.error('\nPlease set DATABASE_URL to PostgreSQL for production')
    process.exit(1)
  }

  console.log('✅ DATABASE_URL is configured for PostgreSQL')
  console.log('Host:', dbUrl.split('@')[1].split('/')[0])
  console.log()

  // Run migration
  console.log('📦 Running Prisma migration...')
  execSync('prisma migrate deploy', { stdio: 'inherit' })

  console.log('\n✅ Migration completed successfully!')
} catch (error) {
  console.error('\n❌ Migration failed:', error.message)
  process.exit(1)
}