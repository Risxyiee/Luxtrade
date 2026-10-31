import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/security/csp-report — penerima pelanggaran CSP (report-only).
 *
 * Konteks (security audit #6, 2026-11-01):
 *   Header Content-Security-Policy-Report-Only dipasang di next.config.ts.
 *   Browser mengirim laporan pelanggaran KE SINI — jangan diabaikan, ini
 *   datanya untuk merancang CSP ENFORCE yang tidak merusak fitur.
 *   Mode report-only = NOL dampak ke user (browser tidak memblokir apa pun).
 *
 * Desain endpoint:
 *   • Tanpa auth (dipanggil browser otomatis, bukan user)
 *   • Rate limit per-IP 60/menit (anti spam)
 *   • Body dibatasi & hanya di-console.log → tertangkap Workers Observability
 *   • Selalu balas 204 (browser berhenti retry kalau 2xx tidak diberikan)
 */
export async function POST(request: NextRequest) {
  const limited = checkRateLimit(request, 'csp-report', {
    maxRequests: 60,
    windowMs: 60_000,
  }, 'ip')
  if (limited) return limited

  try {
    const contentType = request.headers.get('content-type') || ''
    const raw = await request.text()

    // Batasi ukuran (report normal < 4KB)
    if (raw.length > 8192) {
      return new NextResponse(null, { status: 204 })
    }

    if (contentType.includes('replies+json') || contentType.includes('json')) {
      // Application/reports+json → array; application/csp-report → { "csp-report": {...} }
      const parsed: unknown = JSON.parse(raw)
      const report = Array.isArray(parsed) ? parsed[0] : parsed
      const inner = (report as Record<string, unknown>)?.['csp-report'] || report
      console.warn('[csp-report]', JSON.stringify(inner).slice(0, 1500))
    } else {
      console.warn('[csp-report] unparsed content-type:', contentType, raw.slice(0, 500))
    }
  } catch {
    // Laporan rusak → abaikan diam-diam, tetap 204
  }

  return new NextResponse(null, { status: 204 })
}
