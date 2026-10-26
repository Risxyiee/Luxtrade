/**
 * ============================================================
 * /api/agent-proposals — Antrean Proposal Agen Otonom (Task 34)
 * ============================================================
 * GET  → daftar ai_pending_actions status 'pending' (untuk UI
 *        "Antrean Eksekusi" di Dashboard Alexander).
 * POST ?run=sweep → jalankan semua detektor trigger (7 agen) —
 *        dipanggil cron tiap 15 menit (worker-entry) atau manual CEO.
 *
 * AUTH (sama pola dengan ceo-agent):
 *   - Authorization: Bearer <supabase token Bos>  (email = OWNER_EMAIL)
 *   - ATAU ?key=CRON_SECRET / ADMIN_SECRET (dari cron worker-entry)
 * Tanpa auth → 401. TIDAK ada akses anon.
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  envGet, sbConfig, ownerEmail, listPendingActions, runProposalSweep,
} from '@/lib/agent-proposals'

function isCronAuthorized(req: NextRequest): boolean {
  const key = req.nextUrl.searchParams.get('key') || ''
  if (!key) return false
  const secret = envGet('CRON_SECRET') || envGet('ADMIN_SECRET')
  return !!secret && key === secret
}

/** Bearer token Bos → verifikasi ke Supabase auth → cocokkan OWNER_EMAIL. */
async function isOwnerAuthorized(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return false
  const token = authHeader.slice(7).trim()
  if (!token) return false
  const cfg = sbConfig()
  if (!cfg.url || !cfg.anon) return false
  try {
    const res = await fetch(`${cfg.url}/auth/v1/user`, {
      headers: { apikey: cfg.anon, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return false
    const user = (await res.json()) as { email?: string }
    return (user?.email || '').toLowerCase().trim() === ownerEmail()
  } catch { return false }
}

async function guard(req: NextRequest): Promise<NextResponse | null> {
  if (isCronAuthorized(req)) return null
  if (await isOwnerAuthorized(req)) return null
  return NextResponse.json({ error: 'Unauthorized — khusus CEO (Bos) atau cron internal.' }, { status: 401 })
}

export async function GET(req: NextRequest) {
  const denied = await guard(req)
  if (denied) return denied
  const cfg = sbConfig()
  const r = await listPendingActions(cfg, 50)
  return NextResponse.json(
    { ok: r.ok, tableReady: r.tableReady, count: r.actions.length, actions: r.actions },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(req: NextRequest) {
  const denied = await guard(req)
  if (denied) return denied
  const run = req.nextUrl.searchParams.get('run') || ''
  if (run !== 'sweep') {
    return NextResponse.json({ error: "Parameter ?run=sweep wajib (mis. /api/agent-proposals?run=sweep)" }, { status: 400 })
  }
  const cfg = sbConfig()
  const result = await runProposalSweep(cfg)
  console.log(`[agent-proposals] sweep selesai — proposal baru: ${result.created}`)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
