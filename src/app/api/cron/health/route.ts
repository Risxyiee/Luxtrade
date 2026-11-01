import { NextRequest, NextResponse } from 'next/server'
import { getCronAdmin } from '@/lib/cron-supabase'

/**
 * GET /api/cron/health
 * Status kesehatan cron CF Workers — dibaca dari tabel cron_runs
 * (diisi oleh /api/cron/health-alert setiap slot cron selesai: heartbeat
 * ok:true per route + baris ok:false untuk route gagal).
 *
 * Auth: Bearer CRON_SECRET / x-cron-secret (fail-closed di produksi).
 * Respons: per-route last ok / last fail + 50 run terakhir.
 */

export const dynamic = 'force-dynamic'

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const provided = String(
    request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.headers.get('x-cron-secret') ||
      ''
  ).trim()
  const cronSecret = String(process.env.CRON_SECRET || '').trim()
  const vapidKey = String(process.env.VAPID_PRIVATE_KEY || '').trim()
  const valid = [cronSecret, vapidKey].filter(Boolean)
  if (valid.length === 0) return process.env.NODE_ENV === 'development'
  return valid.includes(provided)
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = await getCronAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
  }

  try {
    const { data, error } = await admin
      .from('cron_runs')
      .select('route, ok, status, duration_ms, error, ran_at')
      .order('ran_at', { ascending: false })
      .limit(200)

    if (error) {
      return NextResponse.json(
        { error: 'Query failed — tabel cron_runs belum ada? Jalankan SQL 20261102.', detail: error.message },
        { status: 200 }
      )
    }

    const rows = (data || []) as Record<string, any>[]
    const perRoute: Record<string, {
      lastOk?: string
      lastFail?: string
      lastStatus?: number
      lastError?: string
      runs: number
      fails: number
    }> = {}

    for (const r of rows) {
      const k = String(r.route)
      perRoute[k] = perRoute[k] || { runs: 0, fails: 0 }
      perRoute[k].runs++
      if (r.ok) {
        if (!perRoute[k].lastOk) perRoute[k].lastOk = r.ran_at
      } else {
        if (!perRoute[k].lastFail) perRoute[k].lastFail = r.ran_at
        perRoute[k].fails++
        if (!perRoute[k].lastError && r.error) perRoute[k].lastError = r.error
      }
      if (!perRoute[k].lastStatus && r.status != null) perRoute[k].lastStatus = r.status
    }

    const now = Date.now()
    const STALE_MS = 40 * 60 * 1000 // slot */15 → 40 menit tanpa heartbeat = stale
    const alerts: string[] = []
    for (const [route, s] of Object.entries(perRoute)) {
      const newest = s.lastOk || s.lastFail
      if (route !== '(batch-ok)' && newest && now - new Date(newest).getTime() > STALE_MS) {
        alerts.push(`${route} stale (>40 menit tanpa run)`)
      }
      if (s.lastFail && !s.lastOk) alerts.push(`${route} SELALU gagal baru-baru ini`)
    }

    return NextResponse.json({
      source: 'db',
      checkedAt: new Date().toISOString(),
      alerts,
      perRoute,
      recent: rows.slice(0, 50),
    })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
