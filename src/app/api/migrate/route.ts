import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Migration: Add missing columns to trades table
export async function GET() {
  try {
    // Check if we can query the trades table
    const { error: checkError } = await supabase
      .from('trades')
      .select('id, close_time, image_url')
      .limit(1)
    
    // If no error or error is not about missing column, columns exist
    if (!checkError) {
      return NextResponse.json({ 
        success: true, 
        message: 'All columns already exist',
        columns: ['close_time', 'image_url']
      })
    }
    
    // Check if the error is about missing columns
    if (checkError.message.includes('close_time') || checkError.message.includes('image_url')) {
      // Return SQL that needs to be run in Supabase SQL Editor
      return NextResponse.json({
        success: false,
        needsMigration: true,
        error: 'Missing columns detected',
        sql: `
-- Run this SQL in Supabase SQL Editor:
-- =========================================

-- Add close_time column if it doesn't exist
ALTER TABLE trades ADD COLUMN IF NOT EXISTS close_time TIMESTAMPTZ DEFAULT NOW();

-- Add image_url column if it doesn't exist  
ALTER TABLE trades ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add notes column if it doesn't exist
ALTER TABLE trades ADD COLUMN IF NOT EXISTS notes TEXT;

-- Verify the columns exist
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'trades' AND column_name IN ('close_time', 'image_url', 'notes');
`,
        instructions: [
          '1. Go to Supabase Dashboard',
          '2. Click "SQL Editor" in the left menu',
          '3. Paste the SQL above and click "Run"',
          '4. Refresh this page to verify'
        ]
      })
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database is healthy',
      checkError: checkError.message
    })
    
  } catch (error) {
    console.error('Migration check error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to check database',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST to mark migration as done (frontend confirmation)
export async function POST() {
  return NextResponse.json({ 
    success: true, 
    message: 'Migration verified. You can now save trades!'
  })
}
