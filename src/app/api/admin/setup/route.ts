import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Admin email - only this email can access admin panel
const ADMIN_EMAIL = 'luxtradee@gmail.com'

// SQL to add missing columns to profiles table
const SETUP_SQL = `
-- Add PRO status columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_status TEXT DEFAULT 'inactive';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_expiry_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_profiles_pro_status ON profiles(pro_status);
`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { adminEmail } = body

    // Verify admin access
    if (adminEmail !== ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access only.' },
        { status: 403 }
      )
    }

    // Since we can't run DDL via the Supabase client, return instructions
    return NextResponse.json({
      success: false,
      message: 'Please run the following SQL in Supabase SQL Editor:',
      sql: SETUP_SQL,
      instructions: [
        '1. Go to Supabase Dashboard',
        '2. Navigate to SQL Editor',
        '3. Paste and run the SQL above',
        '4. Refresh this page',
      ],
      note: 'After running the SQL, the admin panel will be fully functional.',
    })
  } catch (error) {
    console.error('Setup API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET to provide the SQL
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const adminEmail = searchParams.get('email')

  if (adminEmail !== ADMIN_EMAIL) {
    return NextResponse.json(
      { error: 'Unauthorized.' },
      { status: 403 }
    )
  }

  return NextResponse.json({
    sql: SETUP_SQL,
  })
}
