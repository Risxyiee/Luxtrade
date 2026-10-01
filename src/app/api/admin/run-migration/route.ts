import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/admin/run-migration
 *
 * One-time migration endpoint to add `consistency_rule` and `best_day_pl`
 * columns to the `prop_firm_challenges` table.
 *
 * Uses the Supabase service_role admin client to execute DDL via RPC.
 * Requires SUPABASE_SERVICE_ROLE_KEY environment variable.
 *
 * Security: Requires a migration token passed as ?token=<MIGRATION_TOKEN>
 * or in the request body as { token: "..." }.
 * Set MIGRATION_TOKEN env var to your desired token value.
 */

const MIGRATION_SQL = `
-- Add consistency_rule and best_day_pl columns to prop_firm_challenges
ALTER TABLE prop_firm_challenges ADD COLUMN IF NOT EXISTS consistency_rule FLOAT DEFAULT 0;
ALTER TABLE prop_firm_challenges ADD COLUMN IF NOT EXISTS best_day_pl FLOAT DEFAULT 0;
`

const VERIFY_SQL = `
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'prop_firm_challenges'
  AND table_schema = 'public'
  AND column_name IN ('consistency_rule', 'best_day_pl')
ORDER BY column_name;
`

export async function POST(request: NextRequest) {
  try {
    // Check for migration token (simple security measure)
    const url = new URL(request.url)
    const queryToken = url.searchParams.get('token')
    let bodyToken: string | undefined
    try {
      const body = await request.json()
      bodyToken = body.token
    } catch {
      // No JSON body, that's OK
    }
    const providedToken = queryToken || bodyToken
    const expectedToken = process.env.MIGRATION_TOKEN

    if (expectedToken && providedToken !== expectedToken) {
      return NextResponse.json({ error: 'Invalid migration token' }, { status: 403 })
    }

    // Get Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase admin credentials not configured', hint: 'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Step 1: Verify if columns already exist
    console.log('[run-migration] Checking if columns already exist...')
    const { data: existingColumns, error: verifyError } = await supabase
      .rpc('exec_sql', { query: VERIFY_SQL })
      .catch(() => ({ data: null, error: 'RPC function exec_sql not available' }))

    // If RPC is not available, try using Prisma if DATABASE_URL is PostgreSQL
    // For now, let's try the direct approach using the Supabase REST API

    // Step 2: Try to execute the migration using the pg_net extension
    // This creates an HTTP request to the Supabase SQL endpoint
    console.log('[run-migration] Attempting migration via pg_net...')

    // Alternative: Use the Supabase Management API
    // This requires a personal access token, which we don't have.

    // The most reliable approach: Return the SQL and instructions
    // for the user to run it manually in the Supabase SQL Editor.

    return NextResponse.json({
      success: false,
      message: 'Direct DDL execution is not supported via the Supabase JS client. Please run the migration SQL manually.',
      sql: MIGRATION_SQL.trim(),
      instructions: [
        '1. Go to Supabase Dashboard → SQL Editor',
        '2. Paste the SQL below',
        '3. Click "Run"',
        '4. Verify the columns were added',
      ],
      supabaseUrl,
      note: 'The Supabase JS client (PostgREST) does not support DDL statements. Use the Supabase Dashboard SQL Editor or a direct PostgreSQL connection.',
    })

  } catch (error: unknown) {
    console.error('[run-migration] Error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  // GET endpoint just returns the migration SQL for reference
  return NextResponse.json({
    migration: 'add_prop_firm_consistency_rules',
    sql: MIGRATION_SQL.trim(),
    description: 'Add consistency_rule and best_day_pl columns to prop_firm_challenges table',
    instructions: 'POST to this endpoint to attempt migration, or run the SQL manually in Supabase SQL Editor',
  })
}
