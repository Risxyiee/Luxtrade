import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET|POST /api/cron/auto-sync-trades
 *
 * R.I.P. MetaApi auto-sync (2025-11): integrasi MetaApi DIHAPUS atas
 * keputusan Bos — token METAAPI_TOKEN di-retire dari Cloudflare secrets
 * dan seluruh lib/route-nya dihapus (src/lib/metaapi.ts, /api/metaapi/*).
 *
 * Route ini dipertahankan supaya scheduler lama yang masih memanggilnya
 * tidak mendapat 404 — sekarang selalu menjawab "integration removed".
 * Auth tetap fail-closed (CRON_SECRET wajib di produksi).
 */
export async function GET(request: NextRequest) {
  return handleRequest(request)
}

export async function POST(request: NextRequest) {
  return handleRequest(request)
}

async function handleRequest(request: NextRequest) {
  // Auth check — FAIL-CLOSED: tanpa CRON_SECRET, DITOLAK di produksi.
  const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET) {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'CRON_SECRET not configured — endpoint disabled (fail-closed)' }, { status: 403 })
    }
  } else if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    message: 'MetaApi integration removed — trades are now logged manually or via screenshot AI import',
    synced: 0,
    newTrades: 0,
    alertsSent: 0,
  })
}
