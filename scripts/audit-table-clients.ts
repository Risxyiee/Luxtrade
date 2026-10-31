/**
 * AUDIT 027 — Pemetaan tabel Supabase → tipe client yang menyentuhnya.
 *
 * Tujuan: menentukan tabel mana yang 100% hanya disentuh client SERVICE ROLE
 * (admin) → aman di-REVOKE dari anon/authenticated (pola migrasi 026),
 * dan tabel mana yang disentuh client USER-JWT (anon key + cookie/Bearer,
 * jalan sebagai role `authenticated`) → privilege HARUS dipertahankan,
 * keamanan diserahkan ke RLS policy.
 *
 * OUTPUT: daftar tabel + file yang menyentuh + klasifikasi per file.
 *   ADMIN  = file hanya pakai client service-role
 *   USER   = file memakai (atau mungkin memakai) client user-JWT/browser
 *   MIXED  = file pakai keduanya → dihitung USER (konservatif)
 *   MANUAL = file menyentuh tabel tapi pola client tidak dikenali
 *
 * Jalankan: bun scripts/audit-table-clients.ts
 */
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = join(process.cwd(), 'src')

// Pola client SERVICE-ROLE (query jalan sebagai service_role, kebal REVOKE)
const ADMIN_PAT =
  /getSupabaseAdmin|createAdminClient|supabase-admin-alt|@\/lib\/supabase\/admin|SUPABASE_SERVICE_ROLE_KEY|cron-supabase/

// Pola client USER-JWT (query jalan sebagai role `authenticated`/`anon`)
const USER_PAT =
  /createClientForApi|@\/lib\/supabase\/server'|@\/lib\/supabase"|getServerClient|createSupabaseClient|getAuthenticatedUser|getClientBrowserAsync|createBrowserClient|supabase-browser|getUser\(/ // getUser di lib sync-user dkk via user client

const TABLE_RE = /\.from\(['"]([a-z_]+)['"]\)/g
// Nama bucket storage yang kebetulan match pola tabel (bukan tabel publik)
const BUCKETS = new Set(['screenshots'])

type Kind = 'ADMIN' | 'USER' | 'MIXED' | 'MANUAL'

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e)) out.push(p)
  }
  return out
}

const map = new Map<string, { file: string; kind: Kind }[]>()

for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8')
  const tables = new Set<string>()
  let m: RegExpExecArray | null
  TABLE_RE.lastIndex = 0
  while ((m = TABLE_RE.exec(src))) {
    if (!BUCKETS.has(m[1])) tables.add(m[1])
  }
  if (tables.size === 0) continue

  const admin = ADMIN_PAT.test(src)
  const user = USER_PAT.test(src)
  let kind: Kind
  if (admin && user) kind = 'MIXED'
  else if (user) kind = 'USER'
  else if (admin) kind = 'ADMIN'
  else kind = 'MANUAL'

  for (const t of tables) {
    if (!map.has(t)) map.set(t, [])
    map.get(t)!.push({ file: relative(process.cwd(), file), kind })
  }
}

const LOCKDOWN: string[] = []
const KEEP: string[] = []
const CHECK: string[] = []

for (const [t, entries] of [...map.entries()].sort()) {
  const kinds = entries.map(e => e.kind)
  if (kinds.every(k => k === 'ADMIN')) LOCKDOWN.push(t)
  else if (kinds.some(k => k === 'USER' || k === 'MIXED')) KEEP.push(t)
  else CHECK.push(t)
}

const rel = (s: string) => s.replace(/^src\//, '')

console.log('════════ LOCKDOWN-SAFE (semua file ADMIN) — kandidat REVOKE ════════')
for (const t of LOCKDOWN) {
  console.log(`\n▸ ${t}`)
  for (const e of map.get(t)!) console.log(`   [${e.kind}] ${rel(e.file)}`)
}
console.log('\n════════ KEEP (disentuh client USER-JWT) — JANGAN REVOKE ════════')
for (const t of KEEP) {
  console.log(`\n▸ ${t}`)
  for (const e of map.get(t)!) console.log(`   [${e.kind}] ${rel(e.file)}`)
}
console.log('\n════════ PERLU CEK MANUAL ════════')
for (const t of CHECK) {
  console.log(`\n▸ ${t}`)
  for (const e of map.get(t)!) console.log(`   [${e.kind}] ${rel(e.file)}`)
}
console.log(
  `\nTotal: ${LOCKDOWN.length} lockdown-safe, ${KEEP.length} keep, ${CHECK.length} manual`,
)
