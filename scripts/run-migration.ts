import { PrismaClient } from '@prisma/client'

// Use a simple approach - don't override the datasource
const prisma = new PrismaClient()

async function migrateDatabase() {
  console.log('🚀 Starting database migration for Achievement system...')
  console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...')

  try {
    // Test connection
    await prisma.$connect()
    console.log('✅ Connected to database')

    // Check if columns already exist
    const existingColumns = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND table_schema = 'public'
    `
    const columnNames = existingColumns.map((col: any) => col.column_name.toLowerCase())

    console.log('Existing columns:', columnNames)

    // Add columns to users table if they don't exist
    if (!columnNames.includes('streakcount')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE public.users ADD COLUMN "streakCount" INTEGER DEFAULT 0`)
      console.log('✅ Added streakCount column')
    } else {
      console.log('✓ streakCount column already exists')
    }

    if (!columnNames.includes('lastloginat')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE public.users ADD COLUMN "lastLoginAt" TIMESTAMP`)
      console.log('✅ Added lastLoginAt column')
    } else {
      console.log('✓ lastLoginAt column already exists')
    }

    if (!columnNames.includes('plan')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE public.users ADD COLUMN plan TEXT DEFAULT 'FREE'`)
      console.log('✅ Added plan column')
    } else {
      console.log('✓ plan column already exists')
    }

    if (!columnNames.includes('proexpiry')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE public.users ADD COLUMN "proExpiry" TIMESTAMP`)
      console.log('✅ Added proExpiry column')
    } else {
      console.log('✓ proExpiry column already exists')
    }

    if (!columnNames.includes('role')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE public.users ADD COLUMN role TEXT DEFAULT 'USER'`)
      console.log('✅ Added role column')
    } else {
      console.log('✓ role column already exists')
    }

    // Create user_submissions table if it doesn't exist
    const existingTables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'user_submissions'
      AND table_schema = 'public'
    `
    const tableExists = existingTables.length > 0

    if (!tableExists) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE public.user_submissions (
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
      `)
      console.log('✅ Created user_submissions table')

      // Create indexes for better performance
      await prisma.$executeRawUnsafe(`CREATE INDEX idx_user_submissions_user_id ON public.user_submissions(user_id)`)
      console.log('✅ Created index on user_id')

      await prisma.$executeRawUnsafe(`CREATE INDEX idx_user_submissions_achievement_key ON public.user_submissions(achievement_key)`)
      console.log('✅ Created index on achievement_key')

      await prisma.$executeRawUnsafe(`CREATE INDEX idx_user_submissions_status ON public.user_submissions(status)`)
      console.log('✅ Created index on status')
    } else {
      console.log('✓ user_submissions table already exists')
    }

    console.log('✅ Database migration completed successfully!')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

migrateDatabase()
  .then(() => {
    console.log('Migration completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
