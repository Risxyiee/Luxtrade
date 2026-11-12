/**
 * ============================================================
 * PATCH/DELETE /api/pine-lab/scripts/[id] — update & hapus MILIK USER
 * ============================================================
 * Spek item 7: id DIFILTER user_id — user A tidak bisa membaca/
 * mengubah/menghapus script milik user B (404, bukan 403 — jangan
 * bocorkan keberadaan resource orang lain).
 * Source TIDAK PERNAH dikembalikan lewat PATCH/DELETE response.
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePineLab } from '@/lib/pine-lab/access'
import {
  PINE_LAB_CONFIG,
  activeLimitMessage,
  sourceTooLargeMessage,
} from '@/lib/pine-lab/config'

export const dynamic = 'force-dynamic'

/** GET — detail script MILIK user (dengan source). User lain → 404. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requirePineLab(request)
  if (gate instanceof NextResponse) return gate
  const { user, admin } = gate
  const { id } = await params

  try {
    const { data, error } = await admin
      .from('pine_scripts')
      .select('id, name, symbol, source, active, created_at, updated_at, last_run_at, last_run_ms, last_error')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (error || !data) {
      return NextResponse.json({ error: 'Script tidak ditemukan.' }, { status: 404 })
    }
    return NextResponse.json({ script: data })
  } catch (e) {
    console.error('[pine-lab/scripts/[id] GET]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requirePineLab(request)
  if (gate instanceof NextResponse) return gate
  const { user, admin } = gate
  const { id } = await params

  try {
    const body = await request.json().catch(() => ({}))
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body?.name !== undefined) patch.name = String(body.name).trim().slice(0, 80) || 'Script tanpa nama'
    if (body?.source !== undefined) {
      const source = String(body.source)
      const sizeKb = Buffer.byteLength(source, 'utf8') / 1024
      if (sizeKb > PINE_LAB_CONFIG.MAX_SOURCE_KB) {
        return NextResponse.json({ error: sourceTooLargeMessage() }, { status: 400 })
      }
      patch.source = source
    }
    if (body?.symbol !== undefined) {
      const symbol = String(body.symbol).toUpperCase()
      if (!PINE_LAB_CONFIG.ALLOWED_SYMBOLS.includes(symbol)) {
        return NextResponse.json({ error: 'Simbol tidak didukung.' }, { status: 400 })
      }
      patch.symbol = symbol
    }
    if (body?.active !== undefined) {
      patch.active = body.active === true
      patch.last_error = null // reset error saat toggle aktif
    }

    // Toggle AKTIF → cek kuota aktif (kecuali sedang menonaktifkan)
    if (patch.active === true) {
      const { count: act, error: aErr } = await admin
        .from('pine_scripts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('active', true)
        .neq('id', id)
      if (aErr) {
        return NextResponse.json({ error: 'Gagal cek kuota aktif.' }, { status: 500 })
      }
      if ((act ?? 0) >= PINE_LAB_CONFIG.MAX_ACTIVE_SCRIPTS) {
        return NextResponse.json({ error: activeLimitMessage() }, { status: 400 })
      }
    }

    // Update DIFILTER user_id → script orang lain tak tersentuh (0 rows)
    const { data, error } = await admin
      .from('pine_scripts')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, name, symbol, active, created_at, updated_at')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Script tidak ditemukan.' }, { status: 404 })
    }
    return NextResponse.json({ script: data })
  } catch (e) {
    console.error('[pine-lab/scripts/[id] PATCH]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requirePineLab(request)
  if (gate instanceof NextResponse) return gate
  const { user, admin } = gate
  const { id } = await params

  try {
    // Delete DIFILTER user_id → script orang lain tak tersentuh (0 rows)
    const { data, error } = await admin
      .from('pine_scripts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Script tidak ditemukan.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[pine-lab/scripts/[id] DELETE]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
