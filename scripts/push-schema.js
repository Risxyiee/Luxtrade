#!/usr/bin/env node
// Load and override DATABASE_URL from .env file
import { readFileSync } from 'fs'
import { execSync } from 'child_process'

// Read .env file
const envContent = readFileSync('.env', 'utf-8')
const lines = envContent.split('\n')

// Parse DATABASE_URL
for (const line of lines) {
  if (line.startsWith('DATABASE_URL=')) {
    const databaseUrl = line.split('=')[1]
    console.log('✅ DATABASE_URL loaded from .env')
    console.log('📝 Length:', databaseUrl.length)
    console.log('🔍 Starts with postgres:', databaseUrl.startsWith('postgres'))

    // Set as environment variable
    process.env.DATABASE_URL = databaseUrl

    // Run prisma db push
    try {
      console.log('\n🚀 Running: npx prisma db push\n')
      execSync('npx prisma db push', {
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: 'inherit'
      })
      console.log('\n✅ Schema pushed successfully!')
    } catch (error) {
      console.error('\n❌ Error:', error.message)
      process.exit(1)
    }
    break
  }
}
