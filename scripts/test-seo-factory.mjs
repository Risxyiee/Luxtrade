/**
 * Uji otak SEO Factory (Farhan) — fungsi murni diekstrak dari KODE ASLI
 * yang akan di-ship (pola yang sama dengan uji growth-sentinel &
 * marketListener b271beef): Bun.Transpiler memotong blok antara marker
 * file, lalu dieksekusi. Tidak ada import DB/network — murni logika.
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

const brainCode = extractPure('src/lib/seo-factory.ts', '/* ── OTAK SEO (MURNI)', '/* ── AKHIR OTAK SEO')
const mod = new Function(
  `${brainCode}\nreturn { SEO_SYMBOLS, SEO_INTENTS, SYMBOL_ALIAS, slugifySeo, pickSeoPages, buildSeoPageHtml, seoInternalLinks, intentCoreSection, formatTanggalIndo, formatAngka, wibParts, escapeHtml, symbolLabel }`,
)()
const { SEO_SYMBOLS, SEO_INTENTS, slugifySeo, pickSeoPages, buildSeoPageHtml, seoInternalLinks } = mod

let pass = 0, fail = 0
function t(name, cond) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}`) }
}

/* ── Fixture ── */
const mkPlan = (symbol, intent) => ({
  slug: intent.slugTemplate(symbol),
  title: intent.titleTemplate(symbol),
  keyword: intent.keyword(symbol),
  metaDescription: intent.metaTemplate(symbol),
  symbol,
  intentKey: intent.key,
})
const intent = (key) => SEO_INTENTS.find((i) => i.key === key)
const sinyalIntent = intent('sinyal-hari-ini')
const jamIntent = intent('jam-pasar')
const breakIntent = intent('strategi-breakout')
const pineIntent = intent('indikator-pine')
const risikoIntent = intent('manajemen-risiko')
const psikoIntent = intent('psikologi-trading')

const baseData = {
  lastPrice: null, priceChangePct: null, lastSignal: null,
  marketOpen: true, sessionWib: 'London', todayIso: '2026-01-09',
  economicEvents: [], memberCount: 0, signalCount7d: 0,
}

const planXau = mkPlan('XAUUSD', sinyalIntent)
const htmlSinyal = buildSeoPageHtml(planXau, baseData)

console.log('\n══ 1. slugifySeo — lowercase, dash, trim, maks 70 ══')
t('slug dasar: spasi/tanda baca → dash + lowercase', slugifySeo('Sinyal XAUUSD Hari Ini!') === 'sinyal-xauusd-hari-ini')
t('maks 70 char & tanpa dash menggantung setelah dipotong', slugifySeo('a'.repeat(90)).length <= 70 && !/-+$/.test(slugifySeo('a'.repeat(69) + '-')))
t('teks tanpa karakter alnum → string kosong', slugifySeo('  ***  ') === '')

console.log('\n══ 2. Matriks symbol × intent ══')
t('intent sinyal-hari-ini → judul persis sesuai spesifikasi', sinyalIntent.titleTemplate('XAUUSD') === 'Sinyal XAUUSD Hari Ini — Analisis & Level Penting (Update Otomatis)')
t('5 simbol × 6 intent = 30 slug unik (tidak ada tabrakan)', SEO_SYMBOLS.length === 5 && SEO_INTENTS.length >= 6 && new Set(SEO_SYMBOLS.flatMap((s) => SEO_INTENTS.map((i) => i.slugTemplate(s)))).size === SEO_SYMBOLS.length * SEO_INTENTS.length)

console.log('\n══ 3. pickSeoPages — deterministik, skip, tanpa duplikat, rotasi ══')
const a = pickSeoPages([], 3, 20260109)
const b = pickSeoPages([], 3, 20260109)
t('daySeed sama → hasil identik (deterministik)', JSON.stringify(a) === JSON.stringify(b) && a.length === 3)
const base = pickSeoPages([], 2, 20260109)
const skip = pickSeoPages([base[0].slug], 2, 20260109)
t('slug existing di-skip → jatuh ke kombinasi berikutnya', skip[0].slug === base[1].slug && skip.length === 2)
const semua = pickSeoPages([], 999, 20260109)
t('tanpa duplikat dalam satu panggilan & count di-clamp ke 30', new Set(semua.map((p) => p.slug)).size === semua.length && semua.length === 30)
t('daySeed beda → kombinasi bergeser (rotasi)', pickSeoPages([], 1, 20260109)[0].slug !== pickSeoPages([], 1, 20260110)[0].slug)
t('plan lengkap: slug/title/keyword/meta/symbol/intentKey non-kosong', !!a[0].slug && !!a[0].title && !!a[0].keyword && a[0].metaDescription.length >= 40 && !!a[0].symbol && !!a[0].intentKey)

console.log('\n══ 4. buildSeoPageHtml — pembuka, data riil, jujur ══')
t('html memuat simbol & TANPA tag <html>', htmlSinyal.includes('XAUUSD') && !/<html/i.test(htmlSinyal) && htmlSinyal.includes('<h2>'))
t('sinyal null → teks jujur "belum ada sinyal baru" + pantau terus', /belum ada sinyal baru/i.test(htmlSinyal) && /pantau terus/i.test(htmlSinyal) && !/\bentry\b[^<]*\d/i.test(htmlSinyal))
t('CTA penutup persis sesuai spesifikasi', htmlSinyal.includes('Coba gratis di Luxtradee — sinyal otomatis masuk notifikasi HP.'))
t('tanggal hari ini tercantum (9 Januari 2026)', htmlSinyal.includes('9 Januari 2026'))
const htmlHarga = buildSeoPageHtml(planXau, { ...baseData, lastPrice: 4321.5, priceChangePct: -0.35 })
t('harga riil terformat id-ID (4.321,50) + arah melemah (0,35%)', htmlHarga.includes('4.321,50') && htmlHarga.includes('melemah') && htmlHarga.includes('0,35%'))

console.log('\n══ 5. Konten inti per intent — anti doorway (beda mutu) ══')
const htmlJam = buildSeoPageHtml(mkPlan('XAUUSD', jamIntent), baseData)
const htmlBreak = buildSeoPageHtml(mkPlan('EURUSD', breakIntent), baseData)
const htmlPine = buildSeoPageHtml(mkPlan('BTCUSD', pineIntent), baseData)
const htmlRisiko = buildSeoPageHtml(mkPlan('GBPUSD', risikoIntent), baseData)
const htmlPsiko = buildSeoPageHtml(mkPlan('US100', psikoIntent), baseData)
t('intent jam-pasar → tabel sesi Sydney/Tokyo/London/New York dalam WIB', htmlJam.includes('<table') && htmlJam.includes('Sydney') && htmlJam.includes('Tokyo') && htmlJam.includes('London') && htmlJam.includes('New York') && htmlJam.includes('WIB'))
const coreHeads = {
  sinyal: ['Cara Membaca Sinyal dengan Disiplin', htmlSinyal],
  jam: ['Jam Pasar Dunia dalam WIB', htmlJam],
  break: ['Langkah Setup Breakout yang Terukur', htmlBreak],
  pine: ['Ide Indikator Pine Script', htmlPine],
  risiko: ['Aturan Risiko 1', htmlRisiko],
  psiko: ['Jebakan Emosi', htmlPsiko],
}
let unik = true
for (const [k, [head, html]] of Object.entries(coreHeads)) {
  if (!html.includes(head)) unik = false
  for (const [k2, [, html2]] of Object.entries(coreHeads)) {
    if (k2 !== k && html2.includes(head)) unik = false
  }
}
t('heading inti 6 intent unik & tidak bocor antar halaman', unik)

console.log('\n══ 6. Kalender ekonomi — kosong di-skip, ada → tabel ══')
t('event kosong → bagian kalender TIDAK muncul (dan tanpa tabel di halaman sinyal)', !htmlSinyal.includes('Kalender Ekonomi') && !htmlSinyal.includes('<table'))
const htmlEvent = buildSeoPageHtml(planXau, { ...baseData, economicEvents: [{ time: '2026-01-09T13:30:00.000Z', country: 'USD', title: 'CPI YoY', impact: 'high' }] })
t('event ada → tabel kalender + judul event + jam dikonversi ke WIB (13:30Z → 20.30)', htmlEvent.includes('Kalender Ekonomi Hari Ini') && htmlEvent.includes('CPI YoY') && htmlEvent.includes('USD') && htmlEvent.includes('20.30') && htmlEvent.includes('<table'))

console.log('\n══ 7. Social proof & sinyal terakhir — angka riil saja ══')
const htmlProof = buildSeoPageHtml(planXau, { ...baseData, memberCount: 42, signalCount7d: 7 })
t('social proof angka riil >0 tampil (42 trader, 7 sinyal)', htmlProof.includes('42 trader') && htmlProof.includes('7 sinyal'))
t('social proof nol → TIDAK mengarang angka member', !htmlSinyal.includes('sudah bergabung') && !htmlSinyal.includes('trader</strong>'))
const htmlSig = buildSeoPageHtml(planXau, { ...baseData, lastSignal: { action: 'buy', symbol: 'XAUUSD', createdAt: '2026-01-09T02:05:00.000Z' } })
t('sinyal ada → aksi+symbol+konversi WIB (02:05Z → 09.05), tanpa level karangan', /sinyal vip terakhir/i.test(htmlSig) && htmlSig.includes('BUY XAUUSD') && htmlSig.includes('09.05 WIB') && !/\bentry\b\s*[:@=]?\s*\d/i.test(htmlSig))

console.log('\n══ 8. seoInternalLinks — internal linking antar plan ══')
const plans3 = pickSeoPages([], 3, 20260109)
const links = seoInternalLinks(plans3.slice(1))
t('blok "Baca juga" berisi /blog/<slug> & judul plan LAIN (judul di-escape HTML)', links.includes('Baca juga') && links.includes('/blog/' + plans3[1].slug) && links.includes('/blog/' + plans3[2].slug) && links.includes(mod.escapeHtml(plans3[1].title)))
t('plan kosong → string kosong (bukan blok kosong)', seoInternalLinks([]) === '')

console.log(`\n══════════ HASIL: ${pass} lulus, ${fail} gagal ══════════`)
process.exit(fail > 0 ? 1 : 0)
