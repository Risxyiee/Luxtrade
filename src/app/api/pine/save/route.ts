/**
 * ============================================================
 * /api/pine/save — Simpan & compile Pine Script® (Task 36)
 * ============================================================
 * POST  { name?: string, source: string }
 *   → Free : maks 2×/BULAN (lazy reset per bulan WIB, tabel user_quotas).
 *     Ke-3 kali → 403 + pesan upgrade Rp49rb/bulan (harga = lib/pricing.ts).
 *   → Pro  : tanpa batas.
 *   Sukses → simpan ke `pine_scripts` + increment counter + kembalikan
 *   baris skrip (UI langsung execute ke chart Vela via chart.runIndicator).
 *
 * GET  → daftar skrip milik user (pembacaan TIDAK menghabiskan kuota)
 *      → + sisa kuota bulan ini untuk badge editor.
 *
 * DELETE ?id=... → hapus skrip milik sendiri.
 *
 * Auth: session cookie / Bearer — sama dengan route lain.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import {
  checkPineQuota, commitPineQuota,
  pineQuotaExceededMessage,
  FREE_PINE_EDITS_PER_MONTH,
} from '@/lib/user-quota'

export const dynamic = 'force-dynamic'

const MAX_SOURCE_LEN = 40_000
const MAX_NAME_LEN = 80

function admin() {
  const supabase = getSupabaseAdmin()
  if (!supabase) throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diset')
  return supabase
}

/* ---------- GET: daftar skrip + sisa kuota ---------- */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = admin()
    const [scriptsRes, quota] = await Promise.all([
      supabase
        .from('pine_scripts')
        .select('id, name, source, created_at, updated_at')
        .eq('user_id', auth.user.id)
        .order('updated_at', { ascending: false })
        .limit(30),
      checkPineQuota(auth.user.id),
    ])
    if (scriptsRes.error) return NextResponse.json({ error: scriptsRes.error.message.slice(0, 140) }, { status: 500 })

    return NextResponse.json({
      scripts: scriptsRes.data || [],
      quota: {
        isPro: quota.isPro,
        used: quota.isPro ? 0 : quota.pine_edits_month_count,
        limit: quota.isPro ? null : FREE_PINE_EDITS_PER_MONTH,
        remaining: quota.isPro ? null : Math.max(0, FREE_PINE_EDITS_PER_MONTH - quota.pine_edits_month_count),
      },
    })
  } catch (x: any) {
    return NextResponse.json({ error: String(x?.message || x).slice(0, 160) }, { status: 500 })
  }
}

/* ---------- POST: validasi kuota → simpan → increment ---------- */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = auth.user.id

    const body = await request.json().catch(() => null) as { name?: string; source?: string } | null
    const source = String(body?.source || '').trim()
    const name = (String(body?.name || '').trim() || 'Untitled script').slice(0, MAX_NAME_LEN)

    if (!source) return NextResponse.json({ error: 'source Pine Script kosong' }, { status: 400 })
    if (!/^\/\/\s*@version=/m.test(source)) {
      return NextResponse.json({ error: 'Bukan Pine Script yang valid — baris pertama harus //@version=5 atau //@version=6' }, { status: 400 })
    }
    if (source.length > MAX_SOURCE_LEN) {
      return NextResponse.json({ error: `Skrip terlalu panjang (maks ${MAX_SOURCE_LEN} karakter)` }, { status: 413 })
    }

    /* 1) KUOTA — hanya FREE (Pro lewati) */
    const q = await checkPineQuota(userId)
    if (!q.isPro && q.pine_edits_month_count >= FREE_PINE_EDITS_PER_MONTH) {
      return NextResponse.json(
        { error: pineQuotaExceededMessage(), used: q.pine_edits_month_count, limit: FREE_PINE_EDITS_PER_MONTH },
        { status: 403 },
      )
    }

    /* 2) SIMPAN ke pine_scripts */
    const supabase = admin()
    const { data, error } = await supabase
      .from('pine_scripts')
      .insert({ user_id: userId, name, source })
      .select('id, name, source, created_at, updated_at')
      .single()
    if (error) {
      const msg = error.message.includes('pine_scripts')
        ? 'Tabel pine_scripts belum ada — jalankan docs/SUPABASE_QUOTA_TABLES.sql di Supabase SQL Editor dulu'
        : error.message
      return NextResponse.json({ error: msg.slice(0, 160) }, { status: 500 })
    }

    /* 3) KUOTA CONSUME — hanya FREE */
    if (!q.isPro) await commitPineQuota(userId)

    return NextResponse.json({
      ok: true,
      script: data,
      quota: {
        isPro: q.isPro,
        used: q.isPro ? 0 : q.pine_edits_month_count + 1,
        limit: q.isPro ? null : FREE_PINE_EDITS_PER_MONTH,
        remaining: q.isPro ? null : Math.max(0, FREE_PINE_EDITS_PER_MONTH - (q.pine_edits_month_count + 1)),
      },
    })
  } catch (x: any) {
    return NextResponse.json({ error: String(x?.message || x).slice(0, 160) }, { status: 500 })
  }
}

/* ---------- DELETE: hapus skrip sendiri ---------- */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const id = new URL(request.url).searchParams.get('id') || ''
    if (!id) return NextResponse.json({ error: 'id wajib' }, { status: 400 })
    const { error } = await admin()
      .from('pine_scripts')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user.id)
    if (error) return NextResponse.json({ error: error.message.slice(0, 140) }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (x: any) {
    return NextResponse.json({ error: String(x?.message || x).slice(0, 160) }, { status: 500 })
  }
}
