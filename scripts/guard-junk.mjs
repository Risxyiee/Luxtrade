#!/usr/bin/env bun
/**
 * guard-junk.mjs — 🚫 PENJAGA AGAR FILE LAMA TIDAK PERNAH BALIK LAGI
 * ══════════════════════════════════════════════════════════════════════
 * Masalah: file junk (vercel.json, report *.md hasil sesi coding,
 * screenshot debug, dll) sudah 3x dihapus tapi selalu muncul lagi,
 * karena mereka ter-track di git dan di-restore oleh operasi git/sync.
 *
 * Solusi 4 lapis (script ini = lapisan 3 & 5):
 *   1. Hapus file junk                          (sekali, manual)
 *   2. git rm + commit                          (hapus dari history HEAD)
 *   3. Blokir pola di .gitignore                (tidak bisa di-commit lagi)
 *   4. Guard ini — dipanggil otomatis oleh `predev` & `prebuild`,
 *      jadi setiap kali `bun run dev` / `bun run build` jalan,
 *      semua junk yang muncul kembali LANGSUNG dihapus.
 *   5. Memasang git pre-commit hook (.githooks) yang menolak
 *      commit file blocklist.
 *
 * Script ini aman dijalankan berulang: kalau bersih, dia tidak
 * melakukan apa-apa. Tidak pernah gagal/ganggu proses lain (exit 0).
 * Jalankan manual kapan saja: `bun run guard`
 */
import { existsSync, rmSync, readFileSync, writeFileSync, chmodSync, readdirSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/* ── 1) Nama file junk yang DIKETAHUI — hapus kalau muncul di root ── */
const JUNK_FILES = new Set([
  // Vercel (deploy sekarang via Cloudflare Workers / wrangler)
  'vercel.json',
  'vercel-postbuild.sh',
  '.vercelignore',
  // Report / dokumentasi sesi coding (root hanya boleh README.md)
  //   → ditangani pola `*.md` di bawah, kecuali README.md
  // Script fix / debug sekali-pakai
  'fix_ai.js',
  'fix_ai_route.py',
  'create-dummy-user.ts',
  'test-db.ts',
  'test-hf-vision.ts',
  'dev.out',
  // Jest — project tidak pakai jest
  'jest.config.js',
  'jest.setup.js',
  'run-tests.sh',
  // Lockfile selain bun
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  // Dump data / docs besar di root
  'doku-api.json',
  'doku-checkout-id.json',
  'doku-docs.json',
  'doku-search.json',
  'funderblu.json',
  'sakura-docs.json',
])

/* ── 2) Pola junk di root ── */
const KEEP_MD = new Set(['README.md'])

function isJunk(name) {
  if (JUNK_FILES.has(name)) return true
  // report/debug .md di root (kecuali README)
  if (name.endsWith('.md') && !KEEP_MD.has(name)) return true
  // screenshot/debug .png di root
  if (name.endsWith('.png')) return true
  // dump json ala "doku-docs.json"
  if (/^(doku-.*|.*-docs|.*-search)\.json$/.test(name)) return true
  return false
}

/* ── 3) Hapus junk yang ditemukan ── */
const removed = []
try {
  for (const name of readdirSync(ROOT)) {
    if (isJunk(name)) {
      rmSync(join(ROOT, name), { recursive: true, force: true })
      removed.push(name)
    }
  }
} catch {
  /* tidak pernah gagal */
}

if (removed.length > 0) {
  console.log(`🛡️  guard-junk: hapus ${removed.length} file junk yang muncul lagi →`, removed.join(', '))
}

/* ── 4) Pastikan blok blocklist ada di .gitignore ── */
const GITIGNORE_MARK = '🚫 BLOCKLIST PERMANEN'
const GITIGNORE_PATH = join(ROOT, '.gitignore')
try {
  const gi = existsSync(GITIGNORE_PATH) ? readFileSync(GITIGNORE_PATH, 'utf8') : ''
  if (!gi.includes(GITIGNORE_MARK)) {
    const block = `
# ╔══════════════════════════════════════════════════════════════════╗
# ║  🚫 BLOCKLIST PERMANEN — file lama yang SUDAH DIHAPUS 3 KALI      ║
# ║  JANGAN pernah commit / recreate file-file ini lagi.              ║
# ║  Dijaga otomatis oleh scripts/guard-junk.mjs (jalan tiap dev).    ║
# ╚══════════════════════════════════════════════════════════════════╝
/vercel.json
/vercel-postbuild.sh
/.vercelignore
/.vercel/
/*.md
!/README.md
/*.png
/fix_ai.js
/fix_ai_route.py
/fix-*.py
/create-dummy-user.ts
/test-db.ts
/test-hf-vision.ts
/dev.out
/jest.config.js
/jest.setup.js
/run-tests.sh
/package-lock.json
/yarn.lock
/pnpm-lock.yaml
/doku-*.json
/*-docs.json
/*-search.json
`
    writeFileSync(GITIGNORE_PATH, gi.replace(/\n*$/, '\n') + block)
    console.log('🛡️  guard-junk: blok blocklist ditambahkan ke .gitignore')
  }
} catch {
  /* tidak pernah gagal */
}

/* ── 5) Pastikan git pre-commit hook terpasang ── */
const HOOK_DIR = join(ROOT, '.githooks')
const HOOK_PATH = join(HOOK_DIR, 'pre-commit')
const HOOK_BODY = `#!/bin/sh
# 🛡️ BLOCKLIST GUARD — tolak commit file junk yang sudah dihapus permanen.
# Daftar lengkap: .gitignore (blok "BLOCKLIST PERMANEN") & scripts/guard-junk.mjs
BLOCK='(^|/)vercel\\.json$|(^|/)vercel-postbuild\\.sh$|(^|/)\\.vercelignore$|(^|/)fix_ai\\.(js|py)$|(^|/)jest\\.(config|setup)\\.js$|(^|/)run-tests\\.sh$|(^|/)package-lock\\.json$|(^|/)yarn\\.lock$|(^|/)pnpm-lock\\.yaml$|(^|/)create-dummy-user\\.ts$|(^|/)test-db\\.ts$|(^|/)test-hf-vision\\.ts$|(^|/)dev\\.out$|(^|/)doku-.*\\.json$'
BAD=$(git diff --cached --name-only --diff-filter=ACR | grep -E "$BLOCK" || true)
ROOTMD=$(git diff --cached --name-only --diff-filter=ACR | grep -E '^[^/]+\\.md$' | grep -v '^README\\.md$' || true)
ROOTPNG=$(git diff --cached --name-only --diff-filter=ACR | grep -E '^[^/]+\\.png$' || true)
BAD="$BAD $ROOTMD $ROOTPNG"
BAD=$(echo "$BAD" | xargs)
if [ -n "$BAD" ]; then
  echo ""
  echo "🚫 COMMIT DITOLAK — file berikut ada di BLOCKLIST (sudah dihapus permanen):"
  echo "$BAD" | sed 's/^/   - /'
  echo ""
  echo "   Lihat .gitignore (blok 'BLOCKLIST PERMANEN')."
  echo "   Kalau benar-benar perlu, gunakan: git commit --no-verify"
  exit 1
fi
`
try {
  execSync('git rev-parse --git-dir', { cwd: ROOT, stdio: 'ignore' })
  if (!existsSync(HOOK_DIR)) mkdirSync(HOOK_DIR, { recursive: true })
  if (!existsSync(HOOK_PATH) || readFileSync(HOOK_PATH, 'utf8') !== HOOK_BODY) {
    writeFileSync(HOOK_PATH, HOOK_BODY)
    chmodSync(HOOK_PATH, 0o755)
  }
  let hooksPath = ''
  try {
    hooksPath = execSync('git config core.hooksPath', { cwd: ROOT, encoding: 'utf8' }).trim()
  } catch {
    hooksPath = ''
  }
  if (hooksPath !== '.githooks') {
    execSync('git config core.hooksPath .githooks', { cwd: ROOT, stdio: 'ignore' })
    console.log('🛡️  guard-junk: git pre-commit hook terpasang (.githooks/pre-commit)')
  }
} catch {
  /* bukan repo git — lewati */
}

process.exit(0)
