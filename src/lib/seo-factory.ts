/**
 * ═══════════════════════════════════════════════════════════════════════
 * SEO FACTORY — Otak "pabrik halaman SEO" (karyawan: FARHAN, mode pabrik)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * TUGAS: tiap hari menerbitkan 2–4 halaman blog SEO dari DATA RIIL (tanpa
 * halusinasi) menarget keyword long-tail Indonesia: "sinyal XAUUSD hari
 * ini", "jam pasar forex wib", "strategi prop firm", "indikator pine
 * script xauusd", dst. Matriks = 5 simbol × 6 intent = 30 kombinasi;
 * urutan dirotasi per hari (daySeed = yyyymmdd WIB) supaya tiap hari
 * terbit halaman BERBEDA dan tidak pernah dobel.
 *
 * ANTI-DOORWAY: tiap intent punya konten inti BERBEDA yang bermutu
 * (checklist baca sinyal / tabel sesi WIB / langkah breakout / ide pine
 * script / tabel risiko 1–2% / jebakan emosi), lalu keunikan datang dari
 * angka riil (harga, sinyal terakhir, kalender ekonomi, member).
 *
 * FILE INI = MURNI (TANPA import apa pun — zero dependency) supaya bisa
 * diekstrak Bun.Transpiler dan dites langsung dari kode asli, pola
 * test-growth-sentinel.mjs. Semua fungsi export.
 * ═══════════════════════════════════════════════════════════════════════
 */

/* ── OTAK SEO (MURNI) ────────────────────────────────────────────────── */

/* ── KONFIG MATRIKS ──────────────────────────────────────────────────── */

export const SEO_SYMBOLS = ['XAUUSD', 'BTCUSD', 'EURUSD', 'GBPUSD', 'US100']

export interface SeoPagePlan {
  slug: string
  title: string
  keyword: string
  metaDescription: string
  symbol: string
  intentKey: string
}

export interface SeoPageData {
  /** Harga terakhir dari candle 15m (bar tertutup) — null = data tidak tersedia. */
  lastPrice?: number | null
  /** Perubahan % dalam rentang candle yang diambil — null = tidak tersedia. */
  priceChangePct?: number | null
  marketOpen: boolean
  sessionWib: string
  /** Tanggal hari ini zona WIB, format yyyy-mm-dd. */
  todayIso: string
  economicEvents: Array<{ time: string; country: string; title: string; impact: string }>
  memberCount: number
}

/** Nama tambahan biar konten natural bahasa Indonesia (bukan bahasa mesin). */
export const SYMBOL_ALIAS: Record<string, string> = {
  XAUUSD: 'XAUUSD (Emas)',
  BTCUSD: 'BTCUSD (Bitcoin)',
  EURUSD: 'EURUSD (Euro/Dolar AS)',
  GBPUSD: 'GBPUSD (Pound Sterling)',
  US100: 'US100 (Nasdaq 100)',
}

export function symbolLabel(s: string): string {
  return SYMBOL_ALIAS[s] || s
}

/**
 * 6 INTENT SEO — tiap intent = sudut pandang berbeda (bukan spintax!).
 * Konten inti tiap intent ditulis manual di intentCoreSection() di bawah.
 */
export const SEO_INTENTS: Array<{
  key: string
  titleTemplate: (s: string) => string
  slugTemplate: (s: string) => string
  keyword: (s: string) => string
  metaTemplate: (s: string) => string
}> = [
  {
    key: 'sinyal-hari-ini',
    titleTemplate: (s) => `Sinyal ${s} Hari Ini — Analisis & Level Penting (Update Otomatis)`,
    slugTemplate: (s) => `sinyal-${slugifySeo(s)}-hari-ini`,
    keyword: (s) => `sinyal ${s} hari ini`,
    metaTemplate: (s) =>
      `Update sinyal ${s} terbaru: harga riil terakhir, sinyal VIP, sesi pasar WIB, dan kalender ekonomi hari ini. Cara membaca sinyal dengan disiplin — gratis di Luxtradee.`,
  },
  {
    key: 'jam-pasar',
    titleTemplate: (s) => `Jam Pasar ${s} WIB — Jadwal Sesi Sydney, Tokyo, London, New York`,
    slugTemplate: (s) => `jam-pasar-${slugifySeo(s)}-wib`,
    keyword: (s) => `jam pasar ${s} wib`,
    metaTemplate: (s) =>
      `Jam pasar ${s} dalam WIB: jadwal sesi Sydney, Tokyo, London, dan New York, plus jam paling ramai untuk trading ${s} dan status pasar hari ini.`,
  },
  {
    key: 'strategi-breakout',
    titleTemplate: (s) => `Strategi Breakout ${s} — Setup Step by Step & Aturan Entry (WIB)`,
    slugTemplate: (s) => `strategi-breakout-${slugifySeo(s)}`,
    keyword: (s) => `strategi breakout ${s}`,
    metaTemplate: (s) =>
      `Strategi breakout ${s} yang terukur: tandai range sesi Asia (WIB), konfirmasi candle penutupan, aturan entry dan stoploss lengkap step by step.`,
  },
  {
    key: 'indikator-pine',
    titleTemplate: (s) => `Indikator Pine Script ${s} — 3 Ide Alert untuk Chart Trading Kamu`,
    slugTemplate: (s) => `indikator-pine-script-${slugifySeo(s)}`,
    keyword: (s) => `indikator pine script ${s}`,
    metaTemplate: (s) =>
      `3 ide indikator Pine Script untuk ${s}: alert EMA 9x21 cross, RSI level ekstrem, dan box range sesi Asia WIB — konsep siap kembangkan di TradingView.`,
  },
  {
    key: 'manajemen-risiko',
    titleTemplate: (s) => `Manajemen Risiko ${s} — Aturan 1–2% & Rumus Ukuran Lot Aman`,
    slugTemplate: (s) => `manajemen-risiko-${slugifySeo(s)}`,
    keyword: (s) => `manajemen risiko trading ${s}`,
    metaTemplate: (s) =>
      `Manajemen risiko ${s}: aturan risiko 1–2% per posisi, rumus ukuran lot, dan tabel dampak rugi beruntun. Lindungi akun dulu, kejar profit belakangan.`,
  },
  {
    key: 'psikologi-trading',
    titleTemplate: (s) => `Psikologi Trading ${s} — 5 Jebakan Emosi yang Paling Sering Bikin MC`,
    slugTemplate: (s) => `psikologi-trading-${slugifySeo(s)}`,
    keyword: (s) => `psikologi trading ${s}`,
    metaTemplate: (s) =>
      `Psikologi trading ${s}: FOMO, revenge trading, geser stoploss, dan cara jurnal trading menata emosi. Pembekalan mental sebelum entry berikutnya.`,
  },
]

/* ── HELPER TEKS (aman HTML & tanpa Intl — deterministik di semua runtime) ── */

export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Format angka gaya Indonesia: 4321.5 → "4.321,50" (manual, tanpa Intl). */
export function formatAngka(n: number): string {
  const fixed = Number(n).toFixed(2)
  const [intPart, decPart] = fixed.split('.')
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return decPart ? `${withSep},${decPart}` : withSep
}

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/** "2026-01-09..." → "9 Januari 2026". Gagal parse → input apa adanya. */
export function formatTanggalIndo(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  if (!m) return String(iso || '')
  const bulan = NAMA_BULAN[Number(m[2]) - 1] || ''
  return `${Number(m[3])} ${bulan} ${m[1]}`.trim()
}

/**
 * ISO timestamp → { tanggal, jam } WIB (UTC+7).
 * - Ada offset (Z / +hh:mm) → digeser +7 jam.
 * - Naive "yyyy-mm-dd hh:mm" → dianggap sudah WIB (tidak digeser).
 * - Tanpa jam → hanya tanggal. Gagal parse → null.
 */
export function wibParts(iso: string): { tanggal: string; jam: string } | null {
  const src = String(iso || '')
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(src)
  if (!m) return null
  const p2 = (n: number | string) => String(n).padStart(2, '0')
  if (m[4] === undefined) {
    return { tanggal: formatTanggalIndo(`${m[1]}-${m[2]}-${m[3]}`), jam: '' }
  }
  const adaOffset = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(src)
  if (adaOffset) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])))
    d.setUTCHours(d.getUTCHours() + 7)
    return {
      tanggal: `${d.getUTCDate()} ${NAMA_BULAN[d.getUTCMonth()] || ''} ${d.getUTCFullYear()}`.trim(),
      jam: `${p2(d.getUTCHours())}.${p2(d.getUTCMinutes())}`,
    }
  }
  return {
    tanggal: formatTanggalIndo(`${m[1]}-${m[2]}-${m[3]}`),
    jam: `${p2(m[4])}.${p2(m[5])}`,
  }
}

/* ── SLUGIFY ─────────────────────────────────────────────────────────── */

/**
 * lowercase, run non-alnum → '-', trim dash di ujung, MAKS 70 char
 * (identik dengan regex backfill slug migrasi 040 supaya konsisten).
 */
export function slugifySeo(text: string): string {
  const dasar = String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (dasar.length <= 70) return dasar
  return dasar.slice(0, 70).replace(/-+$/g, '')
}

/* ── PICK SEO PAGES (deterministik dari daySeed) ─────────────────────── */

/**
 * Pilih halaman SEO hari ini dari matriks symbol × intent.
 * - Deterministik: daySeed sama → hasil sama persis.
 * - Rotasi: index = (daySeed + i) % total kombinasi (urutan flatten stabil:
 *   symbol-major lalu intent).
 * - SKIP slug yang sudah ada di existingSlugs (banding lowercase-trim).
 * - JANGAN pernah menghasilkan duplikat dalam satu panggilan.
 * - count di-clamp ke jumlah kombinasi (30) supaya tak pernah over.
 */
export function pickSeoPages(existingSlugs: string[], count: number, daySeed: number): SeoPagePlan[] {
  const sudahAda = new Set<string>()
  for (const s of Array.isArray(existingSlugs) ? existingSlugs : []) {
    const slug = String(s ?? '').trim().toLowerCase()
    if (slug) sudahAda.add(slug)
  }

  const total = SEO_SYMBOLS.length * SEO_INTENTS.length
  const want = Math.max(0, Math.min(Math.trunc(count) || 0, total))
  const seed = Number.isFinite(daySeed) ? Math.abs(Math.trunc(daySeed)) : 0

  const plans: SeoPagePlan[] = []
  const dipakaiRunIni = new Set<string>()
  for (let i = 0; i < total && plans.length < want; i++) {
    const idx = (seed + i) % total
    const symbol = SEO_SYMBOLS[Math.floor(idx / SEO_INTENTS.length)]
    const intent = SEO_INTENTS[idx % SEO_INTENTS.length]
    const slug = intent.slugTemplate(symbol)
    if (sudahAda.has(slug.toLowerCase()) || dipakaiRunIni.has(slug)) continue
    dipakaiRunIni.add(slug)
    plans.push({
      slug,
      title: intent.titleTemplate(symbol),
      keyword: intent.keyword(symbol),
      metaDescription: intent.metaTemplate(symbol),
      symbol,
      intentKey: intent.key,
    })
  }
  return plans
}

/* ── INTENT CORE (konten inti BERBEDA per intent — anti doorway spam) ── */

export function intentCoreSection(plan: SeoPagePlan, data: SeoPageData): string {
  const s = escapeHtml(plan.symbol)
  const label = escapeHtml(symbolLabel(plan.symbol))
  switch (plan.intentKey) {
    case 'jam-pasar':
      return [
        `<h2>Jam Pasar Dunia dalam WIB</h2>`,
        `<p>${label} diperdagangkan hampir 24 jam dari Senin sampai Jumat waktu Indonesia, tapi karakter tiap sesi berbeda jauh. Jadwal perkiraan sesi forex dalam WIB (bisa bergeser ±1 jam saat pergantian daylight saving/DST):</p>`,
        `<table><thead><tr><th>Sesi</th><th>Buka (WIB)</th><th>Tutup (WIB)</th><th>Karakter</th></tr></thead><tbody>` +
          `<tr><td>Sydney</td><td>04.00</td><td>13.00</td><td>Volume tipis, spread cenderung lebar — cocok untuk observasi</td></tr>` +
          `<tr><td>Tokyo</td><td>07.00</td><td>16.00</td><td>Likuiditas mulai jalan; range Asia terbentuk di sesi ini</td></tr>` +
          `<tr><td>London</td><td>14.00</td><td>23.00</td><td>Volume terbesar — breakout paling sering valid di jam-jam ini</td></tr>` +
          `<tr><td>New York</td><td>19.00</td><td>04.00</td><td>Data ekonomi AS keluar; overlap London–NY paling ramai</td></tr>` +
          `</tbody></table>`,
        `<p>Untuk ${label}, jam paling ramai adalah overlap London–New York (±19.00–23.00 WIB): spread paling ketat dan pergerakan paling bersih. Sebaliknya, menit-menit pergantian sesi (mis. 13.00–14.00 WIB) rawan spike palsu — banyak trader menunggu 15 menit pertama sesi baru selesai dulu.</p>`,
      ].join('\n')

    case 'strategi-breakout':
      return [
        `<h2>Langkah Setup Breakout yang Terukur</h2>`,
        `<p>Breakout artinya harga menembus level penting dengan momentum — bukan sekadar "nembus garis". Untuk ${label}, urutan kerja yang bisa kamu ulang tiap hari:</p>`,
        `<ul>` +
          `<li><strong>1. Tandai range sesi Asia</strong> — high dan low jam ±07.00–14.00 WIB jadi garis breakout kamu.</li>` +
          `<li><strong>2. Tunggu candle MENUTUP di luar range</strong> — sumbu yang menembus lalu balik adalah false breakout, bukan sinyal.</li>` +
          `<li><strong>3. Konfirmasi momentum</strong> — EMA cepat mulai memisah dan volume naik bersamaan dengan penetrasi.</li>` +
          `<li><strong>4. Entry setelah konfirmasi</strong> — stoploss di DALAM range, bukan pas di garis (garis = tempat semua orang pasang SL).</li>` +
          `<li><strong>5. Target minimal 1:2</strong> — kalau jarak SL membuat profil risk-reward tidak sampai 1:2, biarkan setup itu lewat.</li>` +
          `</ul>`,
        `<p>Kesalahan paling mahal pada ${s}: entry pas di garis tanpa konfirmasi, lalu kena spike balik arah. Kalau kamu sering mengalaminya, catat setiap kasus di jurnal — polanya akan kelihatan jelas dalam hitungan minggu, dan di situlah perbaikan mulai.</p>`,
      ].join('\n')

    case 'indikator-pine':
      return [
        `<h2>3 Ide Indikator Pine Script untuk ${s}</h2>`,
        `<p>Semua harga di Luxtradee bisa kamu replikasi di TradingView dengan Pine Script. Tiga ide alert yang paling relevan untuk ${label}:</p>`,
        `<ul>` +
          `<li><strong>Alert EMA 9×21 cross</strong> — kondisi ta.crossover(ta.ema(close, 9), ta.ema(close, 21)) dan sebaliknya, dibungkus alertcondition() supaya TradingView memberi notifikasi tiap cross di chart ${s}.</li>` +
          `<li><strong>RSI level ekstrem</strong> — RSI 14 dengan garis 70/30; alert menyala saat RSI keluar dari zona. Bagus sebagai filter "jangan entry di harga jenuh".</li>` +
          `<li><strong>Box range sesi Asia otomatis</strong> — gambar box high–low jam 07.00–14.00 WIB (zona Asia/Jakarta) dengan box.new, lalu alert saat harga menutup di luar box — persis setup breakout di atas.</li>` +
          `</ul>`,
        `<p>Catatan jujur: ketiganya adalah konsep, bukan script jadi yang tinggal tempel — parameter per simbol beda kebutuhannya. Uji dulu di strategy tester / paper trading sebelum dipakai dengan uang nyata.</p>`,
      ].join('\n')

    case 'manajemen-risiko':
      return [
        `<h2>Aturan Risiko 1–2% per Posisi</h2>`,
        `<p>Aturan yang paling sering menyelamatkan akun ${label}: risiko MAKSIMAL 1–2% dari ekuitas dalam SATU trade. Bukan 1–2% dari margin, bukan "rasa-rasa" — dihitung dari ekuitas akun saat ini.</p>`,
        `<p>Contoh ilustrasi (bukan rekomendasi): ekuitas Rp10.000.000 dengan risiko 1% berarti maksimal rugi Rp100.000 per trade. Kalau jarak stoploss ${s} kamu setara Rp50.000 per lot, ukuran posisi yang aman adalah 2 lot. Rumusnya berlaku untuk semua simbol: <em>lot = (ekuitas × persen risiko) ÷ jarak SL dalam rupiah</em>.</p>`,
        `<table><thead><tr><th>Risiko per trade</th><th>5 kali rugi beruntun</th><th>10 kali rugi beruntun</th></tr></thead><tbody>` +
          `<tr><td>1%</td><td>≈ −4,9%</td><td>≈ −9,6%</td></tr>` +
          `<tr><td>2%</td><td>≈ −9,6%</td><td>≈ −18,3%</td></tr>` +
          `<tr><td>5%</td><td>≈ −22,6%</td><td>≈ −40,1%</td></tr>` +
          `</tbody></table>`,
        `<p>Tabel di atas adalah matematika bunga majemuk — bukan motivasi. Selisih antara risiko 1% dan 5% terlihat kecil di satu trade, tapi setelah sepuluh rugi beruntun (yang WAJIB kamu asumsikan akan datang), akun risiko 5% sudah setengah hilang. Stoploss yang dipasang sekali saat entry dan tidak digeser adalah bagian dari aturan ini, bukan opsional.</p>`,
      ].join('\n')

    case 'psikologi-trading':
      return [
        `<h2>5 Jebakan Emosi Saat Trading ${label}</h2>`,
        `<ul>` +
          `<li><strong>FOMO</strong> — masuk karena harga "sudah jalan" dan takut ketinggalan. Penawar: tunggu retest; setup yang lewat bukan kerugian, akun yang burnout iya.</li>` +
          `<li><strong>Revenge trading</strong> — balas dendam ke pasar setelah kena stoploss. Penawar: berhenti 30 menit setelah dua rugi beruntun, keputusan di ambil setelah kepala dingin.</li>` +
          `<li><strong>Overtrading saat profit</strong> — merasa kebal lalu menaikkan lot tanpa hitung. Penawar: lot boleh naik hanya kalau EKUITAS naik, bukan emosi.</li>` +
          `<li><strong>Geser stoploss</strong> — memindahkan SL menjauh "biar tidak kena dulu". Penawar: SL dipasang sekali saat entry, titik; geser SL = membuka pintu margin call.</li>` +
          `<li><strong>Tidak mencatat</strong> — tanpa jurnal, pola emosimu tidak pernah terlihat. Penawar: satu kolom "emosi saat entry" di jurnal sudah cukup untuk mulai sadar.</li>` +
          `</ul>`,
        `<p>Jurnal trading adalah alat psikologi paling murah yang ada: setelah sekitar 20 catatan, kamu akan melihat sendiri jam dan kondisi ketika keputusan terburukmu lahir — biasanya bukan masalah analisis, tapi masalah emosi.</p>`,
      ].join('\n')

    case 'sinyal-hari-ini':
    default:
      return [
        `<h2>Cara Membaca Sinyal dengan Disiplin</h2>`,
        `<p>Sinyal bukan tombol profit otomatis — cara kamu membacanya yang menentukan hasil. Checklist lengkap sebelum mengeksekusi sinyal ${label}:</p>`,
        `<ul>` +
          `<li><strong>Cek arah dan pair</strong> — pastikan sinyal yang masuk memang untuk ${s}, bukan pair lain yang sekadar mirip.</li>` +
          `<li><strong>Entry sesuai harga sinyal</strong> — kalau harga sudah lari jauh dari level saat kamu lihat, jangan kejar; tunggu setup baru.</li>` +
          `<li><strong>Stoploss tidak boleh dihapus</strong> — SL pada sinyal sudah dihitung terhadap volatilitas ${label}, bukan angka asal.</li>` +
          `<li><strong>Sesuaikan lot dengan risiko 1–2% dari ekuitas</strong> — jangan pernah lebih dari itu dalam satu posisi.</li>` +
          `<li><strong>Cek kalender ekonomi</strong> — 15 menit sebelum rilis data besar (NFP, CPI, FOMC), spread bisa melebar ekstrem dan menyapu stoploss.</li>` +
          `<li><strong>Catat hasilnya di jurnal</strong> — sinyal yang tidak dijurnal tidak akan pernah membuat kamu lebih baik.</li>` +
          `</ul>`,
        `<p>Terakhir: satu sinyal tidak menentukan bulanmu — ekspetasi yang sehat adalah konsistensi proses, bukan menang di setiap posisi.</p>`,
      ].join('\n')
  }
}

/* ── BUILD HTML HALAMAN ──────────────────────────────────────────────── */

/**
 * Susun isi artikel HTML MURNI (h2/p/ul/table — TANPA tag html) untuk satu
 * plan. Semua angka berasal dari `data` (riil); yang null → ditulis JUJUR
 * tanpa mengarang. Struktur:
 *   1. Pembuka: symbol + tanggal hari ini + angka riil yang ADA.
 *   2. Level & Sinyal Terakhir (jujur: null → "belum ada sinyal baru").
 *   3. Konten inti sesuai intent (beda mutu, bukan spintax).
 *   4. Kalender ekonomi (hanya bila ada event — kosong → section di-skip).
 *   5. CTA + social proof angka riil (hanya bila > 0).
 */
export function buildSeoPageHtml(plan: SeoPagePlan, data: SeoPageData): string {
  const s = escapeHtml(plan.symbol)
  const label = escapeHtml(symbolLabel(plan.symbol))
  const tanggal = escapeHtml(formatTanggalIndo(data.todayIso))
  const bagian: string[] = []

  /* 1) Pembuka */
  const harga = typeof data.lastPrice === 'number' && Number.isFinite(data.lastPrice) && data.lastPrice > 0
    ? data.lastPrice
    : null
  const chg = typeof data.priceChangePct === 'number' && Number.isFinite(data.priceChangePct)
    ? data.priceChangePct
    : null
  const frasaPerubahan = chg === null
    ? ''
    : chg <= -0.005
      ? ` (melemah ${escapeHtml(formatAngka(Math.abs(chg)))}% dalam ±20 jam terakhir — candle 15 menit)`
      : chg >= 0.005
        ? ` (menguat ${escapeHtml(formatAngka(chg))}% dalam ±20 jam terakhir — candle 15 menit)`
        : ' (praktis tidak bergerak dalam ±20 jam terakhir)'
  const statusPasar = data.marketOpen
    ? `Perkiraan sesi aktif saat ini: <strong>${escapeHtml(data.sessionWib)}</strong> — pasar dalam jam buka (Senin–Jumat WIB).`
    : `Pasar sedang <strong>tutup</strong> (akhir pekan) — manfaatkan jadwal sesi di bawah untuk menyiapkan rencana sebelum pasar buka kembali.`

  if (harga !== null) {
    bagian.push(
      `<p><strong>${label}</strong> — ${tanggal} (WIB). Harga ${s} terakhir dicatat di <strong>${escapeHtml(formatAngka(harga))}</strong>${frasaPerubahan}. ${statusPasar}</p>`,
    )
  } else {
    bagian.push(
      `<p><strong>${label}</strong> — ${tanggal} (WIB). Data harga live ${s} sedang tidak tersedia saat halaman ini diperbarui, jadi kami tidak menuliskan angka karangan — bagian lain di bawah tetap berdasar data sistem Luxtradee. ${statusPasar}</p>`,
    )
  }

  /* 2) Posisi produk — jurnal, bukan jualan sinyal (keputusan Bos 9 Nov).
     Sinyal/alert di Luxtradee = dari Pine Script milik user sendiri. */
  bagian.push(`<h2>Jurnal Pintar, Bukan Jualan Sinyal</h2>`)
  bagian.push(
    `<p>Luxtradee adalah <strong>jurnal trading</strong>: catat trade (bisa impor CSV/statement MT4–MT5 atau upload screenshot), dan AI membaca pola loss-mu otomatis. Tidak ada sinyal buatan tim yang dibagikan — satu-satunya alert di Luxtradee adalah dari <strong>Pine Script milik kamu sendiri</strong>: tulis indikator/strategimu, aktifkan alert otomatis, dan push Entry/SL/TP masuk HP saat kondisimu terpicu.</p>`,
  )

  /* 3) Konten inti sesuai intent (tiap intent beda — bukan spintax) */
  bagian.push(intentCoreSection(plan, data))

  /* 4) Kalender ekonomi — kosong → section di-skip sepenuhnya */
  const events = Array.isArray(data.economicEvents) ? data.economicEvents : []
  if (events.length > 0) {
    const rows = events
      .slice(0, 5)
      .map((ev) => {
        const w = wibParts(ev.time)
        const jam = w && w.jam ? escapeHtml(w.jam) : escapeHtml(ev.time)
        return `<tr><td>${jam}</td><td>${escapeHtml(ev.country)}</td><td>${escapeHtml(ev.title)}</td><td>${escapeHtml(ev.impact || '-')}</td></tr>`
      })
      .join('')
    bagian.push(`<h2>Kalender Ekonomi Hari Ini (WIB)</h2>`)
    bagian.push(
      `<table><thead><tr><th>Jam (WIB)</th><th>Negara</th><th>Rilis</th><th>Dampak</th></tr></thead><tbody>${rows}</tbody></table>`,
    )
    bagian.push(
      `<p>Rilis berdampak tinggi bisa membalik arah ${label} dalam hitungan menit — banyak trader menutup posisi 15 menit sebelum jam rilis.</p>`,
    )
  }

  /* 5) CTA + social proof angka riil */
  bagian.push(`<h2>Coba Gratis di Luxtradee</h2>`)
  bagian.push(`<p>Coba gratis di Luxtradee — catat trade-mu, AI baca pola loss-mu otomatis.</p>`)
  const member = Math.max(0, Math.trunc(Number(data.memberCount) || 0))
  if (member > 0) {
    bagian.push(`<p><strong>${member} trader</strong> sudah bergabung — angka langsung dari sistem, bukan karangan.</p>`)
  }

  return bagian.join('\n')
}

/* ── INTERNAL LINKING ────────────────────────────────────────────────── */

/**
 * Blok HTML "Baca juga:" berisi link internal ke plan LAIN
 * (<a href="/blog/<slug>">title</a>) — penting untuk crawl & authority.
 * Plan kosong → string kosong (bukan blok kosong).
 */
export function seoInternalLinks(plans: SeoPagePlan[]): string {
  const list = (Array.isArray(plans) ? plans : [])
    .filter((p) => p && p.slug && p.title)
    .slice(0, 5)
  if (!list.length) return ''
  const items = list
    .map((p) => `<li><a href="/blog/${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a></li>`)
    .join('')
  return `<p><strong>Baca juga:</strong></p>\n<ul>${items}</ul>`
}

/* ── AKHIR OTAK SEO ──────────────────────────────────────────────────── */
