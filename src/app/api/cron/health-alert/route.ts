import { NextRequest, NextResponse } from 'next/server'
import { getCronAdmin } from '@/lib/cron-supabase'
import { sendEmail } from '@/lib/email'
import { pushToUser } from '@/lib/push-notify'
import { ADMIN_EMAILS } from '@/lib/admin-auth'

/**
 * POST /api/cron/health-alert
 * Health monitor: dipanggil worker-entry SETELAH batch cron selesai
 * (SELALU — failures boleh kosong = heartbeat sukses semua route).
 *
 *   failures kosong   → catat heartbeat ok:true per route ke cron_runs
 *   failures > 0      → catat ok:false per failure + push & email ke admin
 *
 * Body: { cron: "slot-15-menit-an", failures: [{ route, status?, error? }], checked?: [routes], ts }
 * Auth: Bearer CRON_SECRET / x-cron-secret (fail-closed di produksi).
 * Throttle push/email: maks 1 alarm per 30 menit (anti-spam, isolate-local).
 * Riwayat run tersimpan di tabel cron_runs (SQL 20261102) — status bisa
 * dibaca via GET /api/cron/health.
 */
export const dynamic = 'force-dynamic'

// Throttle in-memory: 1 alarm per 30 menit (hilang saat isolate recycle —
// worst case Bos dapat 2 alarm, lebih baik daripada cron mati senyap).
const THROTTLE_MS = 30 * 60 * 1000
let lastAlertAt = 0

function isAuthorized(request: NextRequest): boolean {
  const provided = String(
    request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.headers.get('x-cron-secret') ||
      ''
  ).trim()
  const secret = String(process.env.CRON_SECRET || '').trim()
  if (!secret) return process.env.NODE_ENV === 'development'
  return provided === secret
}

interface Failure {
  route: string
  status?: number
  error?: string
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { cron?: string; failures?: Failure[]; checked?: string[]; ts?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const cronLabel = body.cron || 'unknown-slot'
  const failures = (body.failures || []).filter(f => f?.route)
  // Daftar route yang dicek worker di slot ini (untuk heartbeat ok:true)
  const checked = (Array.isArray(body.checked) ? body.checked : [])
    .filter((r: unknown) => typeof r === 'string' && r)
    .map((r: string) => String(r).slice(0, 200))

  const admin = await getCronAdmin()

  // ── Riwayat ke cron_runs (best effort — kegagalan DB tidak boleh
  //    memblokir alarm push/email) ──
  if (admin) {
    try {
      const rows: Record<string, unknown>[] = []
      const failedSet = new Set(failures.map(f => f.route))
      // Heartbeat sukses per route (yang tidak gagal)
      for (const r of checked) {
        if (!failedSet.has(r)) {
          rows.push({ cron: cronLabel, route: r, ok: true, status: 200 })
        }
      }
      // Gagal per route
      for (const f of failures) {
        rows.push({
          cron: cronLabel,
          route: String(f.route).slice(0, 200),
          ok: false,
          status: Number.isFinite(f.status as number) ? f.status : null,
          error: f.error ? String(f.error).slice(0, 300) : null,
        })
      }
      if (rows.length > 0) {
        await admin.from('cron_runs').insert(rows)
      }
      // Retensi: peluang 1/20 bersihkan run > 7 hari (murah & cukup)
      if (Math.random() < 0.05) {
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        await admin.from('cron_runs').delete().lt('ran_at', cutoff)
      }
    } catch (e: any) {
      console.error('[health-alert] record failed:', e?.message || e)
    }
  }

  // Semua sukses — tidak ada alarm, cukup heartbeat
  if (failures.length === 0) {
    return NextResponse.json({ success: true, heartbeat: true })
  }

  const now = Date.now()
  if (now - lastAlertAt < THROTTLE_MS) {
    return NextResponse.json({ success: true, throttled: true, message: 'alert sent recently' })
  }
  lastAlertAt = now

  const failedLabel = failures
    .map(f => `${f.route}${f.status ? ` → ${f.status}` : ''}${f.error ? ` (${f.error})` : ''}`)
    .join(' | ')
  const title = '🩺 Cron Bermasalah'

  // Push admin — resolve user id dari email admin
  let pushSent = false
  try {
    if (admin) {
      const { data: adminProfiles } = await admin
        .from('profiles')
        .select('id')
        .in('email', ADMIN_EMAILS)
        .limit(3)
      for (const p of adminProfiles || []) {
        const r = await pushToUser(admin, p.id, {
          title,
          body: `${cronLabel}: ${failures.length} route gagal — ${failedLabel.substring(0, 120)}`,
          url: '/dashboard',
          tag: 'cron-health',
          type: 'general',
          urgency: 'high',
        })
        if (r.sent > 0) pushSent = true
      }
    }
  } catch (e: any) {
    console.error('[health-alert] push failed:', e?.message || e)
  }

  // Email admin — jalur kedua kalau push tidak sampai
  let emailSent = false
  if (ADMIN_EMAILS.length > 0) {
    try {
      const rows = failures
        .map(
          f =>
            `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:monospace">${f.route}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${f.status ?? '—'}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${f.error ?? ''}</td></tr>`
        )
        .join('')
      const html = `<div style="font-family:sans-serif;max-width:640px">
        <h2 style="color:#dc2626">🩺 Cron Health Alert — LuxTradee</h2>
        <p>Slot cron <b style="font-family:monospace">${cronLabel}</b> melaporkan <b>${failures.length} route gagal</b> pada ${new Date().toISOString()} UTC.</p>
        <table style="border-collapse:collapse;width:100%;font-size:13px">
          <thead><tr style="background:#f7f7f7"><th align="left" style="padding:6px 10px">Route</th><th align="left" style="padding:6px 10px">Status</th><th align="left" style="padding:6px 10px">Error</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="color:#666;font-size:12px;margin-top:16px">Alarm otomatis dari worker-entry health monitor. Maks 1 email per 30 menit.</p>
      </div>`
      const emailResult = await sendEmail({
        to: ADMIN_EMAILS[0],
        subject: `🩺 Cron bermasalah: ${failures.length} route gagal (${cronLabel}) — LuxTradee`,
        html,
      })
      emailSent = !!emailResult?.success
    } catch (e: any) {
      console.error('[health-alert] email failed:', e?.message || e)
    }
  }

  return NextResponse.json({
    success: true,
    pushSent,
    emailSent,
    failures: failures.length,
  })
}

export async function GET(request: NextRequest) {
  return POST(request)
}
