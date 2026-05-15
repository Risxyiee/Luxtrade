import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateDatabase() {
  console.log('🚀 Starting database migration for Achievement system...')

  try {
    // Add columns to users table
    console.log('Adding columns to users table...')

    await prisma.$executeRaw`
      ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS "streakCount" INTEGER DEFAULT 0
    `
    console.log('✅ Added streakCount column')

    await prisma.$executeRaw`
      ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP
    `
    console.log('✅ Added lastLoginAt column')

    await prisma.$executeRaw`
      ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'FREE'
    `
    console.log('✅ Added plan column')

    await prisma.$executeRaw`
      ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS "proExpiry" TIMESTAMP
    `
    console.log('✅ Added proExpiry column')

    await prisma.$executeRaw`
      ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'USER'
    `
    console.log('✅ Added role column')

    // Create user_submissions table
    console.log('Creating user_submissions table...')

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS public.user_submissions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        user_email TEXT,
        achievement_key TEXT NOT NULL,
        proof_link TEXT,
        proof_img TEXT,
        status TEXT DEFAULT 'PENDING',
        admin_note TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `
    console.log('✅ Created user_submissions table')

    // Create indexes for better performance
    console.log('Creating indexes...')

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_user_submissions_user_id ON public.user_submissions(user_id)
    `
    console.log('✅ Created index on user_id')

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_user_submissions_achievement_key ON public.user_submissions(achievement_key)
    `
    console.log('✅ Created index on achievement_key')

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_user_submissions_status ON public.user_submissions(status)
    `
    console.log('✅ Created index on status')

    console.log('✅ Database migration completed successfully!')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

migrateDatabase()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
