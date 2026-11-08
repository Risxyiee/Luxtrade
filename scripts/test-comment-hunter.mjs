/**
 * Uji otak Pemburu Komentar — fungsi murni diekstrak dari KODE ASLI yang
 * akan di-ship (pola yang sama dengan uji growth-sentinel / seo-factory):
 * Bun.Transpiler memotong blok antara marker, lalu dieksekusi.
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
  return transpiler.transformSync(slice)
    .replaceAll('export function', 'function')
    .replaceAll('export const', 'const')
    .replaceAll('export interface ', 'interface ')
    .replaceAll('export type ', 'type ')
}

const code = extractPure('src/lib/comment-hunter.ts', '/* ── OTAK PEMBURU KOMENTAR (MURNI) ── */', '/* ── AKHIR OTAK MURNI ── */')
const mod = new Function(`${code}\nreturn { classifyComment, buildAutoReply, pickHuntTargets, summarizeHunt, snippetForReport }`)()
const { classifyComment, buildAutoReply, pickHuntTargets, summarizeHunt, snippetForReport } = mod

let pass = 0, fail = 0
function t(name, cond) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}`) }
}

const ctx = { socialProof: '1.204 trader aktif', signupUrl: 'https://luxtradee.web.id/auth/signup', hasTrial: true }
const FORBIDDEN = ['garansi', 'pasti profit', 'pasti cuan']

console.log('\n══ 1. classifyComment — klasifikasi niat dari teks asli ══')
t('gimana cara daftar → tanya-cara (lead, aman dibalas)',
  classifyComment('kak gimana cara daftarnya?').intent === 'tanya-cara'
  && classifyComment('kak gimana cara daftarnya?').lead === false
  && classifyComment('kak gimana cara daftarnya?').autoReplySafe === true)
t('download apk → tanya-cara', classifyComment('download apk nya dimana ya').intent === 'tanya-cara')
t('harga berapa? → minat-harga + LEAD', classifyComment('harga premium nya berapa?').intent === 'minat-harga' && classifyComment('harga premium nya berapa?').lead === true)
t('daftar harga → minat-harga (urutan benar)', classifyComment('daftar harga dong').intent === 'minat-harga')
t('sinyal akurat ga kak → tanya-sinyal', classifyComment('sinyalnya akurat ga kak?').intent === 'tanya-sinyal')
t('BUY sekarang? → tanya-sinyal', classifyComment('BUY XAUUSD sekarang kak?').intent === 'tanya-sinyal')
t('halo kak → sapa-halo', classifyComment('Halo kak!').intent === 'sapa-halo')
t('keren mantap → pujian', classifyComment('keren banget mantap!').intent === 'pujian')
t('scam → negatif-spam (tidak dibalas)', classifyComment('ini scam kan?').intent === 'negatif-spam' && classifyComment('ini scam kan?').autoReplySafe === false)
t('link http → negatif-spam', classifyComment('cuan gampang, cek http://scam.xyz').intent === 'negatif-spam')
t('teks kosong → lain & tidak aman', classifyComment('').intent === 'lain' && classifyComment('').autoReplySafe === false)

console.log('\n══ 2. buildAutoReply — balasan aman, tanpa janji profit ══')
for (const intent of ['tanya-cara', 'minat-harga', 'tanya-sinyal', 'sapa-halo', 'pujian']) {
  const r = buildAutoReply(intent, ctx)
  t(`${intent} → ada balasan ≤200 char, link ada, tanpa kata terlarang`,
    typeof r === 'string' && r.length > 0 && r.length <= 200
    && FORBIDDEN.every((f) => !r.toLowerCase().includes(f))
    && r.includes('luxtradee.web.id'))
}
t('negatif-spam → null (tidak dibalas otomatis)', buildAutoReply('negatif-spam', ctx) === null)
t('lain → null (butuh LLM / ACC manual)', buildAutoReply('lain', ctx) === null)
t('minat-harga TIDAK menyebut angka harga', !/\b(rp|idr)?\s?\d{4,}/i.test(buildAutoReply('minat-harga', ctx) || 'x'))
t('signupUrl kosong → fallback URL resmi', (buildAutoReply('tanya-cara', { socialProof: '', signupUrl: '', hasTrial: false }) || '').includes('luxtradee.web.id'))

console.log('\n══ 3. pickHuntTargets — dedupe & kap ══')
const media = [{ id: 'm1', comments: [
  { mediaId: 'm1', commentId: 'c1', username: 'a', text: 'halo' },
  { mediaId: 'm1', commentId: 'c2', username: 'b', text: 'harga?' },
  { mediaId: 'm1', commentId: 'c3', username: 'c', text: 'keren' },
] }]
t('semua baru → 3 target', pickHuntTargets(media, new Set(), 10).length === 3)
t('skip yang sudah ada', pickHuntTargets(media, new Set(['c1', 'c3']), 10).length === 1 && pickHuntTargets(media, new Set(['c1', 'c3']), 10)[0].commentId === 'c2')
t('cap maxNew dihormati (urut tanpa sort ulang)', pickHuntTargets(media, new Set(), 2).map((x) => x.commentId).join(',') === 'c1,c2')
t('komentar kosong dibuang', pickHuntTargets([{ id: 'm2', comments: [{ mediaId: 'm2', commentId: 'c4', text: '   ' }] }], new Set(), 10).length === 0)
t('existing tidak dikenal media lain → tetap skip', pickHuntTargets([{ id: 'm3', comments: [{ mediaId: 'm3', commentId: 'c1', text: 'halo lagi' }] }], new Set(['c1']), 10).length === 0)

console.log('\n══ 4. summarizeHunt — ringkasan Discord jujur ══')
const results = [
  { intent: 'minat-harga', status: 'auto_replied', lead: true, username: 'budi', text: 'harga premium berapa?' },
  { intent: 'tanya-cara', status: 'auto_replied', lead: false, username: 'ani', text: 'cara daftar gimana' },
  { intent: 'tanya-sinyal', status: 'drafted', lead: false, username: 'cici', text: 'sinyal hari ini ada?' },
  { intent: 'negatif-spam', status: 'skipped', lead: false, username: 'x', text: 'scam' },
]
const s = summarizeHunt(results)
t('sebut jumlah komentar baru', s.includes('4'))
t('sebut lead (prospek)', /lead/i.test(s) && s.includes('budi'))
t('sebut auto-replied', s.includes('2'))
t('spam dilaporkan sebagai dilewati', /lewati|skip/i.test(s))
t('kosong → jujur 0', summarizeHunt([]).length > 0)

console.log('\n══ 5. snippetForReport ══')
t('teks panjang dipotong dengan …', snippetForReport('a'.repeat(80)).length <= 41 && snippetForReport('a'.repeat(80)).endsWith('…'))
t('teks pendek utuh', snippetForReport('halo') === 'halo')

console.log(`\n══════════ HASIL: ${pass} lulus, ${fail} gagal ══════════`)
process.exit(fail ? 1 : 0)
