import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Debug endpoint — lists all columns in the profiles table with full details
 * Usage: GET /api/debug/columns?table=profiles
 * Also runs DROP NOT NULL on all columns to fix the 23502 issue.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const table = searchParams.get('table') || 'profiles'

  try {
    // Get all columns with full details
    const columns = await db.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable, column_default, character_maximum_length, udt_name
      FROM information_schema.columns
      WHERE table_name = '${table}' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `) as any[]

    // Get NOT NULL constraints
    const notNullConstraints = await db.$queryRawUnsafe(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = '${table}' AND tc.table_schema = 'public';
    `) as any[]

    const pkColumns = notNullConstraints.map((c: any) => c.column_name)

    // Try to DROP NOT NULL on all non-PK columns
    const results: { column: string; action: string; status: string }[] = []
    for (const col of columns) {
      if (pkColumns.includes(col.column_name)) continue
      try {
        await db.$executeRawUnsafe(
          `ALTER TABLE ${table} ALTER COLUMN ${col.column_name} DROP NOT NULL;`
        )
        results.push({ column: col.column_name, action: 'DROP NOT NULL', status: 'ok' })
      } catch (err: any) {
        results.push({ column: col.column_name, action: 'DROP NOT NULL', status: err.message?.slice(0, 80) || 'failed' })
      }
    }

    return NextResponse.json({ 
      table, 
      columns: columns.map(c => ({
        name: c.column_name,
        type: c.data_type,
        nullable: c.is_nullable,
        default: c.column_default,
      })),
      pkColumns,
      dropNotNullResults: results,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
