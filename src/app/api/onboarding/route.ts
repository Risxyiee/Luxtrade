import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { isDatabaseAvailable } from '@/lib/db'

async function ensureColumn() {
  try {
    await db.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'profiles' AND column_name = 'onboarding_completed'
        ) THEN
          ALTER TABLE profiles ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT false;
        END IF;
      END $$;
    `)
  } catch {
    // safe to ignore
  }
}

// GET: check onboarding status
export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth(request)
  if (error) return error

  if (!isDatabaseAvailable()) {
    return NextResponse.json({ completed: true })
  }

  try {
    await ensureColumn()
    const rows = await db.$queryRawUnsafe<{ onboarding_completed: boolean }[]>(
      `SELECT COALESCE(onboarding_completed, false) as onboarding_completed FROM profiles WHERE id = $1`,
      user.id
    )
    return NextResponse.json({ completed: rows.length > 0 ? rows[0].onboarding_completed : false })
  } catch {
    return NextResponse.json({ completed: false })
  }
}

// POST: mark onboarding as completed
export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth(request)
  if (error) return error

  if (!isDatabaseAvailable()) {
    return NextResponse.json({ completed: true })
  }

  try {
    await ensureColumn()
    await db.$executeRawUnsafe(
      `UPDATE profiles SET onboarding_completed = true, updated_at = now() WHERE id = $1`,
      user.id
    )
    return NextResponse.json({ completed: true })
  } catch {
    return NextResponse.json({ completed: true })
  }
}
