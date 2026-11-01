import { NextRequest, NextResponse } from 'next/server'
import { autoFixRLS } from '@/lib/auto-fix-rls'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

/**
 * DB Health endpoint — ADMIN ONLY.
 *
 * GET/POST /api/fix-rls — dipakai tombol "DB Health" di /dashboard/admin.
 *
 * Fungsi (laporan Bos: "rapihin admin panel + fungsinya"):
 * 1. Cek akses service-role ke tabel kritikal (health check lama).
 * 2. Cek KOLOM yang diminta aplikasi tapi belum ada di DB produksi:
 *    - profiles.onboarding_steps       (42703 di log: /api/onboarding/progress)
 *    - profiles.onboarding_completed   (/api/onboarding)
 *    - prop_firm_challenges.consistency_rule + best_day_pl
 *      (42703 di log: /api/prop-firm-guard — dulu cuma di-retry minimal)
 * 3. Kalau ada yang kurang → balikin SATU SQL konsolidasi (idempotent)
 *    siap copy-paste ke Supabase SQL Editor. DDL tidak bisa dijalankan
 *    lewat PostgREST, jadi eksekusi manual oleh admin memang satu-satunya.
 */

/** Definisi kolom yang wajib ada + tipe SQL-nya */
const REQUIRED_COLUMNS: { table: string; column: string; sqlType: string; why: string }[] = [
  { table: 'profiles', column: 'onboarding_steps', sqlType: 'JSONB DEFAULT \'[]\'::jsonb', why: 'progres checklist onboarding (/api/onboarding/progress)' },
  { table: 'profiles', column: 'onboarding_completed', sqlType: 'BOOLEAN DEFAULT FALSE', why: 'penanda onboarding selesai (/api/onboarding)' },
  { table: 'prop_firm_challenges', column: 'consistency_rule', sqlType: 'DOUBLE PRECISION DEFAULT 0', why: 'aturan konsistensi prop firm (/api/prop-firm-guard)' },
  { table: 'prop_firm_challenges', column: 'best_day_pl', sqlType: 'DOUBLE PRECISION DEFAULT 0', why: 'P/L terbaik sehari (/api/prop-firm-guard)' },
]

/** Kolom yang dulu sempat jadi sumber warn log — dicek juga biar tahu
  * apakah feed notifikasi in-app (Bell) aktif */
const OPTIONAL_CHECKS: { table: string; column: string }[] = [
  { table: 'notification_log', column: 'read' },
]

function isMissingColumnError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  return err.code === '42703' || err.code === 'PGRST204' || /does not exist/i.test(err.message || '')
}

async function runDbHealth() {
  const results: { name: string; status: 'ok' | 'error'; detail?: string }[] = []
  const missingColumns: { table: string; column: string; sqlType: string; why: string }[] = []

  // ── 1. Table access (health check lama) ──
  const rls = await autoFixRLS()
  for (const c of rls.checks) {
    results.push({
      name: `Tabel ${c.table}`,
      status: c.accessible ? 'ok' : 'error',
      detail: c.accessible ? 'service-role OK' : c.detail || 'tidak bisa diakses',
    })
  }

  // ── 2. Column checks (baru) ──
  const admin = getSupabaseAdmin()
  if (!admin) {
    results.push({ name: 'Kolom', status: 'error', detail: 'SUPABASE_SERVICE_ROLE_KEY tidak tersedia — cek kolom dilewati' })
  } else {
    for (const def of REQUIRED_COLUMNS) {
      try {
        const { error } = await admin
          .from(def.table)
          .select(def.column)
          .limit(1)
        if (error && isMissingColumnError(error as { code?: string; message?: string })) {
          missingColumns.push(def)
          results.push({ name: `Kolom ${def.table}.${def.column}`, status: 'error', detail: `belum ada — dipakai: ${def.why}` })
        } else if (error) {
          // Bukan missing-column (mis. RLS/network) — anggap kolom ada
          results.push({ name: `Kolom ${def.table}.${def.column}`, status: 'ok', detail: `ada (query warning: ${(error as { message?: string }).message?.slice(0, 80)})` })
        } else {
          results.push({ name: `Kolom ${def.table}.${def.column}`, status: 'ok', detail: 'ada' })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (/does not exist/i.test(msg)) {
          missingColumns.push(def)
          results.push({ name: `Kolom ${def.table}.${def.column}`, status: 'error', detail: `belum ada — dipakai: ${def.why}` })
        } else {
          results.push({ name: `Kolom ${def.table}.${def.column}`, status: 'ok', detail: `ada (cek warning: ${msg.slice(0, 80)})` })
        }
      }
    }

    for (const opt of OPTIONAL_CHECKS) {
      try {
        const { error } = await admin.from(opt.table).select(opt.column).limit(1)
        if (error && isMissingColumnError(error as { code?: string; message?: string })) {
          results.push({ name: `Tabel ${opt.table}`, status: 'error', detail: `tabel belum ada (kolom ${opt.column} dicek) — feed notifikasi in-app nonaktif` })
        } else {
          results.push({ name: `Tabel ${opt.table}`, status: 'ok', detail: 'ada' })
        }
      } catch {
        results.push({ name: `Tabel ${opt.table}`, status: 'error', detail: 'tabel belum ada — feed notifikasi in-app nonaktif' })
      }
    }
  }

  const success = missingColumns.length === 0 && results.every(r => r.status === 'ok')
  return { success, results, missingColumns }
}

function buildFixSql(missing: { table: string; column: string; sqlType: string; why: string }[]): string {
  const lines: string[] = [
    '-- ============================================================',
    '-- LuxTradee — DB Health Fix (auto-generated dari /api/fix-rls)',
    '-- Tambahkan kolom yang diminta aplikasi tapi belum ada di DB.',
    '-- Idempotent — aman dijalankan berkali-kali.',
    '-- Cara: Supabase Dashboard → SQL Editor → paste → Run.',
    '-- ============================================================',
    '',
  ]
  for (const m of missing) {
    lines.push(`-- ${m.table}.${m.column} — ${m.why}`)
    lines.push(`ALTER TABLE public.${m.table} ADD COLUMN IF NOT EXISTS ${m.column} ${m.sqlType};`)
    lines.push('')
  }
  lines.push('-- service_role (admin client API) pasti punya akses penuh')
  lines.push('GRANT ALL ON TABLE public.profiles TO service_role;')
  lines.push('GRANT ALL ON TABLE public.prop_firm_challenges TO service_role;')
  return lines.join('\n')
}

export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const { success, results, missingColumns } = await runDbHealth()

    if (!success) {
      const sql = missingColumns.length > 0 ? buildFixSql(missingColumns) : undefined
      return NextResponse.json({
        success: false,
        results,
        missingColumns,
        sql,
        instructions: sql
          ? 'Copy SQL di bawah → Supabase Dashboard → SQL Editor → paste → Run → kembali ke sini dan klik "Cek Ulang".'
          : 'Beberapa tabel tidak bisa diakses service-role. Jalankan SQL GRANT dari modul auto-fix di Supabase SQL Editor.',
      })
    }

    return NextResponse.json({ success: true, results, missingColumns: [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, message: 'DB health check failed', detail: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
