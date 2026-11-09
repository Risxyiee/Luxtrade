/**
 * Uji otak Growth Sentinel — fungsi murni diekstrak dari KODE ASLI yang
 * akan di-ship (pola yang sama dengan uji marketListener b271beef):
 * Bun.Transpiler memotong blok antara marker file, lalu dieksekusi.
 * Tidak ada import DB/network — murni logika.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = '/home/z/my-project'
const transpiler = new Bun.Transpiler({ loader: 'ts' })

function extractPure(sourcePath, startMarker, endMarker) {
  const src = readFileSync(join(ROOT, sourcePath), 'utf8')
  const a = src.indexOf(startMarker)
  const b = src.indexOf(endMarker, a)
  if (a < 0 || b < 0) throw new Error(`marker tidak ketemu di ${sourcePath}`)
  const slice = src.slice(a, b)
  return transpiler.transformSync(slice).replaceAll('export function', 'function').replaceAll('export const', 'const').replaceAll('export interface ', 'interface ').replaceAll('export type ', 'type ')
}

const libCode = extractPure('src/lib/growth-sentinel.ts', '/* ── METRIK & DETEKSI KEKERINGAN', '/* ── LEAD CAPTURE')
// LEAD CAPTURE = blok terakhir file — ambil sampai akhir
{
  const src = readFileSync(join(ROOT, 'src/lib/growth-sentinel.ts'), 'utf8')
  const a = src.indexOf('/* ── LEAD CAPTURE')
  const transformed = transpiler.transformSync(src.slice(a)).replaceAll('export function', 'function')
  var leadCode = transformed
}
const mod = new Function(`${libCode}\n${leadCode}\nreturn { detectDrought, pickPlaybook, buildHookFallback, buildWelcomeEmailFallback, socialProofLines, extractEmail, clipLeadMessage, SENTINEL_COOLDOWNS_MS }`)()
const { detectDrought, pickPlaybook, buildHookFallback, buildWelcomeEmailFallback, extractEmail, clipLeadMessage, SENTINEL_COOLDOWNS_MS } = mod

let pass = 0, fail = 0
function t(name, cond) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}`) }
}

const now = Date.now()
const H = 3600_000
const iso = (msAgo) => new Date(now - msAgo).toISOString()

const baseMetrics = {
  signups6h: 0, signups24h: 0, signups7d: 0,
  leadsNew: 0, leads24h: 0, trades24h: 0, members: 0,
  dataIncomplete: false,
}

console.log('\n══ 1. detectDrought — level kekeringan dari angka riil ══')
t('7 hari nol signup → critical', detectDrought(baseMetrics).level === 'critical')
t('0 signup 24j + 0 lead → drought', detectDrought({ ...baseMetrics, signups7d: 3 }).level === 'drought')
t('0 signup 24j tapi ada lead → tetap drought (signup yang dinilai)', detectDrought({ ...baseMetrics, signups7d: 3, leads24h: 2 }).level === 'drought')
t('signup 24j = 2 → quiet', detectDrought({ ...baseMetrics, signups7d: 5, signups24h: 2 }).level === 'quiet')
t('signup 24j = 5 → healthy', detectDrought({ ...baseMetrics, signups7d: 9, signups24h: 5 }).level === 'healthy')
t('dataIncomplete membatasi critical → quiet (anti alarm palsu)', detectDrought({ ...baseMetrics, dataIncomplete: true }).level === 'quiet')

console.log('\n══ 2. pickPlaybook — prioritas + cooldown ══')
const emptyState = { lastRun: {} }
// a) lead menunggu = prioritas #1 meski semuanya basi
let pick = pickPlaybook(emptyState, { ...baseMetrics, leadsNew: 3 }, { level: 'drought', reasons: [] }, now)
t('lead baru > 0 & belum pernah jalan → lead-welcome', pick.action === 'lead-welcome')
// b) lead-welcome dalam cooldown → jatuh ke social-proof (basi)
pick = pickPlaybook({ lastRun: { 'lead-welcome': iso(30 * 60_000) } }, { ...baseMetrics, leadsNew: 3 }, { level: 'drought', reasons: [] }, now)
t('lead-welcome baru 30 menit → jatuh ke social-proof', pick.action === 'social-proof')
// c) social-proof fresh, cs-hook basi → cs-hook
pick = pickPlaybook({ lastRun: { 'social-proof': iso(1 * H) } }, baseMetrics, { level: 'healthy', reasons: [] }, now)
t('social-proof fresh 1 jam → cs-hook', pick.action === 'cs-hook')
// d) semua fresh + healthy → rest (hemat kuota)
pick = pickPlaybook({ lastRun: { 'social-proof': iso(1 * H), 'cs-hook': iso(1 * H), 'lead-welcome': iso(30 * 60_000) } }, baseMetrics, { level: 'healthy', reasons: [] }, now)
t('semua fresh + sehat → rest', pick.action === 'rest')
// e) drought parah & alarm basi → drought-alarm
pick = pickPlaybook({ lastRun: { 'social-proof': iso(1 * H), 'cs-hook': iso(1 * H) } }, baseMetrics, { level: 'critical', reasons: ['0 signup dalam 7 hari'] }, now)
t('critical + alarm belum pernah → drought-alarm', pick.action === 'drought-alarm')
// f) drought tapi alarm baru 5 jam → rest
pick = pickPlaybook({ lastRun: { 'social-proof': iso(1 * H), 'cs-hook': iso(1 * H), 'drought-alarm': iso(5 * H) } }, baseMetrics, { level: 'critical', reasons: [] }, now)
t('critical tapi alarm baru 5 jam → rest (jangan spam Discord)', pick.action === 'rest')
// g) state tanpa lastRun sama sekali → lead dulu kalau ada lead
pick = pickPlaybook({}, { ...baseMetrics, leadsNew: 1 }, { level: 'healthy', reasons: [] }, now)
t('state kosong + lead ada → lead-welcome (paling rentan dingin)', pick.action === 'lead-welcome')
// h) konstanta cooldown masuk akal
t('cooldown lead-welcome 1 jam', SENTINEL_COOLDOWNS_MS['lead-welcome'] === 60 * 60_000)
t('cooldown drought-alarm 12 jam', SENTINEL_COOLDOWNS_MS['drought-alarm'] === 12 * H)

console.log('\n══ 3. buildHookFallback — tanpa LLM tetap jalan ══')
const hook = buildHookFallback({ ...baseMetrics, trades24h: 2 })
t('ada 2 trade terjurnal → hook menyebut trade', hook.greeting.includes('2 trade'))
t('chips >= 2 & pendek', hook.chips.length >= 2 && hook.chips.every(c => c.length <= 28))
const hookEmpty = buildHookFallback(baseMetrics)
t('nol trade → hook TIDAK mengarang angka & TIDAK jualan sinyal', !/\d+ sinyal/.test(hookEmpty.greeting) && !/sinyal/i.test(hookEmpty.chips.join(' ')))
t('model fallback jujur', hookEmpty.model === 'fallback-deterministik')

console.log('\n══ 4. buildWelcomeEmailFallback — email jujur ══')
const lead = { id: 'abc', email: 'budi.trader@gmail.com', language: 'id', first_message: 'kira2 cocok buat pemula ga?' }
const mail = buildWelcomeEmailFallback(lead, null)
t('subject menyapa nama dari email', mail.subject.includes('Budi'))
t('body kutip pesan awal lead', mail.body.includes('cocok buat pemula'))
t('body ada CTA signup nyata', mail.body.includes('https://luxtradee.web.id/auth/signup'))
const proof = { members: 42, tradesTotal: 1300, generatedAt: iso(0) }
const mail2 = buildWelcomeEmailFallback(lead, proof)
t('dengan proof → sebut 1300 trade terjurnal', mail2.body.includes('1300 trade'))

console.log('\n══ 5. extractEmail — deteksi lead dari chat ══')
t('email biasa terdeteksi', extractEmail('kirim ke budi.trader@gmail.com ya') === 'budi.trader@gmail.com')
t('huruf besar dinormalisasi', extractEmail('Budi.Trader@Gmail.COM') === 'budi.trader@gmail.com')
t('placeholder xxx ditolak', extractEmail('email: xxx@example.com') === null)
t('placeholder contoh@ ditolak', extractEmail('contoh@mail.com') === null)
t('bukan email → null', extractEmail('mau dong kirim sinyalnya') === null)
t('email 1 karakter lokal ditolak', extractEmail('a@b.io') === null)
t('pesan panjang di-clip', (clipLeadMessage('x'.repeat(500)) || '').length <= 301)

console.log(`\n══════════ HASIL: ${pass} lulus, ${fail} gagal ══════════`)
process.exit(fail > 0 ? 1 : 0)
