import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { isDatabaseAvailable } from '@/lib/db'

async function ensurePublicProfileColumn() {
  try {
    await db.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'profiles' AND column_name = 'public_profile'
        ) THEN
          ALTER TABLE profiles ADD COLUMN public_profile BOOLEAN NOT NULL DEFAULT false;
        END IF;
      END $$;
    `)
  } catch {
    // Column may already exist
  }
}

// GET: Get current user's public profile status
export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth(request)
  if (error) return error

  if (!isDatabaseAvailable()) {
    return NextResponse.json({ publicProfile: false })
  }

  try {
    await ensurePublicProfileColumn()

    const rows = await db.$queryRawUnsafe<{ public_profile: boolean }[]>(
      `SELECT COALESCE(public_profile, false) as public_profile FROM profiles WHERE id = $1`,
      user.id
    )

    const isPublic = rows.length > 0 ? rows[0].public_profile : false
    return NextResponse.json({ publicProfile: isPublic })
  } catch (err: any) {
    console.error('[Public Profile GET] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch profile status' }, { status: 500 })
  }
}

// PUT: Toggle public profile on/off
export async function PUT(request: NextRequest) {
  const { error, user } = await requireAuth(request)
  if (error) return error

  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const { publicProfile } = body

    if (typeof publicProfile !== 'boolean') {
      return NextResponse.json({ error: 'publicProfile must be a boolean' }, { status: 400 })
    }

    await ensurePublicProfileColumn()

    await db.$executeRawUnsafe(
      `UPDATE profiles SET public_profile = $1, updated_at = now() WHERE id = $2`,
      publicProfile,
      user.id
    )

    return NextResponse.json({ publicProfile })
  } catch (err: any) {
    console.error('[Public Profile PUT] Error:', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
