import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/api-auth'
import { sendEmail } from '@/lib/email'

// POST - Send email backup of trading data
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { supabase } = createClientForApi(request)

    // Fetch trades, journal entries, and watchlist in parallel
    const [tradesRes, journalRes, watchlistRes] = await Promise.all([
      supabase
        .from('trades')
        .select('*')
        .eq('user_id', authUser.id)
        .order('close_time', { ascending: false }),
      supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('watchlist')
        .select('*')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false }),
    ])

    const trades = tradesRes.data || []
    const journals = journalRes.data || []
    const watchlist = watchlistRes.data || []

    // Calculate trade stats
    const totalTrades = trades.length
    const wins = trades.filter((t: Record<string, unknown>) => (t.profit_loss as number) >= 0).length
    const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0'
    const totalPL = trades.reduce((sum: number, t: Record<string, unknown>) => sum + (t.profit_loss as number), 0)

    const now = new Date()
    const dateStr = now.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    // Build trades detail section
    let tradesDetail = ''
    if (trades.length > 0) {
      tradesDetail = '\nDETAILED TRADES:\n' + '='.repeat(40) + '\n'
      for (const trade of trades.slice(0, 100)) {
        const t = trade as Record<string, unknown>
        const pl = t.profit_loss as number
        const plStr = pl >= 0 ? `+$${pl.toFixed(2)}` : `-$${Math.abs(pl).toFixed(2)}`
        const openDate = new Date(t.open_time as string).toLocaleDateString('id-ID')
        const symbol = t.symbol as string
        const type = t.type as string
        const lots = t.lot_size as number
        tradesDetail += `  [${openDate}] ${symbol} ${type} ${lots}lot → ${plStr}\n`
      }
      if (trades.length > 100) {
        tradesDetail += `  ... and ${trades.length - 100} more trades\n`
      }
    }

    // Build journal detail section
    let journalDetail = ''
    if (journals.length > 0) {
      journalDetail = '\nDETAILED JOURNAL ENTRIES:\n' + '='.repeat(40) + '\n'
      for (const entry of journals.slice(0, 50)) {
        const e = entry as Record<string, unknown>
        const date = new Date(e.created_at as string).toLocaleDateString('id-ID')
        const title = e.title as string
        const mood = e.mood as string | null
        const moodStr = mood ? ` [${mood}]` : ''
        journalDetail += `  [${date}]${moodStr} ${title}\n`
      }
      if (journals.length > 50) {
        journalDetail += `  ... and ${journals.length - 50} more entries\n`
      }
    }

    // Build watchlist detail section
    let watchlistDetail = ''
    if (watchlist.length > 0) {
      watchlistDetail = '\nWATCHLIST ITEMS:\n' + '='.repeat(40) + '\n'
      for (const item of watchlist) {
        const w = item as Record<string, unknown>
        const symbol = w.symbol as string
        const name = w.name as string | null
        const target = w.target_price as number | null
        const notes = w.notes as string | null
        let line = `  • ${symbol}`
        if (name) line += ` (${name})`
        if (target) line += ` — Target: ${target}`
        if (notes) line += `\n    Notes: ${notes}`
        watchlistDetail += line + '\n'
      }
    }

    // Compose email body
    const plainTextBody = [
      `LuxTrade Data Backup — ${dateStr}`,
      '================================',
      '',
      'TRADES SUMMARY:',
      `  - Total: ${totalTrades} trades`,
      `  - Win Rate: ${winRate}%`,
      `  - Total P/L: ${totalPL >= 0 ? '+' : ''}$${totalPL.toFixed(2)}`,
      '',
      `JOURNAL ENTRIES: ${journals.length} entries`,
      `WATCHLIST: ${watchlist.length} items`,
      tradesDetail,
      journalDetail,
      watchlistDetail,
      '',
      '—',
      'This is an automated backup from LuxTrade.',
      `Generated at: ${now.toISOString()}`,
    ].join('\n')

    // Send email
    const result = await sendEmail({
      to: authUser.email,
      subject: `LuxTrade Data Backup — ${dateStr}`,
      html: `<pre style="font-family: monospace; font-size: 13px; line-height: 1.6; white-space: pre-wrap; color: #e2e8f0; background: #1a1a2e; padding: 24px; border-radius: 12px;">${plainTextBody.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`,
    })

    if (!result.success) {
      const errorMsg = result.error === 'Email service not configured'
        ? 'Email service not configured'
        : 'Failed to send backup email'
      return NextResponse.json({ error: errorMsg }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[email-backup] Error:', error)
    return NextResponse.json({ error: 'Failed to send backup email' }, { status: 500 })
  }
}