/**
 * ============================================================
 * GET/POST /api/pine-lab/scripts — daftar & buat script MILIK USER
 * ============================================================
 * Spek item 2 (flag gate), 5 (kuota), 7 (isolation user_id):
 *   - Semua request wajib lewat requirePineLab (401/403).
 *   - Query SELALU .eq('user_id', user.id) — tidak ada jalur baca
 *     script user lain; source TIDAK pernah terkirim ke user lain.
 *   - Kuota: 3 aktif / 10 total / source ≤ 50 KB (config satu tempat).
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

export async function GET(request: NextRequest) {
  const gate = await requirePineLab(request)
  if (gate instanceof NextResponse) return gate
  const { user, admin } = gate

  try {
    const { data, error } = await admin
      .from('pine_scripts')
      .select('id, name, symbol, active, created_at, updated_at, last_run_at, last_run_ms, last_error')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[pine-lab/scripts GET] DB error:', error.message)
      return NextResponse.json({ error: 'Gagal memuat script (tabel belum dibuat? Jalankan SQL migrasi).' }, { status: 500 })
    }
    return NextResponse.json({ items: data ?? [] })
  } catch (e) {
    console.error('[pine-lab/scripts GET]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const gate = await requirePineLab(request)
  if (gate instanceof NextResponse) return gate
  const { user, admin } = gate

  try {
    const body = await request.json().catch(() => ({}))
    const name = String(body?.name ?? '').trim().slice(0, 80) || 'Script tanpa nama'
    const source = String(body?.source ?? '')
    const symbol = String(body?.symbol ?? PINE_LAB_CONFIG.DEFAULT_SYMBOL).toUpperCase()
    const active = body?.active === true

    // ── Validasi input ──
    if (!source.trim()) {
      return NextResponse.json({ error: 'Source script masih kosong.' }, { status: 400 })
    }
    const sizeKb = Buffer.byteLength(source, 'utf8') / 1024
    if (sizeKb > PINE_LAB_CONFIG.MAX_SOURCE_KB) {
      return NextResponse.json({ error: sourceTooLargeMessage() }, { status: 400 })
    }
    if (!PINE_LAB_CONFIG.ALLOWED_SYMBOLS.includes(symbol)) {
      return NextResponse.json(
        { error: `Simbol tidak didukung. Pilih salah satu: ${PINE_LAB_CONFIG.ALLOWED_SYMBOLS.join(', ')}.` },
        { status: 400 }
      )
    }

    // ── Kuota (query DIFILTER user_id) ──
    const { count: total, error: cErr } = await admin
      .from('pine_scripts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if (cErr) {
      return NextResponse.json({ error: 'Gagal cek kuota (DB belum siap).' }, { status: 500 })
    }
    if ((total ?? 0) >= PINE_LAB_CONFIG.MAX_TOTAL_SCRIPTS) {
      return NextResponse.json(
        { error: `Batas ${PINE_LAB_CONFIG.MAX_TOTAL_SCRIPTS} script tercapai. Hapus script lama dulu.` },
        { status: 400 }
      )
    }

    if (active) {
      const { count: act, error: aErr } = await admin
        .from('pine_scripts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('active', true)
      if (aErr) {
        return NextResponse.json({ error: 'Gagal cek kuota aktif.' }, { status: 500 })
      }
      if ((act ?? 0) >= PINE_LAB_CONFIG.MAX_ACTIVE_SCRIPTS) {
        return NextResponse.json({ error: activeLimitMessage() }, { status: 400 })
      }
    }

    const { data, error } = await admin
      .from('pine_scripts')
      .insert({ user_id: user.id, name, symbol, source, active })
      .select('id, name, symbol, active, created_at, updated_at')
      .single()
    if (error) {
      console.error('[pine-lab/scripts POST] DB error:', error.message)
      return NextResponse.json({ error: 'Gagal menyimpan script.' }, { status: 500 })
    }
    return NextResponse.json({ script: data })
  } catch (e) {
    console.error('[pine-lab/scripts POST]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
