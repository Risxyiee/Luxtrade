/**
 * ceo-phase.ts — fase bisnis + kerja berbasis ARTEFAK untuk karyawan AI Kantor CEO.
 *
 * Masalah yang diselesaikan: semua agen dirancang menganalisis user, padahal user/trade
 * belum ada → laporan kosong yang diisi LLM dengan kalimat mirip tiap hari.
 *
 * Isi modul:
 *  1. getPhase()        — 'pre-launch' | 'early' | 'growth' dari data nyata (cache 1 jam)
 *  2. inputHash() dkk.  — lewati panggilan LLM kalau input identik dengan run terakhir
 *  3. Checklist peluncuran — sumber NBA Alexander saat pre-launch (bukan karangan baru tiap hari)
 *  4. runDailyWork()    — jadwal mingguan per karyawan yang MENGHASILKAN BARANG JADI (artefak)
 *  5. buildCompactBriefing() — briefing singkat tanpa LLM saat pre-launch
 *
 * Modul ini TIDAK mengimpor apa pun dari route.ts — semua ketergantungan (KV, Supabase,
 * LLM, Discord) disuntikkan lewat PhaseDeps, jadi aman dipakai dari route Next.js
 * (file route.ts tidak boleh meng-export fungsi selain GET/POST/dll.).
 */

export type Phase = 'pre-launch' | 'early' | 'growth'

export interface PhaseInfo {
  phase: Phase
  users: number
  trades7d: number
  at: string
  forced?: boolean
}

export interface BrainResult { text: string; provider: string; model: string }

export interface PhaseDeps {
  kvGet: (key: string) => Promise<string | null>
  kvSet: (key: string, value: string) => Promise<boolean>
  /** supaCount(e, table, filters) */
  count: (table: string, filters?: string) => Promise<number>
  /** agentBrain(e, agent, system, user, maxTokens, temp, budget) */
  brain: (agent: string, system: string, user: string, maxTokens: number, temperature: number) => Promise<BrainResult>
  mem: (who: string, text: string) => Promise<void>
  memBlock: () => Promise<string>
  notify: (text: string) => Promise<void>
  /** fetch ke situs sendiri lewat service binding (path, mis. "/about") */
  fetchSelf: (path: string) => Promise<Response>
  env: (name: string) => string
  wibDay: (offset?: number) => string
  isoAgo: (hours: number) => string
  /** email yang tidak dihitung sebagai "user" (pemilik + akun E2E) */
  excludeEmails: string[]
}

/* ============================================================
   1. FASE BISNIS
   ============================================================ */
export const LAUNCH_TARGET_USERS = 10
const PHASE_CACHE_MS = 60 * 60_000

export function phaseOf(users: number, trades7d: number): Phase {
  if (users < 10 || trades7d < 20) return 'pre-launch'
  if (users < 200) return 'early'
  return 'growth'
}

/** Hari dalam seminggu menurut WIB: 0 = Minggu … 6 = Sabtu */
export function wibWeekday(now: number = Date.now()): number {
  return new Date(now + 7 * 3600_000).getUTCDay()
}

/** Tanggal Senin minggu ini (WIB) — kunci "refresh paling lambat seminggu sekali" */
export function weekKey(d: PhaseDeps): string {
  return d.wibDay(-((wibWeekday() + 6) % 7))
}

/**
 * Fase aktif. Override manual: env PHASE_OVERRIDE = pre-launch | early | growth.
 * Query gagal → pakai cache lama; tanpa cache → 'early' (perilaku lama, bukan mode hemat).
 */
export async function getPhase(d: PhaseDeps, forced = ''): Promise<PhaseInfo> {
  const now = new Date().toISOString()
  if (forced === 'pre-launch' || forced === 'early' || forced === 'growth')
    return { phase: forced, users: -1, trades7d: -1, at: now, forced: true }

  let cached: PhaseInfo | null = null
  try { cached = JSON.parse((await d.kvGet('phase:cur')) || 'null') as PhaseInfo | null } catch { cached = null }
  if (cached && cached.at && Date.now() - Date.parse(cached.at) < PHASE_CACHE_MS) return cached

  try {
    const ex = d.excludeEmails.filter(Boolean).map((m) => `"${m}"`).join(',')
    const userFilter = ex ? `or=(email.is.null,email.not.in.(${ex}))` : ''
    const [users, trades7d] = await Promise.all([
      d.count('profiles', userFilter),
      d.count('trades', 'created_at=gte.' + d.isoAgo(24 * 7)),
    ])
    const info: PhaseInfo = { phase: phaseOf(users, trades7d), users, trades7d, at: now }
    await d.kvSet('phase:cur', JSON.stringify(info)).catch(() => false)
    return info
  } catch {
    return cached ?? { phase: 'early', users: -1, trades7d: -1, at: now }
  }
}

/* ============================================================
   2. LEWATI LLM KALAU INPUT TIDAK BERUBAH
   Pola: hash → bandingkan → (kerja) → tandai SETELAH sukses
   ============================================================ */
async function sha1Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
export async function inputHash(inputs: unknown): Promise<string> {
  return sha1Hex(JSON.stringify(inputs))
}
export async function inputsUnchanged(d: PhaseDeps, agent: string, hash: string): Promise<boolean> {
  try { return (await d.kvGet(`hash:${agent}`)) === hash } catch { return false }
}
export async function markInputs(d: PhaseDeps, agent: string, hash: string): Promise<void> {
  try { await d.kvSet(`hash:${agent}`, hash) } catch { /* opsional */ }
}

/* ============================================================
   3. CHECKLIST PELUNCURAN — sumber NBA Alexander saat pre-launch.
   Urutan ini usulan awal: ubah bebas sesuai kondisi nyata.
   Maju ke langkah berikutnya HANYA saat Bos menjawab OKE.
   ============================================================ */
export const LAUNCH_CHECKLIST: string[] = [
  'Pasang webhook Resend (resend.com → Webhooks → https://luxtradee.web.id/api/webhooks/resend) supaya open-rate email terukur',
  'Tayangkan konten pertama: ambil draf terbaik Sinta di Ruang CMO, posting di TikTok dan Instagram hari ini',
  'Ajak 5 trader yang kamu kenal mencoba upload 1 screenshot — catat di langkah mana mereka bingung',
  'Bagikan link di 3 grup/komunitas trader memakai draf community seeding Kevin (edukasi dulu, jangan jualan)',
  'Rekam demo layar 30 detik: upload screenshot → evaluasi AI keluar; pakai di landing dan TikTok',
  'Kirim pesan kolaborasi ke 5 kreator trading kecil memakai draf Bagas di panel artefak Ruang COO',
  'Terbitkan artikel SEO pertama dari draf Sinta lalu submit sitemap ke Google Search Console',
  'Perbaiki jalur daftar → upload trade pertama berdasarkan temuan dari 5 teman tadi (bandingkan dengan rancangan onboarding Maya)',
]

export interface LaunchStep { idx: number; total: number; text: string }

export async function currentLaunchStep(d: PhaseDeps): Promise<LaunchStep | null> {
  let idx = 0
  try { idx = parseInt((await d.kvGet('launch:idx')) || '0', 10) || 0 } catch { idx = 0 }
  if (idx >= LAUNCH_CHECKLIST.length) return null
  return { idx, total: LAUNCH_CHECKLIST.length, text: LAUNCH_CHECKLIST[idx] }
}

export async function advanceLaunchStep(d: PhaseDeps): Promise<void> {
  let idx = 0
  try { idx = parseInt((await d.kvGet('launch:idx')) || '0', 10) || 0 } catch { idx = 0 }
  await d.kvSet('launch:idx', String(idx + 1)).catch(() => false)
}

/* ============================================================
   4. ARTEFAK — tiap run menghasilkan barang jadi, bukan laporan.
   Tersimpan di agent_kv: art:index (metadata, maks 30) + art:body:<id>.
   Tidak ada artefak → tidak ada notifikasi.
   ============================================================ */
export interface ArtifactMeta {
  id: string
  role: string
  kind: string
  label: string
  title: string
  preview: string
  at: string
  who: string
}

interface JobCtx {
  d: PhaseDeps
  info: PhaseInfo
  recentTitles: string[]
  mem: string
}
interface Job {
  id: string
  role: string
  kind: string
  label: string
  who: string
  weekdays: number[]
  build: (c: JobCtx) => Promise<{ title: string; body: string } | null>
}

const ROLE_NAME: Record<string, string> = {
  cmo: 'Sinta', coo: 'Bagas', cso: 'Maya', cto: 'Raka', cfo: 'Putri', gh: 'Farhan', kevin: 'Kevin',
}

const PRODUCT_CTX =
  'Produk: Luxtradee (luxtradee.web.id) — web app jurnal trading untuk trader XAUUSD Indonesia: user upload screenshot trade → evaluasi visual AI, mencatat emosi, ada paket PRO dan program affiliate. Posisi: JURNAL trading, BUKAN penjual sinyal.'
const NO_FABRICATION =
  'ATURAN KERAS: DILARANG mengarang angka performa, testimoni, nama grup/akun/URL spesifik, atau janji profit. Untuk hal yang harus dicari Bos, beri KATEGORI dan KATA KUNCI PENCARIAN, bukan nama yang kamu karang.'

function parseArtifact(raw: string): { title: string; body: string } | null {
  const text = raw.trim()
  const m = text.match(/JUDUL:\**\s*(.+?)\s*\n+\s*-{3,}\s*\n+([\s\S]+)/i)
  if (m && m[2].trim().length > 80)
    return { title: m[1].replace(/\*+/g, '').trim().slice(0, 140), body: m[2].trim().slice(0, 7000) }
  const lines = text.split('\n')
  const title = (lines[0] || '').replace(/^#+\s*/, '').replace(/^\W*JUDUL\W*:?\s*/i, '').replace(/\*+/g, '').trim().slice(0, 140)
  const body = lines.slice(1).join('\n').trim()
  return title && body.length > 120 ? { title, body: body.slice(0, 7000) } : null
}

function llmJob(brainKey: string, system: string, userFn: (c: JobCtx) => string, maxTokens: number) {
  return async (c: JobCtx): Promise<{ title: string; body: string } | null> => {
    const sys =
      `${PRODUCT_CTX}\n${NO_FABRICATION}\n${system}\n` +
      'FORMAT OUTPUT: baris pertama "JUDUL: <judul singkat>", baris kedua "---", lalu isi. Tanpa kalimat pembuka/penutup lain.'
    const usr =
      `Tanggal: ${c.d.wibDay()} (WIB). Fase bisnis: ${c.info.phase} — pendaftar ${c.info.users >= 0 ? c.info.users : 'tidak diketahui'}, trade 7 hari ${c.info.trades7d >= 0 ? c.info.trades7d : 'tidak diketahui'}.\n` +
      (c.recentTitles.length
        ? `10 OUTPUT TERAKHIRMU untuk tugas ini (DILARANG mengulang topik/angle yang sama):\n${c.recentTitles.map((t) => `- ${t}`).join('\n')}\n`
        : '') +
      userFn(c) + c.mem
    const r = await c.d.brain(brainKey, sys, usr, maxTokens, 0.8)
    return parseArtifact(r.text)
  }
}

/* ---------- Job kode murni (tanpa LLM) ---------- */
async function seoAudit(c: JobCtx): Promise<{ title: string; body: string } | null> {
  const paths = ['/', '/about', '/blog', '/faq', '/contact', '/upgrade', '/affiliate']
  const grab = (html: string, re: RegExp) => (html.match(re)?.[1] || '').replace(/\s+/g, ' ').trim()
  const rows = await Promise.all(paths.map(async (p) => {
    try {
      const r = await c.d.fetchSelf(p)
      if (!r.ok) return { p, status: r.status, title: '', desc: '', h1: 0, canonical: false, noindex: false }
      const html = (await r.text()).slice(0, 300_000)
      return {
        p, status: r.status,
        title: grab(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
        desc: grab(html, /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
          grab(html, /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i),
        h1: (html.match(/<h1[\s>]/gi) || []).length,
        canonical: /<link[^>]+rel=["']canonical["']/i.test(html),
        noindex: /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html),
      }
    } catch { return { p, status: 0, title: '', desc: '', h1: 0, canonical: false, noindex: false } }
  }))

  const titleCount: Record<string, number> = {}
  for (const r of rows) if (r.title) titleCount[r.title] = (titleCount[r.title] || 0) + 1

  let bad = 0
  const lines: string[] = []
  for (const r of rows) {
    const issues: string[] = []
    if (r.status !== 200) issues.push(`HTTP ${r.status || 'timeout'}`)
    else {
      if (!r.title) issues.push('title kosong')
      else if (r.title.length < 25 || r.title.length > 65) issues.push(`panjang title ${r.title.length} (ideal 25–65)`)
      if (!r.desc) issues.push('meta description kosong')
      else if (r.desc.length < 70 || r.desc.length > 170) issues.push(`panjang description ${r.desc.length} (ideal 70–170)`)
      if (r.h1 !== 1) issues.push(`jumlah H1 = ${r.h1} (ideal 1)`)
      if (!r.canonical) issues.push('tanpa canonical')
      if (r.noindex) issues.push('NOINDEX aktif')
      if (r.title && titleCount[r.title] > 1) issues.push('title kembar dengan halaman lain')
    }
    if (issues.length) bad++
    lines.push(`- ${r.p} — ${issues.length ? 'MASALAH: ' + issues.join('; ') : 'OK'}`)
  }

  let sitemapLine = 'Sitemap /sitemap.xml: tidak terbaca'
  try {
    const r = await c.d.fetchSelf('/sitemap.xml')
    const xml = r.ok ? await r.text() : ''
    sitemapLine = r.ok ? `Sitemap /sitemap.xml: HTTP 200, ${(xml.match(/<loc>/gi) || []).length} URL` : `Sitemap /sitemap.xml: HTTP ${r.status} — MASALAH`
  } catch { /* tetap pesan default */ }
  let robotsLine = 'robots.txt: tidak terbaca'
  try {
    const r = await c.d.fetchSelf('/robots.txt')
    const txt = r.ok ? await r.text() : ''
    robotsLine = r.ok ? `robots.txt: HTTP 200, ${/sitemap:/i.test(txt) ? 'ada baris Sitemap' : 'TANPA baris Sitemap — MASALAH'}` : `robots.txt: HTTP ${r.status} — MASALAH`
  } catch { /* tetap pesan default */ }

  return {
    title: `Audit SEO teknis: ${bad}/${rows.length} halaman bermasalah`,
    body: [
      `Audit SEO teknis halaman publik (${c.d.wibDay()}) — murni HTTP fetch, tanpa LLM.`,
      '', ...lines, '', sitemapLine, robotsLine, '',
      'Batas: tidak mengecek link rusak per halaman dan tidak menjalankan JavaScript (konten yang baru muncul setelah render di browser tidak terbaca).',
    ].join('\n'),
  }
}

async function breakeven(c: JobCtx): Promise<{ title: string; body: string } | null> {
  const n = (name: string, def: number) => { const v = parseInt(c.d.env(name) || '', 10); return Number.isFinite(v) ? v : def }
  const price = n('PRO_PRICE_IDR', 49000)
  const fixed = n('FIXED_COST_IDR', 0)
  const cash = n('CASH_IDR', 0)
  let pro = -1
  try { pro = await c.d.count('profiles', 'is_pro=eq.true') } catch { pro = -1 }
  const idr = (x: number) => 'Rp' + Math.round(x).toLocaleString('id-ID')
  const mrr = pro > 0 ? pro * price : 0
  const L: string[] = [`Titik impas & runway (matematika murni, tanpa LLM) — ${c.d.wibDay()}`, '']
  L.push(`Harga paket bulanan: ${idr(price)} (env PRO_PRICE_IDR) · user PRO sekarang: ${pro >= 0 ? pro : 'gagal dibaca'} · MRR estimasi: ${idr(mrr)}`)
  if (fixed > 0) {
    const need = Math.ceil(fixed / price)
    L.push(`Biaya tetap/bulan: ${idr(fixed)} → titik impas = ${need} user PRO (${idr(fixed)} ÷ ${idr(price)})`)
    L.push(pro >= 0 ? `Kekurangan: ${Math.max(0, need - pro)} user PRO lagi` : 'Kekurangan: tidak bisa dihitung (jumlah PRO gagal dibaca)')
    if (cash > 0) {
      const burn = Math.max(0, fixed - mrr)
      L.push(burn > 0
        ? `Kas ${idr(cash)} · pengeluaran bersih ${idr(burn)}/bulan → runway ≈ ${(cash / burn).toFixed(1)} bulan`
        : `Kas ${idr(cash)} · pendapatan sudah menutup biaya tetap → runway tidak terbatas`)
    } else L.push('Runway belum bisa dihitung: set env CASH_IDR (saldo kas yang dialokasikan untuk operasional).')
  } else {
    L.push('Titik impas belum bisa dihitung: set env FIXED_COST_IDR = total biaya tetap per bulan (domain, API berbayar, tools, dll.).')
  }
  L.push('', 'Batas: harga paket 6 bulanan/lifetime, potongan payment gateway, dan pajak belum dihitung.')
  return { title: fixed > 0 ? `Titik impas ${Math.ceil(fixed / price)} user PRO` : 'Titik impas: biaya tetap belum diisi', body: L.join('\n') }
}

/* ---------- Jadwal mingguan (0 = Minggu … 6 = Sabtu, WIB) ---------- */
const JOBS: Job[] = [
  {
    id: 'cmo:calendar', role: 'cmo', kind: 'calendar', label: 'Kalender konten 7 hari', who: 'CMO Sinta', weekdays: [0],
    build: llmJob('cmo',
      'Kamu Sinta, CMO Luxtradee. Susun KALENDER KONTEN 7 HARI (Senin–Minggu) untuk TikTok, Instagram, dan thread. Pakai 7 pilar, satu per hari: recap-mingguan, edukasi, mitos-trading, demo-fitur, psikologi, poll-engagement, behind-the-scenes. Tiap hari tulis: platform utama, hook (kalimat pembuka), inti isi 1–2 kalimat, CTA. Terapkan REPURPOSE: pilih satu ide inti minggu ini lalu pecah jadi versi TikTok, caption/carousel IG, dan thread. Isi berbasis edukasi trading umum, BUKAN data user.',
      () => 'Buat kalender untuk minggu depan.', 2500),
  },
  {
    id: 'cso:onboarding', role: 'cso', kind: 'onboarding', label: 'Rancangan onboarding', who: 'CSO Maya', weekdays: [1],
    build: llmJob('cso',
      'Kamu Maya, CSO Luxtradee. Churn belum relevan karena user baru sedikit, jadi tugasmu merancang ONBOARDING. Hasilkan 3 bagian: (1) urutan 3 email sambutan (hari 0, hari 2, hari 5) — tiap email subjek + isi maksimal 80 kata, tanpa link selain luxtradee.web.id; (2) 8 FAQ yang diprediksi ditanyakan user baru beserta jawaban singkat; (3) hambatan yang diprediksi di jalur "daftar → upload trade pertama" beserta 3 perbaikan konkret yang bisa dikerjakan Bos. Semua berupa prediksi/usulan, bukan data user.',
      () => 'Rancang atau perbarui paket onboarding minggu ini.', 2500),
  },
  {
    id: 'cfo:breakeven', role: 'cfo', kind: 'breakeven', label: 'Titik impas & runway', who: 'CFO Putri', weekdays: [1],
    build: breakeven,
  },
  {
    id: 'coo:outreach', role: 'coo', kind: 'outreach', label: 'Paket outbound', who: 'COO Bagas', weekdays: [2],
    build: llmJob('coo',
      'Kamu Bagas, COO Luxtradee. Belum ada free user untuk dijual-ulang, jadi kerjamu OUTBOUND mencari user pertama. Hasilkan 3 bagian: (A) 8 jenis target (komunitas trader Indonesia, kreator trading kecil, mentor, grup belajar SMC/ICT, dll.) beserta KATA KUNCI PENCARIAN untuk menemukannya di Telegram, Facebook, Instagram, YouTube — jangan sebut nama grup/akun spesifik; (B) 2 draf pesan kolaborasi/affiliate (maksimal 90 kata, sopan, jelas manfaat buat mereka, tanpa janji komisi spesifik); (C) 1 draf postingan komunitas yang bermanfaat dan tidak terasa spam. Semua dikirim MANUAL oleh Bos.',
      () => 'Susun paket outbound minggu ini.', 2200),
  },
  {
    id: 'gh:experiment', role: 'gh', kind: 'experiment', label: 'Eksperimen akuisisi mingguan', who: 'GH Farhan', weekdays: [2],
    build: llmJob('gh',
      'Kamu Farhan, Growth Hacker Luxtradee. Rancang SATU eksperimen akuisisi untuk minggu ini (bukan tiga). Isi: Hipotesis; Langkah konkret (maksimal 5); Metrik keberhasilan dengan ambang LANJUT dan ambang STOP; Estimasi effort; Alasan dipilih dibanding alternatif. Daftar output sebelumnya adalah buku catatan eksperimenmu — jangan ulangi eksperimen yang sama; kalau perlu, lanjutkan yang sebelumnya dengan variasi.',
      () => 'Rancang eksperimen minggu ini.', 1800),
  },
  {
    id: 'cmo:seo-article', role: 'cmo', kind: 'seo-article', label: 'Artikel SEO mingguan', who: 'CMO Sinta', weekdays: [3],
    build: llmJob('cmo',
      'Kamu Sinta, CMO Luxtradee. Tulis 1 artikel blog SEO bahasa Indonesia (600–800 kata) untuk topik long-tail yang dicari trader XAUUSD pemula–menengah dan BELUM pernah kamu tulis. Sertakan di awal isi: meta description (maksimal 155 karakter) dan slug, lalu artikel dengan struktur H2/H3, akhiri CTA lembut ke luxtradee.web.id. Tanpa janji profit, tanpa angka karangan, bahasa natural (bukan terjemahan kaku).',
      () => 'Tulis artikel minggu ini.', 3000),
  },
  {
    id: 'cto:seo-audit', role: 'cto', kind: 'seo-audit', label: 'Audit SEO teknis', who: 'CTO Raka', weekdays: [4],
    build: seoAudit,
  },
  {
    id: 'kevin:seeding', role: 'kevin', kind: 'seeding', label: 'Community seeding', who: 'Growth Kevin', weekdays: [5],
    build: llmJob('gh',
      'Kamu Kevin, Growth Hunter Luxtradee. Tulis 3 draf JAWABAN BERMANFAAT untuk pertanyaan umum trader XAUUSD di forum/grup (mis. cara evaluasi trade, kenapa sering kena stop loss, cara menjaga daily loss). Untuk tiap draf tulis: pertanyaan khas yang dijawab, lalu jawaban 60–100 kata yang MURNI edukasi. Jangan promosi; soft mention Luxtradee hanya boleh 1 kalimat dan hanya bila benar-benar relevan. Bos akan memposting manual dan wajib mengikuti aturan grup masing-masing.',
      () => 'Buat 3 draf jawaban minggu ini.', 1800),
  },
]

async function loadIndex(d: PhaseDeps): Promise<ArtifactMeta[]> {
  try {
    const arr = JSON.parse((await d.kvGet('art:index')) || '[]')
    return Array.isArray(arr) ? (arr as ArtifactMeta[]) : []
  } catch { return [] }
}

export interface WorkResult {
  weekday: number
  phase: Phase
  scheduled: string[]
  made: string[]
  skipped: string[]
  failed: string[]
}

/**
 * Jalankan jadwal kerja hari ini (WIB). Dedup per job per hari.
 * opts.only = id job tertentu (tombol manual), opts.force = abaikan dedup.
 */
export async function runDailyWork(d: PhaseDeps, info: PhaseInfo, opts: { only?: string; force?: boolean } = {}): Promise<WorkResult> {
  const day = d.wibDay()
  const wd = wibWeekday()
  const todays = JOBS.filter((j) => (opts.only ? j.id === opts.only : j.weekdays.includes(wd)))
  const index = await loadIndex(d)
  const mem = todays.length ? await d.memBlock().catch(() => '') : ''
  const made: ArtifactMeta[] = []
  const skipped: string[] = []
  const failed: string[] = []

  await Promise.all(todays.map(async (job) => {
    try {
      const doneKey = `work:done:${job.id}:${day}`
      if (!opts.force && (await d.kvGet(doneKey).catch(() => null))) { skipped.push(`${job.id} (sudah dikerjakan hari ini)`); return }
      const recent = index.filter((a) => a.role === job.role && a.kind === job.kind).slice(0, 10).map((a) => a.title)
      const out = await job.build({ d, info, recentTitles: recent, mem })
      if (!out) { failed.push(`${job.id}: model tidak menghasilkan format yang valid`); return }
      const id = `${job.role}-${job.kind}-${day}`
      await d.kvSet(`art:body:${id}`, out.body)
      made.push({
        id, role: job.role, kind: job.kind, label: job.label, title: out.title,
        preview: out.body.replace(/\s+/g, ' ').slice(0, 160), at: new Date().toISOString(), who: job.who,
      })
      await d.kvSet(doneKey, '1').catch(() => false)
      await d.mem(job.who, `Artefak ${job.label}: ${out.title}`).catch(() => {})
    } catch (x) {
      failed.push(`${job.id}: ${String((x as Error)?.message || x).slice(0, 90)}`)
    }
  }))

  if (made.length) {
    const next = [...made, ...index.filter((a) => !made.some((m) => m.id === a.id))].slice(0, 30)
    await d.kvSet('art:index', JSON.stringify(next)).catch(() => false)
    await d.notify(
      `📦 **ARTEFAK BARU (${made.length}) — siap dipakai Bos di Kantor CEO**\n` +
      made.map((m) => `• ${ROLE_NAME[m.role] || m.role} — ${m.label}: ${m.title}`).join('\n') +
      '\n_(draf untuk dikirim/diposting MANUAL oleh Bos — buka panel artefak di ruangan karyawan terkait)_',
    ).catch(() => {})
  }
  return { weekday: wd, phase: info.phase, scheduled: todays.map((j) => j.id), made: made.map((m) => m.id), skipped, failed }
}

/* ============================================================
   5. BRIEFING SINGKAT (pre-launch, bukan Senin) — tanpa panggilan LLM.
   Prioritas harian (NBA) dikirim sebagai pesan terpisah oleh nextBestAction.
   ============================================================ */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function buildCompactBriefing(p: { dateLine: string; info: PhaseInfo; cto: any; cso: any; cfo: any; cmo: any; nbaLine: string }): string {
  const f = (n: unknown) => (typeof n === 'number' && n >= 0 ? n.toLocaleString('id-ID') : '—')
  const L: string[] = []
  L.push(' **BRIEFING SINGKAT — LUXTRADE** (fase pre-launch)')
  L.push(` ${p.dateLine} · 08:00 WIB`)
  L.push('━━━━━━━━━━━━━━━━━━')
  L.push(` Target: ${LAUNCH_TARGET_USERS} user pertama — sekarang ${f(p.info.users)}/${LAUNCH_TARGET_USERS} (trade 7 hari: ${f(p.info.trades7d)})`)
  L.push(p.cto?.siteOk
    ? ` Situs:  ${p.cto.status} OK (${p.cto.latencyMs} ms) · bug 24 jam: ${p.cto.bugs24h >= 0 ? p.cto.bugs24h : 'gagal diambil'}`
    : ` Situs:  DOWN (${p.cto?.status || 'timeout'}) · bug 24 jam: ${p.cto?.bugs24h >= 0 ? p.cto.bugs24h : '?'}`)
  L.push(` Pendaftar: ${f(p.cso?.total)} · aktif 24 jam: ${f(p.cso?.active)}`)
  L.push(p.cmo?.draft ? ' Draf konten hari ini: siap (3 pilihan di Ruang CMO)' : 'Draf konten hari ini: belum ada ')
  if (p.cfo?.usedToday > 0) L.push(`Kuota Gemini: ${f(p.cfo.usedToday)}/${f(p.cfo.limit)} · ${p.cfo.status || '-'}`)
  if (p.nbaLine) { L.push('━━━━━━━━━━━━━━━━━━'); L.push(p.nbaLine) }
  L.push('━━━━━━━━━━━━━━━━━━')
  L.push('Briefing penuh tiap Senin. Artefak mingguan (kalender konten, artikel SEO, paket outbound, audit SEO, dll.) masuk sebagai pesan terpisah.')
  return L.join('\n')
}
