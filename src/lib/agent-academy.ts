/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎓 AKADEMI KARYAWAN AI — "Sekolah Pagi" Luxtradee
 * ═══════════════════════════════════════════════════════════════════════════
 * Permintaan Bos: "tiap hari AI-nya harus belajar sendiri atau ada yg harus
 * diajari, sesuai keahlian masing-masing."
 *
 * Cara kerja (dipanggil dari /api/cron/master-autonomous SEBELUM agen kerja):
 *   1. Tiap agen punya KURIKULUM tetap sesuai keahliannya (mata pelajaran
 *      wajib — rotasi otomatis per tanggal, tidak ada hari sama topiknya).
 *   2. Agen boleh BELAJAR SENDIRI: kalau ia menilai topik lain lebih urgent
 *      untuk keahliannya, ia boleh mengganti topik (sumber: pilihan-sendiri).
 *   3. Hasilnya SATU pelajaran konkret: { topik, pelajaran, terapan } —
 *      disimpan ke office_memory (type 'belajar') → keesokan harinya terbaca
 *      lagi → pengetahuan menumpuk lintas hari (bukan reset tiap run).
 *   4. Pelajaran hari ini DIINJEKSIKAN ke prompt kerja agen yang sama
 *      (academyWorkBlock) → belajar langsung dipraktikkan di shift hari itu.
 *   5. Alexander memasukkan rekap "Belajar pagi ini" ke Morning Briefing
 *      Discord + panel Memori Kantor /kantor-ceo → kantor terasa hidup.
 *
 * Budget: 1 panggilan LLM kecil (maxTokens 420) + 3 subrequest KV/DB per
 * agen per hari. Gagal di titik mana pun → agen tetap bekerja normal
 * (degrade gracefully, pola cron-supabase).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { extractJson } from '@/lib/ai-llm'

/* ═══════════════════════ ROSTER & KEAHLIAN ═══════════════════════ */

export interface AcademyProfile {
  /** Kunci routing (harus sama dgn ?agents= di workflow GHA) */
  key: string
  /** Nama resmi (sama dgn kolom agent_name di office_memory) */
  nama: string
  /** Tag LLM (sama dgn agentTag callAgent → env OR_MODEL_<TAG> tetap berlaku) */
  llmTag: string
  peran: string
  /** Keahlian inti — arahan utama apa yang ia pelajari tiap hari */
  keahlian: string
  /** Tugas harian konkret — supaya "terapan" pelajarannya nyambung ke kerjaan */
  tugasHarian: string
}

export const ACADEMY_ROSTER: Record<string, AcademyProfile> = {
  farhan: {
    key: 'farhan', nama: 'Farhan', llmTag: 'Farhan', peran: 'Growth Hacker',
    keahlian: 'SEO & growth — riset keyword, artikel yang rangking Google, funnel pembaca jadi user',
    tugasHarian: 'menulis 1-2 artikel SEO harian untuk blog Luxtradee',
  },
  sinta: {
    key: 'sinta', nama: 'Sinta', llmTag: 'Sinta', peran: 'CMO',
    keahlian: 'marketing konten viral — riset pasar TikTok, hook & skrip yang FYP, brand Luxtradee',
    tugasHarian: 'laporan riset pasar + 3 draf skrip TikTok edukasi trading',
  },
  raka: {
    key: 'raka', nama: 'Raka', llmTag: 'Raka', peran: 'CTO',
    keahlian: 'keamanan & infrastruktur — probe keamanan, proteksi endpoint, latency, keandalan sistem',
    tugasHarian: 'security sweep black-box + pemantauan tren antar-run',
  },
  maya: {
    key: 'maya', nama: 'Maya', llmTag: 'Maya', peran: 'CSO',
    keahlian: 'customer success & retensi — email win-back, empati ke user, membangun kebiasaan nyatet',
    tugasHarian: 'menulis email win-back personal untuk user pasif/cold',
  },
  bagas: {
    key: 'bagas', nama: 'Bagas', llmTag: 'Bagas', peran: 'COO',
    keahlian: 'monetisasi & penjualan — lead hangat, email konversi PRO, copywriting penawaran',
    tugasHarian: 'menulis email konversi PRO untuk free user teraktif',
  },
  putri: {
    key: 'putri', nama: 'Putri', llmTag: 'Putri', peran: 'CFO',
    keahlian: 'anggaran & biaya API — MRR, kuota LLM/email, efisiensi biaya, deteksi dini pemborosan',
    tugasHarian: 'laporan MRR + kesehatan kuota API harian',
  },
  dewi: {
    key: 'dewi', nama: 'Dewi', llmTag: 'Dewi', peran: 'Data Analyst',
    keahlian: 'analisis data trading — statistik emosi vs profit, pola jam entry, insight dari angka riil',
    tugasHarian: 'insight harian dari statistik trade user',
  },
  alexander: {
    key: 'alexander', nama: 'Alexander', llmTag: 'Alexander', peran: 'CEO',
    keahlian: 'kepemimpinan & strategi — prioritas harian, briefing eksekutif, akuntabilitas tim',
    tugasHarian: 'morning briefing + 1 Next Best Action untuk Bos',
  },
}

/* ═══════════════════════ KURIKULUM PER KEAHLIAN ═══════════════════════
 * Mata pelajaran wajib — dirotasi per tanggal (hash stabil, bukan urutan
 * lorem) supaya tidak ada dua hari beruntun dgn topik sama. */

export const AGENT_CURRICULUM: Record<string, string[]> = {
  farhan: [
    'Teknik merebut featured snippet Google (jawaban langsung di paragraf pertama)',
    'Keyword long-tail vs short-tail: mana yang realistis menang untuk blog baru',
    'Internal linking strategy: cara menautkan artikel agar authority mengalir',
    'E-E-A-T: sinyal kepercayaan yang bikin Google & pembaca percaya blog trading',
    'Menulis hook 3 detik pertama agar pembaca tidak langsung scroll away',
    'Content refresh: memperbarui artikel lama agar naik lagi di pencarian',
    'Struktur artikel mobile-first: paragraf pendek, subjudul, bullet yang enak',
    'Memanfaatkan Google Trends & berita pasar untuk topik yang sedang panas',
    'CTA yang tidak menjual keras tapi tetap mengklik (soft-sell untuk trader)',
    'Analisis konten kompetitor: menemukan celah topik yang belum mereka bahas',
    'Copywriting emosional untuk trader: fear, greed, dan harapan dalam artikel',
    'Meta description & title tag: pola yang mendongrak CTR di hasil pencarian',
  ],
  sinta: [
    'Anatomi hook 3 detik viral di TikTok (pola kalimat pembuka yang menahan jempol)',
    'Struktur storytelling 15-30 detik: masalah → twist → solusi → CTA',
    'CTA komentar vs CTA follow: mana yang benar-benar mengangkat engagement',
    'Jam posting prime-time TikTok Indonesia untuk audiens trader',
    'Mengubah berita pasar (NFP, suku bunga, emas naik-turun) jadi konten yang relatable',
    'Konten edukasi yang tidak membosankan: analogi & contoh angka nyata',
    'Psikologi FOMO dalam konten trading — etis tanpa janji profit palsu',
    'Cara membalas komentar agar percakapan lanjut & akun makin dilirik algoritma',
    'Pola caption yang works: baris pertama sebagai hook kedua',
    'Format before-after & mistake-recap: kenapa format ini selalu FYP',
    'Riset kompetitor konten: menjiplak pola tanpa menjiplak isinya',
    'Konsistensi brand voice: provokatif tapi tetap kredibel sebagai platform trading',
  ],
  raka: [
    'OWASP Top 10 versi praktis untuk web app kecil',
    'Security headers wajib (CSP, HSTS, X-Frame-Options) dan cara mengujinya',
    'Rate limiting API: strategi sederhana tanpa infrastruktur tambahan',
    'Manajemen API key & secret: pola kebocoran yang paling sering terjadi',
    'Mengamankan endpoint cron dari penyalahgunaan (auth, guard, logging)',
    'SQL injection & sanitasi input: checklist review cepat',
    'XSS & Content Security Policy: proteksi berlapis di sisi klien',
    'Audit dependency: mendeteksi paket rentan sebelum jadi masalah',
    'Monitoring & alerting: sinyal paling murah yang mendeteksi insiden dini',
    'Optimasi latency edge: kenapa p95 lebih penting daripada rata-rata',
    'Backup & recovery: rencana pulih minimal yang wajib ada',
    'Keamanan webhook: verifikasi signature & anti-replay',
  ],
  maya: [
    'Teknik win-back email yang terasa manusiawi, bukan blast marketing',
    'Subjek email yang dibuka: pola singkat, personal, tanpa clickbait palsu',
    'Timing email retensi: kapan user pasif paling mungkin membuka email',
    'Personalisasi tanpa creepy: memakai data aktivitas dengan sopan',
    'Deteksi churn sederhana dari pola aktivitas (tanpa model ML rumit)',
    'CTA mikro: satu langkah kecil yang tidak menakutkan untuk user yang males',
    'Onboarding yang lengket: 3 hari pertama menentukan user bertahan atau tidak',
    'Habit loop: cue-routine-reward diterapkan ke kebiasaan nyatet trade',
    'Beda email re-engagement vs win-back dan kapan masing-masing dipakai',
    'Tone hangat tanpa hard-sell: cara menulis seperti teman, bukan CRM',
    'Feedback loop: mengubah diamnya user jadi pelajaran produk',
    'Program loyalitas sederhana yang bisa dijalankan platform kecil',
  ],
  bagas: [
    'Copywriting penawaran PRO: struktur respect → pain → bukti → CTA',
    'Anchoring harga: cara membingkai Rp49.000/bulan agar terasa murah',
    'Scarcity & urgency yang etis (tanpa manipulasi palsu)',
    'Email konversi trial/pengguna-aktif → paid: pola yang terbukti',
    'Follow-up tanpa nagging: ritme kontak yang tidak bikin ilfeel',
    'Memahami pain point trader yang rela bayar: waktu & disiplin',
    'Offer stacking: menyusun nilai agar penawaran terasa jelas',
    'Social proof dalam email: memakai fitur & data produk tanpa mengarang',
    'Membaca sinyal lead hangat: aktivitas 7 hari sebagai jendela minat',
    'Objection handling umum: "nanti dulu", "mahal", "belum sreg"',
    'Upsell vs cross-sell: prioritas untuk platform satu-produk',
    'CTA satu langkah: menghilangkan gesekan dari klik ke pembayaran',
  ],
  putri: [
    'Cara menghitung & meramalkan MRR dari data user aktif',
    'Deteksi dini pemborosan kuota API sebelum jadi tagihan/rate-limit',
    'Budgeting panggilan LLM harian: alokasi per agen & prioritas',
    'Pola biaya provider AI: kapan fallback lebih murah dari primary',
    'Strategi fallback hemat biaya tanpa merusak kualitas output',
    'LTV vs CAC versi sederhana untuk produk langganan micro-SaaS',
    'Early-warning renewal: sinyal user PRO yang mau berhenti',
    'Efisiensi cache untuk menekan konsumsi API (TTL & kunci cache)',
    'Mitigasi rate limit 429: backoff, spread, dan degradasi bertahap',
    'Menulis laporan keuangan ringkas yang langsung bisa diputuskan CEO',
  ],
  dewi: [
    'Winrate & expectancy: cara membaca kualitas sistem dari angka jurnal',
    'Analisis emosi vs profit: mengubah tabel jadi insight yang bisa ditindak',
    'Deteksi pola overtrading dari frekuensi & hasil trade',
    'Distribusi jam entry terbaik/terburuk dan cara menyajikannya jujur',
    'Menarasikan data agar actionable: 1 insight + 1 rekomendasi, tanpa kuliah',
    'R-multiple: mengukur hasil trade relatif terhadap risikonya',
    'Streak analysis: win/loss streak sebagai sinyal psikologi trader',
    'Segmentasi trader (scalper vs swing) dari durasi & frekuensi',
    'Menyaring noise: kapan data terlalu sedikit untuk ditarik kesimpulan',
    'Korelasi durasi hold vs hasil: pola yang sering terlewat',
    'Risk-of-ruin versi sederhana dari winrate & RR rata-rata',
    'Menulis rekomendasi aturan harian yang konkret dan mudah diikuti',
  ],
  alexander: [
    'Framework prioritas harian (skor dampak × urgensi) untuk briefing',
    'Menulis Next Best Action yang spesifik, terukur, dan bisa dieksekusi hari itu',
    'Membaca "mood" operasional dari data run (bukan perasaan)',
    'Delegasi & akuntabilitas: cara mengecek kerjaan tanpa mikromanage',
    'Briefing eksekutif 60 detik: verdict dulu, alasan kemudian',
    'Manajemen risiko operasional: kapan wajib eskalasi ke Bos',
    'Keseimbangan growth vs retention dalam prioritas tim',
    'Accountability loop: mengecek NBA kemarin sebelum menetapkan NBA baru',
    'Eskalasi yang tepat: batas antara masalah rutin dan sirene darurat',
    'Review kinerja mingguan: pola yang muncul dari briefing harian',
    'Komunikasi ke tim AI: instruksi singkat yang tidak ambigu',
    'Menyusun ringkasan lintas divisi tanpa kehilangan angka penting',
  ],
}

/* ═══════════════════════ 🧠 SKILL PAKET KARPATHY (Bos 2026-11) ═══════════════════════
 * Bos menyimpan 4 rujukan Andrej Karpathy dan menyuruhnya jadi skill karyawan:
 *   1. github.com/karpathy/autoresearch — agen AI eksperimen otomatis semalaman:
 *      ubah kode → latih 5 menit → cek metrik → keep-or-discard → ulangi.
 *      Manusia TIDAK menyentuh kode; yang diiterasi adalah file instruksi (program.md).
 *   2. gist llm-wiki — pola basis pengetahuan yang MENGUMPAL: LLM tidak sekadar
 *      RAG (mengulang mencari tiap pertanyaan) tapi membangun & merawat wiki
 *      markdown permanen. Tiga lapis: sumber mentah (tak boleh diubah) → wiki
 *      (milik LLM) → skema (aturan, dikembangkan bersama). Operasi: INGEST
 *      (baca sumber → ringkasan → perbarui halaman terkait → log), QUERY
 *      (jawaban bagus DIFILE KEMBALI jadi halaman), LINT (kesehatan: kontradiksi,
 *      klaim basi, halaman yatim, konsep tanpa halaman). index.md + log.md.
 *   3. github.com/karpathy/nanoGPT — minimalisme: latih/finetune GPT cukup
 *      beberapa file. Sedikit bagian bergerak = sedikit titik gagal.
 *   4. github.com/karpathy/nanochat — pipeline LLM lengkap 1 GPU (tokenisasi →
 *      pretraining → finetune → evaluasi → inference); "ChatGPT terbaik yang
 *      $100 bisa beli": GPT-2 dulu $43.000 (2019) kini $48 (spot ~$15). Satu
 *      DIAL kompleksitas (--depth) mengatur semuanya, hyperparameter lain
 *      dihitung otomatis; speedrun leaderboard GPT-2 (metrik val_bpb/CORE).
 *
 * Cara pakai: topik-topik di bawah digabung ke kurikulum harian (fullCurriculum)
 * → rotasi hash tanggal otomatis → karyawan belajar skill ini bergantian tanpa
 * perlu diingatkan. Gaya sama dgn kurikulum inti: SATU baris konkret per topik. */
export const KARPATHY_SKILL_PACK: Record<string, string[]> = {
  raka: [
    'autoresearch — loop eksperimen otomatis: ubah SATU variabel → ukur metrik objektif → keep-or-discard → ulangi; ciri eksperimen yang tidak buang waktu',
    'autoresearch — metrik tunggal val_bpb (bits per byte, lower is better): pilih angka perbandingan yang adil antar percobaan, bebas bias arsitektur',
    'autoresearch — "program instruksi, bukan kode": yang diiterasi manusia adalah file instruksi utk agen AI (program.md); pola delegasi org riset otomatis',
    'nanochat — pola DIAL TUNGGAL: satu parameter (depth) menentukan seluruh konfigurasi, hyperparameter lain dihitung otomatis — minim salah setel',
    'nanochat — pipeline penuh satu node: tokenisasi → pretraining → finetune → evaluasi → inference bisa sederhana & utuh di satu mesin',
    'nanoGPT — minimalisme: latih GPT cukup beberapa file; makin sedikit bagian bergerak, makin sedikit titik gagal yang dirawat',
  ],
  dewi: [
    'llm-wiki — pengetahuan yang menggumpal: ringkasan dibangun sekali lalu dirawat, bukan diturunkan ulang dari nol tiap pertanyaan (anti-RAG-mindset)',
    'llm-wiki — operasi INGEST: baca sumber baru → tulis halaman ringkasan → perbarui halaman topik terkait → catat log; satu sumber menyentuh banyak halaman',
    'llm-wiki — operasi LINT: rutin cari kontradiksi antar halaman, klaim basi, halaman yatim, konsep penting tanpa halaman — kesehatan basis pengetahuan',
    'llm-wiki — jawaban bagus difile kembali: analisis yang sudah dibuat tidak boleh hilang di riwayat chat, simpan jadi halaman wiki baru',
    'nanochat — satu metrik utama per eksperimen (val_bpb): angka kunci yang sama dipakai membandingkan semua run secara adil',
    'autoresearch — eksperimen kecil tiap malam: banyak putaran kecil dengan keep-or-discard lebih cepat maju daripada satu analisis besar yang jarang',
  ],
  alexander: [
    'autoresearch — desain ORG RISET: instruksi untuk agen AI diiterasi seperti kode; program.md adalah produk utama, bukan pelengkap',
    'autoresearch — keputusan keep-or-discard berbasis metrik objektif semalaman, bukan perasaan atau rapat panjang',
    'llm-wiki — SCHEMA = disiplin: dokumen aturan yang mengubah agen generik jadi penjaga pengetahuan yang disiplin; ikut dikembangkan seiring waktu',
    'llm-wiki — pemisahan tiga lapis: sumber mentah tak boleh diutak-atik, wiki milik agen, skema milik bersama — tanggung jawab jelas',
    'nanochat — kepemimpinan dial tunggal: satu kenop prioritas (mis. depth) yang menentukan arah, parameter turunannya dihitung otomatis',
    'nanochat — pelajaran biaya $100: GPT-2 $43.000 (2019) → $48 (2026); selalu tanya "dial apa yang membuat biaya runtuh 100x"',
  ],
  farhan: [
    'llm-wiki — bangun wiki riset konten: halaman per topik saling tertaut (entity pages), bukan dokumen lepas — authority mengalir antar halaman',
    'llm-wiki — ingest disiplin satu-per-satu: baca sumber → ringkasan → perbarui halaman terkait → log; kecil tiap hari tapi menggumpal',
    'llm-wiki — jawaban bagus jadi artikel: analisis dari percakapan/riset difile jadi halaman permanen, bukan hilang di chat',
    'llm-wiki — lint mingguan konten: deteksi klaim basi (angka tahun lalu), halaman yatim tanpa link internal, topik panas yang belum punya halaman',
    'nanochat — speedrun leaderboard: komunitas berlomba memangkas waktu proses; konten yang tercepat menjawab kebutuhan pencari yang menang',
    'autoresearch — eksperimen semalaman otomatis: daftar variasi judul/hook dijalankan sistematis, yang metriknya kalah dibuang tanpa drama',
  ],
  sinta: [
    'llm-wiki — wiki topik tren pasar: halaman per topik (prop firm, emas, budgeting) diperbarui tiap riset — pengetahuan pasar menumpuk lintas hari',
    'llm-wiki — halaman entitas per kreator kompetitor: pantau pola hook per orang, bukan impresi acak yang tidak bisa disimpulkan',
    'llm-wiki — lint sudut cerita: deteksi angle basi yang sudah terpakai sendiri/kompetitor sebelum skrip baru dibuat',
    'llm-wiki — index.md + log.md: indeks ringkas per kategori + catatan kronologis; dua kacamata berbeda untuk navigasi pengetahuan pasar',
    'autoresearch — loop variasi hook otomatis: eksperimen kecil tiap run dengan metrik tunggal, keep-or-discard yang menang',
    'nanochat — gagasan speedrun: waktu ide→publikasi yang dipangkas terus adalah leaderboard yang benar untuk konten',
  ],
  maya: [
    'llm-wiki — halaman entitas per segmen user: profil segmen diperbarui tiap interaksi, bukan mengingat ulang dari nol tiap email',
    'llm-wiki — pengetahuan menggumpal: catatan win-back hari ini menjadi konteks email berikutnya — hubungan terasa lanjut, bukan reset',
    'llm-wiki — jawaban dari percakapan difile: pertanyaan user yang sering muncul jadi halaman jawaban permanen yang dirawat',
    'llm-wiki — lint empati: deteksi janji/klaim di template lama yang sudah kontradiktif atau tidak relevan dengan kondisi terbaru',
    'nanochat — satu dial kepuasan per eksperimen retensi: ukur SATU hal dengan adil antar percobaan, sisanya jangan ikut diubah',
    'autoresearch — putaran kecil konsisten: kontak kecil mingguan yang dievaluasi metriknya lebih hidup daripada kampanye besar yang jarang',
  ],
  bagas: [
    'llm-wiki — halaman entri per lead hangat: setiap balasan lead diperbarui ke halamannya — konteks menjual menumpuk antar email',
    'llm-wiki — ingest sinyal disiplin: klik/balas/buka → perbarui profil lead → catat log; tidak ada sinyal hangat yang hilang',
    'llm-wiki — lint pipeline penjualan: deteksi lead yatim (lama tak disentuh) dan klaim penawaran basi yang kontradiktif antar email',
    'autoresearch — keep-or-discard pada copy: A/B dgn SATU metrik (reply rate), yang kalah dibuang otomatis tanpa perdebatan selera',
    'autoresearch — loop follow-up semalaman: antrian dijalankan sistematis oleh agen; manusia hanya meracik instruksi (program.md)',
    'nanochat — dial tunggal biaya kampanye: satu kenop pengendali (frekuensi/segment) ditentukan, sisanya ikut otomatis — hemat & minim salah',
  ],
  putri: [
    'nanochat — pelajaran biaya AI: GPT-2 $43.000 (2019) → $48 (2026), spot ~$15; anggarkan dgn asumsi biaya turun, jadi jangan kontrak mahal jangka panjang',
    'nanochat — temukan dial biaya utama tiap layanan: satu parameter (depth) menentukan keseluruhan biaya; temukan kenop serupa di stack kita',
    'autoresearch — budget eksperimen tetap kecil (5 menit): banyak lari murah yang dievaluasi metrik > satu lari besar mahal yang tidak jelas hasilnya',
    'llm-wiki — wiki keputusan biaya: catatan keputusan pengeluaran jadi halaman yang dirawat & dicari, bukan hilang di riwayat chat',
    'llm-wiki — lint keuangan: deteksi kontradiksi antar laporan dan "halaman yatim" — langganan/tool yang tak terpakai tapi tetap bayar',
    'nanochat — leaderboard publik memicu efisiensi: metrik biaya tim dibuka antar divisi agar semua berlomba hemat',
  ],
}

/** Kurikulum penuh = kurikulum inti + paket skill tambahan Bos (karpathy). */
export function fullCurriculum(agentKey: string): string[] {
  return [...(AGENT_CURRICULUM[agentKey] || []), ...(KARPATHY_SKILL_PACK[agentKey] || [])]
}

/* ═══════════════════════ ROTASI TOPIK HARIAN ═══════════════════════ */

/** Hash stabil dari tanggal WIB (YYYY-MM-DD) — rotasi deterministik. */
export function academyDayIndex(dateStr: string): number {
  let h = 0
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0
  return h
}

/** Topik kurikulum hari ini utk agen — beda tiap hari, beda urutan tiap agen.
 *  Kurikulum penuh = inti + SKILL PAKET KARPATHY (fullCurriculum). */
export function pickTodayTopic(agentKey: string, dateStr: string): { topic: string; index: number } {
  const cur = fullCurriculum(agentKey)
  if (!cur.length) return { topic: '', index: -1 }
  const index = academyDayIndex(dateStr) % cur.length
  return { topic: cur[index], index }
}

/* ═══════════════════════ PROMPT SESI BELAJAR ═══════════════════════ */

export function buildAcademySystemPrompt(p: AcademyProfile): string {
  return [
    `Kamu ${p.nama}, ${p.peran} Luxtradee (jurnal trading AI XAUUSD untuk trader Indonesia, PRO Rp49.000/bulan).`,
    `Ini SESI BELAJAR PAGI 10 menit SEBELUM shift kerjamu. Keahlianmu: ${p.keahlian}.`,
    `Tugasmu sehari-hari: ${p.tugasHarian}.`,
    `Pilih SATU pelajaran paling berharga dari topik hari ini — KONKRET, bukan teori umum: ada teknik, angka, atau langkah yang bisa langsung dipraktikkan.`,
    `Kalau setelah dipikir ada topik lain yang LEBIH urgent untuk keahlianmu, BOLEH ganti sendiri — set "sumber":"pilihan-sendiri" dan isi "topik" dengan pilihanmu.`,
    `Output JSON MURNI tanpa teks lain:`,
    `{"topik":"...","pelajaran":"2-4 kalimat konkret","terapan":"1 kalimat: cara kamu pakai ini di tugas hari ini","sumber":"kurikulum|pilihan-sendiri"}`,
  ].join('\n')
}

export function buildAcademyUserPrompt(args: {
  profile: AcademyProfile
  topic: string
  dateStr: string
}): string {
  return [
    `Tanggal: ${args.dateStr}`,
    `TOPIK KURIKULUM HARI INI (mata pelajaran wajib): ${args.topic}`,
    ``,
    `Belajar sekarang. SATU pelajaran terbaik saja, bahasa Indonesia, langsung praktis.`,
  ].join('\n')
}

/* ═══════════════════════ PARSING & INJEKSI ═══════════════════════ */

export interface AcademyLesson {
  topik: string
  pelajaran: string
  terapan: string
  sumber: 'kurikulum' | 'pilihan-sendiri'
  model?: string
}

function clipLocal(s: unknown, n: number): string {
  const t = String(s ?? '').trim()
  return t.length <= n ? t : t.slice(0, n) + '…'
}

/** Parse output LLM sesi belajar → pelajaran valid, atau null (buang). */
export function parseAcademyLesson(raw: string): AcademyLesson | null {
  const parsed = extractJson<{ topik?: string; pelajaran?: string; terapan?: string; sumber?: string }>(raw)
  const topik = clipLocal(parsed?.topik, 90)
  const pelajaran = clipLocal(parsed?.pelajaran, 400)
  const terapan = clipLocal(parsed?.terapan, 220)
  if (topik.length < 4 || pelajaran.length < 20) return null
  return {
    topik,
    pelajaran,
    terapan: terapan || 'Terapkan pada tugas hari ini.',
    sumber: parsed?.sumber === 'pilihan-sendiri' ? 'pilihan-sendiri' : 'kurikulum',
  }
}

/** Blok injeksi ke prompt KERJA agen — pelajarannya wajib dipraktikkan. */
export function academyWorkBlock(lesson: AcademyLesson | null): string {
  if (!lesson) return ''
  return [
    `🎓 HASIL BELAJAR PAGI INI (akademi harian — WAJIB terlihat pengaruhnya di tugas hari ini):`,
    `• Topik: ${lesson.topik}`,
    `• Pelajaran: ${lesson.pelajaran}`,
    `• Terapan: ${lesson.terapan}`,
  ].join('\n')
}

/** Blok rekap akademi untuk prompt briefing Alexander. */
export function academyBriefingBlock(items: Array<{ nama: string; topik: string; pelajaran: string }>): string {
  if (!items.length) return ''
  return [
    `AKADEMI PAGI INI (hasil belajar tim sebelum kerja — tim makin terampil tiap hari):`,
    ...items.map(a => `- ${a.nama}: ${clipLocal(a.topik, 60)} — ${clipLocal(a.pelajaran, 110)}`),
  ].join('\n')
}
