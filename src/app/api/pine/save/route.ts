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

    /* 1) CARI SKRIP NAMA SAMA (case-insensitive) — FIX akar masalah
       "masukin pine keluar ga aktif, harus masukin lagi" (run GHA
       #42: langganan yatim "skrip tidak ketemu"). Dulu tiap save
       selalu INSERT baris baru dgn UUID baru → langganan alert lama
       menunjuk skrip mati. Sekarang: nama sama = UPDATE baris yang
       sama, UUID TETAP → langganan alert tetap hidup. Edit ulang
       skrip yang sama TIDAK menghabiskan kuota free. */
    const supabase = admin()
    const safeName = name.replace(/[\\%_]/g, (m) => `\\${m}`) // escape wildcard ilike
    const existingRes = await supabase
      .from('pine_scripts')
      .select('id, name, source, created_at, updated_at')
      .eq('user_id', userId)
      .ilike('name', safeName)
      .limit(1)
    const existing = (existingRes.data || [])[0] as
      | { id: string; name: string; source: string; created_at: string; updated_at: string }
      | undefined

    /* 2) KUOTA — hanya FREE & hanya SKRIP BARU (update nama sama bebas) */
    const q = await checkPineQuota(userId)
    if (!existing && !q.isPro && q.pine_edits_month_count >= FREE_PINE_EDITS_PER_MONTH) {
      return NextResponse.json(
        { error: pineQuotaExceededMessage(), used: q.pine_edits_month_count, limit: FREE_PINE_EDITS_PER_MONTH },
        { status: 403 },
      )
    }

    /* 3) SIMPAN — insert baru / update yang sudah ada */
    let data: { id: string; name: string; source: string; created_at: string; updated_at: string } | null
    let error: { message: string } | null
    let reused = false
    if (existing) {
      reused = true
      const r = await supabase
        .from('pine_scripts')
        .update({ source, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .eq('user_id', userId)
        .select('id, name, source, created_at, updated_at')
        .single()
      data = r.data
      error = r.error
    } else {
      const r = await supabase
        .from('pine_scripts')
        .insert({ user_id: userId, name, source })
        .select('id, name, source, created_at, updated_at')
        .single()
      data = r.data
      error = r.error
    }
    if (error || !data) {
      const raw = String((error as any)?.message || 'gagal simpan')
      const msg = raw.includes('pine_scripts')
        ? 'Tabel pine_scripts belum ada — jalankan docs/SUPABASE_QUOTA_TABLES.sql di Supabase SQL Editor dulu'
        : raw
      return NextResponse.json({ error: msg.slice(0, 160) }, { status: 500 })
    }

    /* 4) KUOTA CONSUME — hanya FREE & hanya SKRIP BARU */
    if (!existing && !q.isPro) await commitPineQuota(userId)

    return NextResponse.json({
      ok: true,
      script: data,
      reused,
      quota: {
        isPro: q.isPro,
        used: q.isPro || reused ? 0 : q.pine_edits_month_count + 1,
        limit: q.isPro ? null : FREE_PINE_EDITS_PER_MONTH,
        remaining: q.isPro || reused ? null : Math.max(0, FREE_PINE_EDITS_PER_MONTH - (q.pine_edits_month_count + 1)),
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
