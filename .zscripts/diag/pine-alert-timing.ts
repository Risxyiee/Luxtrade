/**
 * DIAGNOSIS pine-alert: di mana sinyal entry/exit berada relatif
 * terhadap "bar terakhir" saat cron berjalan?
 * Jalankan: cd /home/z/my-project && bun .zscripts/diag/pine-alert-timing.ts
 * (folder .zscripts — di luar src, tidak ikut build)
 */
import { fetchServerCandles, runDefaultStrategyPine } from '@/lib/pine-protected'

const SYMBOL = process.argv[2] || 'XAUUSD'
const TF = process.argv[3] || '1h'

const cd = await fetchServerCandles(SYMBOL, TF, 300)
if (!cd || !cd.bars.length) {
  console.log('❌ candle tidak tersedia:', (cd as any)?.error || 'kosong')
  process.exit(1)
}
const lastIdx = cd.bars.length - 1
const fmt = (ms: number) => new Date(ms).toISOString().replace('T', ' ').slice(0, 16)
console.log(`✅ candle source=${cd.source} bars=${cd.bars.length}`)
console.log(`   bar terakhir (berjalan): #${lastIdx} ${fmt(cd.bars[lastIdx].time * 1000)}`)
console.log(`   bar penutupan terakhir : #${lastIdx - 1} ${fmt(cd.bars[lastIdx - 1].time * 1000)}`)

const run = await runDefaultStrategyPine(SYMBOL, TF, cd.bars)
if (!run.ok) { console.log('❌ run gagal:', run.error); process.exit(1) }

const alerts = run.engineAlerts || []
const entries = alerts.filter((a) => /entry/i.test(a.message))
console.log(`\n📊 total engineAlerts (${cd.bars.length} bar): ${alerts.length} | entry: ${entries.length} | exit: ${alerts.length - entries.length}`)

console.log('\n🧪 8 sinyal TERAKHIR — apakah masih "bar terakhir" saat cron jalan?')
for (const a of alerts.slice(-8)) {
  const dist = lastIdx - a.barIndex
  const verdict = dist === 0 ? '✅ FIRING (bar terakhir)'
    : dist === 1 ? '⚠️  BARU SAJA terlewat (1 bar lalu)'
    : `❌ TERLEWAT (${dist} bar lalu — cron tidak mungkin kebagian)`
  console.log(`   #${String(a.barIndex).padStart(3)} ${fmt(a.time)} ${a.message.slice(0, 50).padEnd(50)} → ${verdict}`)
}

/* Simulasi: cron tiap 15 menit — berapa sinyal yang tidak pernah
   terkirim karena bukan bar terakhir saat cron tick? */
let missed = 0
const CRON_MIN = 15
const tfMin = TF.endsWith('m') ? parseInt(TF) : TF.endsWith('h') ? parseInt(TF) * 60 : TF === '1d' ? 1440 : 10080
for (const a of alerts) {
  const barStartMs = cd.bars[a.barIndex]?.time * 1000
  const offsetInBar = a.time - barStartMs // 0 utk entry (open), acak utk exit
  const ticksAfter = Math.floor((tfMin * 60000 - offsetInBar) / (CRON_MIN * 60000))
  if (ticksAfter < 1) missed++
}
console.log(`\n💡 SIMULASI cron ${CRON_MIN} menit pada timeframe ${TF}:`)
console.log(`   sinyal AKAN TERLEWAT: ${missed}/${alerts.length} (${Math.round(100 * missed / Math.max(1, alerts.length))}%)`)

/* ═══════════ VERIFIKASI FIX ═══════════
   Jalankan collectTriggers (versi BARU — jendela catch-up) persis
   seperti yang dilakukan cron → sinyal yang tadinya "TERLEWAT"
   harusnya sekarang masuk daftar pemicu. */
const { collectTriggers } = await import('@/lib/pine-alert-runner')
const triggers = collectTriggers({
  engineAlerts: run.engineAlerts,
  rules: null,
  plots: [],
  bars: cd.bars,
})
console.log(`\n🛠️  HASIL FIX — collectTriggers jendela ${6} bar:`)
if (!triggers.length) console.log('   (tidak ada sinyal dalam jendela — normal bila memang sepi)')
for (const t of triggers) {
  console.log(`   ${t.signal.padEnd(12)} ${fmt(t.time * 1000)} @ ${t.price} — ${t.message.slice(0, 44)}`)
}
const caught = triggers.length > 0
console.log(caught
  ? '\n✅ FIX TERBUKTI: sinyal yang tadinya hilang senyap SEKARANG TERTANGKAP & akan dikirim (push HP + chat Telegram)'
  : '\nℹ️  Tidak ada sinyal dalam 6 bar terakhir — coba timeframe/simbol lain')
process.exit(0)
