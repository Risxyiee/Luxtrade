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

/* ═══════════════════════ ROTASI TOPIK HARIAN ═══════════════════════ */

/** Hash stabil dari tanggal WIB (YYYY-MM-DD) — rotasi deterministik. */
export function academyDayIndex(dateStr: string): number {
  let h = 0
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0
  return h
}

/** Topik kurikulum hari ini utk agen — beda tiap hari, beda urutan tiap agen. */
export function pickTodayTopic(agentKey: string, dateStr: string): { topic: string; index: number } {
  const cur = AGENT_CURRICULUM[agentKey] || []
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
