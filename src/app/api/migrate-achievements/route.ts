import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST() {
  console.log('🚀 Starting database migration for Achievement system...')

  try {
    // Check if columns already exist
    const existingColumns = await db.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND table_schema = 'public'
    `
    const columnNames = (existingColumns as any[]).map(col => col.column_name.toLowerCase())

    console.log('Existing columns:', columnNames)

    // Add columns to users table if they don't exist
    if (!columnNames.includes('streakcount')) {
      await db.$executeRawUnsafe(`ALTER TABLE public.users ADD COLUMN "streakCount" INTEGER DEFAULT 0`)
      console.log('✅ Added streakCount column')
    } else {
      console.log('✓ streakCount column already exists')
    }

    if (!columnNames.includes('lastloginat')) {
      await db.$executeRawUnsafe(`ALTER TABLE public.users ADD COLUMN "lastLoginAt" TIMESTAMP`)
      console.log('✅ Added lastLoginAt column')
    } else {
      console.log('✓ lastLoginAt column already exists')
    }

    if (!columnNames.includes('plan')) {
      await db.$executeRawUnsafe(`ALTER TABLE public.users ADD COLUMN plan TEXT DEFAULT 'FREE'`)
      console.log('✅ Added plan column')
    } else {
      console.log('✓ plan column already exists')
    }

    if (!columnNames.includes('proexpiry')) {
      await db.$executeRawUnsafe(`ALTER TABLE public.users ADD COLUMN "proExpiry" TIMESTAMP`)
      console.log('✅ Added proExpiry column')
    } else {
      console.log('✓ proExpiry column already exists')
    }

    if (!columnNames.includes('role')) {
      await db.$executeRawUnsafe(`ALTER TABLE public.users ADD COLUMN role TEXT DEFAULT 'USER'`)
      console.log('✅ Added role column')
    } else {
      console.log('✓ role column already exists')
    }

    // Create user_submissions table if it doesn't exist
    const existingTables = await db.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'user_submissions'
      AND table_schema = 'public'
    `
    const tableExists = (existingTables as any[]).length > 0

    if (!tableExists) {
      await db.$executeRawUnsafe(`
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
      await db.$executeRawUnsafe(`CREATE INDEX idx_user_submissions_user_id ON public.user_submissions(user_id)`)
      console.log('✅ Created index on user_id')

      await db.$executeRawUnsafe(`CREATE INDEX idx_user_submissions_achievement_key ON public.user_submissions(achievement_key)`)
      console.log('✅ Created index on achievement_key')

      await db.$executeRawUnsafe(`CREATE INDEX idx_user_submissions_status ON public.user_submissions(status)`)
      console.log('✅ Created index on status')
    } else {
      console.log('✓ user_submissions table already exists')
    }

    console.log('✅ Database migration completed successfully!')

    return NextResponse.json({
      success: true,
      message: 'Database migration completed successfully'
    })
  } catch (error) {
    console.error('❌ Migration failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
