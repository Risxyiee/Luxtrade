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
 *
 * PAPAN LAPORAN CSP (FASE 4, 2026-10-31):
 *   Laporan kini JUGA disimpan ke tabel `csp_violations` (SQL 035) via
 *   Supabase REST + service key — best-effort via waitUntil: kegagalan
 *   insert TIDAK PERNAH mengganggu response 204 ke browser. Bos membaca
 *   hasilnya di /dashboard/admin/csp (API admin terpisah).
 *   Retensi 30 hari: ±2% request memicu penghapusan baris lama (tanpa cron).
 */

const RETENTION_DAYS = 30

/** Service-role Supabase REST base + headers, atau null bila belum diset. */
function getServiceRest(): { base: string; headers: Record<string, string> } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return {
    base: `${url.replace(/\/$/, '')}/rest/v1/csp_violations`,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
  }
}

/** Normalisasi dua format laporan (legacy csp-report vs modern reports+json). */
function extractReport(inner: Record<string, unknown>) {
  // Legacy: kebab-case (document-uri, violated-directive, ...)
  // Modern: camelCase (documentURL, effectiveDirective, ...)
  const g = (a: string, b: string) => inner[a] ?? inner[b] ?? null
  const str = (v: unknown, cap = 500) =>
    typeof v === 'string' ? v.slice(0, cap) : null
  const num = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) ? v : null

  const scriptSample = str(g('script-sample', 'sample'), 500)

  return {
    document_uri: str(g('document-uri', 'documentURL'), 500),
    violated_directive: str(g('violated-directive', 'violatedDirective'), 200),
    effective_directive: str(g('effective-directive', 'effectiveDirective'), 200),
    blocked_uri: str(g('blocked-uri', 'blockedURL'), 500),
    source_file: str(g('source-file', 'sourceFile'), 500),
    line_number: num(g('line-number', 'lineNumber')),
    column_number: num(g('column-number', 'columnNumber')),
    disposition: str(g('disposition', 'disposition'), 20),
    status_code: num(g('status-code', 'statusCode')),
    script_sample: scriptSample && scriptSample.length > 0 ? scriptSample : null,
    referrer: str(g('referrer', 'referrer'), 500),
  }
}

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
      const outer = (report as Record<string, unknown>) || {}
      const inner = (outer['csp-report'] ||
        (outer.type ? outer : null) ||
        report) as Record<string, unknown>

      if (inner && typeof inner === 'object') {
        const logLine = JSON.stringify(inner).slice(0, 1500)
        console.warn('[csp-report]', logLine)

        // ── Persist best-effort (FASE 4) — tidak pernah blokir 204 ──
        const rest = getServiceRest()
        if (rest) {
          const ua = request.headers.get('user-agent') || null
          const row = { ...extractReport(inner), user_agent: ua, raw: inner }

          const insertP = fetch(rest.base, {
            method: 'POST',
            headers: rest.headers,
            body: JSON.stringify(row),
          }).then((res) => {
            if (!res.ok) {
              console.warn('[csp-report] insert gagal:', res.status)
            }
          }).catch((e) => {
            console.warn('[csp-report] insert error:', e)
          })

          // waitUntil di CF Workers; di dev fire-and-forget biasa
          try {
            const sym = Symbol.for('__cloudflare-context__')
            const c = (globalThis as Record<symbol, unknown>)[sym] as
              | { ctx?: { waitUntil?: (x: Promise<unknown>) => void } }
              | undefined
            if (c?.ctx?.waitUntil) c.ctx.waitUntil(insertP)
          } catch { /* dev: promise jalan sendiri */ }

          // Retensi 30 hari — peluang kecil supaya murah (±2% request)
          if (Math.random() < 0.02) {
            const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400_000).toISOString()
            fetch(`${rest.base}?created_at=lt.${encodeURIComponent(cutoff)}`, {
              method: 'DELETE',
              headers: rest.headers,
            }).catch(() => { /* best-effort */ })
          }
        }
      }
    } else {
      console.warn('[csp-report] unparsed content-type:', contentType, raw.slice(0, 500))
    }
  } catch {
    // Laporan rusak → abaikan diam-diam, tetap 204
  }

  return new NextResponse(null, { status: 204 })
}
