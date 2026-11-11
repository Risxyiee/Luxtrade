/**
 * 🧠 SINTA BRAIN v4 — MESIN KREATIVITAS KONTEN (permintaan Bos, Nov 2026)
 * ─────────────────────────────────────────────────────────────────────────
 * Keluhan Bos: "kontennya itu-itu mulu … harus tiap hari ganti konten,
 * dicoba mana yang rame mana yang nggak, harus mikir kreatif juga."
 *
 * Penyebab lama:
 *   1. Kalau LLM gagal → jatuh ke DUA spec hardcoded (DEFAULT_TIP/PROMO)
 *      yang diputar bergantian → feed kelihatan fotokopi terus.
 *   2. LLM cuma diminta "jangan ulangi 6 caption terakhir" — tanpa angle,
 *      tanpa topik wajib, tanpa data performa → model malas balik ke pola sama.
 *
 * Solusi di lib ini:
 *   A. 11 ANGLE konten (pain-point, edukasi, mitos-vs-fakta, kesalahan,
 *      storytelling, stat-fakta, checklist, tanya-audiens, motivasi,
 *      promo-fitur, promo-cta) — masing-masing punya panduan menulis +
 *      pola hook, jadi Sinta "mikir kreatif" dengan kerangka, bukan improvisasi.
 *   B. 24 TOPIK inti dalam pool — tiap hari sistem memilih 1 topik yang
 *      TIDAK dipakai 10 run terakhir (deterministik per hari + 25% lompatan
 *      eksperimen) → topik diinjeksi WAJIB ke prompt LLM.
 *   C. 7 FALLBACK SCRIPT lengkap (bukan 2 lagi) — kalau semua provider LLM
 *      mati, konten tetap berganti-ganti ±mingguan tanpa kembar berdekatan.
 *   D. PEMBELAJAR PERFORMA: ringkasan rata-rata views/likes/saves per
 *      template dari meta.metrics instagram_posts (diisi /api/cron/ig-metrics)
 *      → template pemenang dipakai 70%, 30% tetap eksperimen (A/B "mana
 *      yang rame mana yang nggak" versi otomatis).
 *
 * Semua seleksi DETERMINISTIK per hari (hash tanggal) supaya:
 *   - tidak dobel walau cron kena trigger ulang di hari yang sama,
 *   - mudah diaudit ("kenapa hari ini pilih topik X" → bisa dijelaskan).
 */

/* ============================================================
   Tipe
   ============================================================ */

export type AngleId =
  | 'pain-point'
  | 'edukasi'
  | 'myth-buster'
  | 'kesalahan'
  | 'storytelling'
  | 'stat-fakta'
  | 'checklist'
  | 'tanya-audiens'
  | 'motivasi'
  | 'promo-fitur'
  | 'promo-cta'

export interface Angle {
  id: AngleId
  /** Label manusiawi untuk prompt + log ACC Bos. */
  label: string
  /** Panduan menulis — bikin LLM "mikir kreatif" dalam kerangka. */
  guidance: string
  /** Pola hook — LLM WAJIB memilih/memvariasikan salah satu. */
  hookPatterns: string[]
}

export interface TopicEntry {
  /** Kalimat topik inti — diinjeksi ke prompt sebagai topik WAJIB hari ini. */
  topic: string
  angle: AngleId
}

export type Template = 'promo' | 'tip' | 'signal'

/** Spec video versi ringkas (tanpa carousel — diisi route). */
export interface VideoSpecLite {
  template: Template
  topic: string
  caption: string
  hashtags: string[]
  igCaption: string
  scenes: { kind?: string; title: string; sub: string; vo: string }[]
  signal?: unknown | null
}

export interface TemplatePerf {
  posts: number
  avgViews: number
  avgLikes: number
  avgSaves: number
}

export interface PerfSnapshot {
  byTemplate: Record<string, TemplatePerf>
  /** Template dengan rata-rata views tertinggi (min. 2 sampel per sisi). */
  winner: 'tip' | 'promo' | null
  samplePosts: number
  /** Performa per ANGLE konten (id angle → rata-rata) — dipakai
   *  pickAngleAndTopic supaya "kalau ga rame GANTI KONTENNYA" jadi
   *  otomatis: angle sepi di-cooldown, angle rame diprioritaskan. */
  byAngle: Record<string, TemplatePerf>
  /** Angle id dengan rata-rata views tertinggi (min. 2 sampel). */
  winnerAngle: string | null
  /** Angle id yang membukti sepi (min. 2 sampel & views < 40% median
   *  semua angle) → dihindari run berikutnya. */
  flopAngles: string[]
}

/* ============================================================
   A) ANGLE — kerangka kreativitas
   ============================================================ */

export const SINTA_ANGLES: Record<AngleId, Angle> = {
  'pain-point': {
    id: 'pain-point',
    label: 'Nyindir kebiasaan buruk trader',
    guidance:
      'Buka dengan kondisi yang bikin penonton ngaku "ITU GUE BANGET". Jangan menggurui — kedip mata ke masalahnya dulu (2 scene pertama cuma masalah), baru kasih jalan keluar singkat di scene 3, tutup CTA jurnal.',
    hookPatterns: [
      'Kamu nggak loss karena salah analisa — tapi karena ...',
      'Ini alasan akun kamu ngecil pelan-pelan tiap minggu',
      'Berhenti ngelakuin ini sebelum entry lagi',
      'Yang bikin MC bukan strateginya — kebiasaan ini',
      /* FORMAT TERBUKTI BOS (11 Nov): Pola Loss — data jurnal + pertanyaan */
      'Kenapa loss kamu selalu hari Jumat?',
      'Loss kamu ada polanya — cek jurnal kamu',
    ],
  },
  edukasi: {
    id: 'edukasi',
    label: 'Bedah 1 konsep SMC/ICT super sederhana',
    guidance:
      'SATU konsep saja. Jelaskan seolah ke anak SMA: definisi 1 kalimat → contoh nyata di gold/XAUUSD → kesalahan pemula saat pakai konsep itu → CTA jurnal supaya konsepnya keuji.',
    hookPatterns: [
      '{KONSEP} dijelaskan dalam 30 detik',
      'Kenapa harga balik ke sini dulu sebelum jalan?',
      'Inilah konsep yang paling sering disalahpahami pemula',
      'Kalau kamu paham ini, setengah TradingView nggak kamu butuhin',
      /* FORMAT TERBUKTI BOS (11 Nov): Bedah 1 Trade — 1 alasan entry,
         sengaja TIDAK dijelaskan semua biar orang nanya di komen */
      'Buy XAUUSD di sini, SL di sini — kenapa?',
    ],
  },
  'myth-buster': {
    id: 'myth-buster',
    label: 'MITOS vs FAKTA trading',
    guidance:
      'Pilih SATU mitos yang masih dipercaya banyak pemula. Scene 1-2: mitos + kenapa terdengar masuk akal. Scene 3: fakta + bukti sederhana. Hindari nada merendahkan — kamu benerin, bukan ngebata.',
    hookPatterns: [
      'MITOS: ... — FAKTANYA jauh beda',
      'Ini yang guru-guru trading nggak mau bilang',
      'Kalau kamu masih percaya ini, pause dulu 30 detik',
    ],
  },
  kesalahan: {
    id: 'kesalahan',
    label: '3 kesalahan spesifik + solusi',
    guidance:
      'Tiga kesalahan KONKRET (bukan "kurang disiplin" doang) urut dari paling umum. Tiap kesalahan 1 scene: gejalanya di chart/di jurnal, lalu satu kalimat solusi. Nomor 2 paling nyolok — taruh paling menohok.',
    hookPatterns: [
      '3 kesalahan yang bikin kamu ... — nomor 2 paling sering',
      'Stop ngelakuin 3 ini mulai besok',
      'Cek jurnal kamu: kesalahan nomor ini pasti ada',
      /* FORMAT TERBUKTI BOS (11 Nov): Kesalahan Prop Firm — drawdown,
         overlot, tanpa guard; tutup 3 dtk fitur Guard Luxtradee */
      '3 alasan trader gagal challenge prop firm',
    ],
  },
  storytelling: {
    id: 'storytelling',
    label: 'Cerita trader yang relatable',
    guidance:
      'Cerita orang kedua/ketiga (bukan promosi). Struktur: kondisi hancur → titik balik (SATU perubahan kebiasaan) → hasil realistis (bukan impian). Relatable > inspiratif. Jangan janji profit.',
    hookPatterns: [
      'Dari MC 3 kali jadi konsisten — yang berubah cuma 1 kebiasaan',
      '2 bulan lalu dia mau hapus app trading-nya',
      'Modal kecil, disiplin besar — cerita singkat',
      /* FORMAT TERBUKTI BOS (11 Nov): POV Trader — teks besar detik 0,
         cerita EMOSI (bukan fitur) → save & share */
      'POV: udah profit $210, lalu ...',
    ],
  },
  'stat-fakta': {
    id: 'stat-fakta',
    label: 'Angka/ fakta yang mengejutkan',
    guidance:
      'Buka dengan SATU angka keras (data industri umum, boleh umum tanpa sumber spesifik). Scene 2-3: kenapa angkanya sebanyak itu + 3 pembunuh utama. Jangan mengarang angka produk internal — pakai pola umum industri.',
    hookPatterns: [
      '90% trader berhenti di tahun pertama. Penyebab utamanya:',
      'Angka ini bikin kaget —',
      'Data jurnal ribuan trader nunjukin 1 pola sama:',
    ],
  },
  checklist: {
    id: 'checklist',
    label: 'Checklist praktis (saveable)',
    guidance:
      'Bikin penonton PERLU SAVE. 4-5 item checklist yang bisa dicentang sebelum/khayal setelah trading. Tiap item super spesifik (bukan "cek trend"). CTA: "save ini, pakai sebelum entry besok".',
    hookPatterns: [
      'Save ini — checklist sebelum entry',
      '5 kotak yang wajib centang sebelum klik buy/sell',
      'Audit jurnal 10 menit tiap weekend — begini caranya',
    ],
  },
  'tanya-audiens': {
    id: 'tanya-audiens',
    label: 'Pertanyaan buat komentar (engagement)',
    guidance:
      'Hook = pertanyaan nyata yang punya 2 kubus jawaban. Tengah: argumen tiap kubus (adil dua-duanya). Akhir: "komentar jawabanmu — konten berikutnya ngikutin yang paling banyak". Ini konten komentarmu sendiri. PERTANYAAN SPESIFIK MENANG (data Bos): "kamu sering loss jam berapa?" lebih hidup komennya daripada pertanyaan umum — spesifik = gampang dijawab = komen bertambah.',
    hookPatterns: [
      'Kamu tim scalping atau swing? Jawab jujur',
      'News bikin kamu profit atau malah loss?',
      'Mana satu ini: sinyal cepat, atau jurnal rapi?',
    ],
  },
  motivasi: {
    id: 'motivasi',
    label: 'Disiplin & proses (anti-hustle palsu)',
    guidance:
      'Motivasi versi trader: kasar tapi sayang. Nol "mimpi jadi kaya". Fokus: proses boring yang menang, bukti kecil dari jurnal, satu kalimat yang nempel di kepala.',
    hookPatterns: [
      'Disiplin ngalahin pintar — ini buktinya',
      'Nggak ada yang bilang gampang. Tapi ada yang simpel:',
      'Konsistensi itu boring. Justru itu gunanya',
    ],
  },
  'promo-fitur': {
    id: 'promo-fitur',
    label: 'Soft-sell 1 fitur Luxtradee',
    guidance:
      'Buka dari pain point nyata dulu (2 scene). Fitur muncul sebagai SOLUSI di scene 3 — cuma SATU fitur, tunjukkan cara kerjanya singkat. Harga JANGAN disebut di video ini (itu tugas promo-cta).',
    hookPatterns: [
      'Screenshot doang, jurnal kecatat sendiri. Begini:',
      'Alert masuk pas kamu tidur — ini cara kerjanya',
      'Fitur ini yang paling sering disalahpahami:',
      /* FORMAT TERBUKTI BOS (11 Nov): Before vs After — kontras waktu
         manual vs otomatis, demo layar tercepat */
      'Jurnal manual 15 menit — cara ini 4 detik',
    ],
  },
  'promo-cta': {
    id: 'promo-cta',
    label: 'Penawaran langsung (hard-sell sopan)',
    guidance:
      'Langsung ke value: 8 agen AI + jurnal otomatis + guard prop firm, harga PRO Rp49.000/bulan. Buktikan dengan manfaat, bukan janji cuan. Tutup: "link di bio, 2 menit setup".',
    hookPatterns: [
      'Rp49.000/bulan buat 8 agen AI pantau pasar 24 jam',
      'Kamu pantau chart — Luxtrade pantau peluangnya',
      'Hitung sendiri: 1 entry bagus cukup balik modal PRO',
    ],
  },
}

/* ============================================================
   B) TOPIK POOL — 24 topik inti (anti "itu-itu mulu")
   ============================================================ */

export const TOPIC_POOL: TopicEntry[] = [
  // pain-point
  { topic: 'SL kejebak terus — kamu entry SEBELUM sweep selesai (equal highs itu umpan)', angle: 'pain-point' },
  { topic: 'Revenge trading: balas dendam ke pasar pakai posisi makin besar', angle: 'pain-point' },
  { topic: 'Position sizing asal — 1 trade bisa makan 30% akun (harusnya 1-2%)', angle: 'pain-point' },
  { topic: 'Pindah-pindah strategi tiap minggu — akun jadi lab rat, bukan bisnis', angle: 'pain-point' },
  // edukasi
  { topic: 'Apa itu Order Block & kenapa harga sering balik ke sana sebelum jalan', angle: 'edukasi' },
  { topic: 'Fair Value Gap (FVG): celah harga yang suka diisi ulang — cara baca + entry-nya', angle: 'edukasi' },
  { topic: 'Liquidity sweep vs breakout asli — bedanya tipis tapi fatal buat SL kamu', angle: 'edukasi' },
  { topic: 'Premium vs discount: beli di zona murah, bukan di puncak FOMO', angle: 'edukasi' },
  // myth-buster
  { topic: 'MITOS: makin banyak indikator makin akurat — FAKTA: chart makin blur', angle: 'myth-buster' },
  { topic: 'MITOS: trader sukses nggak pernah loss — FAKTA: loss mereka kecil & terjadwal', angle: 'myth-buster' },
  { topic: 'MITOS: harus pantau chart 8 jam sehari — FAKTA: setup bagus cuma butuh 15 menit', angle: 'myth-buster' },
  // kesalahan
  { topic: '3 kesalahan setup SL: terlalu rapat, di angka bulat, di belakang liquidity', angle: 'kesalahan' },
  { topic: '3 kesalahan jurnal yang bikin winrate kamu bohong (cherry-picking setup), (tak catat emosi), (RR fiktif)', angle: 'kesalahan' },
  { topic: '3 kesalahan news time: entry 5 menit sebelum rilis, tanpa SL, all-in arah tebakan', angle: 'kesalahan' },
  // storytelling
  { topic: 'Cerita: dari MC 3 kali ke konsisten 2 bulan — yang berubah cuma 1 kebiasaan (jurnal)', angle: 'storytelling' },
  { topic: 'Cerita: trader yang hampir hapus app-nya, diselamatkan 1 baris data di jurnal', angle: 'storytelling' },
  // stat-fakta
  { topic: '90% trader berhenti di tahun pertama — 3 pembunuh utamanya (overtrade, no plan, no journal)', angle: 'stat-fakta' },
  { topic: 'Mayoritas breach prop firm itu karena 1 hal: drawdown harian — bukan strategi jelek', angle: 'stat-fakta' },
  // checklist
  { topic: 'Checklist sebelum entry: 5 kotak wajib centang (HTF bias, POI, liquidity, RR, risk %)', angle: 'checklist' },
  { topic: 'Checklist akhir pekan: audit jurnal 10 menit — 3 pertanyaan wajib', angle: 'checklist' },
  // tanya-audiens
  { topic: 'Kamu tim scalping atau tim swing? Argumen dua kubus + ajakan komentar', angle: 'tanya-audiens' },
  { topic: 'Jujur: news bikin kamu profit atau loss? Debat dua sisi + komentar', angle: 'tanya-audiens' },
  // promo-fitur
  { topic: 'Screenshot → jurnal kecatat otomatis: begini cara kerjanya (soft-sell)', angle: 'promo-fitur' },
  { topic: 'Guard prop firm: alert masuk SEBELUM drawdown breach, bukan sesudah (soft-sell)', angle: 'promo-fitur' },
  { topic: 'Sinyal Entry/SL/TP otomatis ke layar HP — kamu tidur, agen tetap jaga (soft-sell) — JANGAN janji "realtime" (amanat Bos)', angle: 'promo-fitur' },
  // promo-cta
  { topic: 'PRO Rp49.000/bulan: 8 agen AI + jurnal otomatis — hitung balik modalnya (hard-sell)', angle: 'promo-cta' },
]

/* ============================================================
   C) FALLBACK LIBRARY — 7 script lengkap (LLM mati semua pun feed ganti-ganti)
   Topik di sini SENGAJA sama dengan TOPIC_POOL → anti-repeat tetap nyambung.
   ============================================================ */

const FALLBACK_LIBRARY: VideoSpecLite[] = [
  {
    template: 'tip',
    topic: 'SL kejebak terus — kamu entry SEBELUM sweep selesai (equal highs itu umpan)',
    caption: 'Sweep dulu, baru gerak. Ini yang bikin SL kamu kejebak terus 📉 Cek link di bio',
    hashtags: ['smc', 'smartmoneyconcepts', 'xauusd', 'tradingindonesia', 'luxtrade'],
    igCaption:
      'SL kejebak terus padahal analisa "udah bener"? 😤\n\nBiasanya kamu entry SEBELUM sweep selesai. Equal highs itu umpan — smart money narik liquidity dulu, baru price turun.\n\n3 hal yang dibahas di video ini:\n1️⃣ Cara mark equal highs & equal lows\n2️⃣ Tanda sweep-nya SELESAI (reaksi + displacement)\n3️⃣ Kapan BOLEH entry setelah sweep\n\nSave video ini biar nggak lupa. Dan catat setiap setup kamu di Luxtradee — cukup screenshot, jurnal & winrate kehitung otomatis. Link di bio 🔗\n\n#smc #smartmoneyconcepts #xauusd #goldtrader #tradingindonesia #belajartrading #ictconcepts #tradingjournal #priceaction #luxtrade',
    scenes: [
      { kind: 'hook', title: 'SL KEBJAK TERUS?', sub: 'bukan salah analisa — kamu entry kepagian', vo: 'Stop loss kejebak terus padahal analisa udah bener? Ini penyebabnya.' },
      { kind: 'chart', title: 'EQUAL HIGHS = UMPAN', sub: 'liquidity numpuk di atas — smart money narik dulu', vo: 'Garis equal highs itu umpan. Liquidity numpuk di atasnya.' },
      { kind: 'point', title: 'TUNGGU SWEEP SELESAI', sub: 'reaksi + displacement dulu, baru entry', vo: 'Jangan entry sebelum sweep selesai. Tunggu reaksi dan displacement.' },
      { kind: 'cta', title: 'CATAT TIAP SETUP', sub: 'screenshot → luxtradee auto jurnal — link di bio', vo: 'Catat tiap setup di Luxtradee, cukup screenshot. Cek link di bio.' },
    ],
  },
  {
    template: 'tip',
    topic: 'Fair Value Gap (FVG): celah harga yang suka diisi ulang — cara baca + entry-nya',
    caption: 'Harga suka "balik" ke celahnya dulu. FVG dijelaskan 30 detik 📊 Cek link di bio',
    hashtags: ['fvg', 'smc', 'xauusd', 'belajartrading', 'luxtrade'],
    igCaption:
      'Pernah entry terus harga "balik dulu" ke posisi kamu, nyenggol SL, baru jalan sesuai analisa? 😅\n\nItu bukan sial — itu Fair Value Gap (FVG) lagi diisi ulang.\n\nVideo ini bahas:\n1️⃣ FVG itu apa (dalam 1 kalimat)\n2️⃣ Kenapa harga suka balik ke celahnya\n3️⃣ Cara entry yang sabar: tunggu harga MASUK gap, jangan kejar\n\nMau tiap setup kecatat otomatis? Screenshot aja di Luxtradee — jurnal, RR, dan winrate kehitung sendiri. Link di bio 🔗\n\n#fvg #fairvaluegap #smc #xauusd #goldtrader #belajartrading #ictconcepts #tradingindonesia #priceaction #luxtrade',
    scenes: [
      { kind: 'hook', title: 'HARGA SUKA BALIK DULU?', sub: 'itu FVG lagi diisi ulang — bukan sial', vo: 'Pernah SL kesenggol dulu, baru harga jalan sesuai analisa? Ini FVG.' },
      { kind: 'chart', title: 'FAIR VALUE GAP', sub: 'celah harga dari candle 3 yang lagi', vo: 'Fair Value Gap itu celah harga dari tiga candle berurutan.' },
      { kind: 'point', title: 'TUNGGU HARGA MASUK', sub: 'entry di dalam gap, jangan kejar candle', vo: 'Jangan kejar. Tunggu harga masuk ke gap-nya dulu, baru entry.' },
      { kind: 'cta', title: 'UJI DI JURNAL KAMU', sub: 'screenshot → auto tercatat — link di bio', vo: 'Uji konsep ini di jurnal kamu. Screenshot aja, Luxtradee catatin. Link di bio.' },
    ],
  },
  {
    template: 'tip',
    topic: '3 kesalahan jurnal yang bikin winrate kamu bohong (cherry-picking setup), (tak catat emosi), (RR fiktif)',
    caption: 'Winrate di jurnal bagus, akun tetap ngecil? Cek 3 ini 📓 Cek link di bio',
    hashtags: ['tradingjournal', 'winrate', 'xauusd', 'tradingindonesia', 'luxtrade'],
    igCaption:
      'Winrate di jurnal 70% tapi akun tetap ngecil? 🤔\n\nBerarti jurnalmu yang bohong. 3 kesalahan paling umum:\n\n1️⃣ CHERRY-PICKING — cuma catat trade yang bagus. Yang hancur? "ah, lupa screenshot".\n2️⃣ TAK CATAT EMOSI — FOMO, revenge, ragu. Tanpa kolom emosi, pola buruk nggak kelihatan.\n3️⃣ RR FIKTIF — RR 1:3 di catatan, tapi SL keseret karena "yakin banget".\n\nJurnal yang jujur itu cermin, bukan dekorasi. Luxtradee mencatat SEMUA trade dari screenshot — termasuk yang jelek. Baru winrate kamu beneran ngomong. Link di bio 🔗\n\n#tradingjournal #winrate #xauusd #tradingindonesia #tradingpsychology #belajartrading #goldtrader #smc #propfirm #luxtrade',
    scenes: [
      { kind: 'hook', title: 'WINRATE 70% TETAP RUGI?', sub: 'jurnalmu yang bohong — cek 3 ini', vo: 'Winrate tujuh puluh persen tapi akun tetap ngecil? Jurnalmu yang bohong.' },
      { kind: 'point', title: '1. CHERRY-PICKING', sub: 'cuma catat yang bagus, yang hancur "lupa"', vo: 'Pertama, cherry picking. Yang bagus dicatat, yang hancur dikatakan lupa.' },
      { kind: 'point', title: '2. TAK CATAT EMOSI', sub: 'FOMO & revenge nggak kelihatan di angka', vo: 'Kedua, emosi nggak dicatat. FOMO dan revenge jadi nggak kelihatan.' },
      { kind: 'cta', title: 'JURNAL JUJUR', sub: 'semua trade kecatat dari screenshot — link di bio', vo: 'Catat semua trade, bukan cuma yang bagus. Luxtradee bantu dari screenshot. Link di bio.' },
    ],
  },
  {
    template: 'tip',
    topic: 'Revenge trading: balas dendam ke pasar pakai posisi makin besar',
    caption: 'Kalah → gas doubling biar balik modal? Itu bukan strategi 🚫 Cek link di bio',
    hashtags: ['revengetrading', 'tradingpsychology', 'xauusd', 'tradingindonesia', 'luxtrade'],
    igCaption:
      'Baru SL, langsung buka posisi lagi DOBEL biar "balik modal"? 🎰\n\nItu namanya revenge trading — dan itu bukan strategi, itu emosi pakai jasa leverage.\n\nYang terjadi biasanya:\n• Loss 1% → balas dendam → loss 3% → balas dendam lagi → MC.\n• Pasar nggak kenal kamu. Dia nggak "berutang" apa-apa.\n\nAntidotnya simpel tapi keras:\n1️⃣ Aturan pribadi: MAX 2 trade/hari. Habis 2, tutup laptop.\n2️⃣ Cooldown 30 menit setelah SL — nggak ada negosiasi.\n3️⃣ Semua trade kecatat (termasuk yang emosian) — pola revenge kelihatan jelas di jurnal.\n\nLuxtradee bikin langkah 3 otomatis dari screenshot. Link di bio 🔗\n\n#tradingpsychology #revengetrading #xauusd #tradingindonesia #belajartrading #discipline #goldtrader #tradingjournal #propfirm #luxtrade',
    scenes: [
      { kind: 'hook', title: 'BALAS DENDAM KE PASAR?', sub: 'loss → doubling → MC. Kenal pola ini?', vo: 'Baru loss langsung buka posisi dobel biar balik modal? Itu revenge trading.' },
      { kind: 'quote', title: 'PASAR NGGAK BERUTANG', sub: 'dia nggak kenal kamu — stop nuntut balik', vo: 'Pasar nggak berutang apa-apa ke kamu. Berhenti nuntut balik.' },
      { kind: 'point', title: 'ATURAN ANTI-DENDAM', sub: 'max 2 trade/hari + cooldown 30 menit', vo: 'Maksimal dua trade sehari, dan cooldown tiga puluh menit setelah SL.' },
      { kind: 'cta', title: 'CATAT YANG EMOSIAN', sub: 'pola revenge kelihatan di jurnal — link di bio', vo: 'Catat juga trade yang emosian. Polanya bakal kelihatan. Link di bio.' },
    ],
  },
  {
    template: 'promo',
    topic: 'PRO Rp49.000/bulan: 8 agen AI + jurnal otomatis — hitung balik modalnya (hard-sell)',
    caption: 'PRO Rp49.000/bulan — 8 agen AI + jurnal otomatis. Cek link di bio 👆',
    hashtags: ['trading', 'xauusd', 'tradingindonesia', 'goldtrader', 'luxtrade'],
    igCaption:
      'Masih nebak-nebak arah harga? 🎯\n\nLuxtrade pantau pasar 24 jam pakai 8 agen AI — sinyal masuk langsung ke HP kamu, dan setiap trade kamu otomatis kejurnal cuma dari screenshot.\n\n✅ Sinyal Entry/SL/TP otomatis (push ke layar HP)\n✅ Jurnal otomatis dari screenshot\n✅ Guard prop firm — alert sebelum drawdown breach\n\nPRO mulai Rp49.000/bulan. Hitung sendiri: satu entry bagus biasanya cukup buat balik modal setahun. Link di bio 🔗\n\n#trading #xauusd #goldtrader #tradingindonesia #tradingjournal #smc #ict #propfirm #tradingapp #luxtrade',
    scenes: [
      { kind: 'hook', title: 'MASIH NEBAK-NEBAK?', sub: 'banyak trader kalah karena tebak-tebakan', vo: 'Harga naik turun, kamu masih nebak-nebak sendiri?' },
      { kind: 'point', title: 'LUXTRADE', sub: 'sinyal AI otomatis ke HP kamu', vo: 'Kenalin, Luxtrade. Sinyal trading otomatis, langsung ke HP kamu.' },
      { kind: 'stat', title: '8 AGEN AI', sub: 'pantau pasar 24 jam nonstop', vo: 'Delapan agen AI pantau pasar dua puluh empat jam, nonstop.' },
      { kind: 'point', title: 'TINGGAL EKSEKUSI', sub: 'alert masuk, kamu tinggal eksekusi', vo: 'Alert masuk, kamu tinggal eksekusi. Tanpa drama.' },
      { kind: 'cta', title: 'LUXTRADE', sub: 'PRO mulai Rp49rb/bulan — link di bio', vo: 'Luxtrade. Trading lebih tenang mulai hari ini. Cek link di bio!' },
    ],
  },
  {
    template: 'promo',
    topic: 'Guard prop firm: alert masuk SEBELUM drawdown breach, bukan sesudah (soft-sell)',
    caption: 'Challenge prop firm hangus gara-gara drawdown? Ada guard-nya 🛡️ Cek link di bio',
    hashtags: ['propfirm', 'fundedtrader', 'xauusd', 'tradingindonesia', 'luxtrade'],
    igCaption:
      'Buat kamu yang lagi kejar akun funded 🏆\n\nPenyebab hangusnya challenge paling sering BUKAN strategi jelek — tapi drawdown harian kelewat dikit doang. 5 pips. Satu lot kelebihan. Selesai.\n\nLuxtrade punya Guard Prop Firm:\n1️⃣ Batas drawdown kamu dipantau realtime\n2️⃣ Alert masuk SEBELUM breach — kamu masih sempat tutup posisi\n3️⃣ Riwayat risk per trade kecatat otomatis dari screenshot\n\nChallenge itu mahal. Guard-nya murah. Link di bio 🔗\n\n#propfirm #fundedtrader #xauusd #goldtrader #tradingindonesia #drawdown #riskmanagement #tradingjournal #smc #luxtrade',
    scenes: [
      { kind: 'hook', title: 'CHALLENGE HANGUS?', sub: 'biasanya cuma kelewat 5 pips doang', vo: 'Challenge prop firm hangus gara-gara lima pips? Sia-sia banget.' },
      { kind: 'stat', title: 'DRAWDOWN HARIAN', sub: 'pembunuh challenge nomor satu', vo: 'Drawdown harian itu pembunuh challenge nomor satu.' },
      { kind: 'point', title: 'GUARD PROP FIRM', sub: 'alert SEBELUM breach — masih sempat mutusin', vo: 'Guard Prop Firm ngasih alert sebelum breach, bukan sesudah.' },
      { kind: 'cta', title: 'JAGA CHALLENGE-MU', sub: 'luxtradee guard — cek link di bio', vo: 'Jaga challenge kamu. Luxtradee, cek link di bio.' },
    ],
  },
  {
    template: 'promo',
    topic: 'Screenshot → jurnal kecatat otomatis: begini cara kerjanya (soft-sell)',
    caption: 'Malem-malem ngisi jurnal manual? Screenshot doang cukup 📸 Cek link di bio',
    hashtags: ['tradingjournal', 'xauusd', 'otomatis', 'tradingindonesia', 'luxtrade'],
    igCaption:
      'Jam 11 malem masih ngisi jurnal manual? 😮‍💨\n\nEntry price, SL, TP, RR, screenshot chart, catat emosi… berulang tiap hari. Dua minggu keluar, jurnal bolong.\n\nCara Luxtradee:\n1️⃣ Upload screenshot trade kamu (MT4/MT5/TradingView)\n2️⃣ AI baca entry, SL, TP, dan hasilnya otomatis\n3️⃣ Statistik winrate, RR, dan pola setup kehitung sendiri\n\nNol ngetik. Jurnal yang nggak nyiksa = jurnal yang konsisten = data yang bisa dipercaya. Link di bio 🔗\n\n#tradingjournal #xauusd #tradingindonesia #goldtrader #belajartrading #tradingtips #smc #ict #propfirm #luxtrade',
    scenes: [
      { kind: 'hook', title: 'JURNAL MANUAL SAMPAI MALAM?', sub: '11 PM masih ngetik entry price?', vo: 'Jam sebelas malem masih ngetik jurnal manual?' },
      { kind: 'point', title: 'CUKUP SCREENSHOT', sub: 'upload — AI baca entry/SL/TP sendiri', vo: 'Cukup upload screenshot. AI baca entry, SL, dan TP sendiri.' },
      { kind: 'stat', title: 'NOL NGETIK', sub: 'winrate & RR kehitung otomatis', vo: 'Nol ngetik. Winrate dan R&R kehitung otomatis.' },
      { kind: 'cta', title: 'MULAI MALEM INI', sub: 'luxtradee — cek link di bio', vo: 'Mulai malem ini. Luxtradee, cek link di bio.' },
    ],
  },
]

/* ============================================================
   D) Seleksi — deterministik per hari, anti-kembar, A/B performa
   ============================================================ */

function daySeed(): number {
  return Math.floor(Date.now() / 86_400_000)
}

function hash32(n: number): number {
  let x = (n ^ 0x9e3779b9) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0
  return (x ^ (x >>> 16)) >>> 0
}

function normText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Dua topik dianggap sama kalau 5 kata pertamanya cocok (cukup utk caption vs topik). */
function isTopicRepeated(candidate: string, recentTopics: string[]): boolean {
  const head = normText(candidate).split(' ').slice(0, 5).join(' ')
  if (!head) return false
  return recentTopics.some((r) => {
    const n = normText(r || '')
    if (!n) return false
    return n.includes(head) || head.includes(n.split(' ').slice(0, 5).join(' '))
  })
}

function isPromoAngle(angle: AngleId): boolean {
  return angle === 'promo-fitur' || angle === 'promo-cta'
}

/**
 * Pilih template hari ini:
 *   1. Sinyal segar → 'signal' (recap autentik selalu menang).
 *   2. Ada data performa (≥2 sampel per template) → pemenang 70%,
 *      30% eksperimen ke yang lain (A/B "mana yang rame").
 *   3. Belum ada data → bolak-balik tip/promo per hari.
 */
export function pickTemplateSmart(
  freshSignal: boolean,
  perf: PerfSnapshot | null,
): { template: Template; reason: string } {
  if (freshSignal) return { template: 'signal', reason: 'sinyal segar ≤48 jam — recap autentik' }
  const tip = perf?.byTemplate?.tip
  const promo = perf?.byTemplate?.promo
  if (tip && promo && tip.posts >= 2 && promo.posts >= 2) {
    const winner: 'tip' | 'promo' = tip.avgViews >= promo.avgViews ? 'tip' : 'promo'
    const other: 'tip' | 'promo' = winner === 'tip' ? 'promo' : 'tip'
    const experiment = hash32(daySeed() * 7 + 3) % 100 < 30
    return experiment
      ? { template: other, reason: `eksperimen A/B (30%) — pemenang sejauh ini: ${winner} (${perf?.byTemplate?.[winner]?.avgViews.toFixed(0)} views rata-rata)` }
      : { template: winner, reason: `ikut pemenang performa (70%) — ${winner} rata-rata ${perf?.byTemplate?.[winner]?.avgViews.toFixed(0)} views` }
  }
  return { template: daySeed() % 2 === 0 ? 'tip' : 'promo', reason: 'belum ada data performa — rotasi tip/promo per hari' }
}

/**
 * Pilih ANGLE + TOPIK hari ini:
 *   - filter sesuai template (promo → hanya angle promo),
 *   - buang topik yang dipakai 10 run terakhir,
 *   - hash tanggal menentukan urutan + 25% lompatan eksperimen.
 */
export function pickAngleAndTopic(
  template: Template,
  recentTopics: string[],
  perf?: PerfSnapshot | null,
): { angle: Angle; topic: TopicEntry; rationale: string } {
  const eligible = TOPIC_POOL.filter((t) =>
    template === 'promo' ? isPromoAngle(t.angle) : !isPromoAngle(t.angle),
  )
  const fresh = eligible.filter((t) => !isTopicRepeated(t.topic, recentTopics))
  let pool = fresh.length ? fresh : eligible

  /* BELAJAR DARI INSIGHT (permintaan Bos: "liat insight tiap video —
     kalau ga rame ganti kontennya"):
     1. Angle sepi (flop) dihindari — kecuali semua kandidat flop.
     2. Angle pemenang diprioritaskan 55% run (sisa tetap eksplorasi
        supaya Sinta tidak cepat jenuh dan data terus bertambah). */
  const flop = new Set(perf?.flopAngles ?? [])
  const noFlop = pool.filter((t) => !flop.has(t.angle))
  let flopNote = ''
  if (noFlop.length && noFlop.length < pool.length) {
    pool = noFlop
    flopNote = ` · angle sepi dihindari: ${[...flop].filter((a) => SINTA_ANGLES[a as AngleId]).map((a) => SINTA_ANGLES[a as AngleId].label).join(', ') || [...flop].join(', ')}`
  }
  const winnerAngle = perf?.winnerAngle || null
  if (winnerAngle && hash32(daySeed() * 41 + 11) % 100 < 55) {
    const winners = pool.filter((t) => t.angle === winnerAngle)
    if (winners.length) {
      const idx = hash32(daySeed() * 7 + 5) % winners.length
      return {
        angle: SINTA_ANGLES[winners[idx].angle],
        topic: winners[idx],
        rationale: `ikut angle pemenang "${SINTA_ANGLES[winnerAngle as AngleId]?.label || winnerAngle}" (${perf?.byAngle?.[winnerAngle]?.avgViews.toFixed(0)} views rata-rata) · pool ${pool.length} topik${flopNote}`,
      }
    }
  }
  let idx = hash32(daySeed()) % pool.length
  let jumped = false
  if (pool.length > 1 && hash32(daySeed() * 31 + 17) % 100 < 25) {
    idx = (idx + 1 + hash32(daySeed() * 13) % (pool.length - 1)) % pool.length
    jumped = true
  }
  const topic = pool[idx]
  return {
    angle: SINTA_ANGLES[topic.angle],
    topic,
    rationale: `pool ${pool.length}/${eligible.length} topik belum-dipakai · indeks ${idx}${jumped ? ' (lompatan eksperimen)' : ''}${flopNote}`,
  }
}

/**
 * Fallback saat LLM gagal total: ambil script dari library 7 spec,
 * filter sesuai template + buang topik yang baru dipakai → feed tetap ganti.
 */
export function pickFallbackSpec(template: Template, recentTopics: string[]): VideoSpecLite {
  const byTemplate = FALLBACK_LIBRARY.filter((s) => s.template === template)
  const pool = byTemplate.length ? byTemplate : FALLBACK_LIBRARY
  const fresh = pool.filter((s) => !isTopicRepeated(s.topic, recentTopics))
  const finalPool = fresh.length ? fresh : pool
  const idx = hash32(daySeed() * 101 + 7) % finalPool.length
  return finalPool[idx]
}

/* ============================================================
   E) Agregasi performa dari meta.metrics instagram_posts
   (diisi oleh /api/cron/ig-metrics)
   ============================================================ */

export function aggregatePerf(
  rows: { meta?: Record<string, unknown> | null; published_at?: string | null }[],
): PerfSnapshot {
  const byTemplate: Record<string, TemplatePerf> = {}
  const byAngle: Record<string, TemplatePerf> = {}
  const addSample = (store: Record<string, TemplatePerf>, key: string, views: number, likes: number, saves: number) => {
    const cur = store[key] || { posts: 0, avgViews: 0, avgLikes: 0, avgSaves: 0 }
    // rata-rata berjalan
    cur.avgViews = (cur.avgViews * cur.posts + views) / (cur.posts + 1)
    cur.avgLikes = (cur.avgLikes * cur.posts + likes) / (cur.posts + 1)
    cur.avgSaves = (cur.avgSaves * cur.posts + saves) / (cur.posts + 1)
    cur.posts += 1
    store[key] = cur
  }
  let samplePosts = 0
  for (const row of rows) {
    const meta = (row?.meta || {}) as Record<string, unknown>
    const tpl = String(meta.template || '').toLowerCase()
    if (tpl !== 'tip' && tpl !== 'promo' && tpl !== 'signal') continue
    const metrics = (meta.metrics || {}) as Record<string, unknown>
    const views = Number(metrics.views ?? metrics.plays ?? 0) || 0
    const likes = Number(metrics.likes ?? 0) || 0
    const saves = Number(metrics.saves ?? 0) || 0
    if (!views && !likes && !saves) continue
    addSample(byTemplate, tpl, views, likes, saves)
    /* Level angle — meta.angle diisi ig-video-post/video-bot (id angle). */
    const ang = String(meta.angle || '').trim().toLowerCase()
    if (ang) addSample(byAngle, ang, views, likes, saves)
    samplePosts += 1
  }
  let winner: 'tip' | 'promo' | null = null
  const tip = byTemplate.tip
  const promo = byTemplate.promo
  if (tip && promo && tip.posts >= 2 && promo.posts >= 2) {
    winner = tip.avgViews >= promo.avgViews ? 'tip' : 'promo'
  }
  /* Pemenang + angle sepi (dibanding MEDIAN supaya tahan outlier viral). */
  const angleEntries = Object.entries(byAngle).filter(([, p]) => p.posts >= 2)
  let winnerAngle: string | null = null
  let flopAngles: string[] = []
  if (angleEntries.length >= 2) {
    const sorted = [...angleEntries].sort((a, b) => b[1].avgViews - a[1].avgViews)
    winnerAngle = sorted[0][0]
    const medians = sorted.map(([, p]) => p.avgViews).sort((a, b) => a - b)
    const median = medians[Math.floor(medians.length / 2)] || 0
    flopAngles = sorted
      .filter(([, p]) => median > 0 && p.avgViews < median * 0.4)
      .map(([id]) => id)
  }
  return { byTemplate, winner, samplePosts, byAngle, winnerAngle, flopAngles }
}
