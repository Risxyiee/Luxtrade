#!/usr/bin/env node
/**
 * Regression: P0 Security Route Hardening — v2 (metode HTTP asli per route).
 * Commit setelah audit 2026-11, branch security/p0-hardening (PR #2).
 *
 * ── PERBAIKAN v2 (masalah di v1) ─────────────────────────────────────────
 * v1 mengirim POST ke SEMUA route terhapus dan menganggap 404 ATAU 405
 * sebagai "lulus". Itu bisa menghasilkan lulus-palsu:
 *   route yang ternyata masih hidup tetapi hanya punya handler GET akan
 *   menjawab 405 untuk POST → v1 menyebutnya "terhapus" padahal GET hidup.
 *
 * v2 memperbaikinya:
 *   1. Tiap route dites dengan METODE HTTP ASLINYA, diambil dari kode
 *      SEBELUM dihapus (git show origin/main:src/app/api/<path>/route.ts).
 *   2. Route yang mendukung GET dan POST sekaligus dites KEDUANYA:
 *      debug/check-promo-flow, debug/send-email, test-auth.
 *   3. Route yang benar-benar dihapus harus menjawab 404.
 *      405 sekarang dianggap GAGAL (= path masih ada, metodenya saja beda).
 *      SATU pengecualian terdokumentasi (BAGIAN 1B): URL
 *      /api/trading-accounts/test-create ditangkap route dinamis tetangga
 *      [id] yang hidup, jadi ekspektasinya 405 (POST, bukti handler
 *      backdoor mati) dan 404 (GET, validasi UUID) — bukan 404-karena-terhapus.
 *   4. Route yang dipertahankan juga dites dengan metode aslinya
 *      (v1 mengetes GET padahal admin/activate & seed aslinya POST → 405
 *      di v1 dihitung "lulus" tanpa membuktikan auth bekerja).
 *
 * ── Tabel metode asli (hasil ekstraksi otomatis dari origin/main) ────────
 *   23 route hanya GET, 9 route hanya POST, 3 route GET+POST (total 35;
 *   1 di antaranya dipindah ke BAGIAN 1B karena path ditangkap sibling).
 *
 * ── KEAMANAN PENJALANAN ──────────────────────────────────────────────────
 *   - Hanya boleh menunjuk localhost (localhost / 127.0.0.1 / ::1).
 *     Untuk host lain (verifikasi pasca-merge ke production), WAJIB set
 *     ALLOW_REMOTE=1 secara sadar — default menolak.
 *   - Semua body POST/PATCH = '{}' (payload minimal, tanpa data nyata).
 *   - GET tanpa query string (tanpa ?sql=, tanpa parameter email/apapun).
 *   - Status code dicatat; BODY SELALU DIBUANG dan tidak pernah dicetak —
 *     kalau ada route ternyata hidup (mis. route yang membocorkan env),
 *     isinya tidak ikut ke log.
 *   - Fail-fast: hasil tak terduga (route terhapus ternyata hidup, atau
 *     route terjaga ternyata tidak menolak) → pengujian LANGSUNG BERHENTI,
 *     sisa request tidak dikirim.
 *   - Route ber-flag execRisk (cron yang di mode development tanpa secret
 *     bisa MENJEKSEKUSI job asli) DILEWATI secara default; set
 *     ALLOW_EXEC_RISK=1 untuk memaksa dites.
 *
 * Pemakaian:
 *   node scripts/regression-p0-routes.mjs
 *   BASE_URL=http://127.0.0.1:3000 node scripts/regression-p0-routes.mjs
 *   node scripts/regression-p0-routes.mjs --only=debug/env   (subset)
 */

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '')
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7)

// ── Guard: localhost-only (kecuali ALLOW_REMOTE=1 eksplisit) ──────────────
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|::1)(:\d+)?$/.test(BASE)
if (!isLocal && process.env.ALLOW_REMOTE !== '1') {
  console.error(
    `⛔ MENOLAK jalan: BASE_URL=${BASE} bukan localhost.\n` +
      `Script ini mengirim metode HTTP ASLI route (termasuk POST) — kalau suatu\n` +
      `route kebetulan masih hidup di host itu, request bisa ikut dieksekusi.\n` +
      `Untuk verifikasi pasca-merge ke production, jalankan dengan ALLOW_REMOTE=1\n` +
      `secara sadar dan hanya SETELAH deploy selesai.`
  )
  process.exit(2)
}

// Route yang WAJIB sudah dihapus → SEMUA metode aslinya harus 404.
// Sumber metode: git show origin/main:src/app/api/<path>/route.ts (kode pra-penghapusan).
const MUST_BE_GONE = [
  // debug/** — GET-only
  { path: '/api/debug/env', methods: ['GET'] },
  { path: '/api/debug/show-env', methods: ['GET'] },
  { path: '/api/debug/columns', methods: ['GET'] },
  { path: '/api/debug/db', methods: ['GET'] },
  { path: '/api/debug/production', methods: ['GET'] },
  { path: '/api/debug/sync', methods: ['GET'] },
  { path: '/api/debug/trades', methods: ['GET'] },
  { path: '/api/debug/accounts-check', methods: ['GET'] },
  { path: '/api/debug/accounts-detail', methods: ['GET'] },
  { path: '/api/debug/trading-accounts', methods: ['GET'] },
  { path: '/api/debug/check-env', methods: ['GET'] },
  { path: '/api/debug/promo-codes', methods: ['GET'] },
  { path: '/api/debug/check-buckets', methods: ['GET'] },
  { path: '/api/debug/test-huggingface', methods: ['GET'] },
  // debug/** — GET+POST (dites keduanya!)
  { path: '/api/debug/check-promo-flow', methods: ['GET', 'POST'] },
  { path: '/api/debug/send-email', methods: ['GET', 'POST'] },
  // root diagnostics — GET-only
  { path: '/api/check-env', methods: ['GET'] },
  { path: '/api/test-env', methods: ['GET'] },
  { path: '/api/test-auth', methods: ['GET', 'POST'] },
  { path: '/api/test-supabase', methods: ['GET'] },
  { path: '/api/test', methods: ['GET'] },
  { path: '/api/test/db', methods: ['GET'] },
  { path: '/api/test/service-key', methods: ['GET'] },
  // auth backdoor — POST-only
  { path: '/api/auth/admin-login', methods: ['POST'] },
  { path: '/api/auth/force-confirm', methods: ['POST'] },
  // cron pine-alerts — dihapus 0f67ea25 (diganti strategy-alerts)
  { path: '/api/cron/pine-alerts', methods: ['GET', 'POST'] },
  // Pine engine + alert strategi ala Pine — DIHAPUS 11-11 (Bos: "alert
  // pine hapus aja dulu" — fitur pine dinonaktifkan sementara, Bos coba
  // Pine sendiri dulu). Sumber metode: kode pra-penghapusan di git.
  { path: '/api/strategy-alerts', methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
  { path: '/api/cron/strategy-alerts', methods: ['GET', 'POST'] },
  { path: '/api/pine/scripts', methods: ['GET', 'POST'] },
  { path: '/api/pine/scripts/test-id/backtest', methods: ['POST'] },
  { path: '/api/pine/events', methods: ['GET'] },
  { path: '/api/pine/channels', methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
  { path: '/api/pine/validate', methods: ['POST'] },
  { path: '/api/pine/live-run', methods: ['POST'] },
  { path: '/api/pine/cron-live', methods: ['GET', 'POST'] },
  { path: '/api/pine/champion-template', methods: ['GET'] },
  // admin tanpa auth-check — POST-only
  { path: '/api/admin/simple-test', methods: ['GET'] },
  { path: '/api/admin/test-activation', methods: ['GET'] },
  { path: '/api/admin/create-admin', methods: ['POST'] },
  { path: '/api/admin/ensure-admin', methods: ['POST'] },
  { path: '/api/admin/simple-activate', methods: ['POST'] },
  { path: '/api/admin/debug-activate', methods: ['POST'] },
  { path: '/api/admin/test-pro', methods: ['POST'] },
  // MetaApi (retired)
  { path: '/api/metaapi/connect', methods: ['POST'] },
  { path: '/api/metaapi/deals', methods: ['GET'] },
]

// Kasus khusus (BAGIAN 1B): file backdoor /api/trading-accounts/test-create
// memang sudah dihapus (diverifikasi di git), TAPI URL-nya kini ditangkap
// route dinamis tetangga src/app/api/trading-accounts/[id]/route.ts
// (segmen [id] menangkap "test-create" sebagai nilai id), jadi path ini
// TIDAK akan menjawab 404-karena-terhapus seperti route lain. Yang dibuktikan
// di sini bukan "path 404", melainkan "handler backdoor sudah tidak ada":
//   - POST → HARUS 405 (sibling [id] hanya punya GET/PATCH/DELETE — diverifikasi
//     di kode). 405 = tidak ada handler POST di path itu = backdoor tulis
//     lintas-user MATI. Kalau POST menjawab selain 405 (200/401/400/...),
//     berarti ADA handler POST hidup → GAGAL.
//   - GET  → HARUS 404 (sibling [id] memvalidasi UUID dulu; "test-create" bukan
//     UUID → langsung 404 tanpa menyentuh database).
// Catatan: ini BUKAN mengulang bug tes lama ("405 dianggap terhapus") — di
// sini 405 adalah jawaban yang benar dan dibuktikan dari kode sibling yang
// hidup, bukan sekadar ditoleransi.
const SPECIAL_CASES = [
  {
    path: '/api/trading-accounts/test-create',
    probes: [
      { method: 'POST', expect: [405], why: 'tidak ada handler POST = backdoor tulis mati (path ditangkap sibling [id])' },
      { method: 'GET', expect: [404], why: 'validasi UUID sibling [id] menolak id non-UUID' },
    ],
  },
]

// Route yang DIPERTAHANKAN → SEMUA metode aslinya harus menolak anonim (401/403).
// Metode asli diverifikasi dari kode branch ini (bukan dikira-kira).
const MUST_REJECT_ANON = [
  { path: '/api/admin/activate', methods: ['POST'] },
  { path: '/api/admin/withdrawals', methods: ['GET', 'PATCH'] },
  { path: '/api/admin/users', methods: ['GET', 'POST', 'PATCH'] },
  { path: '/api/email-campaigns', methods: ['GET'] },
  { path: '/api/seed', methods: ['POST'] },
  { path: '/api/setup', methods: ['GET', 'POST'] },
  { path: '/api/setup-db', methods: ['GET', 'POST'] },
  // pine-alerts DIHAPUS di 0f67ea25 (diganti /api/cron/strategy-alerts, tanpa
  // jalur Pine lagi) → pindah ke MUST_BE_GONE agar probe-nya mengharapkan 404.
  // execRisk: saat NODE_ENV=development TANPA CRON_SECRET, route ini lolos gate
  // dan MENJEKSEKUSI job downgrade sungguhan (bisa mengubah data user PRO).
  // Default: dilewati. Set ALLOW_EXEC_RISK=1 untuk memaksa (dengan sadar).
  { path: '/api/cron/downgrade-expired-pro', methods: ['GET', 'POST'], execRisk: true },
]

let pass = 0
let failures = 0
let skipped = 0
let aborted = false

function matchOnly(path) {
  return !ONLY || path.includes(ONLY)
}

async function probe(path, method) {
  const init = {
    method,
    headers: { 'Content-Type': 'application/json' },
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  }
  if (method !== 'GET' && method !== 'HEAD') init.body = '{}'
  try {
    const res = await fetch(`${BASE}${path}`, init)
    await res.text().catch(() => '') // body DIBUANG — tidak pernah dicetak ke log
    return res.status
  } catch {
    return null
  }
}

async function main() {
  console.log(`\n🛡  P0 route regression v2 — target: ${BASE}${ONLY ? ` (filter: "${ONLY}")` : ''}\n`)

  // BAGIAN 1 — route terhapus: semua metode aslinya harus 404
  console.log(`— BAGIAN 1: route terhapus (semua metode asli harus 404; 405 = path masih hidup) —`)
  for (const { path, methods } of MUST_BE_GONE) {
    if (!matchOnly(path)) continue
    for (const m of methods) {
      const status = await probe(path, m)
      if (status === 404) {
        pass++
        console.log(`  ✅ ${m.padEnd(5)} ${path} → 404`)
      } else {
        failures++
        console.log(
          `  ❌ ${m.padEnd(5)} ${path} → ${status ?? 'unreachable'}  (harusnya 404)` +
            (status === 405 ? '  ← 405 berarti PATH MASIH HIDUP, bukan terhapus!' : '')
        )
        aborted = true
        break
      }
    }
    if (aborted) {
      console.log(`\n⛔ DIHENTIKAN DINI: ada route terhapus yang ternyata masih hidup. Sisa probe TIDAK dikirim demi keamanan.`)
      break
    }
  }

  // BAGIAN 1B — kasus khusus path yang ditangkap sibling dinamis
  if (!aborted) {
    console.log(`\n— BAGIAN 1B: kasus khusus (path ditangkap route dinamis tetangga) —`)
    for (const sc of SPECIAL_CASES) {
      if (!matchOnly(sc.path)) continue
      for (const p of sc.probes) {
        const status = await probe(sc.path, p.method)
        if (p.expect.includes(status)) {
          pass++
          console.log(`  ✅ ${p.method.padEnd(5)} ${sc.path} → ${status}  (${p.why})`)
        } else {
          failures++
          console.log(`  ❌ ${p.method.padEnd(5)} ${sc.path} → ${status ?? 'unreachable'}  (harusnya ${p.expect.join('/')})`)
          aborted = true
          break
        }
      }
      if (aborted) {
        console.log(`\n⛔ DIHENTIKAN DINI: perilaku path khusus tidak sesuai kode.`)
        break
      }
    }
  }

  // BAGIAN 2 — route terjaga: semua metode aslinya harus 401/403
  if (!aborted) {
    console.log(`\n— BAGIAN 2: route terjaga (semua metode asli harus menolak anonim 401/403) —`)
    for (const r of MUST_REJECT_ANON) {
      if (!matchOnly(r.path)) continue
      if (r.execRisk && process.env.ALLOW_EXEC_RISK !== '1') {
        skipped += r.methods.length
        console.log(`  ⏭  ${r.methods.join('+')} ${r.path} → DILEWATI (execRisk: bisa mengeksekusi job asli di dev-bypass; ALLOW_EXEC_RISK=1 utk paksa)`)
        continue
      }
      for (const m of r.methods) {
        const status = await probe(r.path, m)
        if (status === 401 || status === 403) {
          pass++
          console.log(`  ✅ ${m.padEnd(5)} ${r.path} → ${status}`)
        } else {
          failures++
          const why =
            status === 405
              ? 'metode tidak tersedia → tabel metode di script ini salah, perbaiki dulu'
              : status === 404
                ? 'route hilang (regresi?)'
                : status === 200
                  ? 'DITERIMA TANPA AUTH — bahaya!'
                  : 'harusnya 401/403'
          console.log(`  ❌ ${m.padEnd(5)} ${r.path} → ${status ?? 'unreachable'}  (${why})`)
          aborted = true
          break
        }
      }
      if (aborted) {
        console.log(`\n⛔ DIHENTIKAN DINI: ada route terjaga yang tidak menolak akses anonim.`)
        break
      }
    }
  }

  console.log(`\nHasil: ${pass} pass, ${failures} gagal, ${skipped} dilewati (execRisk)`)
  console.log(failures === 0 ? '🟢 SEMUA PASS' : `🔴 ${failures} GAGAL`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
