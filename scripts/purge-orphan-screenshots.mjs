#!/usr/bin/env node
/**
 * purge-orphan-screenshots.mjs
 * ──────────────────────────────────────────────────────────────────
 * Hapus file YATIM di ROOT bucket `trade-screenshots`
 * (file yang tidak direferensikan trades.screenshot_url mana pun).
 *
 * Wajib pakai Storage API (bukan SQL) — Supabase memblokir
 * `delete from storage.objects` via trigger storage.protect_delete.
 *
 * Safety:
 *   1. DRY RUN by default — tanpa flag, HANYA menampilkan kandidat.
 *   2. Guard ganda: file yang masih direferensikan trades.screenshot_url
 *      (exact substring match) otomatis DILEWATI, tidak akan terhapus.
 *   3. Verifikasi ulang setelah hapus.
 *
 * Cara pakai:
 *   DRY RUN:
 *     SUPABASE_SERVICE_ROLE_KEY=xxxx bun scripts/purge-orphan-screenshots.mjs
 *     # atau: node --env-file=.env.local scripts/purge-orphan-screenshots.mjs
 *
 *   HAPUS BENERAN (tambah --yes):
 *     SUPABASE_SERVICE_ROLE_KEY=xxxx bun scripts/purge-orphan-screenshots.mjs --yes
 *
 * Env:
 *   SUPABASE_SERVICE_ROLE_KEY   wajib (Dashboard → Settings → API → service_role)
 *   NEXT_PUBLIC_SUPABASE_URL    opsional (ada fallback)
 * ──────────────────────────────────────────────────────────────────
 */
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'trade-screenshots'
const DRY_RUN = !process.argv.includes('--yes')

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://klxkdrfsfcoankbaoejn.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY tidak ada di environment.')
  console.error('   Contoh pemakaian:')
  console.error('   SUPABASE_SERVICE_ROLE_KEY=eyJ... bun scripts/purge-orphan-screenshots.mjs --yes')
  console.error('   (atau taruh sementara di .env.local — JANGAN pernah di-commit)')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

// ── 1. Referensi aktif di trades (exact substring match — bebas wildcard) ──
const { data: refRows, error: refErr } = await admin
  .from('trades')
  .select('screenshot_url')
  .not('screenshot_url', 'is', null)

if (refErr) {
  console.error('❌ Gagal ambil trades.screenshot_url:', refErr.message)
  process.exit(1)
}
const refs = (refRows ?? []).map((r) => r.screenshot_url)
console.log(`📚 Referensi screenshot aktif di trades: ${refs.length}`)

// ── 2. List SEMUA objek di ROOT bucket (paginasi sampai habis) ──
const rootFiles = []
const pageSize = 1000
for (let offset = 0; ; offset += pageSize) {
  const { data, error } = await admin.storage
    .from(BUCKET)
    .list('', { limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } })
  if (error) {
    console.error('❌ Gagal list bucket:', error.message)
    process.exit(1)
  }
  if (!data || data.length === 0) break
  for (const item of data) {
    // id === null → placeholder folder; file asli selalu punya id
    if (item.id !== null && !item.name.includes('/')) rootFiles.push(item.name)
  }
  if (data.length < pageSize) break
}
console.log(`🗂  File di ROOT bucket: ${rootFiles.length}`)

// ── 3. Saring: hanya yang TIDAK direferensikan trade ──
const orphans = rootFiles.filter((name) => !refs.some((u) => u.includes(name)))
const skipped = rootFiles.filter((name) => refs.some((u) => u.includes(name)))

if (skipped.length) {
  console.log(`🛡  DILEWATI (masih direferensikan trade — tidak dihapus): ${skipped.length}`)
  for (const s of skipped) console.log('   ⚠️  ' + s)
}

console.log(`🎯 Kandidat yatim (aman dihapus): ${orphans.length}`)
for (const o of orphans) console.log('   🗑  ' + o)

if (orphans.length === 0) {
  console.log('✅ Tidak ada yang perlu dihapus.')
  process.exit(0)
}

if (DRY_RUN) {
  console.log(
    `\n🧪 DRY RUN — tidak ada yang dihapus. Jalankan ulang dengan --yes untuk menghapus ${orphans.length} file.`
  )
  process.exit(0)
}

// ── 4. Hapus via Storage API, batch @50 ──
let ok = 0
let fail = 0
for (let i = 0; i < orphans.length; i += 50) {
  const batch = orphans.slice(i, i + 50)
  const { error } = await admin.storage.from(BUCKET).remove(batch)
  if (error) {
    console.error('❌ Remove gagal (batch ' + (i / 50 + 1) + '):', error.message)
    fail += batch.length
    continue
  }
  ok += batch.length
  console.log(`   🗑  Terhapus ${ok}/${orphans.length}`)
}

// ── 5. Verifikasi ulang ──
const { data: after } = await admin.storage.from(BUCKET).list('', { limit: 1000, offset: 0 })
const sisaRoot = (after ?? []).filter((x) => x.id !== null && !x.name.includes('/'))
console.log(`\n📊 HASIL: terhapus ${ok}, gagal ${fail}, sisa file root: ${sisaRoot.length}`)
if (sisaRoot.length === 0) {
  console.log('✅ Root bucket BERSIH — semua objek kini di dalam folder pemiliknya.')
} else {
  for (const s of sisaRoot) console.log('   ⚠️ tersisa: ' + s.name)
}
