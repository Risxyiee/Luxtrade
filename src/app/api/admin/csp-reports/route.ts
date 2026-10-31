import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@supabase/supabase-js'

/**
 * GET/DELETE /api/admin/csp-reports — papan laporan pelanggaran CSP.
 *
 * GET  : agregasi kelompok (directive × blocked_uri × document_uri) +
 *        sampel terbaru — bahan keputusan CSP ENFORCE.
 * DELETE: bersihkan semua baris (reset papan).
 *
 * Akses: requireAdmin (Bearer token Bos) + baca via SERVICE KEY —
 * tabel csp_violations RLS-nya terkunci (SQL 035, tanpa policy publik).
 */

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

interface CspRow {
  id: string
  document_uri: string | null
  violated_directive: string | null
  effective_directive: string | null
  blocked_uri: string | null
  source_file: string | null
  line_number: number | null
  disposition: string | null
  script_sample: string | null
  created_at: string
}

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const svc = getSupabaseAdmin()
    if (!svc) {
      return NextResponse.json(
        { error: 'SERVICE_ROLE_KEY belum diset — papan tidak bisa membaca data' },
        { status: 503 }
      )
    }

    const { data: rows, error: dbError } = await svc
      .from('csp_violations')
      .select('id, document_uri, violated_directive, effective_directive, blocked_uri, source_file, line_number, disposition, script_sample, created_at')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (dbError) {
      // Tabel belum dibuat (SQL 035 belum dijalankan) → jawab jujur
      return NextResponse.json(
        { error: `Gagal baca csp_violations: ${dbError.message}. Jalankan SQL 035 dulu.` },
        { status: 503 }
      )
    }

    const list: CspRow[] = rows || []
    const now = Date.now()
    const dayAgo = now - 86400_000

    // ── Agregasi per kelompok (directive × blocked × document) ──
    const groupMap = new Map<string, {
      effectiveDirective: string
      blockedUri: string
      documentUri: string
      count: number
      firstSeen: string
      lastSeen: string
      sourceFile: string | null
      sample: string | null
    }>()

    for (const r of list) {
      const directive = r.effective_directive || r.violated_directive || 'unknown'
      const blocked = r.blocked_uri || '(kosong)'
      const doc = r.document_uri || '(kosong)'
      const key = `${directive}|${blocked}|${doc}`
      const existing = groupMap.get(key)
      if (existing) {
        existing.count++
        if (r.created_at < existing.firstSeen) existing.firstSeen = r.created_at
        if (r.created_at > existing.lastSeen) existing.lastSeen = r.created_at
        if (!existing.sample && r.script_sample) existing.sample = r.script_sample
      } else {
        groupMap.set(key, {
          effectiveDirective: directive,
          blockedUri: blocked,
          documentUri: doc,
          count: 1,
          firstSeen: r.created_at,
          lastSeen: r.created_at,
          sourceFile: r.source_file,
          sample: r.script_sample,
        })
      }
    }

    const groups = Array.from(groupMap.values()).sort((a, b) => b.count - a.count)
    const last24h = list.filter(r => new Date(r.created_at).getTime() >= dayAgo).length

    return NextResponse.json({
      total: list.length,           // dipatok 1000 terbaru (batas query)
      last24h,
      uniqueDirectives: new Set(list.map(r => r.effective_directive || r.violated_directive || 'unknown')).size,
      groups,
      recent: list.slice(0, 50),
      truncated: list.length >= 1000,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[admin/csp-reports] error:', err)
    return NextResponse.json({ error: 'Gagal memuat laporan CSP' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const svc = getSupabaseAdmin()
    if (!svc) {
      return NextResponse.json({ error: 'SERVICE_ROLE_KEY belum diset' }, { status: 503 })
    }

    const { error: delError } = await svc
      .from('csp_violations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // hapus SEMUA baris

    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/csp-reports] DELETE error:', err)
    return NextResponse.json({ error: 'Gagal membersihkan laporan' }, { status: 500 })
  }
}
