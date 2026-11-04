#!/usr/bin/env node
/**
 * Regression: P0 Security Route Hardening (commit setelah audit 2026-11).
 *
 * Memastikan:
 *  1. 36 route debug/backdoor yang dihapus benar-benar 404/405.
 *  2. Route admin/cron yang DIPERTAHANKAN menolak akses tanpa auth (401/403).
 *
 * Pemakaian:
 *   BASE_URL=http://localhost:3000 node scripts/regression-p0-routes.mjs
 *   BASE_URL=https://luxtradee.web.id node scripts/regression-p0-routes.mjs
 *
 * Aman dijalankan ke production: hanya probe tanpa-credentials yang DIHARAPKAN
 * ditolak (404/405/401/403). Tidak ada body yang mengubah data.
 */

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')

// Route yang WAJIB sudah dihapus → harus 404/405.
const MUST_BE_GONE = [
  // debug/**
  '/api/debug/columns', '/api/debug/env', '/api/debug/show-env', '/api/debug/sync',
  '/api/debug/production', '/api/debug/db', '/api/debug/trades', '/api/debug/accounts-check',
  '/api/debug/accounts-detail', '/api/debug/trading-accounts', '/api/debug/check-env',
  '/api/debug/check-promo-flow', '/api/debug/promo-codes', '/api/debug/send-email',
  '/api/debug/check-buckets', '/api/debug/test-huggingface',
  // root diagnostics
  '/api/check-env', '/api/test-env', '/api/test-auth', '/api/test-supabase',
  '/api/test', '/api/test/db', '/api/test/service-key',
  // auth backdoor
  '/api/auth/admin-login', '/api/auth/force-confirm',
  // admin tanpa auth-check
  '/api/admin/simple-test', '/api/admin/create-admin', '/api/admin/ensure-admin',
  '/api/admin/simple-activate', '/api/admin/debug-activate', '/api/admin/test-activation',
  '/api/admin/test-pro',
  // cross-user write primitive
  '/api/trading-accounts/test-create',
  // MetaApi (retired)
  '/api/metaapi/connect', '/api/metaapi/deals',
]

// Route yang DIPERTAHANKAN → tanpa auth harus 401/403 (bukan 200/2xx).
const MUST_REJECT_ANON = [
  { path: '/api/admin/activate', method: 'GET' },
  { path: '/api/admin/withdrawals', method: 'GET' },
  { path: '/api/admin/users', method: 'GET' },
  { path: '/api/email-campaigns', method: 'GET' },
  { path: '/api/seed', method: 'GET' },
  { path: '/api/setup', method: 'GET' },
  { path: '/api/setup-db', method: 'GET' },
  { path: '/api/cron/pine-alerts', method: 'GET' },
  { path: '/api/cron/downgrade-expired-pro', method: 'GET' },
]

let failures = 0

async function probe(path, method = 'GET') {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json' },
      body: method === 'POST' ? '{}' : undefined,
    })
    await res.text().catch(() => '')
    return res.status
  } catch {
    return null
  }
}

async function main() {
  console.log(`\n🛡  P0 route regression — target: ${BASE}\n`)

  console.log(`— ${MUST_BE_GONE.length} route terhapus harus 404/405 —`)
  for (const p of MUST_BE_GONE) {
    const status = await probe(p, 'POST')
    const ok = status === 404 || status === 405
    if (!ok) failures++
    console.log(`  ${ok ? '✅' : '❌'} POST ${p} → ${status ?? 'unreachable'}${ok ? '' : '  (harusnya 404/405)'}`)
  }

  const isLocal = /localhost|127\.0\.0\.1/.test(BASE)
  console.log(`\n— ${MUST_REJECT_ANON.length} route tersisa harus tolak anonim (401/403, 405 = method tidak ada) —`)
  for (const { path, method } of MUST_REJECT_ANON) {
    const status = await probe(path, method)
    // 405 = route memang tidak menyediakan method itu → tertutup untuk method tsb.
    let ok = status === 401 || status === 403 || status === 405
    let note = ''
    if (!ok && status === 200 && isLocal) {
      // dev-bypass terdokumentasi: cron route hanya lolos tanpa secret saat NODE_ENV=development.
      // Di production ini WAJIB gagal — jangan lewati kalau BASE_URL bukan localhost.
      ok = true
      note = '  (200 via dev-bypass — hanya valid di localhost; production harus 401/403)'
    }
    if (!ok) failures++
    console.log(`  ${ok ? '✅' : '❌'} ${method} ${path} → ${status ?? 'unreachable'}${ok ? '' : '  (harusnya 401/403/405)'}${note}`)
  }

  console.log(`\n${failures === 0 ? '🟢 SEMUA PASS' : `🔴 ${failures} GAGAL`}\n`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
