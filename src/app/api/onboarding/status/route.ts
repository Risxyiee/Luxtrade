import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

export const dynamic = 'force-dynamic'

// ============================================================================
// ONBOARDING STATUS — data nyata user buat auto-checklist (laporan Bos:
// "onboarding kurang interactive"). Step yang sudah BENERAN dikerjain user
// (punya akun, punya trade, nulis jurnal, isi watchlist) otomatis dicentang
// di tab Onboarding — bukan cuma diklik manual.
// Return: { accounts, trades, journal, watchlist }
// ============================================================================

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  const response = authResult.response
  const user = authResult.user
  if (response) return response
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ accounts: 0, trades: 0, journal: 0, watchlist: 0 })
  }

  const count = async (table: string): Promise<number> => {
    try {
      const { count, error } = await admin
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
      return error ? 0 : (count || 0)
    } catch {
      return 0
    }
  }

  const [accounts, trades, journal, watchlist] = await Promise.all([
    count('trading_accounts'),
    count('trades'),
    count('journal_entries'),
    count('watchlist'),
  ])

  return NextResponse.json({ accounts, trades, journal, watchlist })
}
