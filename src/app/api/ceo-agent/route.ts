// app/api/ceo-agent/route.ts — LUXTRADE SUPER AI AGENT (Ruang CEO)
// Next.js API Route · target deploy: Cloudflare Workers (OpenNext)
// Fetch native. TANPA Vercel AI SDK. TANPA Hono. TANPA node-fetch.
// Auth: header "Authorization: Bearer ADMIN_SECRET" atau ?key=CRON_SECRET
// Cron 08:00 WIB: Cloudflare cron trigger (worker-entry.ts) → /api/ceo-agent?action=briefing&key=CRON_SECRET
// (cron-job.org TIDAK diperlukan lagi — semua otomatis lewat trigger Workers bawaan)
// ARSITEKTUR MULTI-AGENT (SOP Bos): tiap karyawan pakai model OpenRouter
// sendiri. Task 35: katalog lama dipensiunkan OpenRouter (llama-3.1-8b:
// free, gemma-2-9b:free, qwen-2.5-coder, glm-4.7-flash, glm-4-flash semuanya
// 404 — dulu inilah penyebab "semua karyawan jadi templat"). Kini dipakai
// model GRATIS yang hidup (diverifikasi katalog OpenRouter): Gemma 4 &
// Nemotron 3.5. Putri CFO TETAP tanpa LLM (murni matematika).
// ============================================================
// Tabel Supabase yang dipakai (skema produksi Luxtradee — lihat
// prisma/schema.prisma):
//  profiles    → data user (email, created_at, is_pro, …)
//  trades      → upload jurnal trading (user_id, created_at) — basis "user aktif"
//  bug_reports → laporan bug dari user (created_at, status) — basis CTO
//  agent_kv    → KV internal (supabase-migrations/012_create_agent_kv.sql)
// ============================================================
// NOTE: No runtime = 'edge' — OpenNext limitation for API routes.
// Seluruh app sudah berjalan di Cloudflare Workers (edge) via OpenNext,
// route ini pun otomatis jalan di Worker yang sama. Semua API yang dipakai
// (fetch, AbortController, Intl) Workers-compatible.
import { metaAutoPost, metaDiag, type MetaPostResult } from '@/lib/meta-post'
import { bagasCooldownSince, bagasCooldownOrFilter, emailsFromActionRows, contactsFromTaskRows, normEmail } from '@/lib/bagas-cooldown'
import { callMorteraDirect } from '@/lib/ai-llm'
import { harnessWrap } from '@/lib/harness-prompt'
import {
  getPhase, runDailyWork, tickDailyWork, currentLaunchStep, advanceLaunchStep, buildCompactBriefing,
  wibWeekday, type PhaseDeps,
} from '@/lib/ceo-phase'
export const dynamic = 'force-dynamic'

interface Env { [k: string]: string | undefined }

/* Nilai secret dari dashboard kadang ke-paste dgn tanda kutip/spasi → 401.
   Bersihkan dulu sebelum dipakai. */
const cleanEnv = (v: string | undefined) =>
  (v || '').trim().replace(/^["']+|["']+$/g, '')

/* Baca secret dari process.env dulu, lalu fallback binding CF Workers
   (OpenNext context) — kadang secret dashboard tidak masuk process.env
   tapi tetap tersedia di env Worker. Dipakai diag & email-test. */
function cfSecret(e: Env, name: string): string {
  const v = cleanEnv((e as Record<string, string | undefined>)[name])
  if (v) return v
  try {
    const sym = Symbol.for('__cloudflare-context__')
    const ctx = (globalThis as Record<symbol, unknown>)[sym] as { env?: Record<string, string> } | undefined
    return cleanEnv(ctx?.env?.[name]) || ''
  } catch { return '' }
}

/* PENTING (fix briefing cron "—"/gagal diambil): NEXT_PUBLIC_* direferensikan
   LANGSUNG di sini supaya Next.js meng-inline nilainya saat BUILD. Akses
   dinamis process.env[...] di Cloudflare Workers hanya membaca runtime
   binding — kalau key cuma diset di Build settings (bukan Variables &
   Secrets), cron kehilangan kunci Supabase padahal situs normal-normal saja
   (bundle browser ter-inline saat build). Urutan fallback: runtime secret →
   NEXT_PUBLIC runtime → nilai inline build. */
const INLINED_SB_URL: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL
const INLINED_SB_KEY: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const SITE_URL = 'https://luxtradee.web.id'
const EMAIL_FROM = 'LuxTradee <noreply@luxtradee.web.id>'
const ANGLES = [
  'Pain point trader XAUUSD yang belajar SMC/ICT — pusing struktur, liquidity, FVG, killer zone, tapi akun tetap kena MC.',
  'Kelelahan ngetik jurnal trading manual setiap hari — males, gak konsisten, gak tahu harus evaluasi apa.',
  'Cara menjaga max daily loss prop firm dengan evaluasi visual — screenshot chart + penandaan.',
]

/* PILAR KONTEN 7 HARI (rotasi harian, indeks = hari WIB 0=Minggu) —
   spec perbaikan kantor AI: draf Sinta saat pre-launch berbasis edukasi
   trading umum + rotasi tema, BUKAN analisis data user yang belum ada. */
const CMO_PILLARS: { name: string; task: string }[] = [
  { name: 'recap-mingguan', task: 'rekap pelajaran minggu ini: kesalahan umum trader XAUUSD & pelajaran yang bisa diambil' },
  { name: 'edukasi', task: 'satu konsep edukasi (struktur pasar, risk-reward, atau jurnal) dijelaskan sederhana dalam 30 detik' },
  { name: 'mitos-trading', task: 'bongkar satu mitos trading yang bikin pemula rugi' },
  { name: 'demo-fitur', task: 'demo alur Luxtradee: upload screenshot → evaluasi AI muncul (tunjukkan proses, bukan jualan)' },
  { name: 'psikologi', task: 'psikologi trading: FOMO / revenge trading / takut cut loss — kenapa terjadi & cara mengendalikan' },
  { name: 'poll-engagement', task: 'pertanyaan interaktif untuk kolom komentar: pengalaman trader Indonesia soal topik hari ini' },
  { name: 'behind-the-scenes', task: 'behind the scenes membangun Luxtradee: proses, keputusan, pembelajaran (tanpa janji profit)' },
]

/* ---------- util ---------- */
function timeoutSignal(ms: number): AbortSignal {
  const c = new AbortController()
  setTimeout(() => c.abort(), ms)
  return c.signal
}

/* Tugas lanjutan SETELAH response dikirim (fase 2 briefing) — di CF Workers
   dipasang ke waitUntil supaya tidak dibatalkan saat response selesai;
   di luar CF (dev lokal) promise jalan apa adanya (fire-and-forget). */
function cfWaitUntil(p: Promise<unknown>): boolean {
  try {
    const sym = Symbol.for('__cloudflare-context__')
    const c = (globalThis as Record<symbol, unknown>)[sym] as
      | { ctx?: { waitUntil?: (x: Promise<unknown>) => void } }
      | undefined
    if (c?.ctx?.waitUntil) { c.ctx.waitUntil(p); return true }
  } catch { /* ignore */ }
  return false
}

/* ── SELF-FETCH — panggil worker INI sendiri tanpa lewat edge/DNS publik ──
   Bukti produksi (CF observability 2026-11-06): fetch dari DALAM worker ke
   https://luxtradee.web.id/... dibalas 522 oleh edge CF (loop-back gagal) —
   cron briefing & fase-2 briefing-extras pernah mati karena ini.
   Service binding SELF (wrangler.jsonc "services") memanggil handler worker
   yang sama secara LANGSUNG — respons identik dengan request publik
   (200/401/404), tanpa 522, tanpa latensi internet.
   Fallback fetch publik hanya saat binding tak tersedia (dev lokal). */
let _selfFetchFn: ((u: string, init?: RequestInit) => Promise<Response>) | null | undefined
async function selfFetch(u: string, init?: RequestInit): Promise<Response> {
  if (_selfFetchFn === undefined) {
    _selfFetchFn = null
    try {
      /* 1) Context worker-entry.ts — dipasang sebelum OpenNext (paling andal) */
      const sym = Symbol.for('__cloudflare-context__')
      const c = (globalThis as Record<symbol, unknown>)[sym] as
        | { env?: { SELF?: { fetch: (inp: RequestInfo | URL, i?: RequestInit) => Promise<Response> } } }
        | undefined
      if (c?.env?.SELF && typeof c.env.SELF.fetch === 'function') {
        _selfFetchFn = c.env.SELF.fetch.bind(c.env.SELF)
      }
    } catch { /* coba cara 2 */ }
    if (!_selfFetchFn) {
      try {
        /* 2) getSelfFetch() — getCloudflareContext via OpenNext */
        const { getSelfFetch } = await import('@/lib/cloudflare-bindings')
        _selfFetchFn = await getSelfFetch()
      } catch { /* tetap null → fallback fetch publik */ }
    }
    if (!_selfFetchFn) {
      console.warn('[selfFetch] binding SELF tidak tersedia — fallback fetch publik (produksi berisiko 522)')
    }
  }
  return _selfFetchFn ? _selfFetchFn(u, init) : fetch(u, init)
}

/* Batas waktu keras 1 langkah via Promise.race — langkah yang lambat tidak
   lagi ditunggu (dipakai compose Alexander biar briefing tidak menumpuk
   timeout cron 120 dtk). */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T | null): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms)
    p.then((v) => { clearTimeout(t); resolve(v) }).catch(() => { clearTimeout(t); resolve(fallback) })
  })
}
const isoAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
/* Task 35g (akar komplain Bos: "sudah update data tapi kantor masih tampil kerjaan lama"):
   dulu key harian pakai tanggal UTC — padahal Bos & semua user di WIB (UTC+7).
   Jam 00:00–06:59 WIB, tanggal UTC masih "kemarin" → draf CMO / briefing /
   verdict NBA / csmailed semuanya baca key KEMARIN → kantor tampil kerjaan lama
   padahal hari sudah ganti. Kini SEMUA key harian pakai tanggal WIB. */
const wibDay = (off = 0) => new Date(Date.now() + 7 * 3600_000 + off * 86400_000).toISOString().slice(0, 10)
const dayIndex = () => Math.floor(Date.now() / 86400_000)
const fmtN = (n: number) => (n >= 0 ? n.toLocaleString('id-ID') : '—')
const wibNow = () =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date())
const env = () => process.env as Env

function sbUrl(e: Env) {
  // URL project DIPATOK (env atau fallback yang sama dgn src/lib/api-auth.ts)
  // — tidak boleh bisa diganti dari luar, kalau tidak email-gate bisa dipalsukan
  return (cleanEnv(e.SUPABASE_URL || e.NEXT_PUBLIC_SUPABASE_URL || INLINED_SB_URL) || 'https://klxkdrfsfcoankbaoejn.supabase.co').replace(/\/$/, '')
}
function sbAnonKey(e: Env) {
  return cleanEnv(e.SUPABASE_ANON_KEY || e.NEXT_PUBLIC_SUPABASE_ANON_KEY || INLINED_SB_KEY)
}
/* Service role key — bypass RLS untuk CEO agent (baca profiles/trades/bug_reports
   tanpa diblok policy anon). Ambil dari env SUPABASE_SERVICE_ROLE_KEY.
   Kalau belum diset, fallback ke anon key (data tertentu akan 401). */
function sbServiceKey(e: Env) {
  return cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY) || sbAnonKey(e)
}
function ownerEmail(e: Env) {
  return (cleanEnv(e.OWNER_EMAIL) || 'luxtradee@gmail.com').toLowerCase()
}
/* ---------- verifikasi token login Supabase (email-gate CEO) ----------
   Token Bearer dari sesi login user → GET /auth/v1/user → cocokkan email. */
async function verifyOwnerToken(e: Env, token: string): Promise<boolean> {
  if (!sbUrl(e) || !sbAnonKey(e) || !token) return false
  try {
    const res = await fetch(`${sbUrl(e)}/auth/v1/user`, {
      headers: { apikey: sbAnonKey(e), Authorization: `Bearer ${token}` },
      signal: timeoutSignal(10_000),
    })
    if (!res.ok) return false
    const user = (await res.json()) as { email?: string }
    return (user?.email || '').toLowerCase().trim() === ownerEmail(e)
  } catch { return false }
}

/* ---------- KV berbasis tabel Supabase "agent_kv" ----------
   (jalankan SQL create table agent_kv sekali di Supabase — lihat
    supabase-migrations/012_create_agent_kv.sql)
   Akses WAJIB service_role sejak migrasi 027 (lockdown client): grant
   anon/authenticated ke agent_kv dicabut TOTAL — baca & tulis anon
   dibalas 401 (bukti: CF observability 2026-11-06). */
async function kvGet(e: Env, key: string): Promise<string | null> {
  const res = await fetch(
    `${sbUrl(e)}/rest/v1/agent_kv?select=value&key=eq.${encodeURIComponent(key)}`,
    { headers: sbHPriv(e), signal: timeoutSignal(10_000) },
  )
  if (!res.ok) {
    console.warn(`[kvGet] baca agent_kv "${key.slice(0, 48)}" → HTTP ${res.status}` +
      (res.status === 401 ? ' — set/cek SUPABASE_SERVICE_ROLE_KEY di Cloudflare Secrets (anon diblokir sejak migrasi 027)' : ''))
    return null
  }
  const rows = (await res.json()) as { value?: string }[]
  return rows[0]?.value ?? null
}
async function kvSet(e: Env, key: string, value: string): Promise<boolean> {
  /* TULIS agent_kv WAJIB service_role. Bukti produksi (CF observability
     2026-11-06): POST /rest/v1/agent_kv → 401 "new row violates row-level
     security policy" — upsert dulu pakai anon. Migrasi 027 me-REVOKE semua
     grant client ke agent_kv; hanya service_role (BYPASSRLS) yang boleh.
     FIX ANTI-FLOOD (Bos 6 Nov: "kenapa masih dapet alert?"): return boolean
     sukses/gagal — dulu kegagalan tulis DISENYAPIKAN (cuma console.error),
     watchdog mengira counter heal & briefing:done sudah tersimpan → briefing
     dipicu ulang tanpa batas tiap 15 menit. Caller kritis WAJIB cek return. */
  const res = await fetch(`${sbUrl(e)}/rest/v1/agent_kv?on_conflict=key`, {
    method: 'POST',
    headers: { ...sbHPriv(e), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key, value }),
    signal: timeoutSignal(10_000),
  })
  if (!res.ok) {
    console.error(`[kvSet] upsert agent_kv "${key.slice(0, 48)}" → HTTP ${res.status}` +
      (res.status === 401 ? ' — set/cek SUPABASE_SERVICE_ROLE_KEY di Cloudflare Secrets (anon diblokir sejak migrasi 027)' : ''))
    return false
  }
  return true
}
async function kvIncr(e: Env, key: string): Promise<number> {
  const cur = parseInt((await kvGet(e, key)) || '0', 10)
  const ok = await kvSet(e, key, String(cur + 1))
  /* ANTI-FLOOD: tulisan gagal → THROW. Caller kritis (self-heal briefing)
     pakai ini sebagai syarat mutlak; caller opsional pakai .catch(() => {}). */
  if (!ok) throw new Error(`agent_kv write gagal "${key.slice(0, 48)}" — counter/dedup tidak persist`)
  return cur + 1
}
/* Hapus kunci kv (service_role — RLS anon biasanya tidak punya DELETE).
   Task 35-e JUJUR: kini return jumlah baris yang BENAR-BENAR terhapus
   (Prefer: return=representation) — dulu diam-diam "sukses" walau 0
   terhapus, bikin reset-work melapor "7 dibersihkan" yang belum tentu. */
async function kvDel(e: Env, key: string): Promise<number> {
  try {
    const res = await fetch(`${sbUrl(e)}/rest/v1/agent_kv?key=eq.${encodeURIComponent(key)}&select=key`, {
      method: 'DELETE', headers: { ...sbHPriv(e), Prefer: 'return=representation' }, signal: timeoutSignal(10_000),
    })
    if (!res.ok) return 0
    const rows = (await res.json().catch(() => [])) as unknown[]
    return Array.isArray(rows) ? rows.length : 0
  } catch { return 0 }
}

/* ---------- Supabase headers ---------- */
/* sbH = anon key — hanya untuk endpoint publik Supabase (auth/v1, tabel yang
   memang ber-policy anon). agent_kv TIDAK bisa anon lagi (REVOKE migrasi
   027) — aksesnya wajib sbHPriv. */
function sbH(e: Env) {
  return { apikey: sbAnonKey(e), Authorization: `Bearer ${sbAnonKey(e)}` }
}
/* sbHPriv = service_role key — bypass RLS, untuk CEO agent baca profiles/trades/bug_reports.
   FIX Bos 6 Nov: apikey WAJIB service_role juga (dulu apikey=anon) — kalau anon key
   dirotasi/dihapus di dashboard Supabase, request admin ikutan HTTP 401 "Invalid API
   key" padahal service_role sehat (persis gejala briefing: bug_reports & trades 401).
   supabase-js admin client juga begitu: apikey = Authorization = service key. */
function sbHPriv(e: Env) {
  const sk = sbServiceKey(e)
  return { apikey: sk, Authorization: `Bearer ${sk}` }
}
async function supaCount(e: Env, table: string, filters = ''): Promise<number> {
  const url = `${sbUrl(e)}/rest/v1/${table}?select=*&limit=1${filters ? '&' + filters : ''}`
  /* Gunakan service_role key untuk tabel yang butuh bypass RLS.
     agent_kv juga wajib service_role sejak migrasi 027 (REVOKE client).
     profiles/trades/bug_reports + ai_pending_actions (tabel sistem,
     TANPA policy anon) → wajib service_role.
     Task 35-e pelajaran dari Bos: reset-work dulu COUNT ai_pending_actions
     pakai anon → 401, padahal key sehat semua (dashboard & antrean proposal
     jalan normal). Pesan "key salah/expired" yang lama MENYESATKAN. */
  const usePriv = ['profiles', 'trades', 'bug_reports', 'ai_pending_actions'].includes(table)
  const res = await fetch(url, { headers: { ...(usePriv ? sbHPriv(e) : sbH(e)), Prefer: 'count=exact' }, signal: timeoutSignal(10_000) })
  if (!res.ok) {
    const hint = res.status === 401
      ? (usePriv
        ? (!cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY)
          ? ' — service_role belum diset (fallback anon diblokir RLS). Set SUPABASE_SERVICE_ROLE_KEY di Cloudflare Secrets (Supabase → Settings → API → service_role secret)'
          : ' — service_role DITOLAK Supabase untuk tabel ini (key salah/expired/di-rotasi — cek Supabase → Settings → API)')
        : ' — anon key ditolak untuk tabel ini (RLS anon tidak punya policy / key salah). Tabel sistem wajib lewat service_role')
      : res.status === 404
        ? ` — tabel "${table}" tidak ada`
        : ''
    throw new Error(`Supabase ${table} HTTP ${res.status}${hint}`)
  }
  const cr = res.headers.get('content-range') || '' // "0-0/1240" atau "*/0"
  const total = parseInt(cr.split('/')[1] || '', 10)
  if (!Number.isFinite(total)) throw new Error(`content-range tidak terbaca: "${cr}"`)
  return total
}

/* Task 32 — ATURAN ANTI-HALUSINASI (SOP Bos): semua agen WAJIB berangkat
   dari DATA NYATA yang disuntikkan ke prompt; angka di luar blok data
   dilarang keras. Prompt agen kini selalu diawali query data → LLM. */
const REAL_DATA_RULE = 'ATURAN ANTI-HALUSINASI WAJIB: semua angka/fakta HANYA boleh diambil dari blok "DATA NYATA" di prompt ini — DILARANG mengarang/menebak angka, nama, atau status. Kalau data tidak tersedia, katakan datanya tidak tersedia.'

/* ============================================================
   PUTRI (CFO) — PnL NYATA dari tabel trades (Task 32 SOP Bos):
   query Supabase DULU → matematika MURNI di Next.js (sum, win rate,
   pair teratas, best/worst). TANPA LLM = mustahil halusinasi angka.
   Gagal koneksi → err terisi, angka TIDAK dikarang.
   ============================================================ */
interface PnlStats { trades: number; pnl: number; wins: number; winRatePct: number; topPair: string; best: number; worst: number; err: string }

async function computePnl(e: Env, sinceIso: string): Promise<PnlStats> {
  const empty: PnlStats = { trades: 0, pnl: 0, wins: 0, winRatePct: 0, topPair: '', best: 0, worst: 0, err: '' }
  try {
    const url = `${sbUrl(e)}/rest/v1/trades?select=profit_loss,symbol&close_time=gte.${encodeURIComponent(sinceIso)}&order=close_time.desc&limit=2000`
    const res = await fetch(url, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
    if (!res.ok) return { ...empty, err: `trades HTTP ${res.status}` }
    const rows = (await res.json()) as { profit_loss?: number | null; symbol?: string | null }[]
    let pnl = 0, wins = 0, best = 0, worst = 0, counted = 0
    const sym: Record<string, number> = {}
    for (const r of rows) {
      const pl = typeof r.profit_loss === 'number' ? r.profit_loss : null
      if (pl === null) continue
      counted++
      pnl += pl
      if (pl > 0) wins++
      if (pl > best) best = pl
      if (pl < worst) worst = pl
      const s = String(r.symbol || '').toUpperCase().trim()
      if (s) sym[s] = (sym[s] || 0) + 1
    }
    if (!counted) return empty
    const topPair = Object.entries(sym).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
    return {
      trades: counted,
      pnl: Math.round(pnl * 100) / 100,
      wins,
      winRatePct: Math.round((wins / counted) * 100),
      topPair,
      best: Math.round(best * 100) / 100,
      worst: Math.round(worst * 100) / 100,
      err: '',
    }
  } catch (x: any) {
    return { ...empty, err: String(x?.message || x).slice(0, 100) }
  }
}

function pnlLine(p: PnlStats | null | undefined): string {
  if (!p || p.err) return '• 💹 PnL komunitas: gagal dihitung ⚠️'
  if (!p.trades) return '• 💹 PnL komunitas 24 jam: belum ada trade yang ditutup'
  return `• 💹 PnL komunitas 24 jam: ${p.pnl >= 0 ? '+' : ''}${p.pnl} dari ${fmtN(p.trades)} trade (win rate ${p.winRatePct}%${p.topPair ? ` · pair teratas ${p.topPair}` : ''})`
}

/* ============================================================
   MEMORI KANTOR — memori bersama antar semua agen (agent_kv).
   Setiap karyawan yang baru menarik kesimpulan MENULISnya di sini;
   prompt karyawan lain memuat catatan terbaru → tim belajar
   bersama (CMO tahu temuan Dewi, COO tahu hasil email CSO, dst).

   MEMORI PRIBADI (baru) — selain memori kantor bersama, SETIAP
   karyawan punya memori sendiri `mem:agent:<key>` (maks 20 catatan,
   teks lebih panjang). Prompt tiap karyawan menyuntikkan memori
   pribadinya → karyawan INGET kerjaan, keputusan & hasilnya sendiri
   di hari-hari sebelumnya (tidak mulai kerja dari nol setiap cron).
   ============================================================ */
interface MemEntry { at: string; who: string; text: string }

/* Map penulis → kunci memori pribadi karyawan */
const WHO_AGENT_KEY: Record<string, string> = {
  'CMO Sinta': 'cmo', 'CEO Alexander': 'ceo', 'CSO Maya': 'cso', 'CTO Raka': 'cto',
  'DA Dewi': 'da', 'GH Farhan': 'gh', 'CFO Putri': 'cfo', 'COO Bagas': 'coo',
  'Maya × Sinta': 'cso',
  /* Kevin (Growth Hunter — growth-sentinel + comment-hunter) nulis memori
     langsung dari route cron-nya dengan who 'Growth Kevin' — dipetakan ke
     sini supaya kartu karyawannya di Kantor CEO punya memori pribadi. */
  'Growth Kevin': 'kevin',
}
const AGENT_MEM_KEYS = ['coo', 'cto', 'cso', 'cmo', 'cfo', 'ceo', 'da', 'gh', 'kevin']
const AGENT_MEM_MAX = 20

async function memAdd(e: Env, who: string, text: string): Promise<void> {
  try {
    const clean = String(text).replace(/\s+/g, ' ').trim().slice(0, 190)
    let list: MemEntry[] = []
    try { list = JSON.parse((await kvGet(e, 'mem:list')) || '[]') } catch { /* reset kalau korup */ }
    const entry: MemEntry = { at: new Date().toISOString(), who, text: clean }
    list.unshift(entry)
    await kvSet(e, 'mem:list', JSON.stringify(list.slice(0, 24))).catch(() => {})
    /* Dual-write ke memori pribadi karyawan penulis — karyawan ingat kerjaannya sendiri */
    const ak = WHO_AGENT_KEY[who]
    if (ak) {
      const personal: MemEntry = { ...entry, text: String(text).replace(/\s+/g, ' ').trim().slice(0, 240) }
      let own: MemEntry[] = []
      try { own = JSON.parse((await kvGet(e, `mem:agent:${ak}`)) || '[]') } catch { /* reset */ }
      own.unshift(personal)
      await kvSet(e, `mem:agent:${ak}`, JSON.stringify(own.slice(0, AGENT_MEM_MAX))).catch(() => {})
    }
  } catch { /* memori opsional — jangan ganggu alur utama */ }
}

async function memList(e: Env): Promise<MemEntry[]> {
  try { return JSON.parse((await kvGet(e, 'mem:list')) || '[]') as MemEntry[] } catch { return [] }
}

/* Memori pribadi per karyawan (dipakai kartu detail karyawan & prompt LLM) */
async function agentMemList(e: Env, agent: string): Promise<MemEntry[]> {
  try { return JSON.parse((await kvGet(e, `mem:agent:${agent}`)) || '[]') as MemEntry[] } catch { return [] }
}

/* Blok teks buat prompt LLM — karyawan jadi tahu temuan rekan kerja */
async function memBlock(e: Env, max = 8): Promise<string> {
  const list = await memList(e)
  if (!list.length) return ''
  return '\nMEMORI KANTOR (catatan terbaru dari rekan kerja — pertimbangkan ini, JANGAN ulangi kesimpulan yang sama persis):\n' +
    list.slice(0, max).map((m) => `- [${(m.at || '').slice(5, 10)} ${m.who}] ${m.text}`).join('\n')
}

/* Blok MEMORI PRIBADI buat prompt LLM — karyawan ingat hasil kerjanya
   sendiri sebelumnya → output baru mengembangkan, bukan mengulang. */
async function agentMemBlock(e: Env, agent: string, max = 6): Promise<string> {
  const list = await agentMemList(e, agent)
  if (!list.length) return ''
  return `\nMEMORI PRIBADIMU (hasil kerjamu sendiri sebelumnya — JANGAN ulangi output lama; kembangkan, perbaiki, atau bandingkan hasilnya):\n` +
    list.slice(0, max).map((m) => `- [${(m.at || '').slice(5, 10)}] ${m.text}`).join('\n')
}

/* ============================================================
   AGEN 1 — CTO (IT & QA): ping situs + bug report 24 jam
   ============================================================ */
function siteStatusNote(status: number): string {
  return String(status)
}
void siteStatusNote

async function ctoAgent(e: Env) {
  const ping = async () => {
    const t0 = Date.now()
    try {
      const res = await selfFetch(SITE_URL, { method: 'GET', redirect: 'follow', signal: timeoutSignal(15_000) })
      return { status: res.status, siteOk: res.ok, latencyMs: Date.now() - t0, err: '' }
    } catch (x: any) {
      return { status: 0, siteOk: false, latencyMs: Date.now() - t0, err: String(x?.message || x) }
    }
  }

  let site = await ping()
  if (!site.siteOk) {
    // self-ping ke domain publik kadang gagal sesaat (redeploy/edge hiccup) — retry 1x
    await new Promise((r) => setTimeout(r, 1500))
    const retry = await ping()
    if (retry.siteOk || !site.err) site = retry
  }

  // 521-524 = Cloudflare edge gagal hubungi "origin". Padahal route ini EKSEKUSI
  // DI DALAM Worker yang sama → kalau kita bisa jalan, situs pasti hidup.
  // Self-ping CF 5xx = false negative yang dikenal → anggap OK.
  let err = site.err
  if (!site.siteOk && [521, 522, 523, 524].includes(site.status)) {
    site.siteOk = true
    err = `${site.status} (self-ping CF diabaikan — Worker aktif, situs LIVE)`
  }

  let bugs24h = -1
  try { bugs24h = await supaCount(e, 'bug_reports', 'created_at=gte.' + isoAgo(24)) }
  catch (x: any) { err = err || String(x?.message || x) }
  /* riwayat watchdog hari ini (dicatat action=watchdog tiap 15 mnt) */
  let upToday = 0, downToday = 0
  try {
    upToday = parseInt((await kvGet(e, `up:${wibDay()}`)) || '0', 10)
    downToday = parseInt((await kvGet(e, `down:${wibDay()}`)) || '0', 10)
  } catch { /* ignore */ }
  return { title: 'CTO — IT & QA', siteOk: site.siteOk, status: site.status, latencyMs: site.latencyMs, bugs24h, upToday, downToday, err }
}

/* ============================================================
   AGEN 2 — CSO (Customer Success): pendaftar / aktif / pasif
   Basis data: profiles (total) + trades 24 jam (aktivitas upload).
   Tidak ada kolom last_upload_at di skema ini — "user aktif" =
   pemilik user_id yang muncul di trades dalam 24 jam terakhir.
   ============================================================ */
async function fetchActiveUserIds(e: Env, since: string): Promise<Set<string>> {
  /* Pakai service_role key — trades butuh bypass RLS */
  const res = await fetch(
    `${sbUrl(e)}/rest/v1/trades?select=user_id&created_at=gte.${encodeURIComponent(since)}&limit=1000`,
    { headers: sbHPriv(e), signal: timeoutSignal(10_000) },
  )
  if (!res.ok) throw new Error(`Supabase trades HTTP ${res.status}${res.status === 401 && !cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY) ? ' — set SUPABASE_SERVICE_ROLE_KEY' : ''}`)
  const rows = (await res.json()) as { user_id?: string }[]
  return new Set(rows.map((r) => r.user_id).filter(Boolean) as string[])
}

async function csoAgent(e: Env) {
  const since = isoAgo(24)
  const activeSet = await fetchActiveUserIds(e, since)
  const total = await supaCount(e, 'profiles')
  const passive = Math.max(0, total - activeSet.size)
  /* Feedback loop: user yang di-email CSO kemarin — berapa yang balik
     upload hari ini? (ID yang di-email disimpan di agent_kv saat kirim) */
  let emailed = 0, returned = 0
  try {
    const ids: string[] = JSON.parse((await kvGet(e, `csmailed:${wibDay(-1)}`)) || '[]')
    emailed = ids.length
    returned = ids.filter((id) => activeSet.has(id)).length
  } catch { /* ignore */ }
  /* ⭐ KEMAMPUAN BARU (SOP Bos) — SKOR RISIKO CHURN:
     user yang PERNAH upload dalam 30 hari terakhir tapi 3 hari terakhir
     diam = sedang meninggalkan produk → kandidat email win-back Maya.
     2 query agregat (bukan data pribadi) — gagal → 0, tidak pernah crash. */
  let churnRisk = 0
  try {
    const [everActive, nowActive] = await Promise.all([
      fetchActiveUserIds(e, isoAgo(24 * 30)),
      fetchActiveUserIds(e, isoAgo(24 * 3)),
    ])
    for (const id of everActive) if (!nowActive.has(id)) churnRisk++
  } catch { /* opsional */ }
  return { title: 'CSO — Customer Success', total, active: activeSet.size, passive, churnRisk, emailedYesterday: emailed, returnedYesterday: returned }
}

/* ============================================================
   AGEN 3 — CMO (Marketing & Copywriter AI): Gemini native REST
   v2: CMO menganalisis KONTEN TIKTOK ASLI dari tabel tiktok_posts
   (migrasi 014 — link + caption + views/likes diisi Bos lewat
   Ruang CMO) → draf meniru pola yang TERBUKTI perform di FYP.
   Kalau tabel masih kosong → fallback ke deskripsi gaya statis
   di env TIKTOK_REFERENCE (perilaku lama).
   ============================================================ */
function fallbackDraft(angle: string): string {
  return [
    '[DRAF CADANGAN — model AI gagal/error (bukan hasil AI), revisi manual]',
    'HOOK: "Trader XAUUSD, stop scroll 3 detik. Ini alasan akun lo bocor tiap minggu."',
    `ISI: ${angle}`,
    'SOLUSI: upload screenshot chart lo — biarkan evaluasi visualnya yang nuduhin kesalahan lo.',
    'CTA: "Coba gratis hari ini — link di bio." (durasi 30–40 detik)',
  ].join('\n')
}

/* 1 panggilan Gemini text. thinkingBudget: 0 — pelajaran fix
   auto-journal: thinking memakan maxOutputTokens → teks kosong. */
async function geminiText(e: Env, systemPrompt: string, userPrompt: string, maxTokens = 2048, temperature = 1.0): Promise<string> {
  const model = e.GEMINI_MODEL || 'gemini-2.5-flash'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(e.GEMINI_API_KEY || '')}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          ...(model.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
      signal: timeoutSignal(30_000),
    },
  )
  if (res.status === 429) {
    await kvIncr(e, `quota429:${wibDay()}`).catch(() => {}) // counter opsional — jangan timpa error 429 asli
    const x: any = new Error('Gemini 429 (rate limit)'); x.status = 429
    throw x
  }
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
  const data: any = await res.json()
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || '').join('').trim()
  if (!text) throw new Error('Gemini mengembalikan respons kosong')
  return text
}

/* ============================================================
   ALOKASI MODEL MULTI-AGENT (SOP Bos) — tiap karyawan punya model
   OpenRouter masing-masing sesuai keahliannya. Update Tahap T:
   ALEXANDER (CEO) dipindah dari google/gemma-4-31b-it:free ke
   nvidia/nemotron-3.5-lightning:free — alasan: 3 karyawan (Sinta
   CMO, Dewi DA, Alexander CEO) pakai gemma-4-31b yang sama di cron
   pagi 08:00 → berebut kuota :free 20 req/menit (OpenRouter shared
   capacity) → sering 429 → briefing jatuh ke templat "OTAK
   ALEXANDER OFFLINE". Nemotron Lightning lebih cepat (1M ctx, latensi
   ~333ms di diag Bos) & tidak tumpang tindih dengan CMO/DA.
   • Bagas  (COO)  → google/gemma-4-26b-a4b-it:free (route ai-coo-agent)
   • Raka   (CTO)  → nvidia/nemotron-3.5-lightning:free
   • Maya   (CSO)  → google/gemma-4-26b-a4b-it:free
   • Sinta  (CMO)  → google/gemma-4-31b-it:free (kreatif konten)
   • Putri  (CFO)  → TANPA LLM — murni matematika hardcoded
   • Alexander (CEO) → nvidia/nemotron-3.5-lightning:free (anti-429)
   • Dewi   (DA)   → google/gemma-4-31b-it:free (analisis data)
   • Farhan (GH)   → nvidia/nemotron-3.5-lightning:free
   Cadangan tim: Nemotron Ultra 550B → Xing 4.0.
   Override per karyawan tanpa ubah kode: env OR_MODEL_CTO (contoh).
   ============================================================ */
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions'
type AgentKey = 'coo' | 'cto' | 'cso' | 'cmo' | 'ceo' | 'da' | 'gh'
/* Task 35: model lama SEMUA 404 di OpenRouter (katalog dikurasi ulang —
   tinggal 16 model gratis). Verifikasi katalog: GET /api/v1/models.
   Pilihan hidup: Gemma 4 (31B/26B MoE — bahasa Indonesia bagus),
   Nemotron 3.5 Lightning (cepat, 1M ctx). Override per karyawan
   tetap bisa via env OR_MODEL_<AGENT> tanpa ubah kode. */
const AGENT_MODELS: Record<AgentKey, string> = {
  coo: 'google/gemma-4-26b-a4b-it:free',
  cto: 'nvidia/nemotron-3.5-lightning:free',
  cso: 'google/gemma-4-26b-a4b-it:free',
  cmo: 'google/gemma-4-31b-it:free',
  ceo: 'nvidia/nemotron-3.5-lightning:free',
  da: 'google/gemma-4-31b-it:free',
  gh: 'nvidia/nemotron-3.5-lightning:free',
}
/* Cadangan resmi seluruh tim (Task 35c — disaring dari data diag LIVE Bos):
   thinkingmachines/inkling:free DIBUANG — HTTP 403 (diblokir kebijakan
   OpenRouter, tidak pernah bisa dipakai). Xing 4.0 masih dicadangkan walau
   kadang 429 (kapasitas shared), Nemotron Ultra 550B terbukti paling sehat
   (333 ms di diag Bos). Kalau model utama 404/429 → chain turun ke sini. */
const OR_TEAM_FALLBACKS = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'xingchen-agi/xing4.0-29b-a4b:free',
]

/* ---------- Circuit breaker OpenRouter (Task 35c) ----------
   Model :free itu SHARED — Gemma 4 & Xing sering 429 karena kapasitas
   pemakaian BERSAMA semua user OpenRouter (bukan salah key/kita). Tanpa
   breaker, tiap agen tetap mencoba model yang lagi sakit → respons lambat
   & tim risiko jatuh ke templat. Solusi: model yang gagal 429/403/5xx
   ditandai "sick" di agent_kv selama 10 menit → di-skip (kecuali satu-
   satunya pilihan). Kunci kesehatan DIPAKAI BERSAMA semua layanan
   (agent-proposals orJson pakai konvensi kunci sama) → satu agen kena 429,
   seluruh tim langsung melompat ke model hidup. */
const OR_SICK_MS = 10 * 60_000
const orSickKey = (model: string) => `or:sick:${model}`

async function orSickMap(e: Env, models: string[]): Promise<Record<string, boolean>> {
  const entries = await Promise.all(models.map(async (m) => {
    try {
      const raw = await kvGet(e, orSickKey(m))
      const t = parseInt(raw || '0', 10)
      return [m, !!t && Date.now() - t < OR_SICK_MS] as const
    } catch { return [m, false] as const }
  }))
  return Object.fromEntries(entries)
}
async function orMarkSick(e: Env, model: string): Promise<void> {
  try { await kvSet(e, orSickKey(model), String(Date.now())) } catch { /* opsional — gagal breaker abaikan */ }
}
async function orMarkHealthy(e: Env, model: string): Promise<void> {
  try { await kvSet(e, orSickKey(model), '0') } catch { /* opsional */ }
}

function orChain(e: Env, agent: AgentKey): string[] {
  const override = cleanEnv(e[`OR_MODEL_${agent.toUpperCase()}`])
  /* Legacy env OPENROUTER_MODEL masih dihormati sebagai pilihan utama Sinta */
  const primary = override || (agent === 'cmo' ? cleanEnv(e.OPENROUTER_MODEL) : '') || AGENT_MODELS[agent]
  return [...new Set([primary, ...OR_TEAM_FALLBACKS])]
}

/* 1 panggilan OpenRouter — native fetch, kompatibel Cloudflare Workers.
   Coba model satu per satu sesuai chain; parsing standar OpenAI:
   result.choices?.[0]?.message?.content?.trim().
   ⏱️ timeoutMs per-model bisa dioper caller (agentBrain budget-aware):
   dulu 45 dtk PERMANEN × 3 model = 135 dtk — lebih besar dari seluruh
   anggaran compose (30-75 dtk) → model pertama gantung = jam dinding
   habis = TEMPLAT, model hidup di belakang tak pernah sempat dicoba. */
async function openRouterChat(e: Env, chain: string[], systemPrompt: string, userPrompt: string, maxTokens = 1024, temperature?: number, timeoutMs = 45_000): Promise<{ text: string; model: string }> {
  /* cfSecret: process.env dulu → fallback binding CF Workers (secret yang
     diset via dashboard kadang tidak masuk process.env — kalau cuma baca
     e.OPENROUTER_API_KEY, LLM gagal "belum diset" padahal key terpasang). */
  const orKey = cfSecret(e, 'OPENROUTER_API_KEY')
  if (!orKey) throw new Error('OPENROUTER_API_KEY belum diset — tambah di Cloudflare Workers Secrets')
  /* Circuit breaker: model sakit (429/403/5xx ≤10 mnt) di-skip — kalau SEMUA
     sakit, coba tetap semuanya (lebih baik mencoba daripada menyerah). */
  const sick = await orSickMap(e, chain)
  const order = chain.some((m) => sick[m]) && chain.some((m) => !sick[m]) ? chain.filter((m) => !sick[m]) : chain
  let lastErr = ''
  for (const model of order) {
    try {
      const res = await fetch(OR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${orKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
          ...(temperature !== undefined ? { temperature } : {}),
        }),
        signal: timeoutSignal(timeoutMs),
      })
      if (!res.ok) {
        lastErr = `${model} → HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 120)}`
        /* 429/403/5xx = model/shared-capacity sakit → tandai biar agen lain
           langsung melompat ke model hidup (hemat waktu & percobaan) */
        if ([429, 403, 500, 502, 503].includes(res.status)) await orMarkSick(e, model)
        continue
      }
      const result: any = await res.json()
      /* Task 35f: model REASONING (mis. Nemotron Lightning) sering menaruh
         teks di field `reasoning` dengan `content` kosong — dulu hanya baca
         content → Lightning selalu dianggap gagal walau jawab. Sekarang
         fallback: content ?? reasoning. */
      const msg = result?.choices?.[0]?.message || {}
      const text = String(msg.content ?? msg.reasoning ?? '').trim()
      if (!text) { lastErr = `${model} → respons kosong`; continue }
      await orMarkHealthy(e, model)
      return { text, model }
    } catch (x: any) {
      lastErr = `${model} → ${String(x?.message || x).slice(0, 120)}`
    }
  }
  /* Task 33 (permintaan Bos): error ASLI OpenRouter wajib tercetak di log
     server (Cloudflare `wrangler tail`) — dulu ditelan diam-diam sehingga
     saat dashboard jatuh ke templat cadangan, penyebabnya (429 kuota?
     500 server? timeout?) tidak bisa didiagnosa. */
  console.error('[OpenRouter] Semua model gagal - error asli terakhir:', lastErr || '(tanpa detail)')
  throw new Error(lastErr || 'OpenRouter: semua model gagal')
}

/* ============================================================
   MORTERA CLOUD — otak TINGKAT DEWA semua karyawan (prioritas 1).
   Kini DELEGASI ke callMorteraDirect di src/lib/ai-llm.ts — dapat SEMUA
   perlakuan hardened rantai callLLM: 404/400 → model cadangan →
   AUTO-DISCOVER GET /models (model-ID salah menyembuhkan DIRI tanpa
   deploy — dulu inilah penyebab "semua karyawan jadi templat"),
   429 → cooldown 10 mnt, 401/402/403 → cooldown 60 mnt.
   Gagal seluruhnya → rantai OpenRouter lama takeover mulus.
   ============================================================ */
/* ⏱️ Timeout Mortera ADAPTIF (keluhan Bos 10 Nov: "otak Alexander templat
   mulu, gagal ambil api"). Akar masalah: callMorteraDirect default 40 dtk —
   kalau gateway Mortera GANTUNG (diag produksi 10 Nov 08:02 WIB: "aborted
   due to timeout"), SATU panggilan compose briefing ngabisin 40 dtk, padahal
   compose dipagari withTimeout 45 dtk → sisa ≤5 dtk buat OpenRouter →
   nyaris selalu gagal → briefing jatuh TEMPLAT "OTAK ALEXANDER OFFLINE"
   tiap kali Mortera ngambek.
   ⏱️ FIX V2 10 Nov (keluhan lanjutan Bos: "otak ceo karyawan ai templat mulu
   padahal udah make api berbayar"): diag produksi menunjukkan Mortera SERING
   timeout di detik ke-20 (tugas pendek) — model sehat lewat gateway rata-rata
   8-15 dtk, dan GET /v1/credits tetap cepat → bukan jaringan mati, murni
   ANTRIAN inference gateway yang kadang lewat 20 dtk. 20 dtk = memotong
   panggilan yang SEBENARNYA SEDANG DIKERJAKAN dan SISIHkan API berbayar.
   Kini: tugas pendek (≤1500 token) 40 dtk, tugas panjang 75 dtk — dan agentBrain
   jadi BUDGET-AWARE (lihat bawah) supaya sisa waktu tetap ada buat rantai
   OpenRouter. CATATAN SONNET (10 Nov): otak kini Claude Sonnet 5.5 (permintaan
   Bos "ganti api ke sonnet semua") — Sonnet lebih lambat ±30-60% dari Haiku,
   makanya timeout dinaikkan dari 30/60 → 40/75. */
function morteraTimeoutFor(maxTokens: number): number {
  return maxTokens <= 1500 ? 40_000 : 75_000
}

async function morteraChat(e: Env, systemPrompt: string, userPrompt: string, maxTokens: number, temperature: number, timeoutMs?: number): Promise<{ text: string; model: string }> {
  const key = cfSecret(e, 'MORTERA_API_KEY')
  if (!key) throw new Error('MORTERA_API_KEY belum diset — kantor tetap jalan pakai rantai OpenRouter (dorman, bukan error)')
  const notes: string[] = []
  const r = await callMorteraDirect(systemPrompt, userPrompt, maxTokens, notes, temperature, timeoutMs)
  if (!r) throw new Error(notes.length ? notes.join(' | ').slice(0, 300) : 'Mortera: semua model gagal')
  return { text: r.text, model: r.model }
}

/* Otak Multi-Agent — PRIORITAS 1 MORTERA (Claude Sonnet 5.5 — permintaan Bos
   "ganti api ke sonnet semua") → model resmi
   karyawan (OpenRouter) → kalau mati semua, caller wajib pakai templat
   statis (sistem tidak pernah crash).

   ⚠️ PENTING (lindungi kuota auto-jurnal): Gemini TIDAK lagi jadi fallback
   otomatis kerjaan karyawan AI. Seluruh kuota GEMINI_API_KEY disisakan untuk
   fitur user-facing (auto-jurnal/evaluasi screenshot) — dulu kerjaan cron
   ikut makan kuota yang sama → auto-jurnal user kena 429 "Kuota AI penuh".
   Kalau OpenRouter mati total → laporan tetap terkirim pakai templat statis.
   Set LLM_GEMINI_FALLBACK=1 di Cloudflare untuk mengaktifkan kembali
   fallback Gemini secara sengaja. */
/* Diagnosa TERAKHIR agentBrain — disimpan ke agent_kv `brain:diag` DAN
   tampil di action=info (PUBLIK, tanpa secret — isinya cuma provider/model
   + alasan gagal). Tujuan: Bos bisa lihat DARI LUAR kenapa karyawan jatuh
   ke templat — tanpa login, tanpa wrangler tail, dan TIDAK hilang saat
   isolate Workers berganti (in-memory saja terlalu rapuh). */
let lastBrainDiag: { at: string; agent: string; hasil: string } | null = null

function recordBrainDiag(e: Env, agent: string, hasil: string): void {
  lastBrainDiag = { at: new Date().toISOString(), agent, hasil }
  /* fire-and-forget: diagnostik tidak boleh menggagalkan agen */
  kvSet(e, 'brain:diag', JSON.stringify(lastBrainDiag)).catch(() => {})
}

async function agentBrain(e: Env, agent: AgentKey, systemPrompt: string, userPrompt: string, maxTokens = 1024, temperature = 0.7, budgetMs?: number): Promise<{ text: string; provider: 'mortera' | 'openrouter' | 'gemini'; model: string }> {
  /* HARNESS V3 (UNIFIED LOOP) — otak SEMUA karyawan dibungkus identitas +
     mandat domain (EXTERNAL_GROWTH / INTERNAL) + aturan zero-fluff (haram
     kata klise AI, haram placeholder, gaya spesialis senior) SEBELUM prompt
     kerja spesifiknya. Satu titik injeksi → seluruh tim konsisten V3 tanpa
     mengubah tiap pemanggil. */
  const sys = harnessWrap(agent, systemPrompt)
  let err = ''
  /* ⏱️ BUDGET-AWARE (fix "templat mulu padahal api berbayar"): dulu tiap
     lapisan punya timeout pribadi yang tidur sadar anggaran pemanggil —
     compose briefing dapet 30-75 dtk, tapi Mortera sendiri bisa ngabisin
     30 dtk × retry + OpenRouter 45 dtk × 3 model = >150 dtk → withTimeout
     mematikan semua → TEMPLAT. Kini seluruh rantai berbagi SATU anggaran:
     • Mortera (prioritas 1, API BERBAYAR, Claude Sonnet 5.5) dapat maks 60%
       anggaran — Sonnet sedikit lebih lambat dari Haiku & Bos ingin kualitas
       premium, jadi porsinya dinaikkan dari 45% (60% * 75 dtk = 45 dtk)
       tanpa membulani rantai free (sisa 40%).
     • OpenRouter per-model: sisa anggaran dibagi rata maks 2 model,
       plafon 45 dtk, minimum 12 dtk (kalau sisa terlalu tipis, 1 model
       tercepat saja yang dicoba). */
  const t0 = Date.now()
  /* Default 75 dtk (bukan 120): cron briefing total cuma 120 dtk & agen
     berjalan PARALEL — 1 agen banting setangguh mungkin tidak boleh
     menyeret seluruh Promise.all melewati batas cron. compose memoper
     anggarannya sendiri (composeCap 30-75 dtk). */
  const total = Math.max(15_000, budgetMs || 75_000)
  const morBudget = Math.min(morteraTimeoutFor(maxTokens), Math.round(total * 0.6))
  /* PRIORITAS 1 — MORTERA (Claude Sonnet 5.5): otak SEMUA karyawan kantor
     (permintaan Bos: "ganti api ke sonnet semua").
     Gagal (key belum diset / cooldown / 5xx) → rantai lama takeover mulus. */
  try {
    const m = await morteraChat(e, sys, userPrompt, maxTokens, temperature, morBudget)
    recordBrainDiag(e, agent, `mortera ✅ ${m.model}`)
    return { ...m, provider: 'mortera' }
  } catch (x: any) {
    err = '[Mortera] ' + String(x?.message || x).slice(0, 220)
    recordBrainDiag(e, agent, 'mortera ❌ → ' + err)
    console.error(`[agentBrain:${agent}] Mortera gagal — lanjut rantai OpenRouter:`, err)
  }
  const orPerModel = Math.max(12_000, Math.min(45_000, Math.round((total - (Date.now() - t0)) / 2)))
  try {
    const r = await openRouterChat(e, orChain(e, agent), sys, userPrompt, maxTokens, temperature, orPerModel)
    recordBrainDiag(e, agent, `openrouter ✅ ${r.model} (mortera gagal: ${err.slice(0, 160)})`)
    return { ...r, provider: 'openrouter' }
  } catch (x: any) {
    err = String(x?.message || x).slice(0, 140)
    recordBrainDiag(e, agent, 'openrouter ❌ → ' + err)
    /* Task 33: jejak log server — agen mana yang gagal & penyebabnya */
    console.error(`[agentBrain:${agent}] OpenRouter gagal, mencoba jalur cadangan:`, err)
  }
  if (cleanEnv(e.LLM_GEMINI_FALLBACK) === '1') {
    if (cleanEnv(e.GEMINI_API_KEY)) {
      try {
        const text = await geminiText(e, sys, userPrompt, maxTokens, temperature)
        return { text, provider: 'gemini', model: e.GEMINI_MODEL || 'gemini-2.5-flash' }
      } catch (x: any) {
        err += ' | Gemini: ' + String(x?.message || x).slice(0, 80)
        console.error(`[agentBrain:${agent}] fallback Gemini juga gagal:`, String(x?.message || x).slice(0, 140))
      }
    }
  } else if (cleanEnv(e.GEMINI_API_KEY)) {
    err += ' | fallback Gemini dilewati (lindungi kuota auto-jurnal — set LLM_GEMINI_FALLBACK=1 untuk aktifkan)'
  }
  throw new Error(err || 'semua LLM gagal')
}

/* ============================================================
   Task 35b — DIAGNOSTIK OPENROUTER AKTIF (tombol 🩺 Diagnostik)
   Dulu diag cuma cek "env ada/tidak" → Bos tetap nebak-nebak kenapa
   karyawan AI jatuh ke templat. Sekarang diag BENAR-BENAR memanggil:
   1) GET /api/v1/key  → validitas key + pemakaian/batas kredit
   2) Tes hidup TIAP model di chain (prompt 16 token) → HTTP status
      asli + potongan body error + saran perbaikan bahasa manusia.
   Target: masalah OpenRouter KELIHATAN dalam 1 klik, tanpa wrangler tail.
   ============================================================ */
const OR_HINTS: Record<number, string> = {
  401: 'API Key TIDAK VALID / sudah dihapus — buat key baru di openrouter.ai/keys → update secret OPENROUTER_API_KEY di Cloudflare (Workers → Settings → Variables & Secrets) → Deploy',
  402: 'Kredit OpenRouter habis — isi kredit ATAU pastikan hanya pakai model :free',
  403: 'Request diblokir kebijakan OpenRouter — cek status akun / moderasi konten',
  404: 'Model ID tidak ada di katalog OpenRouter (katalog sering dikurasi ulang) — ganti ke model hidup lain',
  408: 'Model terlalu lama merespons (timeout) — coba lagi / ganti model',
  429: 'Rate limit! Free tier: 20 req/menit · 50 req/hari (akun tanpa kredit) — top up $10 → jadi 1000 req/hari, ATAU tunggu kuota reset',
  500: 'Server OpenRouter error internal — coba lagi nanti / ganti model',
  502: 'Upstream provider model error — pakai model cadangan',
  503: 'Model sedang penuh kapasitas — coba model lain dulu',
}

async function orDiag(e: Env): Promise<Record<string, unknown>> {
  const key = cfSecret(e, 'OPENROUTER_API_KEY')
  if (!key) {
    return { ok: false, reason: 'no-key', error: 'OPENROUTER_API_KEY belum diset — Cloudflare → Workers & Pages → luxtradee → Settings → Variables & Secrets → Add OPENROUTER_API_KEY (sk-or-...) → Encrypt → Deploy' }
  }
  const out: Record<string, unknown> = { ok: true, keyPresent: true }

  /* 1) Validitas & kuota key (endpoint khusus pemilik key, murah — bukan chat) */
  try {
    const res = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${key}` },
      signal: timeoutSignal(15_000),
    })
    const body: any = await res.json().catch(() => null)
    if (!res.ok) {
      out.keyCheck = { ok: false, status: res.status, hint: OR_HINTS[res.status] || `HTTP ${res.status}`, body: JSON.stringify(body).slice(0, 140) }
    } else {
      const d = body?.data || {}
      const lim = d.limit === null || d.limit === undefined ? undefined : Number(d.limit)
      /* Task 35d: Bos pernah salah paham "limit $100" = saldo — perjelas:
         limit = batas BELANJA key (diset saat bikin key), bukan saldo akun.
         Status free-tier ditentukan SALDO akun (pernah top up $10+ atau belum). */
      const limNote = lim != null ? ` · "limit $${lim.toFixed(2)}" = batas belanja KEY ini (diset saat bikin key), BUKAN saldo akun` : ''
      out.keyCheck = {
        ok: true,
        label: d.label || '',
        usage: typeof d.usage === 'number' ? d.usage : undefined,
        limit: lim,
        isFreeTier: !!d.is_free_tier,
        note: (d.is_free_tier
          ? 'akun FREE-TIER (saldo kosong) — model :free dibatasi 20 req/menit · 50 req/hari; top up $10 SEKALI → langsung 1000 req/hari'
          : 'akun ber-kredit — kuota longgar 1000 req/hari') + limNote,
      }
    }
  } catch (x: any) {
    out.keyCheck = { ok: false, error: String(x?.message || x).slice(0, 120) }
  }

  /* 2) Tes hidup TIAP model unik milik SELURUH tim (bukan cuma chain CEO)
     — prompt 16 token. Hasilnya sekaligus jadi input circuit breaker:
     model yang 429/403 langsung ditandai sakit → agen lain tak buang waktu. */
  const chain = [...new Set([...(Object.values(AGENT_MODELS) as string[]), ...OR_TEAM_FALLBACKS])]
  const tested: Record<string, unknown>[] = []
  for (const model of chain) {
    const t0 = Date.now()
    try {
      const res = await fetch(OR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Balas persis satu kata: OK' }], max_tokens: 64 }),
        signal: timeoutSignal(25_000),
      })
      const ms = Date.now() - t0
      if (!res.ok) {
        const txt = (await res.text().catch(() => '')).slice(0, 140)
        if ([429, 403, 500, 502, 503].includes(res.status)) await orMarkSick(e, model)
        tested.push({ model, ok: false, status: res.status, ms, hint: OR_HINTS[res.status] || `HTTP ${res.status}`, body: txt })
      } else {
        const data: any = await res.json()
        const msg = data?.choices?.[0]?.message || {}
        const text = String(msg.content ?? msg.reasoning ?? '').trim()
        if (text) {
          await orMarkHealthy(e, model)
          tested.push({ model, ok: true, status: 200, ms, reply: text.slice(0, 40) })
        } else {
          /* Task 35f: JUJUR — 200 dengan balasan kosong dulu tampil "❌ HTTP 200 ·"
             tanpa penjelasan (membingungkan Bos). Kini ada alasannya. */
          tested.push({ model, ok: false, status: 200, ms, hint: 'HTTP 200 tapi balasan kosong — model "reasoning" kemungkinan kehabisan token jawaban di tes mini ini (di kerja nyata token besar biasanya jalan; kalau tetap kosong, agen otomatis lompat ke model lain di chain)' })
        }
      }
    } catch (x: any) {
      tested.push({ model, ok: false, status: 0, ms: Date.now() - t0, hint: 'Timeout / jaringan terputus dari Workers', error: String(x?.message || x).slice(0, 120) })
    }
  }
  const alive = tested.filter((t) => t.ok)
  out.chain = tested
  out.aliveCount = alive.length
  out.verdict = alive.length
    ? `✅ ${alive.length}/${tested.length} model hidup — otak karyawan SEHARUSNYA bekerja. Kalau dashboard masih templat, itu cache lama — klik agen manual atau tunggu reset harian.`
    : '❌ SEMUA model gagal — INILAH penyebab karyawan AI jatuh ke templat. Ikuti hint di atas (paling sering: 401 key mati / 429 kuota free-tier).'
  return out
}

/* Top 5 konten TikTok milik Bos, urut views (tabel tiktok_posts).
   Butuh service_role key — tabel terkunci RLS. Gagal → [] (fallback). */
async function fetchTopTikToks(e: Env): Promise<{ url: string; caption: string; views: number; likes: number }[]> {
  if (!sbUrl(e) || !cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY)) return []
  const res = await fetch(
    `${sbUrl(e)}/rest/v1/tiktok_posts?select=url,caption,views,likes&order=views.desc&limit=5`,
    { headers: sbHPriv(e), signal: timeoutSignal(10_000) },
  )
  if (!res.ok) return []
  return (await res.json()) as { url: string; caption: string; views: number; likes: number }[]
}

async function cmoAgent(e: Env) {
  /* PILAR KONTEN rotasi harian (WIB) — spec perbaikan kantor AI anti
     "itu-itu mulu": tiap hari SATU pilar beda berbasis edukasi trading
     umum. Angle pain-point lama (ANGLES) tetap dipakai utk draf cadangan
     & variasi dalam pilar. */
  const pillar = CMO_PILLARS[wibWeekday() % CMO_PILLARS.length]
  const angle = ANGLES[dayIndex() % ANGLES.length]

  /* SOP Bos: 1 draf TikTok / HARI. Draf hari ini yang sudah dibuat
     (dashboard dibuka / briefing pagi) dipakai ulang — hemat kuota model. */
  const dayKey = `cmo:${wibDay()}`
  try {
    const cached = await kvGet(e, dayKey)
    if (cached) return { ...JSON.parse(cached), dupToday: true }
  } catch { /* ignore */ }

  let history: string[] = []
  try { history = JSON.parse((await kvGet(e, 'drafts:history')) || '[]') } catch { /* ignore */ }

  /* Bahan analisis: konten asli TikTok Bos (diisi lewat Ruang CMO) */
  const posts = await fetchTopTikToks(e).catch(() => [])

  /* Task 32 (SOP Bos): DATA NYATA USER ditarik DULU sebelum panggil LLM —
     konten Sinta berangkat dari fakta funnel, bukan karangan. */
  let realUsers = { total: -1, active24: -1, passive: -1 }
  try {
    const [a24, tot] = await Promise.all([
      fetchActiveUserIds(e, isoAgo(24)),
      supaCount(e, 'profiles'),
    ])
    realUsers = { total: tot, active24: a24.size, passive: Math.max(0, tot - a24.size) }
  } catch { /* data gagal → prompt bilang tidak tersedia (anti-halusinasi) */ }
  const realDataBlock =
    `\nDATA NYATA Luxtradee (sumber: Supabase, diambil barusan):
` +
    (realUsers.total >= 0
      ? `- Total pendaftar: ${fmtN(realUsers.total)} · aktif 24 jam: ${fmtN(realUsers.active24)} · pasif: ${fmtN(realUsers.passive)}
`
      : `- (data user sedang tidak tersedia — DILARANG menyebut angka user)
`)
  const tiktokBlock = posts.length
    ? `KONTEN TIKTOK ASLI milik CEO (urut views — paling atas TERBUKTI paling perform):\n` +
      posts.map((p, i) => `${i + 1}. [${fmtN(p.views)} views · ${fmtN(p.likes)} likes] "${(p.caption || '').slice(0, 400)}"`).join('\n')
    : ''

  /* SOP Sinta: draf hari ini juga WAJIB menjawab alasan churn dari rapat
     Maya × Sinta terakhir (bukan sekadar ikut angle rotasi). */
  let churnLine = ''
  try {
    const p = JSON.parse((await kvGet(e, 'cso-cmo:last')) || 'null')
    if (p?.diagnosis)
      churnLine =
        `\nHASIL RAPAT MAYA (CSO) TERAKHIR — akar masalah user males pakai jurnal:\n` +
        `"${String(p.diagnosis).slice(0, 200)}"` +
        (Array.isArray(p.reasons) && p.reasons.length ? `\nAlasan utama: ${p.reasons.slice(0, 3).join('; ')}` : '') +
        `\nSkrip hari ini WAJIB menjawab akar masalah tersebut.`
  } catch { /* ignore */ }

  const systemPrompt =
    `Kamu adalah CMO Luxtrade. ` +
    (posts.length
      ? `Analisis pola dari konten berikut: hook seperti apa yang bikin FYP, topik apa yang paling banyak ditonton, struktur & gaya bahasa khasnya. TIRU pola pemenang tersebut dalam draf baru.\n\n${tiktokBlock}`
      : `Analisis gaya bahasa, hook, dan struktur dari naskah TikTok milik CEO berikut ini: ${e.TIKTOK_REFERENCE || '(belum ada referensi — pakai gaya trader Indonesia kasual, bahasa gaul)'}`) +
    `\nTugasmu hari ini: Buat 3 draf naskah video TikTok baru yang meniru pola/gaya tersebut 100% — SAME angle, TIGA pendekatan berbeda (beda hook, beda struktur, beda gaya buka) supaya Bos bisa PILIH yang paling pas. ` +
    `DILARANG mengulang naskah yang sama dari hari-hari sebelumnya. ` +
    `PILAR KONTEN HARI INI (WAJIB menentukan ARAH ketiga draf — rotasi harian anti-repetisi): "${pillar.name}" — ${pillar.task}. Pain point boleh jadi bumbu, tapi pilar inilah inti naskahnya.` +
    `\n\n` + REAL_DATA_RULE

  const userPrompt =
    `Tanggal hari ini: ${wibNow()}.\n` +
    `ANGLE HARI INI (WAJIB dipakai): ${angle}\n` +
    realDataBlock +
    churnLine +
    (history.length
      ? `\nHOOK/judul ${history.length} naskah terakhir (DILARANG mengulang atau terlalu mirip):\n` +
        history.map((h, i) => `${i + 1}. ${(h.split('\n').find((l) => l.trim()) || h).slice(0, 140)}`).join('\n') + '\n'
      : '') +
    (posts.length ? `\nWAJIB: ambil pola dari konten berperform terbaik di atas — bukan naskah generik.\n` : '') +
    (await memBlock(e)) +
    (await agentMemBlock(e, 'cmo')) +
    `\nOutput: TEPAT 3 naskah TikTok (hook 3 detik pertama → body → CTA, durasi 30–45 detik per naskah), dipisah baris persis "===DRAF-2===" dan "===DRAF-3===" antar naskah, tanpa penjelasan tambahan.`

  /* ═══════ Rantai model SINTA (SOP Multi-Agent) ═══════
     Task 35: rantai via agentBrain('cmo') = Gemma 4 31B → Nemotron
     Lightning → Gemma 4 26B → Nemotron Ultra → Inkling → Xing 4.0
     (semuanya model gratis hidup; model lama glm-4.7/4-flash sudah 404)
     → fallbackDraft (fail-safe — teks statis, sistem tidak pernah crash)
     ⭐ Kemampuan baru: 1 panggilan model → 3 draf pilihan (Bos pilih).
        Kalau model cuma kasih 1–2, draf utama diduplikasi agar pilihan tetap ada. */
  let drafts: string[] = []
  let provider: 'mortera' | 'gemini' | 'openrouter' | 'fallback' = 'fallback'
  let model = ''
  let usedFallback = false
  let fallbackError = ''

  try {
    const brain = await agentBrain(e, 'cmo', systemPrompt, userPrompt, 3000, 1.0)
    drafts = brain.text
      .split(/\n*===DRAF-\d+===\n*/)
      .map((s) => s.trim())
      .filter((s) => s.length > 40)
    provider = brain.provider
    model = brain.model
  } catch (brainErr: any) {
    fallbackError = String(brainErr?.message || brainErr).slice(0, 160)
  }
  if (!drafts.length) {
    drafts = [fallbackDraft(angle)]
    usedFallback = true
  }
  while (drafts.length < 3) drafts.push(drafts[drafts.length - 1])
  drafts = drafts.slice(0, 3)
  const draft = drafts[0]

  history.unshift(draft)
  await kvSet(e, 'drafts:history', JSON.stringify(history.slice(0, 10)))
  await memAdd(e, 'CMO Sinta', `Draf TikTok (${angle}, ${model || provider}): ${draft.replace(/\s+/g, ' ').slice(0, 130)}`)
  const out = { draft, drafts, angle, usedFallback, provider, model, basedOn: posts.length ? 'tiktok' : 'reference', analyzedPosts: posts.length, ...(fallbackError ? { fallbackError } : {}) }
  await kvSet(e, dayKey, JSON.stringify(out)).catch(() => {})
  return out
}

/* ============================================================
   AGEN 3b — CMO INSTAGRAM (Tahap T): Sinta bikin CAPTION INSTAGRAM
   terpisah dari draf TikTok. Bukan copy-paste naskah TikTok ke IG
   (formatnya beda — IG butuh caption lebih pendek + hashtag +
   insight analisis trading yang educational). Caption diambil dari
   data REAL: win rate agregat, pair favorit, sesi terbaik komunitas
   24 jam — bukan teks generik.

   Auto-post: dipanggil di FASE 2 cron CEO agent. Dedup harian
   `cmo:ig-posted:${day}` (terpisah dari `cmo:posted:${day}` TikTok).
   Token Meta wajib di-set di Cloudflare Secrets
   (INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_USER_ID). Tanpa token →
   status JUJUR "belum diset", tidak ada simulasi sukses.
   ============================================================ */
async function cmoInstagramCaption(e: Env) {
  const day = wibDay()
  const dayKey = `cmo:ig:${day}`
  /* Cache: kalau caption hari ini sudah dibuat, return dari KV (hemat LLM) */
  try {
    const cached = JSON.parse((await kvGet(e, dayKey)) || 'null')
    if (cached?.caption) return cached
  } catch { /* ignore */ }

  /* Ambil data REAL komunitas 24 jam untuk konten analisis */
  let winRate = 0, totalTrades = 0, topPair = 'XAUUSD'
  try {
    const since = isoAgo(24)
    const url = `${sbUrl(e)}/rest/v1/trades?select=symbol,profit_loss&created_at=gte.${encodeURIComponent(since)}&limit=500`
    const res = await fetch(url, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
    if (res.ok) {
      const rows = (await res.json()) as { symbol?: string; profit_loss?: number }[]
      totalTrades = rows.length
      const wins = rows.filter((r) => Number(r.profit_loss) > 0).length
      winRate = totalTrades ? Math.round((wins / totalTrades) * 100) : 0
      /* Pair favorit (count group by symbol) */
      const counts: Record<string, number> = {}
      for (const r of rows) {
        const s = String(r.symbol || '').trim().toUpperCase()
        if (s) counts[s] = (counts[s] || 0) + 1
      }
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
      if (top) topPair = top[0]
    }
  } catch { /* data opsional — fallback ke default */ }

  /* Paritas tanggal (angka hari dlm bulan, bukan string ISO) — angle IG caption selang-seling per hari */
  const angle = parseInt(wibDay().slice(8), 10) % 2 === 0
    ? 'win rate komunitas + pair favorit hari ini'
    : 'sesi trading terbaik & pola yang paling sering muncul'

  const systemPrompt =
    'Kamu Sinta, CMO Luxtradee (aplikasi jurnal trading XAUUSD Indonesia). ' +
    'Tugasmu: bikin 1 CAPTION Instagram (bukan naskah TikTok) yang educational & analitis — ' +
    'membagikan insight trading XAUUSD nyata dari data komunitas Luxtradee. ' +
    'Gaya: profesional tapi santai, bahasa Indonesia, trader-friendly. ' +
    'STRUKTUR: hook 1 baris menarik → insight data 2-3 baris → 1 pelajaran konkret → CTA ke luxtradee.web.id. ' +
    'WAJIB sertakan 5-8 hashtag relevan di akhir (pisah spasi). ' +
    'Maksimal 1800 karakter (Instagram batas 2200, sisakan margin). ' +
    REAL_DATA_RULE

  const userPrompt =
    `Tanggal: ${wibNow()} WIB.\n` +
    `ANGLE HARI INI: ${angle}\n` +
    `DATA NYATA Luxtradee 24 jam:\n` +
    `- Total trade: ${fmtN(totalTrades)}\n` +
    `- Win rate komunitas: ${winRate}%\n` +
    `- Pair teratas: ${topPair}\n\n` +
    (totalTrades < 5
      ? 'Catatan: data komunitas 24 jam sedang sepi (transaksi belum ramai). Tetap buat caption yang relevan — fokus ke edukasi XAUUSD umum dengan angle "data komunitas sedang dalam fase konsolidasi, ini pelajaran sabar yang bisa diambil".\n\n'
      : '') +
    (await memBlock(e)) +
    (await agentMemBlock(e, 'cmo')) +
    `\nOutput: HANYA caption Instagram (1 post), tanpa penjelasan tambahan, tanpa label "Caption:".`

  let caption = ''
  let provider: 'mortera' | 'openrouter' | 'gemini' | 'fallback' = 'fallback'
  let model = ''
  let usedFallback = false
  let fallbackError = ''

  try {
    const brain = await agentBrain(e, 'cmo', systemPrompt, userPrompt, 1200, 0.8)
    caption = brain.text.trim().slice(0, 2200)
    provider = brain.provider
    model = brain.model
  } catch (brainErr: any) {
    fallbackError = String(brainErr?.message || brainErr).slice(0, 160)
  }

  /* Fallback caption: tetap educational walau LLM gagal */
  if (!caption || caption.length < 80) {
    caption = [
      `Trader XAUUSD, baca ini sebelum buka posisi hari ini.`,
      ``,
      `Data komunitas Luxtradee 24 jam terakhir:`,
      `- ${fmtN(totalTrades)} trade tercatat`,
      `- Win rate agregat: ${winRate}%`,
      `- Pair teratas: ${topPair}`,
      ``,
      `Pelajaran hari ini: konsistensi lebih penting daripada 1 big win. ` +
      `Trader yang jurnal setiap trade-nya punya data buat evaluasi — yang cuma hafal di kepala, nggak.`,
      ``,
      `Mulai jurnal visual gratis di luxtradee.web.id`,
      `#xauusd #goldtrading #tradingjournal #tradingindonesia #luxtradee #propfirm #scalping`,
    ].join('\n')
    usedFallback = true
  }

  await memAdd(e, 'CMO Sinta', `Caption IG (${angle}, ${model || provider}): ${caption.replace(/\s+/g, ' ').slice(0, 130)}`)
  const out = { caption, angle, usedFallback, provider, model, totalTrades, winRate, topPair, ...(fallbackError ? { fallbackError } : {}) }
  await kvSet(e, dayKey, JSON.stringify(out)).catch(() => {})
  return out
}

/* ============================================================
   AGEN 4 — CFO (API Quota Manager, anti-429 Gemini Vision gratis)
   ============================================================ */
async function cfoAgent(e: Env) {
  const limit = parseInt(e.DAILY_VISION_LIMIT || '1400', 10)
  const emailLimit = parseInt(e.RESEND_DAILY_LIMIT || '100', 10) // Resend free: 100 email/hari
  const read = async (k: string) => parseInt((await kvGet(e, k)) || '0', 10)
  const usedToday = await read(`quota:${wibDay(0)}`)
  const usedYesterday = await read(`quota:${wibDay(-1)}`)
  const quota429 = await read(`quota429:${wibDay(-1)}`)
  const emailToday = await read(`email:${wibDay(0)}`)
  const emailYesterday = await read(`email:${wibDay(-1)}`)
  const pct = limit > 0 ? Math.round((usedToday / limit) * 100) : 0
  const emailPct = emailLimit > 0 ? Math.round((emailToday / emailLimit) * 100) : 0
  /* ⭐ KEMAMPUAN BARU (SOP Bos) — LAPORAN PENDAPATAN:
     hitung user PRO (is_pro di Supabase) × harga paket bulanan
     (env PRO_PRICE_IDR, default 49.000) → estimasi MRR + progres
     target (env MRR_TARGET_IDR, default 10 juta). Tetap TANPA LLM —
     murni matematika hardcoded, tidak bisa halusinasi angka. */
  let proCount = -1
  try { proCount = await supaCount(e, 'profiles', 'is_pro=eq.true') } catch { proCount = -1 }
  const proPrice = parseInt(e.PRO_PRICE_IDR || '49000', 10)
  const mrrTarget = parseInt(e.MRR_TARGET_IDR || '10000000', 10)
  /* Titik impas (spec perbaikan kantor AI): biaya tetap ÷ harga PRO —
     murni matematika; tampil sebagai target user PRO selama belum ada PRO. */
  const fixedCost = parseInt(e.FIXED_COST_IDR || '0', 10)
  const breakevenUsers = fixedCost > 0 ? Math.ceil(fixedCost / proPrice) : 0
  /* Task 32 (SOP Bos): PnL NYATA — query trades dulu → matematika murni
     Next.js. Angka profit/loss berasal 100% dari database, bukan LLM. */
  const [pnl24, pnl7] = await Promise.all([computePnl(e, isoAgo(24)), computePnl(e, isoAgo(24 * 7))])
  return {
    title: 'CFO — API Quota Manager', limit, usedToday, usedYesterday, quota429,
    emailLimit, emailToday, emailYesterday, emailPct,
    proCount, proPrice, mrrTarget, estMRR: proCount > 0 ? proCount * proPrice : 0,
    fixedCost, breakevenUsers,
    pnl24, pnl7,
    status: pct >= 95 ? 'KRITIS — hentikan upload sisa hari ini'
      : pct >= 80 ? 'WASPADA — kurangi frekuensi upload'
      : 'AMAN ✅',
    emailStatus: emailPct >= 95 ? 'KRITIS — kuota email hampir habis'
      : emailPct >= 80 ? 'WASPADA — kuota email menipis'
      : 'AMAN ✅',
  }
}

/* ---------- Notifikasi Discord (pengganti WhatsApp gateway) ----------
   Hanya butuh 1 secret: DISCORD_WEBHOOK_URL (sudah diset di Cloudflare).
   Pesan memakai markdown Discord (**bold**), max 2000 char. */
async function sendDiscord(e: Env, message: string): Promise<boolean> {
  let webhookUrl = cleanEnv(e.DISCORD_WEBHOOK_URL)
  if (!webhookUrl) {
    // fallback: binding env CF Workers (OpenNext context)
    try {
      const sym = Symbol.for('__cloudflare-context__')
      const ctx = (globalThis as Record<symbol, unknown>)[sym] as { env?: Record<string, string> } | undefined
      webhookUrl = ctx?.env?.DISCORD_WEBHOOK_URL || ''
    } catch { /* ignore */ }
  }
  if (!webhookUrl)
    throw new Error('DISCORD_WEBHOOK_URL belum diset — Cloudflare → Workers → luxtradee → Variables & Secrets')

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'LuxTradee CEO Agent',
      content: message.slice(0, 2000), // batas hard Discord
    }),
    signal: timeoutSignal(15_000),
  })
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 120)
    throw new Error(`Discord HTTP ${res.status}${detail ? ' — ' + detail : ''}`)
  }
  return true
}

/* ---------- Morning Briefing (gabungan 4 agen) ---------- */
function buildBriefing(cto: any, cso: any, cmo: any, cfo: any, autoAcc = '', autoOn = false, qa: any = null, cooLine = '', nbaLine = '', e2e: any = null): string {
  const L: string[] = []
  L.push('🌅 **LAPORAN KERJA PAGI — LUXTRADE SUPER AI**')
  L.push(`📅 ${wibNow()} · 08:00 WIB — laporan harian semua karyawan`)
  L.push('━━━━━━━━━━━━━━━━━━')
  if (nbaLine) { L.push(nbaLine); L.push('━━━━━━━━━━━━━━━━━━') }
  L.push('🖥️ **CTO AGENT — IT & QA**')
  L.push(cto?.siteOk
    ? `• Website: ✅ ${cto.status} OK (${cto.latencyMs} ms)`
    : `• Website: ❌ DOWN (${cto?.status || 'timeout'})${cto?.err ? ' — ' + String(cto.err).slice(0, 80) : ''}`)
  L.push(cto?.bugs24h > 0 ? `• Bug 24 jam terakhir: ${cto.bugs24h} ⚠️ segera cek bug_reports`
    : cto?.bugs24h === 0 ? '• Bug 24 jam terakhir: 0 ✅'
    : `• Bug 24 jam: gagal diambil ⚠️ ${String(cto?.err || '').slice(0, 110)}`)
  if (qa && qa.total > 0) {
    L.push(qa.fails?.length
      ? `• QA ${qa.total} fitur dashboard: ${qa.ok} OK, ${qa.fails.length} MASALAH ⚠️`
      : `• QA otomatis ${qa.total} fitur dashboard: SEMUA OK ✅ (rata-rata ${qa.avgMs} ms)`)
    for (const f of (qa.fails || []).slice(0, 5))
      L.push(`   ↳ ${f.path} → ${f.status || 'timeout'}${f.err ? ' — ' + f.err : ''}`)
  }
  if (e2e?.e2eSkip) L.push(`• E2E login+fitur: dilewati — ${String(e2e.e2eSkip).slice(0, 90)}`)
  else if (e2e && e2e.e2eTotal > 0) {
    L.push(e2e.e2eFailed
      ? `• E2E LOGIN + tes fitur satu-satu: ${e2e.e2ePassed}/${e2e.e2eTotal} lolos ⚠️`
      : `• E2E LOGIN + tes fitur satu-satu (${e2e.e2eTotal} langkah): SEMUA OK ✅ (${(e2e.e2eDurMs / 1000).toFixed(1)}s)`)
    for (const f of (e2e.e2eSteps || []).filter((s: any) => !s.ok).slice(0, 4))
      L.push(`   ↳ ${f.label}: ${String(f.detail || 'gagal').slice(0, 90)}`)
  }
  L.push('')
  L.push('👥 **CSO AGENT — CUSTOMER SUCCESS**')
  L.push(`• Total pendaftar: ${fmtN(cso?.total)}`)
  L.push(`• User aktif (upload 24 jam): ${fmtN(cso?.active)}`)
  L.push(`• User pasif (>24 jam tanpa aktivitas): ${fmtN(cso?.passive)}`)
  if (cso?.emailedYesterday > 0)
    L.push(`• Feedback email kemarin: ${fmtN(cso.returnedYesterday)}/${fmtN(cso.emailedYesterday)} user balik upload ${cso.returnedYesterday > 0 ? '✅' : '⏳'}`)
  if (cso?.churnRisk > 0)
    L.push(`• ⚠️ Risiko churn: ${fmtN(cso.churnRisk)} user pernah aktif 30 hari tapi 3 hari terakhir diam — kandidat email win-back Maya`)
  if (cso?.err) L.push(`⚠️ CSO gagal: ${String(cso.err).slice(0, 130)}`)
  L.push('')
  L.push('📣 **CMO AGENT — DRAF TIKTOK HARI INI**')
  L.push(cmo?.draft ? `—\n${cmo.draft}\n—` : '• Gagal generate draf ⚠️')
  if (cmo?.usedFallback) L.push('_(semua model gagal — pakai draf cadangan, mohon revisi manual)_')
  else if (cmo?.provider === 'mortera') L.push(`_(via Mortera Cloud — otak Sinta: Claude Sonnet 5.5 ✅)_`)
  else if (cmo?.provider === 'openrouter') L.push(`_(via OpenRouter — model resmi Sinta${cmo?.model ? ': ' + cmo.model : ''} ✅)_`)
  if (cmo?.basedOn === 'tiktok') L.push(`📚 Dianalisis dari ${fmtN(cmo.analyzedPosts)} konten TikTok asli lo (urut views) — pola pemenang ditiru`)
  else if (cmo?.draft) L.push('📚 Analisis pakai referensi statis — isi "Bahan Analisis TikTok" di Ruang CMO biar makin akurat')
  L.push('')
  L.push('💰 **CFO AGENT — KUOTA API GEMINI**')
  L.push(`• Terpakai kemarin: ${fmtN(cfo?.usedYesterday)}/${fmtN(cfo?.limit)}`)
  L.push(`• Terpakai hari ini: ${fmtN(cfo?.usedToday)}/${fmtN(cfo?.limit)}`)
  L.push(`• Event 429 kemarin: ${fmtN(cfo?.quota429)}`)
  L.push(`• Email terkirim hari ini: ${fmtN(cfo?.emailToday)}/${fmtN(cfo?.emailLimit)} (Resend — ${cfo?.emailStatus || '-'})`)
  L.push(`• Status: ${cfo?.status || '-'}`)
  if (cfo?.proCount !== undefined && cfo.proCount >= 0) {
    if (cfo.proCount === 0)
      /* Pre-launch: jangan spam "MRR Rp0" tiap hari — tampilkan TARGET yang
         bisa dieksekusi (titik impas, matematika murni Putri). */
      L.push(`• 💵 Pendapatan: belum ada user PRO — titik impas: ${fmtN(cfo.breakevenUsers || 0)} user PRO (biaya tetap Rp${fmtN(cfo.fixedCost || 0)}/bulan ÷ harga PRO Rp${fmtN(cfo.proPrice)})${cfo.fixedCost ? '' : ' · set env FIXED_COST_IDR biar hitungannya jalan'}`)
    else
      L.push(`• 💵 Pendapatan (estimasi): ${fmtN(cfo.proCount)} user PRO × Rp${fmtN(cfo.proPrice)} ≈ **Rp${fmtN(cfo.estMRR)}/bulan MRR**${cfo.mrrTarget > 0 ? ` (${Math.round(((cfo.estMRR || 0) / cfo.mrrTarget) * 100)}% dari target Rp${fmtN(cfo.mrrTarget)})` : ''}`)
  }
  /* Task 32: PnL NYATA dari tabel trades (matematika murni Putri) */
  if (cfo?.pnl24) L.push(pnlLine(cfo.pnl24))
  if (cfo?.pnl7 && cfo.pnl7.trades > 0)
    L.push(`   ↳ Rekap 7 hari: ${cfo.pnl7.pnl >= 0 ? '+' : ''}${cfo.pnl7.pnl} dari ${fmtN(cfo.pnl7.trades)} trade (win rate ${cfo.pnl7.winRatePct}%)`)
  if (cfo?.err) L.push(`⚠️ CFO gagal: ${String(cfo.err).slice(0, 130)}`)
  if (cooLine) L.push(cooLine)
  L.push('━━━━━━━━━━━━━━━━━━')
  if (autoAcc) L.push(autoAcc)
  L.push(autoOn
    ? '🤖 AUTO-ACC aktif — email sapaan user pasif dikirim CSO otomatis tiap pagi, Bos nggak perlu klik apa-apa.'
    : "Bos, klik tombol 'ACC EMAIL' di Ruang CEO (/kantor-ceo) jika ingin CSO mengirim email sapaan ke user pasif hari ini.")
  L.push('ℹ️ Alarm darurat (situs DOWN / bug baru / kuota 80%) dikirim INSTAN kapan pun — watchdog jaga tiap 15 menit.')
  return L.join('\n')
}

/* ALEXANDER (CEO) merangkai Morning Briefing — SOP Multi-Agent: model
   resminya merapikan laporan mentah semua agen jadi satu briefing. Validasi
   ketat (wajib memuat seksi CTO/CSO/CMO, panjang masuk akal) — gagal →
   templat buildBriefing dipakai (fail-safe).
   ⏱️ budgetMs (fix "templat mulu padahal api berbayar"): anggaran waktu
   compose dari runMorningBriefing (composeCap) dioper utuh ke agentBrain —
   rantai Mortera→OpenRouter di dalamnya yang membagi-bagi sendiri, bukan
   masing-masing layer nebak-nebak lalu totalnya meledak. maxTokens 900→1200:
   model REASONING (Nemotron) memakan token buat mikir dulu — 900 kadang
   habis sebelum isi briefing sempat ditulis → "respons kosong" → jatuh
   templat padahal modelnya hidup. */
async function ceoComposeBriefing(e: Env, templateText: string, budgetMs?: number): Promise<{ text: string; model: string }> {
  const brain = await agentBrain(
    e, 'ceo',
    'Kamu Alexander, wakil CEO Luxtradee (jurnal trading XAUUSD). Tugas pagi ini: merangkai LAPORAN MENTAH dari karyawan AI jadi SATU Morning Briefing rapi untuk Discord Bos. ATURAN WAJIB: (1) pertahankan SEMUA angka & status penting PERSIS seperti laporan mentah — DILARANG mengubah/menambah/mengurangi angka (anti-halusinasi); (2) format markdown Discord, mulai dengan baris "🌅 **LAPORAN KERJA PAGI — LUXTRADE SUPER AI**" lalu baris tanggal; (3) seksi dipisah ━━━━ dengan judul 🖥️ CTO / 👥 CSO / 📣 CMO / 💰 CFO; (4) maksimal 1800 karakter; (5) bahasa Indonesia, profesional tapi santai. Output HANYA isi briefing-nya, tanpa komentar pembuka/penutup.',
    `LAPORAN MENTAH KARYAWAN:\n${templateText}`,
    1200, 0.4, budgetMs,
  )
  const text = brain.text.trim()
  if (text.length < 300 || ['CTO', 'CSO', 'CMO'].some((k) => !text.includes(k)))
    throw new Error('hasil Alexander tidak lolos validasi')
  return { text: text.slice(0, 1950), model: brain.model }
}

/* Email cadangan — kalau laporan utama GAGAL kirim ke Discord, Bos tetap
   harus tahu hasil kerja karyawan AI: briefing dikirim ke email owner via
   Resend. Gagal di sini diabaikan (non-kritis). */
async function briefingFailEmail(e: Env, discordErr: string, briefingText: string): Promise<void> {
  const rKey = cfSecret(e, 'RESEND_API_KEY')
  if (!rKey) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rKey}` },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: ownerEmail(e),
      subject: '⚠️ Laporan pagi gagal kirim ke Discord — cek DISCORD_WEBHOOK_URL',
      text: `${briefingText}\n\n━━━━━━━━━━━━━━━━━━\nError Discord: ${discordErr}\nWaktu: ${new Date().toISOString()}`,
    }),
    signal: timeoutSignal(10_000),
  }).catch(() => {})
}

/* ============================================================
   FASE BISNIS (lib/ceo-phase.ts) — adapter PhaseDeps: semua ketergantungan
   kantor (KV, Supabase, otak LLM, memori, Discord, self-fetch) disuntik
   dari fungsi lokal route ini ke modul fase. Fase dihitung dari data
   nyata (pendaftar + trade 7 hari, cache 1 jam); override manual via
   env PHASE_OVERRIDE = pre-launch | early | growth.
   ============================================================ */
function phaseDeps(e: Env): PhaseDeps {
  const ex = [ownerEmail(e), cleanEnv(e.E2E_TEST_EMAIL) || 'e2e-tester@luxtradee.app']
    .map((s) => s.toLowerCase().trim()).filter(Boolean)
  return {
    kvGet: (k) => kvGet(e, k),
    kvSet: (k, v) => kvSet(e, k, v),
    count: (table, filters) => supaCount(e, table, filters || ''),
    brain: async (agent, system, user, maxTokens, temperature) => {
      const r = await agentBrain(e, agent as AgentKey, system, user, maxTokens, temperature)
      return { text: r.text, provider: r.provider, model: r.model }
    },
    mem: async (who, text) => { await memAdd(e, who, text) },
    memBlock: () => memBlock(e, 6),
    notify: async (text) => { await sendDiscord(e, text) },
    fetchSelf: (p) => selfFetch(p.startsWith('http') ? p : SITE_URL + p),
    env: (name) => cfSecret(e, name),
    wibDay: (off) => wibDay(off),
    isoAgo: (h) => isoAgo(h),
    excludeEmails: ex,
  }
}

async function runMorningBriefing(e: Env, req?: Request, cronKey?: string) {
  /* FASE 1 — LAPORAN INTI, DIKIRIM SECEPAT MUNGKIN.
     Riwayat insiden: dulu QA sweep + E2E login + AUTO-ACC (±50 email
     berurutan) dijalankan SEBELUM laporan dikirim → total sering >120 dtk →
     fetch dari cron Cloudflare kena timeout 120 dtk → laporan TIDAK PERNAH
     SAMPAI Discord (hilang seharian, tanpa alarm). Kini laporan inti
     (CTO/CSO/CMO/CFO + penawaran COO + prioritas kemarin) dikirim dulu
     <~60 dtk; QA/E2E/AUTO-ACC/diskusi CSO×CMO/NBA jadi FASE 2 — pesan
     terpisah SETELAH laporan utama aman. */
  const day = wibDay()
  const briefingT0 = Date.now()
  const [cto, cso, cmo, cfo, cooLine] = await Promise.all([
    ctoAgent(e).catch((x: any) => ({ siteOk: false, status: 0, latencyMs: 0, bugs24h: -1, err: String(x?.message || x) })),
    csoAgent(e).catch((x: any) => ({ total: -1, active: -1, passive: -1, err: String(x?.message || x) })),
    cmoAgent(e).catch((x: any) => ({ draft: '', angle: '', usedFallback: false, error: String(x?.message || x) })),
    cfoAgent(e).catch((x: any) => ({ limit: 0, usedToday: 0, usedYesterday: 0, quota429: 0, status: 'error', err: String(x?.message || x) })),
    cooYesterdayLine(e).catch(() => ''),
  ])

  /* AKUNTABILITAS NBA — Alexander ingatkan prioritas KEMARIN dulu.
     Bos jadi punya jejak: dilakukan atau harus ada alasan ganti.
     ⭐ Bos bisa jawab oke/not-oke (tombol Ruang Rapat / slash command
     Discord /nba-oke · /nba-not) — jawaban dicatat & briefing menghormati itu. */
  let nbaLine = ''
  try {
    const raw = await kvGet(e, 'nba:last')
    if (raw) {
      const p = JSON.parse(raw) as { at?: string; text?: string }
      /* Task 35g: tanggal proposal dikonversi ke WIB dulu (dulu langsung pakai
         potongan ISO UTC-nya — proposal jam 00:00–06:59 WIB salah dianggap "kemarin",
         verdict Bos yang tersimpan di key tanggal WIB jadi tak terbaca). */
      const atWibDay = p?.at ? new Date(new Date(p.at).getTime() + 7 * 3600_000).toISOString().slice(0, 10) : ''
      if (p?.text && atWibDay && atWibDay < wibDay()) {
        const verdict = await kvGet(e, `nba-verdict:${atWibDay}`)
        if (verdict === 'oke')
          nbaLine = `🎯 **PRIORITAS KEMARIN**: ${p.text}\n→ ✅ Bos sudah konfirmasi OKE — dicatat ke Memori Kantor. Kalau sudah tuntas, kabari Alexander buat update status.`
        else if (verdict === 'not')
          nbaLine = `🎯 **PRIORITAS KEMARIN**: ${p.text}\n→ ❌ Bos jawab NOT OKE — prioritas diganti tanpa rasa bersalah. Prioritas baru dipilih di bawah.`
        else
          nbaLine = `🎯 **PRIORITAS KEMARIN**: ${p.text}\n→ Bos, dilakukan? Kalau belum: jadikan prioritas utama hari ini, atau bilang Alexander kenapa diganti.`
      }
    }
  } catch { /* ignore */ }

  /* AUTO-ACC default ON — Maya kirim email pasif OTOMATIS tiap pagi tanpa
     diklik (Bos tidur, karyawan kerja). Untuk mematikan: toggle AUTO-ACC
     di Ruang CSO (diset eksplisit ke 'off'). */
  const autoOn = (await kvGet(e, 'autoacc').catch(() => null)) !== 'off'
  /* FASE BISNIS — pre-launch (bukan Senin) → BRIEFING SINGKAT tanpa LLM
     (lib/ceo-phase.ts): target peluncuran + kesehatan situs/bug + pendaftar
     + langkah checklist hari ini. Briefing PENUH tetap tiap Senin & saat
     fase early/growth (perilaku lama). Efek samping positif: mode
     "OTAK ALEXANDER OFFLINE" hilang di hari biasa pre-launch — laporan
     inti tidak lagi tergantung LLM yang bisa timeout. */
  const pinfo = await getPhase(phaseDeps(e), cleanEnv(e.PHASE_OVERRIDE)).catch(() => null)
  const compactMode = !!pinfo && pinfo.phase === 'pre-launch' && wibWeekday() !== 1
  const templateText = compactMode && pinfo
    ? buildCompactBriefing({ dateLine: wibNow(), info: pinfo, cto, cso, cfo, cmo, nbaLine })
    : buildBriefing(cto, cso, cmo, cfo, '', autoOn, null, cooLine, nbaLine, null)

  /* ALEXANDER (CEO) merangkai — Tahap T: timeout dinaikkan dari 30s → 45s
     karena model lama (gemma-4-31b) sering lambat & berebut kuota dengan
     Sinta/Dewi. Sekarang pakai nemotron-3.5-lightning (lebih cepat, 1M ctx).
     ⏱️ 10 Nov: batas compose jadi ADAPTIF — dulu patok 45 dtk padahal
     Promise.all agen (draf Sinta saat LLM lambat) bisa makan 30-60 dtk
     lebih dulu → sisa compose cuma belasan dtk → gampang kena tembak
     templat "OTAK ALEXANDER OFFLINE". Kini compose dapat sisa anggaran
     cron 120 dtk dikurangi waktu terpakai (dibatasi 30-75 dtk) — FASE 1
     total dipastikan tetap <120 dtk (105 = 120 - 15 margin Discord). */
  let text = templateText
  if (compactMode) {
    /* Pre-launch (bukan Senin): LOMPAT compose LLM — briefing singkat
       deterministic sudah final, tidak ada lagi mode "OTAK ALEXANDER
       OFFLINE" di hari biasa. */
    text = `${templateText}\n_(briefing singkat pre-launch — dihitung dari data nyata, tanpa LLM; briefing penuh tiap Senin)_`
  } else {
    const composeCap = Math.max(30_000, Math.min(75_000, 105_000 - (Date.now() - briefingT0)))
    try {
      /* budgetMs = composeCap dioper ke agentBrain → rantai Mortera→OpenRouter
         membagi anggaran INI (Mortera maks 60%, sisanya OpenRouter) — tidak
         ada lagi lapisan yang makan waktu sendiri-sendiri sampai withTimeout
         menembak padahal model masih mungkin menjawab. */
      const composed = await withTimeout(ceoComposeBriefing(e, templateText, composeCap), composeCap, null)
      if (composed?.text) {
        text = `${composed.text}\n_(dirapikan Alexander — CEO AI · ${composed.model})_`
        cfWaitUntil(memAdd(e, 'CEO Alexander', `Morning Briefing disusun via ${composed.model}`).catch(() => {}))
      } else {
        /* Task 35b: JANGAN diam-diam pakai templat — Bos harus tahu ini bukan
           rangkuman AI. Penyebab lengkap: klik 🩺 Diagnostik di Ruang CTO. */
        text = `⚠️ **OTAK ALEXANDER OFFLINE** — laporan di bawah hasil TEMPLAT, bukan rangkuman AI (model gagal merespons). Cek 🩺 Diagnostik di Ruang CTO untuk penyebab persisnya.\n\n${templateText}`
      }
    } catch (x: any) {
      text = `⚠️ **OTAK ALEXANDER OFFLINE** — penyebab: ${String(x?.message || x).slice(0, 200)}\nLaporan di bawah hasil TEMPLAT. Cek 🩺 Diagnostik di Ruang CTO.\n\n${templateText}`
    }
  }

  /* Kirim laporan utama — 2 percobaan (Discord kadang 429/ngambek). */
  let notifySent = false, notifyErr = ''
  for (let attempt = 0; attempt < 2 && !notifySent; attempt++) {
    try { await sendDiscord(e, text); notifySent = true; notifyErr = '' }
    catch (x: any) {
      notifyErr = String(x?.message || x)
      if (attempt === 0) await new Promise((r) => setTimeout(r, 2500))
    }
  }

  /* Tandai briefing hari ini SUDAH DICOBA — watchdog pakai ini untuk
     self-heal: kalau key ini belum "1" lewat jam 08:20 WIB, briefing
     dipicu ulang otomatis (maks 2×/hari). */
  await kvSet(e, `briefing:done:${day}`, notifySent ? '1' : '0').catch(() => {})
  if (!notifySent) cfWaitUntil(briefingFailEmail(e, notifyErr, text).catch(() => {}))

  const summary: Record<string, unknown> = { at: new Date().toISOString(), notifySent, notifyErr, cto, cso, cmo, cfo, talk: null, talkSent: false, nba: null, text, partial: true }
  await kvSet(e, 'briefing:last', JSON.stringify(summary)).catch(() => {})

  /* FASE 2 — lampiran & ekstra TIDAK BLOKIR response: auto-acc email,
     QA + E2E, diskusi CSO×CMO, NBA. cfWaitUntil → tetap jalan di Worker
     setelah response dikirim (kalau waitUntil tak tersedia → tetap dicoba). */
  /* FIX "Too many subrequests" GELOMBANG KEDUA (log produksi): FASE 2 dulu
     jalan via waitUntil — MASIH invokasi yang sama dgn FASE 1 → budget
     ±50 subrequest CF Workers free TETAP bisa habis di tengah jalan
     (auto-acc email bisa 50 penerima × 3 subrequest, QA sweep 14, E2E 10,
     talk + NBA masing-masing ±10) → email berhenti diam-diam, lampiran
     QA/talk/NBA hilang tanpa jejak.
     Kini tiap langkah dipicu sbg INVOKASI TERPISAH via self-call HTTP
     (pola yang sama dengan self-heal watchdog): invokasi baru = budget
     subrequest BARU. Tiap langkah punya dedup harian sendiri (acc_email /
     lamp:qa / cso-cmo / nba / cmo:posted) → re-run briefing tidak dobel
     kirim. Tanpa req (mis. pemanggilan lama) → fallback inline waitUntil. */
  try {
    if (!req) throw new Error('req tidak tersedia')
    const auth = req.headers.get('authorization') || ''
    for (const step of ['emails', 'qa', 'talk', 'work']) {
      const u2 = new URL(req.url)
      u2.searchParams.set('action', 'briefing-extras')
      u2.searchParams.set('step', step)
      if (cronKey) u2.searchParams.set('key', cronKey)
      cfWaitUntil(
        selfFetch(u2.toString(), {
          method: 'GET',
          /* Briefing manual dari browser Bos tidak bawa CRON_SECRET →
             forward sesi owner supaya invokasi anak lolos email-gate. */
          headers: !cronKey && auth ? { Authorization: auth } : undefined,
          signal: timeoutSignal(115_000),
        })
          .then((r) => console.log(`[briefing] fase-2 "${step}" (invokasi terpisah) → HTTP ${r.status}`))
          .catch((x: any) => console.warn(`[briefing] fase-2 "${step}" gagal dipicu:`, String(x?.message || x)))
      )
    }
  } catch {
    cfWaitUntil(briefingExtras(e, { day, autoOn, briefingText: text, summary }).catch(() => {}))
  }

  return summary
}

/* FASE 2 briefing — pekerjaan lambat SETELAH laporan utama aman di Discord.
   Semua hasil dikirim sebagai PESAN DISCORD TERPISAH + briefing:last
   di-merge supaya dashboard Ruang CEO tetap lengkap. */
async function briefingExtras(e: Env, ctx: { day: string; autoOn: boolean; briefingText: string; summary: Record<string, unknown> }, step = 'all'): Promise<void> {
  const { day, autoOn, briefingText, summary } = ctx
  /* step = 'emails' | 'qa' | 'talk' | 'all' — tiap langkah kini dijalankan
     di INVOKASI TERPISAH (budget subrequest sendiri, lihat runMorningBriefing).
     'all' hanya dipakai fallback inline lama. */
  const runStep = (s: string) => step === 'all' || step === s

  /* AUTO-ACC — kalau owner menyalakannya, CSO kirim email pasif OTOMATIS
     (1×/hari, dedup via agent_kv acc_email:<tanggal>). Bos tidur, karyawan kerja.
     ±50 email berurutan itu LAMA — dulu bikin briefing lewat timeout cron. */
  try {
    if (runStep('emails') && autoOn && !(await kvGet(e, `acc_email:${day}`))) {
      await kvSet(e, `acc_email:${day}`, new Date().toISOString())
      let autoAcc = ''
      if (cfSecret(e, 'RESEND_API_KEY')) {
        try { const r = await sendPassiveEmails(e); autoAcc = `📧 AUTO-ACC: ${r.sent} email PERSONAL terkirim ke 2 grup — ${r.sentDormant} vakum + ${r.sentNever} belum pernah upload (draf: "${r.variant}"; ${r.personalized} pakai data trading asli penerima; draf Maya via ${r.emailProvider === 'template' ? 'templat statis' : r.emailModel || r.emailProvider})` }
        catch (x: any) { autoAcc = `📧 AUTO-ACC gagal kirim: ${String(x?.message || x).slice(0, 80)}` }
      } else autoAcc = '📧 AUTO-ACC aktif tapi RESEND_API_KEY belum diset — email belum terkirim'
      try { await sendDiscord(e, autoAcc) } catch { /* ignore */ }
      summary.autoAcc = autoAcc
    }
  } catch { /* opsional */ }

  /* QA + E2E — Raka sweep semua fitur (lama) → hasil jadi LAMPIRAN terpisah.
     Dedup per hari supaya self-heal/manual re-run tidak dobel kirim. */
  try {
    /* QA 15 route + E2E login cukup MINGGUAN (Senin) — spec perbaikan
       kantor AI: hasilnya hampir selalu sama tiap hari & makan waktu.
       Watchdog 15 menit (alarm DOWN/bug/kuota) tetap harian; tes manual
       action=qa / action=e2e tetap bisa dipicu kapan pun dari Ruang CTO. */
    if (runStep('qa') && wibWeekday() === 1 && !(await kvGet(e, `lamp:qa:${day}`))) {
      await kvSet(e, `lamp:qa:${day}`, new Date().toISOString())
      const [qa, e2e] = await Promise.all([
        qaAgent(e).catch((x: any) => ({ total: 0, ok: 0, fails: [], avgMs: 0, err: String(x?.message || x) })),
        e2eAgent(e).catch((x: any) => ({ e2eTotal: 0, e2eFailed: 1, e2eSteps: [], e2eVerdict: String(x?.message || x) } as any)),
      ])
      const L: string[] = []
      if (qa?.total > 0) {
        L.push(qa.fails?.length
          ? `• QA ${qa.total} fitur dashboard: ${qa.ok} OK, ${qa.fails.length} MASALAH ⚠️`
          : `• QA otomatis ${qa.total} fitur dashboard: SEMUA OK ✅ (rata-rata ${qa.avgMs} ms)`)
        for (const f of (qa.fails || []).slice(0, 6))
          L.push(`   ↳ ${f.path} → ${f.status || 'timeout'}${f.err ? ' — ' + f.err : ''}`)
      }
      if (e2e?.e2eTotal > 0) {
        L.push(e2e.e2eFailed
          ? `• E2E LOGIN + tes fitur satu-satu: ${e2e.e2ePassed}/${e2e.e2eTotal} lolos ⚠️`
          : `• E2E LOGIN + tes fitur satu-satu (${e2e.e2eTotal} langkah): SEMUA OK ✅ (${(e2e.e2eDurMs / 1000).toFixed(1)}s)`)
        for (const f of (e2e.e2eSteps || []).filter((s: any) => !s.ok).slice(0, 5))
          L.push(`   ↳ ${f.label}: ${String(f.detail || 'gagal').slice(0, 90)}`)
      }
      if (L.length) { try { await sendDiscord(e, `📎 **LAMPIRAN QA CTO (Raka)**\n${L.join('\n')}`) } catch { /* ignore */ } }
      summary.qa = qa
      summary.e2e = e2e
    }
  } catch { /* opsional */ }

  /* DISKUSI HARIAN CSO × CMO — 1×/hari. Pesan Discord terpisah + panel
     Ruang CSO. Kalau Bos sudah jalankan manual hari ini → skip (no duplikat). */
  try {
    if (runStep('talk') && !(await kvGet(e, `cso-cmo:${day}`))) {
      await kvSet(e, `cso-cmo:${day}`, new Date().toISOString())
      const talk = await csoCmoTalk(e)
      summary.talk = talk
      try { await sendDiscord(e, talkToDiscord(talk)); summary.talkSent = true } catch { /* ignore */ }
    } else if (runStep('talk')) {
      const raw = await kvGet(e, 'cso-cmo:last')
      if (raw) summary.talk = JSON.parse(raw)
    }
  } catch { /* talk opsional */ }

  /* AUTO-POSTING NYATA SINTA (Task 32 SOP Bos) — draf utama hari ini
     diposting ke Instagram/Facebook via Meta Graph API (token kredensial),
     1×/hari (dedup KV), toggle cmo:autopost. Sengaja di FASE 2 ini (bukan
     di cmoAgent) supaya Fase 1 laporan tetap <60 dtk — pelajaran Task 29.
     Tanpa token → status JUJUR "belum diset", tidak ada simulasi sukses. */
  try {
    if (runStep('talk') && !(await kvGet(e, `cmo:posted:${day}`)) && (await kvGet(e, 'cmo:autopost')) !== 'off') {
      let draftText = ''
      try { draftText = String(JSON.parse((await kvGet(e, `cmo:${day}`)) || 'null')?.draft || '') } catch { /* ignore */ }
      if (draftText) {
        const post: MetaPostResult = await metaAutoPost(draftText)
        summary.cmoPost = post
        if (post.posted) {
          await kvSet(e, `cmo:posted:${day}`, JSON.stringify(post)).catch(() => {})
          await memAdd(e, 'CMO Sinta', `Draf hari ini NYATA diposting ke ${post.platform === 'instagram' ? 'Instagram' : 'Facebook'} (Graph API id ${String(post.id).slice(0, 18)})`).catch(() => {})
        }
        const line = post.posted
          ? `🚀 AUTO-POST SINTA: draf hari ini NYATA tayang di ${post.platform === 'instagram' ? 'Instagram' : 'Facebook'} (Graph API) ✅`
          : `🚀 AUTO-POST SINTA belum jalan: ${String(post.reason || '').slice(0, 140)}`
        try { await sendDiscord(e, line) } catch { /* ignore */ }
      }
    }
  } catch { /* auto-post opsional — jangan ganggu fase 2 lain */ }

  /* AUTO-POSTING INSTAGRAM ANALISIS (Tahap T) — Caption IG terpisah
     dari draf TikTok. Sinta bikin caption educational berbasis data
     REAL komunitas 24 jam (win rate, pair favorit) → diposting ke IG
     via Meta Graph API. Dedup `cmo:ig-posted:${day}` terpisah dari
     `cmo:posted:${day}` (TikTok) supaya keduanya bisa jalan hari yang
     sama. Sengaja di FASE 2 supaya Fase 1 briefing tetap cepat. */
  try {
    if (runStep('talk') && !(await kvGet(e, `cmo:ig-posted:${day}`)) && (await kvGet(e, 'cmo:autopost')) !== 'off') {
      const ig = await cmoInstagramCaption(e)
      if (ig?.caption) {
        const post: MetaPostResult = await metaAutoPost(ig.caption)
        summary.igPost = { ...ig, post }
        if (post.posted) {
          await kvSet(e, `cmo:ig-posted:${day}`, JSON.stringify(post)).catch(() => {})
          await memAdd(e, 'CMO Sinta', `Caption IG analisis NYATA diposting ke ${post.platform === 'instagram' ? 'Instagram' : 'Facebook'} (id ${String(post.id).slice(0, 18)})`).catch(() => {})
        }
        const line = post.posted
          ? `AUTO-POST IG ANALISIS: caption IG analisis trading NYATA tayang di ${post.platform === 'instagram' ? 'Instagram' : 'Facebook'} (Graph API)`
          : `AUTO-POST IG ANALISIS belum jalan: ${String(post.reason || '').slice(0, 140)}`
        try { await sendDiscord(e, line) } catch { /* ignore */ }
      }
    }
  } catch { /* IG auto-post opsional — jangan ganggu fase 2 lain */ }

  /* ARTEFAK MINGGUAN (lib/ceo-phase.ts runDailyWork) — kalender konten
     (Minggu), onboarding + titik impas (Senin), outbound + eksperimen
     (Selasa), artikel SEO (Rabu), audit SEO teknis (Kamis), community
     seeding (Sabtu). Tiap job dedup harian internal; artefak tersimpan di
     agent_kv (art:index + art:body:<id>) dan dinotifikasikan Discord oleh
     modul. Jalan di SEMUA fase (info fase hanya konteks prompt). */
  try {
    if (runStep('work')) {
      const d = phaseDeps(e)
      const info = await getPhase(d, cleanEnv(e.PHASE_OVERRIDE))
      summary.work = await runDailyWork(d, info)
    }
  } catch (x: any) { summary.workError = String(x?.message || x).slice(0, 140) }

  /* NEXT BEST ACTION — Alexander pilih 1 prioritas Bos hari ini
     (pesan Discord terpisah + tampil di Ruang Rapat). Dedup harian. */
  try {
    if (runStep('talk') && !(await kvGet(e, `nba:${day}`))) {
      await kvSet(e, `nba:${day}`, new Date().toISOString())
      const t = await nextBestAction(e, briefingText)
      if (t) summary.nba = { at: new Date().toISOString(), text: t }
    } else if (runStep('talk')) {
      const raw = await kvGet(e, 'nba:last')
      if (raw) summary.nba = JSON.parse(raw)
    }
  } catch { /* opsional */ }

  /* Merge hasil langkah ini ke briefing:last (dashboard Ruang CEO tetap
     lengkap). Baca FRESH → tulis utuh: invokasi paralel antar langkah
     tidak saling menimpa hasil FASE 1 / langkah lain. */
  try {
    const raw = await kvGet(e, 'briefing:last')
    const last = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>
    Object.assign(last, summary)
    last.partial = false
    await kvSet(e, 'briefing:last', JSON.stringify(last))
  } catch { /* ignore */ }
}
/* ---------- flow "ACC EMAIL": email ke user pasif ----------
   v3: EMAIL PERSONAL per user — Maya baca data trading ASLI tiap
   penerima (jumlah trade, pair favorit, berapa hari lalu terakhir
   upload, onboarding) → tiap user dapat email yang relevan dengan
   DIRINYA, bukan template generik. Variasi pesan tetap dirotasi
   harian (anti email fatigue) + ID penerima dicatat → besok dihitung
   berapa yang BALIK upload (feedback loop nyata). */

const PASSIVE_VARIANTS = [
  {
    subject: 'Lama gak ketemu 👋',
    text: 'Yuk evaluasi visual hari ini di https://luxtradee.web.id — cuma 2 menit.\n\n— Tim Luxtrade',
  },
  {
    subject: 'Jurnal lo masih nunggu 📈',
    text: 'Jurnal yang kosong itu kehilangan data — trade bagus hari ini bisa jadi pelajaran besok.\n\nUpload screenshot terakhir lo, 2 menit langsung dapat evaluasi visual: https://luxtradee.web.id\n\n— Tim Luxtrade',
  },
  {
    subject: 'Setup terakhir lo kapan? 🎯',
    text: 'Trader disiplin itu yang nyatet setiap entry — bukan yang hafal.\n\nBalik lagi yuk: upload 1 screenshot, biarkan AI yang evaluasi. https://luxtradee.web.id\n\n— Tim Luxtrade',
  },
]

/* Task 35h (SOP Bos): email untuk GRUP B — user yang daftar tapi BELUM PERNAH
   upload 1 trade pun (beda kandidat & beda nada dari GRUP A vakum di atas).
   Fallback statis kalau draf LLM Maya gagal — sama seperti GRUP A. */
const NEVER_UPLOADED_VARIANTS = [
  {
    subject: 'Satu langkah kecil buat mulai 🚀',
    text: 'Akunnya sudah siap, tinggal 1 langkah: upload 1 screenshot trade lo di https://luxtradee.web.id — dalam 2 menit AI kasih evaluasi visual lengkap.\n\nNggak perlu data lengkap, cukup 1 gambar buat mulai.\n\n— Tim Luxtrade',
  },
  {
    subject: 'Evaluasi AI pertamamu nungguin 📊',
    text: 'Banyak trader nunggu "moment yang pas" buat mulai — padahal cuma butuh 1 screenshot.\n\nUpload yang pertama di https://luxtradee.web.id, AI langsung kasih analisis entry, risk & hasilnya.\n\n— Tim Luxtrade',
  },
  {
    subject: 'Coba 2 menit sore ini yuk ⏱️',
    text: 'Fitur evaluasi AI-nya gratis dicoba: upload 1 screenshot trading lo, 2 menit kemudian keluar analisis visualnya.\n\nSiapa tahu ini kebiasaan bagus pertama di 2025 — mulai dari 1 gambar.\n\n— Tim Luxtrade',
  },
]

/* Footer statis — SELALU ditambahkan sistem (bukan LLM) supaya link &
   tanda tangan tidak pernah hilang/halusinasi. */
const CSO_EMAIL_FOOTER = 'Upload screenshot terakhir lo — evaluasi AI jalan dalam 2 menit: https://luxtradee.web.id\n\n— Tim Luxtrade'
/* Rotasi 3 variasi nada email Maya (SOP: rotasi 3 variasi) */
const CSO_EMAIL_TONES = [
  'sapaan hangat yang kangen — seperti teman lama yang peduli',
  'motivasi disiplin — trader hebat adalah yang balik lagi setelah vakum',
  'nostalgia — ingatkan betapa cepat waktu berlalu & jurnalnya masih menunggu',
]

interface PerUserTrade { n: number; top: string; lastAt: number; wins: number }

async function buildPerUserTradeMap(e: Env): Promise<Map<string, PerUserTrade>> {
  const map = new Map<string, PerUserTrade>()
  try {
    const rows = await fetchTrades30(e)
    for (const r of rows) {
      if (!r.user_id) continue
      const cur = map.get(r.user_id) || { n: 0, top: '', lastAt: 0, wins: 0 }
      cur.n++
      if ((r.profit_loss || 0) > 0) cur.wins++
      if (r.symbol) (cur as any)._sym = { ...((cur as any)._sym || {}), [r.symbol]: (((cur as any)._sym || {})[r.symbol] || 0) + 1 }
      if (r.created_at) cur.lastAt = Math.max(cur.lastAt, new Date(r.created_at).getTime())
      map.set(r.user_id, cur)
    }
    /* pair favorit per user */
    for (const [, v] of map) {
      const syms = (v as any)._sym as Record<string, number> | undefined
      if (syms) v.top = Object.entries(syms).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
      delete (v as any)._sym
    }
  } catch { /* tanpa data trade → email tetap terkirim (mode generik) */ }
  return map
}

function personalLine(name: string, t: PerUserTrade | undefined, createdAgeDays: number): string {
  const hai = name ? `Hai ${name}!` : 'Hai!'
  if (t && t.n > 0) {
    const days = Math.max(1, Math.round((Date.now() - t.lastAt) / 86400_000))
    const wr = Math.round((t.wins / t.n) * 100)
    return `${hai} Kamu sudah nyatet ${t.n} trade di Luxtrade${t.top ? ` — ${t.top} jadi pair andalanmu` : ''} (win rate catatanmu ${wr}%). Terakhir upload ${days} hari lalu — momen bagus gak boleh putus di sini.`
  }
  if (createdAgeDays >= 3)
    return `${hai} Akunmu sudah ${createdAgeDays} hari bergabung, tapi belum ada 1 screenshot pun yang diupload — padahal evaluasi AI-nya cuma butuh 2 menit per trade.`
  return hai
}

async function sendPassiveEmails(e: Env): Promise<{ sent: number; ids: string[]; variant: string; personalized: number; emailProvider: string; emailModel: string; sentDormant: number; sentNever: number }> {
  const since = isoAgo(24)
  const activeIds = await fetchActiveUserIds(e, since)

  // kandidat: profil dengan email, terbaru dulu — maks 200 kandidat
  /* Pakai service_role key — profiles butuh bypass RLS */
  const url = `${sbUrl(e)}/rest/v1/profiles?select=id,email,full_name,created_at&email=not.is.null&order=created_at.desc&limit=200`
  const res = await fetch(url, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
  if (!res.ok) throw new Error(`Supabase profiles HTTP ${res.status}${res.status === 401 && !cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY) ? ' — set SUPABASE_SERVICE_ROLE_KEY' : ''}`)
  const profiles = (await res.json()) as { id?: string; email?: string; full_name?: string | null; created_at?: string }[]

  /* Task 35h (SOP Bos) — DUA GRUP, masing-masing draf BERBEDA:
     GRUP A "dormant"  : pernah upload trade (data nyata ada) tapi >24 jam diam
                         → email rasa kangen/nilai jurnal (nada lama).
     GRUP B "never"    : BELUM pernah upload 1 trade pun & akun ≥3 hari
                         (baru daftar <3 hari tidak diganggu) → email ajakan pertama.
     Maks total 20 (A 12 + B 8): selain Resend free 100/hari tetap aman, tiap
     email = 1 fetch + langkah ini kini jalan di invokasi sendiri yang dibatasi
     CF Workers free ±50 subrequest → 50 penerima dulu bikin budget jebol di
     tengah antrean (email berhenti diam-diam). 20 = aman dgn headroom LLM/KV. */
  const tradeMap0 = await buildPerUserTradeMap(e)

  /* 🔗 UNIFIKASI COOLDOWN KARYAWAN (penutup temuan AUTO-ACC): lead yang sedang
     ditangani karyawan LAIN tidak di-email Maya di sini —
     (a) ai_pending_actions agent_name in (Bagas, Maya) window 7 hari
         (proposal upgrade Bagas + winback proposal Maya via sweep/master);
     (b) ai_pending_tasks agent_type='COO' (draf cron COO harian).
     Window ikut executed_at → ACC telat tetap dihitung. FAIL-OPEN: query
     gagal / tabel belum ada → set kosong → perilaku lama. */
  const sinceCd = bagasCooldownSince()
  let cooledEmails = new Set<string>()
  const cooledIds = new Set<string>()
  try {
    const actRes = await fetch(`${sbUrl(e)}/rest/v1/ai_pending_actions?select=action_payload&agent_name=in.(Bagas,Maya)&${bagasCooldownOrFilter(sinceCd)}&limit=200`, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
    if (actRes.ok) cooledEmails = emailsFromActionRows(await actRes.json())
  } catch { /* fail-open */ }
  try {
    const taskRes = await fetch(`${sbUrl(e)}/rest/v1/ai_pending_tasks?select=target_user_id,context_data&agent_type=eq.COO&${bagasCooldownOrFilter(sinceCd)}&limit=200`, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
    if (taskRes.ok) {
      const cross = contactsFromTaskRows(await taskRes.json())
      for (const em of cross.emails) cooledEmails.add(em)
      for (const id of cross.userIds) cooledIds.add(id)
    }
  } catch { /* fail-open */ }

  const allTargets = profiles.filter((p) => p.email && p.id && !activeIds.has(p.id)
    && !cooledIds.has(p.id as string)
    && !cooledEmails.has(normEmail(p.email)))
  const dormant = allTargets.filter((p) => (tradeMap0.get(p.id as string)?.n || 0) > 0).slice(0, 12)
  const never = allTargets
    .filter((p) => !(tradeMap0.get(p.id as string)?.n) && p.created_at && Date.now() - new Date(p.created_at).getTime() >= 3 * 86400_000)
    .slice(0, 8)
  const targets = [...dormant, ...never]

  /* SOP Multi-Agent — MAYA (CSO) meracik draf email hari ini pakai model
     resminya (google/gemma-4-26b-a4b-it:free via OpenRouter — Task 35), rotasi 3 variasi
     nada. Task 35h: DUA panggilan LLM — 1 draf per grup, tiap grup dapat email
     yang pas dengan kondisinya. 1 panggilan LLM/hari/grup; sapaan personal per
     user tetap dari data trading ASLI (personalLine) + CTA statis sistem.
     Gagal → templat statis (PASSIVE_VARIANTS / NEVER_UPLOADED_VARIANTS). */
  const variantIdx = dayIndex() % PASSIVE_VARIANTS.length
  const draftDormant = async () => {
    let variant = PASSIVE_VARIANTS[variantIdx]
    let provider = 'template', model = ''
    try {
      const brain = await agentBrain(
        e, 'cso',
        'Kamu Maya, CSO Luxtradee — web app jurnal trading XAUUSD (upload screenshot → evaluasi AI). Tulis 1 email untuk USER LAMA yang sudah PERNAH nyatet trade tapi sekarang vakum (tidak upload >24 jam, banyak berminggu-minggu). Gaya: hangat & kangen seperti teman lama, ingatkan nilai jurnalnya (data trade & win rate-nya sudah terkumpul), BUKAN nagih, maksimal 80 kata, TANPA link/URL apa pun (sistem menambahkan link & tanda tangan otomatis), TANPA markdown, TANPA sapaan nama (sistem menambahkan sapaan personal per penerima). ' +
        `Nada variasi hari ini: ${CSO_EMAIL_TONES[variantIdx]}. ` +
        'OUTPUT HANYA JSON valid: {"subject":"maks 60 karakter, boleh 1 emoji","body":"isi email tanpa sapaan nama"} ' +
        REAL_DATA_RULE,
        `Konteks nyata: ${dormant.length} user lama vakum akan dikontak hari ini (dari database). Tanggal: ${wibNow()}.`,
        400, 0.8,
      )
      const parsed = JSON.parse(extractJsonLoose(brain.text) || '{}') as { subject?: string; body?: string }
      const subject = String(parsed.subject || '').replace(/https?:\/\/\S+/g, '').trim().slice(0, 120)
      const body = String(parsed.body || '').replace(/https?:\/\/\S+/g, '').replace(/```/g, '').trim().slice(0, 700)
      if (subject && body && body.length > 40) {
        variant = { subject, text: `${body}\n\n${CSO_EMAIL_FOOTER}` }
        provider = brain.provider
        model = brain.model
      }
    } catch { /* templat statis tetap dipakai */ }
    return { variant, provider, model }
  }
  const draftNever = async () => {
    let variant = NEVER_UPLOADED_VARIANTS[variantIdx % NEVER_UPLOADED_VARIANTS.length]
    let provider = 'template', model = ''
    try {
      const brain = await agentBrain(
        e, 'cso',
        'Kamu Maya, CSO Luxtradee — web app jurnal trading XAUUSD (upload screenshot → evaluasi AI). Tulis 1 email untuk user yang daftar TAPI BELUM PERNAH upload 1 trade pun (akunnya sudah ≥3 hari). Mereka ragu/gak tahu mulai dari mana — hilangkan rasa canggung itu: tekankan cukup 1 screenshot & 2 menit, semua fitur bisa langsung dirasakan. Gaya: ramah, meringankan, tanpa tekanan, maksimal 80 kata, TANPA link/URL apa pun (sistem menambahkan link & tanda tangan otomatis), TANPA markdown, TANPA sapaan nama (sistem menambahkan sapaan personal per penerima). ' +
        'OUTPUT HANYA JSON valid: {"subject":"maks 60 karakter, boleh 1 emoji","body":"isi email tanpa sapaan nama"} ' +
        REAL_DATA_RULE,
        `Konteks nyata: ${never.length} user belum pernah upload akan dikontak hari ini (dari database). Tanggal: ${wibNow()}.`,
        400, 0.8,
      )
      const parsed = JSON.parse(extractJsonLoose(brain.text) || '{}') as { subject?: string; body?: string }
      const subject = String(parsed.subject || '').replace(/https?:\/\/\S+/g, '').trim().slice(0, 120)
      const body = String(parsed.body || '').replace(/https?:\/\/\S+/g, '').replace(/```/g, '').trim().slice(0, 700)
      if (subject && body && body.length > 40) {
        variant = { subject, text: `${body}\n\n${CSO_EMAIL_FOOTER}` }
        provider = brain.provider
        model = brain.model
      }
    } catch { /* templat statis tetap dipakai */ }
    return { variant, provider, model }
  }
  /* Dua draf diracik paralel — hemat waktu (2 panggilan LLM berbeda prompt) */
  const [drA, drB] = await Promise.all([draftDormant(), draftNever()])
  const variantA = drA.variant, variantB = drB.variant
  let emailProvider = drA.provider === 'template' ? drB.provider : drA.provider
  let emailModel = drA.model || drB.model
  const variantLabel = `${variantA.subject} | ${variantB.subject}`

  /* Data trading personal per penerima — sudah dibangun di atas (tradeMap0) */
  const tradeMap = tradeMap0

  let sent = 0, personalized = 0, sentDormant = 0, sentNever = 0
  const emailedIds: string[] = []
  for (const p of targets) {
    const t = tradeMap.get(p.id as string)
    const isDormant = (t?.n || 0) > 0
    const v = isDormant ? variantA : variantB
    const createdAgeDays = p.created_at ? Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400_000) : 0
    const name = (p.full_name || '').trim().split(/\s+/)[0] || ''
    const line = personalLine(name, t, createdAgeDays)
    if (t || createdAgeDays >= 3) personalized++
    const body = `${line}\n\n${v.text}`
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${e.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: p.email as string,
        subject: v.subject,
        text: body,
      }),
      signal: timeoutSignal(10_000),
    }).catch(() => null)
    if (r && (r as any).ok) {
      sent++
      if (isDormant) sentDormant++; else sentNever++
      emailedIds.push(p.id as string)
    }
  }
  /* CFO: pantau kuota Resend — DI-BATCH 1× tulis. Dulu kvIncr per email =
     2 subrequest per penerima (makan habis budget ±50 CF Workers free).
     Hitung ulang dari 0 + sent tetap akurat: dedup harian menjamin satu
     pengirim per hari, jadi tidak ada penulis paralel. */
  if (sent) {
    try {
      const prev = parseInt((await kvGet(e, `email:${wibDay()}`)) || '0', 10)
      await kvSet(e, `email:${wibDay()}`, String(prev + sent))
    } catch { /* opsional */ }
  }
  /* simpan siapa saja yang di-email hari ini → besok dihitung "balik aktif" */
  if (emailedIds.length) await kvSet(e, `csmailed:${wibDay()}`, JSON.stringify(emailedIds.slice(0, 50))).catch(() => {})
  if (sent) await memAdd(e, 'CSO Maya', `${sent} email personal ke 2 grup: ${sentDormant} user vakum (draf "${variantA.subject}") + ${sentNever} belum pernah upload (draf "${variantB.subject}"); ${personalized} pakai data trade asli penerima; draf via ${emailProvider === 'template' ? 'templat statis' : emailModel}`)
  return { sent, ids: emailedIds, variant: variantLabel, personalized, emailProvider, emailModel, sentDormant, sentNever }
}

/* ============================================================
   WATCHDOG — CTO jaga situs 24/7 (dipanggil cron tiap 15 menit)
   Cek situs + bug + kuota. Kalau ada masalah → ALARM DISCORD INSTAN
   (tidak nunggu briefing besok pagi). Kalau aman → diam saja,
   cuma catat riwayat uptime ke agent_kv.
   ============================================================ */
async function watchdog(e: Env, req: Request, cronKey: string) {
  const day = wibDay()
  const alerts: string[] = []

  /* 1) ping situs + hitung bug — pakai ctoAgent (sudah ada retry + abaikan 521-524) */
  const cto = await ctoAgent(e).catch((x: any) => ({ siteOk: false, status: 0, latencyMs: 0, bugs24h: -1, err: String(x?.message || x) }))
  await kvIncr(e, `${cto.siteOk ? 'up' : 'down'}:${day}`).catch(() => {}) // riwayat uptime

  /* site DOWN → alarm (dedup 30 menit biar nggak spam).
     FIX ANTI-FLOOD: dedup LAPIS DUA — KV + fallback memori isolate.
     Dulu kalau agent_kv gagal (key dirotasi → 401), lastDown selalu terbaca 0
     dan kvSet gagal senyap → alarm DOWN terulang TIAP 15 MENIT. Kini fallback
     memori menahan alarm walau KV mati. */
  let lastDown = 0
  try { lastDown = parseInt((await kvGet(e, 'wd:down:last')) || '0', 10) } catch { /* ignore */ }
  if (!cto.siteOk && Date.now() - Math.max(lastDown, _memDownAlertAt) > 30 * 60_000) {
    _memDownAlertAt = Date.now()
    await kvSet(e, 'wd:down:last', String(Date.now()))
    const msg = `🚨 **CTO WATCHDOG — WEBSITE DOWN!**\n• Status: ${cto.status || 'timeout'}\n• ${String(cto.err || '').slice(0, 150)}\nCek sekarang: https://luxtradee.web.id`
    try { await sendDiscord(e, msg); alerts.push('situs-down') } catch { /* ignore */ }
  }
  /* site pulih → kabari sekali */
  if (cto.siteOk && lastDown && Date.now() - lastDown < 2 * 3600_000) {
    const rk = `wd:recovered:${day}`
    if ((await kvGet(e, rk)) !== '1') {
      await kvSet(e, rk, '1')
      try { await sendDiscord(e, '✅ **CTO WATCHDOG** — Website kembali ONLINE! Semua normal.'); alerts.push('situs-pulih') } catch { /* ignore */ }
    }
  }

  /* 2) bug baru → alarm sekali per kenaikan angka */
  let bugsAlertedRaw: string | null = null
  try { bugsAlertedRaw = await kvGet(e, 'wd:bugs:last') } catch { /* ignore */ }
  if (cto.bugs24h >= 0) {
    if (bugsAlertedRaw == null) {
      await kvSet(e, 'wd:bugs:last', String(cto.bugs24h)) // baseline pertama, tanpa alarm
    } else if (cto.bugs24h > parseInt(bugsAlertedRaw || '0', 10)) {
      await kvSet(e, 'wd:bugs:last', String(cto.bugs24h))
      /* TRIAGE otomatis (RAKA — CTO): 3 bug terakhir diringkas jadi diagnosa
         + prioritas P1-P3 oleh model resmi Raka (nvidia/nemotron-3.5-lightning:free via OpenRouter — Task 35, qwen lama 404) → Bos nggak perlu buka Supabase manual.
         LLM hanya dipanggil SAAT bug baru masuk (bukan tiap 15 mnt). */
      let triage = ''
      try {
        const bres = await fetch(`${sbUrl(e)}/rest/v1/bug_reports?select=description&order=created_at.desc&limit=3`, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
        const bugs: { description?: string }[] = bres.ok ? await bres.json() : []
        const list = bugs.map((b, i) => `${i + 1}. ${String(b.description || '').replace(/\s+/g, ' ').slice(0, 300)}`).filter((s) => s.length > 3).join('\n')
        if (list) {
          try {
            const brain = await agentBrain(
              e, 'cto',
              'Kamu Raka, CTO Luxtradee (web app jurnal trading). Ringkas laporan bug user jadi diagnosa singkat & actionable. Format per baris: "- [P1/P2/P3] masalah → kemungkinan penyebab/lokasi". P1=kritis (situs/fitur utama mati), P2=gangguan, P3=minor. Satu baris per bug, tanpa pembuka/penutup.',
              `Laporan bug terbaru:\n${list}`,
              512, 0.3,
            )
            triage = brain.text
          } catch { triage = list } // semua model gagal → alarm tetap kirim dgn daftar mentah
        }
      } catch { /* triage opsional — gagal → kirim alarm tanpa detail */ }
      const msg = `🐞 **CTO WATCHDOG — BUG BARU MASUK!**\n• Total 24 jam: ${cto.bugs24h} bug\n${triage ? triage.slice(0, 900) + '\n' : ''}Segera cek tabel bug_reports di Supabase.`
      try { await sendDiscord(e, msg); alerts.push('bug-baru') } catch { /* ignore */ }
    }
  }

  /* 3) kuota Gemini >= 80% → alarm 1×/hari */
  const cfo = await cfoAgent(e).catch(() => null)
  let quota = ''
  if (cfo && cfo.limit > 0) {
    quota = `${cfo.usedToday}/${cfo.limit}`
    const pct = Math.round((cfo.usedToday / cfo.limit) * 100)
    let flagged = ''
    try { flagged = (await kvGet(e, `wd:quota:${day}`)) || '' } catch { /* ignore */ }
    /* FIX ANTI-FLOOD: lapis dedup memori isolate — kalau KV gagal, alarm kuota
       tetap MAKS 1×/hari (dulu bisa tiap 15 menit saat agent_kv 401). */
    if (pct >= 80 && flagged !== 'sent' && _memQuotaAlertDay !== day) {
      _memQuotaAlertDay = day
      await kvSet(e, `wd:quota:${day}`, 'sent')
      const msg = `💰 **CFO WATCHDOG — KUOTA ${pct}% TERPAKAI**\n• ${cfo.usedToday}/${cfo.limit} request hari ini\n• Status: ${cfo.status}`
      try { await sendDiscord(e, msg); alerts.push('kuota-80') } catch { /* ignore */ }
    }
  }

  /* 4) SELF-HEAL BRIEFING — kalau sudah lewat 08:20 WIB tapi laporan pagi
     belum terkirim hari ini (cron 08:00 timeout/gagal/401), watchdog picu
     briefing ulang otomatis. Maks 2×/hari biar tidak spam. Bos tidur,
     laporan tetap sampai. */
  try {
    const done = await kvGet(e, `briefing:done:${day}`)
    if (done !== '1') {
      const hm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
      const hh = parseInt(hm.slice(0, 2), 10)
      const mm = parseInt(hm.slice(3, 5), 10)
      if (hh > 8 || (hh === 8 && mm >= 20)) {
        /* FIX ANTI-FLOOD (Bos 6 Nov: "kenapa masih dapet pesan alert di Discord?"):
           dulu: kvGet(briefing:heal) gagal → dianggap 0 → heal JALAN, lalu
           kvIncr-nya .catch(() => {}) → counter GAGAL PERSIST → run berikutnya
           tetap "0 < 2" → BRIEFING DIPICU ULANG TIAP 15 MENIT SEHARI PANJANG
           (flood briefing 401 ke Discord ±08:20–12:38 WIB 6 Nov).
           Kini FAIL-CLOSED: heal hanya boleh jalan kalau counter BENAR-BENAR
           TERTULIS di agent_kv (hasil kvIncr = 1 atau 2). KV mati → TANPA heal
           — briefing bolong sehari lebih baik daripada spam tanpa batas; cron
           08:00 tetap jalur utama, dan status tetap terpantau di cron_runs. */
        let heal = -1
        try { heal = await kvIncr(e, `briefing:heal:${day}`) } catch { heal = -1 }
        if (heal >= 1 && heal <= 2) {
        /* FIX "Too many subrequests by single Worker invocation" (log produksi):
           dulu briefing dijalankan DALAM invokasi watchdog yang sama — gabungan
           watchdog (ping + KV + Supabase) + briefing (4 agen, masing-masing KV
           sick-map + fetch OpenRouter) melebihi jatah subrequest per invokasi
           (free plan ±50) → CEO/CMO gugur di tengah jalan.
           Solusi: briefing dipicu sebagai INVOKASI TERPISAH via self-call HTTP
           (invokasi baru = budget subrequest baru, pola standar Workers).
           Fire-and-forget via waitUntil — watchdog tetap cepat selesai, dan
           hasilnya dinilai lewat key briefing:done:<tanggal> yang ditulis
           runMorningBriefing sendiri. Maks 2×/hari tetap berlaku. */
        try {
          const u2 = new URL(req.url)
          u2.searchParams.set('action', 'briefing')
          if (cronKey) u2.searchParams.set('key', cronKey)
          cfWaitUntil(
            selfFetch(u2.toString(), { method: 'GET', signal: timeoutSignal(115_000) })
              .then((r) => console.log(`[watchdog] self-heal briefing (invokasi terpisah) → HTTP ${r.status}`))
              .catch((x: any) => console.warn('[watchdog] self-heal briefing gagal dipicu:', String(x?.message || x)))
          )
          alerts.push('briefing-self-heal-dipicu')
        } catch (x: any) {
          console.warn('[watchdog] self-heal gagal menyusun URL self-call:', String(x?.message || x))
          alerts.push('briefing-heal-gagal')
        }
        } else if (heal === -1) {
          console.warn('[watchdog] self-heal DILEWATI — counter heal gagal ditulis ke agent_kv (anti-flood fail-closed)')
        }
      }
    }
  } catch { /* self-heal opsional */ }

  return { watch: true, at: new Date().toISOString(), siteOk: cto.siteOk, status: cto.status, bugs24h: cto.bugs24h, quota, alerts }
}

/* FIX ANTI-FLOOD (6 Nov): fallback dedup DALAM ISOLATE — kalau agent_kv tidak
   bisa ditulis (key dirotasi/401), alarm tetap ditahan: DOWN maks 1×/30 mnt,
   kuota maks 1×/hari — TANPA bergantung KV. Isolate recycle → fallback reset,
   worst case alarm berulang SEKALI, bukan tiap 15 menit seharian. */
let _memDownAlertAt = 0
let _memQuotaAlertDay = ''

async function weeklyReport(e: Env) {
  const L: string[] = []
  L.push('📊 **LAPORAN MINGGUAN — LUXTRADE SUPER AI**')
  L.push(`📅 ${wibNow()}`)
  L.push('━━━━━━━━━━━━━━━━━━')

  /* CSO — pertumbuhan user 7 hari */
  try {
    const since7 = isoAgo(24 * 7)
    const total = await supaCount(e, 'profiles')
    const baru7 = await supaCount(e, 'profiles', 'created_at=gte.' + since7)
    const active7 = (await fetchActiveUserIds(e, since7)).size
    L.push('👥 **CSO — Pertumbuhan 7 hari**')
    L.push(`• Total pendaftar: ${fmtN(total)} (baru minggu ini: +${fmtN(baru7)})`)
    L.push(`• Aktif (upload 7 hari): ${fmtN(active7)}`)
    L.push(`• Pasif: ${fmtN(Math.max(0, total - active7))}`)
  } catch (x: any) { L.push(`⚠️ Data user gagal diambil: ${String(x?.message || x).slice(0, 90)}`) }

  /* CTO — bug & uptime */
  let bugs7 = -1
  try { bugs7 = await supaCount(e, 'bug_reports', 'created_at=gte.' + isoAgo(24 * 7)) } catch { /* ignore */ }
  L.push('🖥️ **CTO — Kualitas & Uptime 7 hari**')
  L.push(bugs7 >= 0 ? `• Bug masuk minggu ini: ${bugs7} ${bugs7 > 0 ? '⚠️' : '✅'}` : '• Bug: gagal diambil')
  let up = 0, down = 0
  for (let i = 0; i < 7; i++) {
    const d = wibDay(-i)
    try {
      up += parseInt((await kvGet(e, `up:${d}`)) || '0', 10)
      down += parseInt((await kvGet(e, `down:${d}`)) || '0', 10)
    } catch { /* ignore */ }
  }
  const cek = up + down
  if (cek > 0) L.push(`• Uptime (hasil watchdog): ${Math.round((up / cek) * 100)}% — ${up}/${cek} cek OK`)
  else L.push('• Uptime: belum ada data watchdog (set cron action=watchdog tiap 15 mnt)')

  /* CFO — pemakaian kuota 7 hari */
  let q7 = 0
  for (let i = 0; i < 7; i++) { try { q7 += parseInt((await kvGet(e, `quota:${wibDay(-i)}`)) || '0', 10) } catch { /* ignore */ } }
  const limit = parseInt(e.DAILY_VISION_LIMIT || '1400', 10)
  L.push('💰 **CFO — Pemakaian Kuota Gemini**')
  L.push(`• Total 7 hari: ${fmtN(q7)} request (rata-rata ${fmtN(Math.round(q7 / 7))}/hari · limit harian ${fmtN(limit)})`)

  /* COO — konversi jualan: lead yang di-email minggu ini → sudah PRO? */
  try {
    const resT = await fetch(`${sbUrl(e)}/rest/v1/ai_pending_tasks?agent_type=eq.COO&status=eq.approved&executed_at=gte.${encodeURIComponent(isoAgo(24 * 7))}&select=target_user_id`, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
    const rows: { target_user_id?: string }[] = resT.ok ? await resT.json() : []
    const ids = [...new Set(rows.map((r) => r.target_user_id).filter(Boolean) as string[])]
    if (ids.length) {
      let pro = 0
      const resP = await fetch(`${sbUrl(e)}/rest/v1/profiles?select=is_pro&id=in.(${ids.map((i) => `"${i}"`).join(',')})`, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
      const profs: { is_pro?: boolean }[] = resP.ok ? await resP.json() : []
      pro = profs.filter((p) => p.is_pro).length
      L.push(`💼 **COO — Jualan 7 hari**: ${ids.length} penawaran PRO terkirim → ${pro} lead sudah PRO (${Math.round((pro / ids.length) * 100)}% konversi)${pro > 0 ? ' 🎉' : ''}`)
    } else L.push('💼 **COO — Jualan 7 hari**: belum ada penawaran terkirim minggu ini')
  } catch { L.push('💼 **COO — Jualan 7 hari**: data gagal diambil') }

  /* 🧪 A/B CTA Landing — eksperimen otomatis Farhan (7 hari) */
  try {
    const ab = await abSnapshot(e)
    L.push(`🧪 **GH — A/B CTA Landing (7 hari)**: A ${ab.A.views} lihat · ${ab.A.clicks} klik (${ab.A.cr}%) | B ${ab.B.views} lihat · ${ab.B.clicks} klik (${ab.B.cr}%) → ${ab.winner}`)
  } catch { /* A/B opsional — laporan tetap jalan */ }

  /* 📬 Open-rate email (webhook Resend) — mata Bagas */
  try {
    let opens7 = 0, clicks7 = 0
    for (let i = 0; i < 7; i++) {
      const d = wibDay(-i)
      opens7 += parseInt((await kvGet(e, `opens:${d}`)) || '0', 10) || 0
      clicks7 += parseInt((await kvGet(e, `clicks:${d}`)) || '0', 10) || 0
    }
    L.push(`📬 **Email open-rate 7 hari** (webhook Resend): ${fmtN(opens7)} kali dibuka · ${fmtN(clicks7)} klik link${(opens7 || clicks7) ? '' : ' — pasang webhook: resend.com → Webhooks → /api/webhooks/resend'}`)
  } catch { /* opsional */ }

  /* Email Resend — pemakaian 7 hari (free tier ±3.000/bulan) */
  let em7 = 0
  for (let i = 0; i < 7; i++) { try { em7 += parseInt((await kvGet(e, `email:${wibDay(-i)}`)) || '0', 10) } catch { /* ignore */ } }
  L.push(`📧 **Email Resend 7 hari**: ${fmtN(em7)} terkirim`)

  L.push('━━━━━━━━━━━━━━━━━━')
  L.push('🤖 Laporan otomatis dari karyawan AI — Bos tinggal baca.')
  const text = L.join('\n')
  let notifySent = false, notifyErr = ''
  try { await sendDiscord(e, text); notifySent = true } catch (x: any) { notifyErr = String(x?.message || x) }
  await kvSet(e, 'weekly:last', JSON.stringify({ at: new Date().toISOString(), notifySent, notifyErr, text }))
  return { weekly: true, notifySent, notifyErr, text }
}

/* ============================================================
   QA OTOMATIS (CTO) — tes semua fitur/route utama Luxtradee
   Dipanggil: briefing 08:00 WIB + tombol manual Ruang CTO.
   Status tak terduga (5xx/timeout) = MASALAH → dilaporkan.
   CF 521-524 (self-ping false negative) dianggap OK — sama
   seperti ctoAgent: Worker ini jalan = situs pasti hidup.
   ============================================================ */
const QA_ROUTES: { path: string; label: string; expect: number[] }[] = [
  { path: '/', label: 'Landing page', expect: [200] },
  { path: '/about', label: 'Tentang', expect: [200] },
  { path: '/blog', label: 'Blog', expect: [200] },
  { path: '/faq', label: 'FAQ', expect: [200] },
  { path: '/contact', label: 'Kontak', expect: [200] },
  { path: '/upgrade', label: 'Upgrade PRO', expect: [200] },
  { path: '/affiliate', label: 'Affiliate', expect: [200] },
  { path: '/dashboard', label: 'Dashboard user', expect: [200] },
  { path: '/settings', label: 'Pengaturan', expect: [200] },
  { path: '/kantor-ceo', label: 'Kantor CEO', expect: [200] },
  { path: '/api/health', label: 'API health', expect: [200] },
  { path: '/api/landing-stats', label: 'API landing stats', expect: [200] },
  /* ⭐ Kemampuan baru (SOP Bos): ping ENDPOINT KRITIS per fitur inti.
     401 = route hidup & auth guard bekerja · 405 = hidup (method salah) —
     yang dilaporkan hanya 5xx/timeout (fitur inti mati). */
  { path: '/api/trades', label: 'API jurnal trades (auth guard)', expect: [200, 401, 405] },
  { path: '/api/analyze-screenshot', label: 'API evaluasi AI screenshot', expect: [200, 401, 405] },
  { path: '/api/chat', label: 'API CS chat bot', expect: [200, 400, 401, 405] },
]

async function qaAgent(e: Env) {
  const CF_FALSE = [521, 522, 523, 524]
  const results = await Promise.all(QA_ROUTES.map(async (r) => {
    const t0 = Date.now()
    try {
      const res = await selfFetch(SITE_URL + r.path, { redirect: 'follow', signal: timeoutSignal(12_000) })
      const cfFalse = CF_FALSE.includes(res.status)
      return { path: r.path, label: r.label, status: cfFalse ? 200 : res.status, ok: r.expect.includes(res.status) || cfFalse, ms: Date.now() - t0 }
    } catch (x: any) {
      return { path: r.path, label: r.label, status: 0, ok: false, ms: Date.now() - t0, err: String(x?.message || x).slice(0, 60) }
    }
  }))
  const fails = results.filter((r) => !r.ok)
  const avgMs = Math.round(results.reduce((a, r) => a + r.ms, 0) / (results.length || 1))
  const out = { at: new Date().toISOString(), total: results.length, ok: results.length - fails.length, fails, avgMs, results }
  await kvSet(e, 'qa:last', JSON.stringify(out)).catch(() => {})
  return out
}

/* ============================================================
   E2E AUTO-TESTER — Raka masuk dashboard PAKAI LOGIN SUNGGUHAN.
   Bedanya dengan qaAgent: QA cuma "ketuk pintu" (GET + cek status),
   E2E ini simulasi USER ASLI dari pintu masuk sampai keluar:
     1. Akun tes siap (dibuat otomatis 1× via admin API service_role)
     2. LOGIN Supabase (password grant — sama persis dgn /auth/login)
     3. Sesi valid (GET /auth/v1/user)
     4. Halaman dashboard terbuka
     5. Baca profil sendiri (RLS read)
     6. Buat trade tes (RLS insert)
     7. Trade tes terbaca (RLS select)
     8. 🔒 RLS privasi: trade user LAIN tidak terbaca
     9. Hapus trade tes (RLS delete + bersih-bersih)
   Trade tes ditandai notes E2E + SELALU dihapus (try/finally) —
   tidak pernah menodai data asli. Akun tes = env E2E_TEST_EMAIL /
   E2E_TEST_PASSWORD (default e2e-tester@luxtradee.app). Hasil disimpan
   agent_kv 'e2e:last' → tampil di Ruang CTO + briefing pagi 08:00.
   ============================================================ */
interface E2eStep { id: string; label: string; ok: boolean; ms: number; status?: number; detail?: string }

const E2E_EMAIL_DEFAULT = 'e2e-tester@luxtradee.app'
const E2E_PASS_DEFAULT = 'Lxtd-E2e!2025'

/** Baca body error PostgREST → pesan diagnosable (bukan cuma "HTTP 403"). */
async function pgErrDetail(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { code?: string; message?: string }
    const code = j.code ? ` ${j.code}` : ''
    const msg = j.message ? ` ${j.message.slice(0, 100)}` : ''
    return `HTTP ${res.status}${code}${msg}`
  } catch {
    return `HTTP ${res.status}`
  }
}

async function e2eAgent(e: Env) {
  const t0 = Date.now()
  const steps: E2eStep[] = []
  const push = (id: string, label: string, ok: boolean, ms: number, detail?: string, status?: number) =>
    steps.push({ id, label, ok, ms, ...(detail ? { detail: String(detail).slice(0, 140) } : {}), ...(status ? { status } : {}) })
  /* Pelari langkah: catat durasi + tangkap error → 1 langkah gagal TIDAK menghentikan rangkaian */
  const run = async (id: string, label: string, fn: () => Promise<string | undefined>): Promise<boolean> => {
    const s = Date.now()
    try { push(id, label, true, Date.now() - s, await fn()); return true }
    catch (x: any) { push(id, label, false, Date.now() - s, x?.message || x, x?.status); return false }
  }

  if (!sbUrl(e) || !sbAnonKey(e))
    return { at: new Date().toISOString(), e2eSkip: 'SUPABASE_URL / SUPABASE_ANON_KEY belum diset', e2eTotal: 0, e2ePassed: 0, e2eFailed: 0, e2eDurMs: 0, e2eSteps: [] }

  const EMAIL = cleanEnv(e.E2E_TEST_EMAIL) || E2E_EMAIL_DEFAULT
  const PASS = cleanEnv(e.E2E_TEST_PASSWORD) || E2E_PASS_DEFAULT

  /* --- 1. Pastikan akun tes ada (422 = email sudah terdaftar → langsung dipakai) --- */
  await run('provision', 'Akun tes siap', async () => {
    const res = await fetch(`${sbUrl(e)}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: sbServiceKey(e), Authorization: `Bearer ${sbServiceKey(e)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASS, email_confirm: true }),
      signal: timeoutSignal(12_000),
    })
    if (res.ok) return 'akun tes baru dibuat'
    if (res.status === 422) return 'akun tes sudah ada — langsung dipakai'
    throw Object.assign(new Error(`admin API HTTP ${res.status} — butuh SUPABASE_SERVICE_ROLE_KEY`), { status: res.status })
  })

  /* --- 2. LOGIN (password grant — jalur yang sama dengan halaman login user) --- */
  let token = '', uid = ''
  await run('login', 'Login dashboard (akun tes)', async () => {
    const res = await fetch(`${sbUrl(e)}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: sbAnonKey(e), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASS, gotrue_meta_security: { captcha_token: null } }),
      signal: timeoutSignal(12_000),
    })
    if (!res.ok) throw Object.assign(new Error(`login gagal HTTP ${res.status} — cek email/password akun tes`), { status: res.status })
    const j = await res.json() as { access_token?: string; user?: { id?: string } }
    if (!j.access_token) throw new Error('respons login tanpa access_token')
    token = j.access_token
    uid = j.user?.id || ''
    return 'sesi diterima ✅'
  })

  if (token && uid) {
    const uH = { apikey: sbAnonKey(e), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

    /* --- 3. Sesi valid --- */
    await run('session', 'Sesi valid (GET /auth/v1/user)', async () => {
      const res = await fetch(`${sbUrl(e)}/auth/v1/user`, { headers: uH, signal: timeoutSignal(10_000) })
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status })
      return `token dikenali (${EMAIL})`
    })

    /* --- 4. Halaman dashboard terbuka --- */
    await run('dashboard', 'Halaman dashboard terbuka', async () => {
      const res = await selfFetch(`${SITE_URL}/dashboard`, { redirect: 'follow', signal: timeoutSignal(15_000) })
      if ([521, 522, 523, 524].includes(res.status)) return `HTTP ${res.status} (self-ping CF diabaikan — Worker aktif)`
      if (!res.ok) throw Object.assign(new Error(`dashboard HTTP ${res.status}`), { status: res.status })
      return 'HTTP 200 OK'
    })

    /* --- 5. Baca profil sendiri (RLS read) --- */
    await run('profile', 'Baca profil sendiri (RLS read)', async () => {
      const res = await fetch(`${sbUrl(e)}/rest/v1/profiles?id=eq.${encodeURIComponent(uid)}&select=id`, { headers: uH, signal: timeoutSignal(10_000) })
      if (!res.ok) {
        const detail = await pgErrDetail(res)
        // 42501 + "table users" = policy RLS profiles membaca auth.users/public.users
        // yang sudah dikunci Supabase utk role authenticated → jalankan 017_fix_e2e_rls_and_defaults.sql
        if (detail.includes('42501') && detail.toLowerCase().includes('table users')) {
          throw Object.assign(new Error(`${detail} — policy RLS profiles membaca tabel users (dilarang Supabase) → jalankan supabase-migrations/017_fix_e2e_rls_and_defaults.sql`), { status: res.status })
        }
        throw Object.assign(new Error(detail), { status: res.status })
      }
      const rows = await res.json() as unknown[]
      return rows.length ? 'profil ditemukan ✅' : 'query OK — baris profil belum ada (normal, onboarding belum dijalankan)'
    })

    let tradeId = ''
    try {
      /* --- 6. Buat trade tes (RLS insert) --- */
      await run('trade-create', 'Buat trade tes (RLS insert)', async () => {
        tradeId = crypto.randomUUID()
        const nowIso = new Date().toISOString()
        const res = await fetch(`${sbUrl(e)}/rest/v1/trades`, {
          method: 'POST',
          headers: { ...uH, Prefer: 'return=representation' },
          body: JSON.stringify({
            id: tradeId, user_id: uid, symbol: 'XAUUSD', type: 'BUY',
            open_price: 2400.5, close_price: 2402.5, lot_size: 0.01, profit_loss: 2,
            open_time: nowIso, close_time: nowIso,
            /* updated_at = NOT NULL tanpa default di produksi (Prisma @updatedAt
               hanya diisi client, bukan DB) — insert REST polos wajib mengisi. */
            updated_at: nowIso,
            notes: '🤖 E2E auto-test Raka — dihapus otomatis',
          }),
          signal: timeoutSignal(12_000),
        })
        if (!res.ok) throw Object.assign(new Error(await pgErrDetail(res)), { status: res.status })
        return 'trade tes tersimpan ✅'
      })

      /* --- 7. Trade tes terbaca kembali (RLS select) --- */
      await run('trade-verify', 'Trade tes terbaca (RLS select)', async () => {
        if (!tradeId) throw new Error('dilewati — langkah sebelumnya gagal')
        const res = await fetch(`${sbUrl(e)}/rest/v1/trades?id=eq.${tradeId}&select=id`, { headers: uH, signal: timeoutSignal(10_000) })
        if (!res.ok) throw Object.assign(new Error(await pgErrDetail(res)), { status: res.status })
        const rows = await res.json() as unknown[]
        if (!rows.length) throw new Error('trade tes tidak terbaca — RLS select bermasalah?')
        return 'trade tes terbaca kembali ✅'
      })

      /* --- 8. TES PRIVASI: trade milik user LAIN tidak boleh bocor --- */
      await run('rls-privacy', '🔒 RLS privasi: data user lain terkunci', async () => {
        const res = await fetch(`${sbUrl(e)}/rest/v1/trades?user_id=neq.${uid}&select=id&limit=1`, { headers: uH, signal: timeoutSignal(10_000) })
        if (!res.ok) throw Object.assign(new Error(await pgErrDetail(res)), { status: res.status })
        const rows = await res.json() as unknown[]
        if (rows.length) throw new Error('KEBOCORAN: akun tes bisa membaca trade user lain!')
        return 'tidak ada kebocoran ✅'
      })
    } finally {
      /* --- 9. Bersih-bersih WAJIB (jalan meski langkah tengah gagal) --- */
      await run('trade-delete', 'Hapus trade tes (RLS delete)', async () => {
        if (!tradeId) return 'tidak ada trade tes — bersih'
        const res = await fetch(`${sbUrl(e)}/rest/v1/trades?id=eq.${tradeId}`, { method: 'DELETE', headers: uH, signal: timeoutSignal(10_000) })
        if (!res.ok) throw Object.assign(new Error(`hapus ${await pgErrDetail(res)} — sisa trade tes mungkin tertinggal`), { status: res.status })
        return 'bersih — data asli tidak terganggu ✅'
      })
    }
  } else {
    /* Login gagal → langkah lanjutan ditandai dilewati (biar laporannya jujur) */
    for (const [id, label] of [['session', 'Sesi valid'], ['dashboard', 'Halaman dashboard terbuka'], ['profile', 'Baca profil sendiri'], ['trade-create', 'Buat trade tes'], ['trade-verify', 'Trade tes terbaca'], ['rls-privacy', '🔒 RLS privasi'], ['trade-delete', 'Hapus trade tes']] as const)
      push(id, label, false, 0, 'dilewati — login gagal')
  }

  const passed = steps.filter((s) => s.ok).length
  const failed = steps.length - passed
  const out = {
    at: new Date().toISOString(), e2eTotal: steps.length, e2ePassed: passed, e2eFailed: failed,
    e2eDurMs: Date.now() - t0, e2eAccount: EMAIL, e2eSteps: steps,
    e2eVerdict: failed ? `${failed} langkah gagal ⚠️` : 'login + semua fitur OK ✅',
  }
  await kvSet(e, 'e2e:last', JSON.stringify(out)).catch(() => {})
  if (failed)
    await memAdd(e, 'CTO Raka', `E2E auto-test: ${passed}/${steps.length} lolos — gagal: ${steps.filter((s) => !s.ok).map((s) => s.id).join(', ')}`)
  return out
}

/* Antrean COO — hitung draf penawaran yang masih menunggu ACC Bos.
   Dipakai: kartu overview, status live karakter 3D, panel Ruang COO.
   Tabel ai_pending_tasks dibuat lewat supabase-migrations/013 —
   kalau tabelnya belum ada, balik kosong (jangan error). */
async function cooPending(e: Env): Promise<{ pending: number; approved24h: number }> {
  const out = { pending: 0, approved24h: 0 }
  if (!sbUrl(e) || !cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY)) return out
  const res = await fetch(`${sbUrl(e)}/rest/v1/ai_pending_tasks?agent_type=eq.COO&created_at=gte.${encodeURIComponent(isoAgo(48))}&select=status`, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
  if (!res.ok) return out
  const rows = (await res.json()) as { status?: string }[]
  out.pending = rows.filter((r) => r.status === 'pending').length
  out.approved24h = rows.filter((r) => r.status === 'approved').length
  return out
}

/* Ringkasan kerja COO 24 jam terakhir — buat laporan pagi 08:00 */
async function cooYesterdayLine(e: Env): Promise<string> {
  if (!sbUrl(e) || !cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY)) return ''
  const res = await fetch(`${sbUrl(e)}/rest/v1/ai_pending_tasks?agent_type=eq.COO&created_at=gte.${encodeURIComponent(isoAgo(24))}&select=status`, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
  if (!res.ok) return ''
  const rows = (await res.json()) as { status?: string }[]
  if (!rows.length) return ''
  const pending = rows.filter((r) => r.status === 'pending').length
  const approved = rows.filter((r) => r.status === 'approved').length
  return `💼 **COO — Divisi Jualan**: ${rows.length} draf penawaran 24 jam terakhir (${approved} terkirim, ${pending} menunggu ACC Bos di Ruang COO — /kantor-ceo)`
}

/* ============================================================
   DISKUSI HARIAN CSO × CMO (RuCSO upgrade)
   Maya (CSO) bawa DATA NYATA user pasif ke meja Sinta (CMO):
   berapa yang mendaftar tapi tak pernah upload jurnal, keluhan
   bug, feedback email. Gemini menyusun DIALOG keduanya mencari
   ROOT CAUSE "kenapa user nggak mau pakai jurnal" → lalu CMO
   menulis 1 SKRIP KONTEN TikTok yang menjawab alasan teratas.
   Dipakai: tombol manual Ruang CSO + otomatis 1×/hari di briefing 08:00.
   ============================================================ */
interface TalkTurn { who: 'CSO' | 'CMO'; text: string }
interface CsoCmoTalk {
  at: string
  provider: 'mortera' | 'gemini' | 'openrouter' | 'fallback'
  diagnosis: string
  reasons: string[]
  dialog: TalkTurn[]
  script: { hook: string; body: string; cta: string }
  intel: { total: number; active24h: number; active7d: number; passive: number; baruTakAktif: number; bug7d: number }
  raw?: string
  dupToday?: boolean
}

/* JSON tololeran: buang fence markdown, ambil blok { ... } terluas */
function extractJsonLoose(text: string): string | null {
  const clean = text.replace(/```(?:json)?/gi, '').trim()
  const a = clean.indexOf('{')
  const b = clean.lastIndexOf('}')
  if (a < 0 || b <= a) return null
  return clean.slice(a, b + 1)
}

async function csoCmoTalk(e: Env): Promise<CsoCmoTalk> {
  /* ---- 1. Kumpulkan intel nyata dari database ---- */
  const active24 = await fetchActiveUserIds(e, isoAgo(24))
  const active7 = await fetchActiveUserIds(e, isoAgo(24 * 7))
  const total = await supaCount(e, 'profiles')
  const baru14 = await supaCount(e, 'profiles', 'created_at=gte.' + isoAgo(24 * 14))
  const bug7d = await supaCount(e, 'bug_reports', 'created_at=gte.' + isoAgo(24 * 7)).catch(() => -1)

  /* Contoh keluhan user (bug 7 hari) — bahan obrolan konkret */
  let bugSamples: string[] = []
  try {
    const bres = await fetch(`${sbUrl(e)}/rest/v1/bug_reports?select=description&created_at=gte.${encodeURIComponent(isoAgo(24 * 7))}&order=created_at.desc&limit=5`, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
    if (bres.ok) bugSamples = ((await bres.json()) as { description?: string }[]).map((b) => String(b.description || '').replace(/\s+/g, ' ').slice(0, 160)).filter((s) => s.length > 3)
  } catch { /* opsional */ }

  /* Feedback email CSO kemarin — berapa yang balik */
  let emailed = 0, returned = 0
  try {
    const ids: string[] = JSON.parse((await kvGet(e, `csmailed:${wibDay(-1)}`)) || '[]')
    emailed = ids.length
    returned = ids.filter((id) => active7.has(id)).length
  } catch { /* ignore */ }

  const intel = {
    total,
    active24h: active24.size,
    active7d: active7.size,
    passive: Math.max(0, total - active24.size),
    /* Pendaftar 14 hari terakhir yang TIDAK pernah upload jurnal = calon churn paling nyata */
    baruTakAktif: Math.max(0, baru14 - active7.size),
    bug7d,
  }

  /* ANTI-ITU-ITU-MULU (spec perbaikan kantor AI): kalau angka intel TIDAK
     berubah sejak rapat terakhir, JANGAN bakar LLM — pakai hasil rapat
     sebelumnya (ditandai dupToday). Hash disimpan HANYA setelah rapat baru
     sukses dibuat (pola mark-after-success). */
  let intelHash = ''
  try {
    const hb = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(JSON.stringify(intel)))
    intelHash = Array.from(new Uint8Array(hb)).map((b) => b.toString(16).padStart(2, '0')).join('')
    if (intelHash === (await kvGet(e, 'talk:intel-hash'))) {
      const prevRaw = await kvGet(e, 'cso-cmo:last')
      const prev = prevRaw ? (JSON.parse(prevRaw) as CsoCmoTalk) : null
      if (prev?.dialog?.length) return { ...prev, at: new Date().toISOString(), dupToday: true }
    }
  } catch { /* hash opsional */ }

  const intelText =
    `DATA NYATA Luxtradee (web app jurnal trading XAUUSD, upload screenshot → evaluasi AI):\n` +
    `- Total pendaftar: ${intel.total}\n` +
    `- Aktif 24 jam: ${intel.active24h} · Aktif 7 hari: ${intel.active7d}\n` +
    `- Pasif (di luar 24 jam): ${intel.passive}\n` +
    `- Daftar 14 hari terakhir: ${baru14} — ${intel.baruTakAktif} di antaranya BELUM PERNAH upload jurnal sama sekali\n` +
    (emailed ? `- Email sapaan kemarin: ${emailed} user dikontak, ${returned} balik aktif\n` : '') +
    (bug7d >= 0 ? `- Laporan bug 7 hari: ${bug7d}\n` : '') +
    (bugSamples.length ? `- Contoh keluhan user:\n${bugSamples.map((s) => `  • ${s}`).join('\n')}\n` : '')

  /* ---- 2. Dialog Maya (CSO) × Sinta (CMO) + skrip konten ---- */
  const systemPrompt =
    `Kamu penulis skenario internal tim Luxtradee. Tulis DIALOG kerja singkat antara 2 karyawan AI:\n` +
    `- MAYA (CSO, cewek, peduli user, bicara pake data)\n` +
    `- SINTA (CMO, copywriter TikTok, bahasa gaul kreatif)\n\n` +
    `TOPIK: cari akar masalah KENAPA user mendaftar tapi nggak mau/males pakai jurnal trading (upload screenshot). Maya bawa data, Sinta menduga-duga penyebab psikologis (malas, bingung mulai, ngerasa ribet, belum yakin manfaat) dan mengusulkan angle konten.\n` +
    `Akhi: Sinta membuat 1 skrip video TikTok (hook 3 detik → isi → CTA, 30-45 dtk) yang MENJAWAB alasan teratas — target trader XAUUSD Indonesia.\n` +
    `Kalau ada hasil diskusi sebelumnya di bawah: JANGAN mengulang kesimpulan yang sama persis — verifikasi dengan data terbaru, gali akar yang belum dibahas, atau nyatakan pola baru.\n\n` +
    `OUTPUT HANYA JSON valid (tanpa markdown, tanpa penjelasan):\n` +
    `{"diagnosis":"1-2 kalimat inti masalah","reasons":["alasan 1","alasan 2","alasan 3"],"dialog":[{"who":"CSO","text":"..."},{"who":"CMO","text":"..."}],"script":{"hook":"...","body":"...","cta":"..."}}\n` +
    `Aturan: dialog 6-8 giliran pergantian, tiap teks maks 200 karakter, bahasa Indonesia santai, sebutkan angka data yang nyata.` + ' ' + REAL_DATA_RULE

  /* Learning loop: baca kesimpulan diskusi sebelumnya → Maya & Sinta
     tidak mengulang verbatim — mereka verifikasi/memperdalam. */
  let prevTalk = ''
  try {
    const p = JSON.parse((await kvGet(e, 'cso-cmo:last')) || 'null')
    if (p?.diagnosis)
      prevTalk = `\nHASIL DISKUSI KALIAN SEBELUMNYA (${String(p.at || '').slice(0, 10)}): diagnosis "${String(p.diagnosis).slice(0, 200)}"${Array.isArray(p.reasons) && p.reasons.length ? ' — alasan: ' + p.reasons.slice(0, 3).join('; ') : ''}`
  } catch { /* ignore */ }

  const userPrompt = `${intelText}${prevTalk}${await memBlock(e)}${await agentMemBlock(e, 'cso')}\nTanggal: ${wibNow()}. Buat dialog + skrip sekarang.`

  let provider: CsoCmoTalk['provider'] = 'fallback'
  let parsed: Omit<CsoCmoTalk, 'at' | 'provider' | 'intel' | 'raw'> | null = null
  let raw = ''
  try {
    /* SOP Multi-Agent — rapat dibawakan MAYA (CSO) dengan modelnya sendiri
       (gemma-2-9b via OpenRouter) → Gemini nyawa cadangan → templat. */
    const brain = await agentBrain(e, 'cso', systemPrompt, userPrompt, 2048, 0.8)
    raw = brain.text
    provider = brain.provider
  } catch { raw = '' }

  if (raw) {
    try {
      const j = JSON.parse(extractJsonLoose(raw) || raw)
      const dialog: TalkTurn[] = Array.isArray(j.dialog)
        ? j.dialog
            .map((d: { who?: string; text?: string }) => ({ who: String(d?.who || '').toUpperCase().includes('CMO') ? 'CMO' : 'CSO', text: String(d?.text || '').slice(0, 400) }))
            .filter((d: TalkTurn) => d.text)
        : []
      if (dialog.length >= 2 && (j.script?.hook || j.diagnosis)) {
        parsed = {
          diagnosis: String(j.diagnosis || '').slice(0, 400),
          reasons: Array.isArray(j.reasons) ? j.reasons.map((r: unknown) => String(r).slice(0, 140)).slice(0, 5) : [],
          dialog,
          script: {
            hook: String(j.script?.hook || '').slice(0, 400),
            body: String(j.script?.body || '').slice(0, 900),
            cta: String(j.script?.cta || '').slice(0, 300),
          },
        }
      }
    } catch { /* JSON rusak → fallback */ }
  }

  if (!parsed) {
    /* Fallback tanpa LLM: dialog templat dari data nyata */
    provider = 'fallback'
    const topReason = intel.baruTakAktif > 0
      ? `${intel.baruTakAktif} dari ${baru14} pendaftar baru belum pernah upload jurnal`
      : `${intel.passive} user pasif tidak upload dalam 24 jam`
    parsed = {
      diagnosis: `${topReason} — kemungkinan karena terasa ribet/bingung mulai, bukan karena tidak tertarik.`,
      reasons: [
        'Bingung mulai — nggak tahu screenshot yang bagus seperti apa',
        'Kira jurnal = ngetik manual yang panjang',
        'Belum merasakan manfaat evaluasi di 5 menit pertama',
      ],
      dialog: [
        { who: 'CSO', text: `Sinta, dari data: ${topReason}. Ini pola yang sama tiap minggu.` },
        { who: 'CMO', text: 'Berarti masalahnya bukan "males nggak mau" — tapi mereka belum lihat prosesnya semudah apa. Kita tunjukkan, jangkan dijelasin.' },
        { who: 'CSO', text: 'Setuju. Keluhan terbanyak juga soal mulai yang bingung, bukan soal fitur.' },
        { who: 'CMO', text: 'Oke, gua bikin skrip: video 30 detik, tunjukkan upload screenshot → evaluasi muncul. Satu take, no talking-head.' },
      ],
      script: {
        hook: '"Daftar tapi belum pernah upload jurnal? Rugi 90% manfaatnya."',
        body: `Rekam layar: drag screenshot trade → upload → evaluasi AI muncul dalam hitungan detik. Teks besar: "Bukan ngetik. Cuma 2 menit." Tutup dengan chart perbandingan before/after pakai evaluasi. Data bagimu: ${intel.baruTakAktif || intel.passive} trader lain masih nunda — jadi yang beda.`,
        cta: '"Upload 1 screenshot hari ini — link di bio, gratis."',
      },
    }
  }

  const out: CsoCmoTalk = { at: new Date().toISOString(), provider, intel, ...parsed }
  await kvSet(e, 'cso-cmo:last', JSON.stringify(out)).catch(() => {})
  if (intelHash) await kvSet(e, 'talk:intel-hash', intelHash).catch(() => false)
  if (out.diagnosis) await memAdd(e, 'Maya × Sinta', `Rapat CSO×CMO — ${String(out.diagnosis).slice(0, 150)}${out.script?.hook ? ' → skrip: "' + String(out.script.hook).slice(0, 60) + '"' : ''}`)
  return out
}

/* Versi teks buat Discord — pesan terpisah setelah briefing utama */
function talkToDiscord(t: CsoCmoTalk): string {
  const L: string[] = []
  L.push('💬 **DISKUSI CSO × CMO — kenapa user males upload jurnal?**')
  L.push(`🔍 ${t.diagnosis}`)
  for (const d of t.dialog.slice(0, 6)) L.push(`${d.who === 'CSO' ? '👩‍💼 Maya (CSO)' : '📣 Sinta (CMO)'}: ${d.text}`)
  if (t.script?.hook) {
    L.push('')
    L.push('🎬 **SKRIP KONTEN HASIL RAPAT:**')
    L.push(`HOOK: ${t.script.hook}\nISI: ${t.script.body}\nCTA: ${t.script.cta}`)
  }
  L.push('_(Diskusi otomatis CSO × CMO — skrip lengkap ada di Ruang CSO /kantor-ceo)_')
  return L.join('\n').slice(0, 1900)
}

/* ============================================================
   AGEN 6 — DEWI (DATA ANALYST): pola trading user dari trades
   Kueri NYATA 30 hari (maks 1000 trade terbaru): win rate,
   pair favorit, sesi & jam tersibuk → Gemini jadikan insight +
   3 rekomendasi. Learning loop: insight minggu lalu ikut dibaca
   → Dewi evaluasi rekomendasinya sendiri, bukan analisis amnesia.
   ============================================================ */
interface DaInsight {
  at: string
  provider: 'mortera' | 'gemini' | 'openrouter' | 'fallback'
  insight: string
  patterns: string[]
  recommendations: string[]
  stats: { uploads30: number; uploads7: number; traders30: number; winRate: number; topSymbol: string; topSession: string; bestHour: string; emotion?: { counted: number; best: string; bestWr: number; worst: string; worstWr: number } | null }
  dupToday?: boolean
  sampleOk?: boolean
}

async function fetchTrades30(e: Env) {
  const res = await fetch(
    `${sbUrl(e)}/rest/v1/trades?select=symbol,profit_loss,session,user_id,created_at,emotion&created_at=gte.${encodeURIComponent(isoAgo(24 * 30))}&order=created_at.desc&limit=1000`,
    { headers: sbHPriv(e), signal: timeoutSignal(10_000) },
  )
  if (!res.ok) throw new Error(`Supabase trades HTTP ${res.status}${res.status === 401 && !cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY) ? ' — set SUPABASE_SERVICE_ROLE_KEY' : ''}`)
  return (await res.json()) as { symbol?: string; profit_loss?: number; session?: string | null; user_id?: string; created_at?: string; emotion?: string | null }[]
}

function computeTradeStats(rows: { symbol?: string; profit_loss?: number; session?: string | null; user_id?: string; created_at?: string; emotion?: string | null }[]) {
  const traders = new Set<string>()
  const sym: Record<string, number> = {}
  const ses: Record<string, number> = {}
  const hour: Record<number, number> = {}
  /* ⭐ Kemampuan baru (SOP Bos): korelasi EMOSI (self-report saat upload)
     vs hasil trade — win rate per emosi, sampel minimal 5 trade/emosi
     supaya tidak menyesatkan. Tanpa data pribadi — hanya agregat. */
  const emo: Record<string, { n: number; w: number }> = {}
  let wins = 0, up7 = 0
  const since7 = Date.now() - 24 * 7 * 3600_000
  for (const r of rows) {
    if (r.user_id) traders.add(r.user_id)
    if (r.symbol) sym[r.symbol] = (sym[r.symbol] || 0) + 1
    if (r.session) ses[r.session] = (ses[r.session] || 0) + 1
    if (r.created_at) {
      if (new Date(r.created_at).getTime() >= since7) up7++
      const h = (new Date(r.created_at).getUTCHours() + 7) % 24 // konversi ke WIB
      hour[h] = (hour[h] || 0) + 1
    }
    const pl = r.profit_loss || 0
    if (pl > 0) wins++
    const ek = (r.emotion || '').trim().toLowerCase()
    if (ek) {
      const e0 = emo[ek] || { n: 0, w: 0 }
      e0.n++
      if (pl > 0) e0.w++
      emo[ek] = e0
    }
  }
  const top = (m: Record<string, number>) => Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
  const bh = Object.entries(hour).sort((a, b) => b[1] - a[1])[0]?.[0]
  const emoRanked = Object.entries(emo).filter(([, v]) => v.n >= 5).sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n)
  const emotion = emoRanked.length
    ? {
        counted: emoRanked.reduce((a, [, v]) => a + v.n, 0),
        best: emoRanked[0][0], bestWr: Math.round((emoRanked[0][1].w / emoRanked[0][1].n) * 100),
        worst: emoRanked[emoRanked.length - 1][0], worstWr: Math.round((emoRanked[emoRanked.length - 1][1].w / emoRanked[emoRanked.length - 1][1].n) * 100),
      }
    : null
  return {
    uploads30: rows.length,
    uploads7: up7,
    traders30: traders.size,
    winRate: rows.length ? Math.round((wins / rows.length) * 100) : 0,
    topSymbol: top(sym),
    topSession: top(ses),
    bestHour: bh !== undefined ? `${bh}:00 WIB` : '—',
    emotion,
  }
}

async function analystAgent(e: Env): Promise<DaInsight> {
  const rows = await fetchTrades30(e)
  const stats = computeTradeStats(rows)
  const base = { at: new Date().toISOString(), stats }

  /* AMBANG SAMPEL MINIMAL (spec perbaikan kantor AI): di bawah 50 trade
     dalam 30 hari, analisis AI lebih banyak menebak daripada fakta →
     JANGAN panggil LLM sama sekali (hemat kuota, tanpa laporan kosong).
     Status jujur "data belum cukup"; analisis penuh menyala otomatis
     lagi begitu sampel ≥50 (fase early/growth). */
  if (rows.length < 50) {
    const out: DaInsight = { ...base, provider: 'fallback',
      insight: `Data belum cukup untuk analisis statistik: ${rows.length}/50 trade dalam 30 hari. Dewi tidak membakar kuota AI untuk sampel yang belum bermakna — analisis penuh (termasuk emosi vs profit) otomatis menyala begitu data cukup.`,
      patterns: stats.traders30 ? [`Sampel sekarang: ${rows.length} trade dari ${stats.traders30} trader (ambang minimal 50)`] : [],
      recommendations: ['Fokus sekarang: dapatkan user baru & upload pertama (cek langkah checklist peluncuran di briefing)'],
      sampleOk: false }
    await kvSet(e, 'da:last', JSON.stringify(out)).catch(() => {})
    return out
  }

  /* Learning loop: baca insight sendiri sebelumnya → evaluasi, jangan mengulang */
  let prev = ''
  try {
    const p = JSON.parse((await kvGet(e, 'da:last')) || 'null')
    if (p?.insight)
      prev = `\nINSIGHT KAMU SEBELUMNYA (${String(p.at || '').slice(0, 10)}): "${String(p.insight).slice(0, 220)}"${Array.isArray(p.recommendations) && p.recommendations.length ? '\nRekomendasi kemarin: ' + p.recommendations.slice(0, 3).join(' | ').slice(0, 220) : ''}\nCek angka di atas: apakah rekomendasi kemarin mulai terlihat efeknya? Jangan ulangi verbatim — perdalam atau ganti fokus.`
  } catch { /* ignore */ }

  const dataText =
    `DATA TRADES 30 HARI TERAKHIR (nyata, dari database Luxtradee):\n` +
    `- Total upload jurnal: ${stats.uploads30} (${stats.uploads7} dalam 7 hari terakhir)\n` +
    `- Trader aktif unik: ${stats.traders30} (rata-rata ${stats.traders30 ? (stats.uploads30 / stats.traders30).toFixed(1) : 0} trade/trader)\n` +
    `- Win rate agregat: ${stats.winRate}%\n` +
    `- Pair paling sering: ${stats.topSymbol} · Sesi tersibuk: ${stats.topSession} · Jam paling ramai: ${stats.bestHour}` +
    (stats.emotion
      ? `\n- EMOSI saat trading (self-report user, agregat): paling profit "${stats.emotion.best}" (win rate ${stats.emotion.bestWr}%) · paling rugi "${stats.emotion.worst}" (win rate ${stats.emotion.worstWr}%) — dari ${stats.emotion.counted} trade berlabel emosi`
      : '')

  const systemPrompt =
    `Kamu Dewi, Data Analyst Luxtradee (web app jurnal trading XAUUSD — user upload screenshot/record trade, AI evaluasi visual). ` +
    `Analisis angka nyata, temukan pola yang tidak terlihat kasat mata, kasih rekomendasi konkret yang bisa dieksekusi Bos minggu ini (produk, konten, atau retensi). ` +
    `OUTPUT HANYA JSON valid (tanpa markdown): {"insight":"maks 2 kalimat","patterns":["pola 1","pola 2","pola 3"],"recommendations":["rekomendasi 1","rekomendasi 2","rekomendasi 3"]} — bahasa Indonesia santai-profesional, sebut angka nyata.` + ' ' + REAL_DATA_RULE

  let provider: DaInsight['provider'] = 'fallback'
  let insight = '', patterns: string[] = [], recommendations: string[] = []
  let raw = ''
  try {
    /* SOP Multi-Agent — DEWI (DA) analisis pakai modelnya sendiri → Gemini cadangan */
    const brain = await agentBrain(e, 'da', systemPrompt, dataText + prev + (await memBlock(e)) + (await agentMemBlock(e, 'da')) + `\nTanggal: ${wibNow()}`, 1024, 0.5)
    raw = brain.text
    provider = brain.provider
  } catch { raw = '' }
  if (raw) {
    try {
      const j2 = JSON.parse(extractJsonLoose(raw) || raw)
      insight = String(j2.insight || '').slice(0, 400)
      patterns = Array.isArray(j2.patterns) ? j2.patterns.map((x: unknown) => String(x).slice(0, 180)).slice(0, 4) : []
      recommendations = Array.isArray(j2.recommendations) ? j2.recommendations.map((x: unknown) => String(x).slice(0, 180)).slice(0, 4) : []
    } catch { raw = '' }
  }
  if (!insight) {
    /* Fallback TANPA LLM — tetap dari angka nyata */
    provider = 'fallback'
    insight = `${stats.uploads30} upload dari ${stats.traders30} trader dalam 30 hari — win rate agregat ${stats.winRate}%. Pair favorit ${stats.topSymbol}, sesi tersibuk ${stats.topSession} (puncak ${stats.bestHour}).`
    patterns = [
      `Pair teraktif: ${stats.topSymbol}`,
      `Sesi tersibuk: ${stats.topSession}, puncak jam ${stats.bestHour}`,
      stats.emotion
        ? `Emosi "${stats.emotion.best}" paling untung (WR ${stats.emotion.bestWr}%) vs "${stats.emotion.worst}" paling rugi (WR ${stats.emotion.worstWr}%) — edukasi psikologi trading sangat relevan`
        : `Rata-rata ${stats.traders30 ? (stats.uploads30 / stats.traders30).toFixed(1) : 0} trade per trader · 7 hari terakhir ${stats.uploads7} upload`,
    ]
    recommendations = [
      stats.winRate < 45 ? 'Win rate di bawah 45% — konten edukasi "evaluasi sebelum entry" sangat relevan buat mayoritas user' : 'Win rate sehat — dorong user membagikan hasilnya ke komunitas (social proof)',
      `Jadwalkan posting TikTok menjelang ${stats.bestHour} — itulah jam trader paling aktif online`,
      `Sorot pair ${stats.topSymbol} & sesi ${stats.topSession} di konten CMO biar relevan dengan mayoritas user`,
    ]
  }

  const out: DaInsight = { ...base, provider, insight, patterns, recommendations }
  await kvSet(e, 'da:last', JSON.stringify(out)).catch(() => {})
  if (insight) await memAdd(e, 'DA Dewi', `Analisis 30 hari (${stats.traders30} trader, WR ${stats.winRate}%, favorit ${stats.topSymbol}): ${insight}`)
  return out
}

function daToDiscord(d: DaInsight): string {
  const L = ['📊 **DATA ANALYST — INSIGHT MINGGUAN (Dewi)**', `🔍 ${d.insight}`]
  if (d.stats?.emotion) L.push(`😤 Emosi & hasil: "${d.stats.emotion.best}" WR ${d.stats.emotion.bestWr}% paling profit · "${d.stats.emotion.worst}" WR ${d.stats.emotion.worstWr}% paling rugi (self-report user)`)
  if (d.patterns?.length) { L.push('📈 Pola 30 hari:'); d.patterns.slice(0, 3).forEach((p) => L.push(`• ${p}`)) }
  if (d.recommendations?.length) { L.push('💡 Rekomendasi minggu ini:'); d.recommendations.slice(0, 3).forEach((r, i) => L.push(`${i + 1}. ${r}`)) }
  L.push('_(analisis otomatis tiap Senin 10:00 WIB — detail di Ruang Data Analyst /kantor-ceo)_')
  return L.join('\n').slice(0, 1900)
}

/* ============================================================
   AGEN 7 — FARHAN (GROWTH HACKER): funnel nyata + eksperimen
   Ukur pendaftar → aktivasi (upload trade pertama) → PRO →
   referral, cari titik bocor terbesar, usulkan 3 eksperimen.
   Synch dengan Dewi: insight DA dipakai sebagai bahan.
   ============================================================ */
interface GhExperiment { name: string; how: string; metric: string; effort: string }
interface AbVariantStat { views: number; clicks: number; cr: number }
interface GhInsight {
  at: string
  provider: 'mortera' | 'gemini' | 'openrouter' | 'fallback'
  insight: string
  experiments: GhExperiment[]
  funnel: { total: number; pro: number; baru7: number; referred: number; onboarded: number; activated7: number }
  ab?: { A: AbVariantStat; B: AbVariantStat; winner: string }
  dupToday?: boolean
}

/* ---------- 🧪 A/B CTA Landing — eksperimen otomatis Farhan ----------
   Landing membagi pengunjung 50/50 (localStorage bucket) → view/click
   dicatat route /api/ab-track ke agent_kv: ab:view|click:{A|B}:{tanggal}.
   Fungsi ini baca rekap 7 hari — dipakai ghAgent, weekly, & Ruang Growth. */
async function abSnapshot(e: Env): Promise<{ A: AbVariantStat; B: AbVariantStat; winner: string }> {
  const zero = (): AbVariantStat => ({ views: 0, clicks: 0, cr: 0 })
  const out: Record<'A' | 'B', AbVariantStat> = { A: zero(), B: zero() }
  for (let i = 0; i < 7; i++) {
    const d = wibDay(-i)
    for (const v of ['A', 'B'] as const) {
      out[v].views += parseInt((await kvGet(e, `ab:view:${v}:${d}`)) || '0', 10) || 0
      out[v].clicks += parseInt((await kvGet(e, `ab:click:${v}:${d}`)) || '0', 10) || 0
    }
  }
  for (const v of ['A', 'B'] as const) out[v].cr = out[v].views ? Math.round((out[v].clicks / out[v].views) * 1000) / 10 : 0
  const winner = (out.A.views < 20 && out.B.views < 20) ? 'belum cukup data (<20 lihat/varian)'
    : out.B.cr > out.A.cr ? 'B 🏆' : out.A.cr > out.B.cr ? 'A 🏆' : 'imbang'
  return { A: out.A, B: out.B, winner }
}

async function growthAgent(e: Env): Promise<GhInsight> {
  let total = 0, pro = 0, baru7 = 0, referred = 0, onboarded = 0
  try {
    ;[total, pro, baru7, referred, onboarded] = await Promise.all([
      supaCount(e, 'profiles'),
      supaCount(e, 'profiles', 'is_pro=eq.true'),
      supaCount(e, 'profiles', 'created_at=gte.' + isoAgo(24 * 7)),
      supaCount(e, 'profiles', 'referred_by_code=not.is.null'),
      supaCount(e, 'profiles', 'onboarding_completed=eq.true'),
    ])
  } catch (x: any) { throw new Error(String(x?.message || x)) }

  /* Aktivasi: pendaftar baru 7 hari yang sudah upload trade */
  let activated7 = 0
  try {
    const res = await fetch(`${sbUrl(e)}/rest/v1/profiles?select=id&created_at=gte.${encodeURIComponent(isoAgo(24 * 7))}&limit=300`, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
    const ids = res.ok ? ((await res.json()) as { id?: string }[]).map((r) => r.id).filter(Boolean) as string[] : []
    if (ids.length) {
      const active7 = await fetchActiveUserIds(e, isoAgo(24 * 7))
      activated7 = ids.filter((id) => active7.has(id)).length
    }
  } catch { /* opsional — aktivasi 0 kalau gagal */ }

  const funnel = { total, pro, baru7, referred, onboarded, activated7 }
  const base = { at: new Date().toISOString(), funnel }
  if (!total) {
    const out: GhInsight = { ...base, provider: 'fallback', insight: 'Belum ada pendaftar — fokus pertama: distribusi konten (TikTok CMO) sebelum eksperimen funnel.', experiments: [] }
    await kvSet(e, 'gh:last', JSON.stringify(out)).catch(() => {})
    return out
  }

  let daLine = ''
  try { const d = JSON.parse((await kvGet(e, 'da:last')) || 'null'); if (d?.insight) daLine = `\nINSIGHT DATA ANALYST (Dewi) TERBARU: "${String(d.insight).slice(0, 220)}"` } catch { /* ignore */ }

  /* Hasil A/B CTA landing — Farhan harus tahu eksperimen yang sedang jalan */
  let ab: GhInsight['ab'] | null = null
  let abLine = ''
  try {
    ab = await abSnapshot(e)
    abLine = `\nHASIL A/B CTA LANDING 7 HARI (eksperimen otomatis milikmu): varian A ${ab.A.views} lihat · ${ab.A.clicks} klik (${ab.A.cr}%) | varian B ${ab.B.views} lihat · ${ab.B.clicks} klik (${ab.B.cr}%) → pemenang sementara: ${ab.winner}`
  } catch { /* A/B opsional */ }

  /* AMBANG TRAFFIC MINIMAL (spec perbaikan kantor AI): funnel < 10 pendaftar
     → analisis funnel & A/B belum bermakna → JANGAN panggil LLM (A/B test
     butuh traffic, ditunda sampai ada). Sementara Farhan kerja 1 eksperimen
     akuisisi/minggu via artefak (job gh:experiment, Rabu). Menyala otomatis
     lagi begitu ≥10 pendaftar. */
  if (total < 10) {
    const abViews = ab ? ab.A.views + ab.B.views : 0
    const out: GhInsight = { ...base, provider: 'fallback',
      insight: `Funnel masih terlalu kecil untuk dianalisis: ${total}/10 pendaftar (A/B landing baru ${abViews} lihat dalam 7 hari — butuh traffic lebih besar). Analisis funnel & A/B otomatis menyala begitu ada traffic. Sementara: 1 eksperimen akuisisi per minggu (panel artefak, job gh:experiment).`,
      experiments: [],
      ab: ab || undefined }
    await kvSet(e, 'gh:last', JSON.stringify(out)).catch(() => {})
    return out
  }

  const funnelText =
    `FUNNEL LUXTRADEE (nyata):\n` +
    `- Total pendaftar: ${total} · User PRO: ${pro} (${total ? Math.round((pro / total) * 100) : 0}%)\n` +
    `- Pendaftar baru 7 hari: ${baru7} — ${activated7} di antaranya sudah upload trade (aktivasi ${baru7 ? Math.round((activated7 / baru7) * 100) : 0}%)\n` +
    `- User datang dari referral: ${referred} · Selesai onboarding: ${onboarded}`

  const systemPrompt =
    `Kamu Farhan, Growth Hacker Luxtradee (jurnal trading XAUUSD). Usulkan 3 EKSPERIMEN pertumbuhan yang bisa dieksekusi minggu ini — prioritas dampak besar dengan effort rendah. ` +
    `OUTPUT HANYA JSON valid (tanpa markdown): {"insight":"maks 2 kalimat soal titik bocor funnel terbesar","experiments":[{"name":"nama singkat","how":"langkah konkret 1-2 kalimat","metric":"metrik keberhasilan terukur","effort":"rendah|sedang|tinggi"}]} — bahasa Indonesia.`

  let provider: GhInsight['provider'] = 'fallback'
  let insight = '', experiments: GhExperiment[] = []
  let raw = ''
  try {
    /* SOP Multi-Agent — FARHAN (GH) rancang eksperimen pakai modelnya sendiri → Gemini cadangan */
    const brain = await agentBrain(e, 'gh', systemPrompt, funnelText + abLine + daLine + (await memBlock(e)) + (await agentMemBlock(e, 'gh')) + `\nTanggal: ${wibNow()}`, 1024, 0.6)
    raw = brain.text
    provider = brain.provider
  } catch { raw = '' }
  if (raw) {
    try {
      const j2 = JSON.parse(extractJsonLoose(raw) || raw)
      insight = String(j2.insight || '').slice(0, 400)
      experiments = Array.isArray(j2.experiments)
        ? j2.experiments.slice(0, 3).map((x: any) => ({
            name: String(x?.name || '').slice(0, 120),
            how: String(x?.how || '').slice(0, 260),
            metric: String(x?.metric || '').slice(0, 120),
            effort: String(x?.effort || 'sedang').slice(0, 20),
          })).filter((x: GhExperiment) => x.name)
        : []
    } catch { raw = '' }
  }
  if (!insight || !experiments.length) {
    /* Fallback TANPA LLM — tetap dari funnel nyata */
    provider = 'fallback'
    const akt = baru7 ? Math.round((activated7 / baru7) * 100) : 0
    insight = `Titik bocor terbesar: aktivasi pendaftar baru cuma ${akt}% (${activated7}/${baru7}) dan konversi PRO ${total ? Math.round((pro / total) * 100) : 0}%.`
    experiments = [
      { name: 'Email aktivasi 24 jam', how: 'Pendaftar baru yang belum upload dalam 24 jam dapat 1 email: "upload 1 screenshot, evaluasi AI jalan dalam 2 menit".', metric: 'Aktivasi pendaftar baru naik ke >30%', effort: 'rendah' },
      { name: 'Social proof di landing', how: 'Tampilkan jumlah trade ter-evaluasi & win rate agregat (data Dewi) di landing page.', metric: 'Konversi kunjungan → daftar naik', effort: 'sedang' },
      { name: 'Reward referral 2 arah', how: `Benefit PRO untuk pengundang & diundang. Saat ini baru ${referred} user dari referral — potensi gratis belum digarap.`, metric: 'Pendaftar dari referral mingguan naik', effort: 'sedang' },
    ]
  }
  const out: GhInsight = { ...base, provider, insight, experiments, ab: ab || undefined }
  await kvSet(e, 'gh:last', JSON.stringify(out)).catch(() => {})
  if (insight) await memAdd(e, 'GH Farhan', `Funnel (${funnel.total} pendaftar, PRO ${funnel.pro}): ${insight}`)
  return out
}

function ghToDiscord(g: GhInsight): string {
  const L = ['🚀 **GROWTH HACKER — RANCANGAN EKSPERIMEN (Farhan)**', `🔍 ${g.insight}`]
  if (g.funnel) L.push(`📉 Funnel: ${fmtN(g.funnel.total)} pendaftar · ${fmtN(g.funnel.pro)} PRO · aktivasi baru 7 hr ${g.funnel.baru7 ? Math.round((g.funnel.activated7 / g.funnel.baru7) * 100) : 0}% · ${fmtN(g.funnel.referred)} dari referral`)
  if (g.experiments?.length) {
    L.push('🧪 Eksperimen prioritas:')
    g.experiments.slice(0, 3).forEach((x, i) => L.push(`${i + 1}. **${x.name}** (effort ${x.effort}) → ${x.metric}\n   ${x.how}`))
  }
  L.push('_(rancangan otomatis tiap Senin 10:00 WIB — detail di Ruang Growth /kantor-ceo)_')
  return L.join('\n').slice(0, 1900)
}

/* ---------- NEXT BEST ACTION (CEO pintar): 1 prioritas/hari ----------
   Setelah briefing tersusun, Alexander pilih SATU aksi terpenting yang
   HANYA Bos yang bisa kerjakan hari ini → dikirim ke Discord sebagai
   pesan terpisah + tampil di Ruang Rapat. 1 panggilan LLM/hari. */
async function nextBestAction(e: Env, briefingText: string): Promise<string> {
  try {
    /* FASE BISNIS — saat pre-launch, prioritas Bos = LANGKAH CHECKLIST
       PELUNCURAN (lib/ceo-phase.ts) — deterministik, bukan karangan LLM baru
       tiap hari. Maju langkah HANYA saat Bos jawab OKE (action=nba-verdict).
       Checklist habis / fase lain → NBA LLM biasa di bawah. */
    const d = phaseDeps(e)
    const pinfo = await getPhase(d, cleanEnv(e.PHASE_OVERRIDE)).catch(() => null)
    if (pinfo?.phase === 'pre-launch') {
      const step = await currentLaunchStep(d)
      if (step) {
        const text = `🎯 ${step.text}`
        await kvSet(e, 'nba:last', JSON.stringify({ at: new Date().toISOString(), text, src: 'checklist', idx: step.idx })).catch(() => {})
        await memAdd(e, 'CEO Alexander', `Prioritas Bos hari ini (langkah ${step.idx + 1}/${step.total} checklist peluncuran): ${step.text}`)
        try { await sendDiscord(e, `${text}\n_(langkah ${step.idx + 1}/${step.total} checklist peluncuran — maju ke langkah berikutnya setelah Bos jawab OKE)_`) } catch { /* ignore */ }
        return text
      }
    }
    /* SOP Multi-Agent — Alexander (CEO, Llama 3.1 8B) pilih prioritas;
       tidak lagi tergantung Gemini. */
    const brain = await agentBrain(
      e, 'ceo',
      'Kamu wakil CEO Luxtradee (jurnal trading XAUUSD). Dari briefing pagi di bawah, tentukan SATU aksi prioritas tertinggi yang Bos harus kerjakan HARI INI — yang paling berdampak ke pertumbuhan atau paling urgent, dan HANYA Bos yang bisa (bukan yang bisa dikerjakan karyawan AI). LIHAT MEMORI KANTOR: jangan pilih prioritas yang mirip dengan yang sudah dipilih hari-hari sebelumnya kecuali benar-benar masih paling penting. Format jawaban HANYA: "🎯 <aksi konkret> — <alasan 1 kalimat>". Maks 200 karakter, bahasa Indonesia.',
      briefingText.slice(0, 1600) + (await memBlock(e, 5)) + (await agentMemBlock(e, 'ceo', 5)), 200, 0.4,
    )
    const nba = brain.text
    const text = nba.split('\n').filter((s) => s.trim()).slice(0, 2).join(' ').trim().slice(0, 300)
    if (!text) return ''
    await kvSet(e, 'nba:last', JSON.stringify({ at: new Date().toISOString(), text })).catch(() => {})
    await memAdd(e, 'CEO Alexander', `Prioritas Bos hari ini: ${text.replace(/^🎯\s*/, '')}`)
    try { await sendDiscord(e, `${text}\n_(dipilih otomatis dari briefing pagi — 1 prioritas saja, biar fokus)_`) } catch { /* ignore */ }
    return text
  } catch { return '' }
}

/* ============================================================
   BAHAN ANALISIS TIKTOK — CRUD tabel tiktok_posts (migrasi 014)
   Dipakai Ruang CMO: Bos paste link + views/likes → caption
   diambil OTOMATIS via TikTok oEmbed (gratis, tanpa API key).
   ============================================================ */
async function tikTokList(e: Env) {
  if (!sbUrl(e) || !cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY)) throw new Error('set SUPABASE_SERVICE_ROLE_KEY dulu di Cloudflare (butuh bypass RLS)')
  const res = await fetch(`${sbUrl(e)}/rest/v1/tiktok_posts?select=id,url,caption,thumbnail_url,views,likes,comments,posted_at&order=views.desc&limit=100`, { headers: sbHPriv(e), signal: timeoutSignal(10_000) })
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 160)
    throw new Error(`tiktok_posts HTTP ${res.status}${detail ? ' — ' + detail : ''}${detail.includes('does not exist') ? ' — jalankan supabase-migrations/014_create_tiktok_posts.sql dulu' : ''}`)
  }
  return { posts: await res.json() }
}

/* URL TikTok valid: link panjang (www/m) ATAU link pendek share (vt/vm)
   — contoh: https://vt.tiktok.com/ZSgQjsxYP/ */
const TT_URL_RE = /^https:\/\/(www\.|m\.|vt\.|vm\.)?tiktok\.com\/[^\s]+$/i

async function tikTokAdd(e: Env, body: { url?: string; views?: number; likes?: number; comments?: number; caption?: string }) {
  const postUrl = String(body.url || '').trim()
  if (!TT_URL_RE.test(postUrl)) throw new Error('URL TikTok tidak valid — contoh: https://www.tiktok.com/@username/video/123456789 atau link pendek https://vt.tiktok.com/ZSgQjsxYP')
  if (!sbUrl(e) || !cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY)) throw new Error('set SUPABASE_SERVICE_ROLE_KEY dulu di Cloudflare (butuh bypass RLS)')

  /* Link pendek vt/vm → resolve redirect ke URL video asli dulu supaya
     oEmbed bisa baca caption (vt.tiktok.com sering ditolak oEmbed).
     Canonical hanya dipakai kalau hasil redirect benar-benar URL video
     (bukan halaman about/login yang kadang jadi tujuan redirect). */
  let canonical = postUrl
  if (/^https:\/\/(vt|vm)\.tiktok\.com\//i.test(postUrl)) {
    try {
      const r0 = await fetch(postUrl, { redirect: 'follow', signal: timeoutSignal(10_000) })
      if (r0.ok && /^https:\/\/(www\.|m\.)?tiktok\.com\//i.test(r0.url) && /\/(video|photo)\//i.test(r0.url)) canonical = r0.url
    } catch { /* gagal resolve → coba oEmbed dengan URL asli */ }
  }

  /* oEmbed TikTok: gratis, tanpa API key → caption + thumbnail otomatis */
  let caption = String(body.caption || '').trim()
  let thumbnail = ''
  let autoCaption = false
  try {
    let oe = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(canonical)}`, { signal: timeoutSignal(10_000) })
    if (!oe.ok && canonical !== postUrl)
      oe = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(postUrl)}`, { signal: timeoutSignal(10_000) })
    if (oe.ok) {
      const d: any = await oe.json()
      const t = String(d?.title || '').trim()
      if (t) { caption = caption || t; autoCaption = !body.caption }
      thumbnail = String(d?.thumbnail_url || '')
    }
  } catch { /* oEmbed gagal → pakai caption manual dari Bos */ }

  const row = {
    url: postUrl,
    caption: caption || '(caption kosong)',
    thumbnail_url: thumbnail,
    views: Math.max(0, Math.round(Number(body.views) || 0)),
    likes: Math.max(0, Math.round(Number(body.likes) || 0)),
    comments: Math.max(0, Math.round(Number(body.comments) || 0)),
  }
  const res = await fetch(`${sbUrl(e)}/rest/v1/tiktok_posts?on_conflict=url`, {
    method: 'POST',
    headers: { ...sbHPriv(e), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row),
    signal: timeoutSignal(10_000),
  })
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 160)
    throw new Error(`Simpan gagal HTTP ${res.status}${detail ? ' — ' + detail : ''}${detail.includes('does not exist') ? ' — jalankan supabase-migrations/014_create_tiktok_posts.sql dulu' : ''}`)
  }
  const saved: any = await res.json()
  return { ok: true, post: Array.isArray(saved) ? saved[0] : saved, captionAuto: autoCaption }
}

async function tikTokDel(e: Env, id: string) {
  if (!id) throw new Error('id wajib diisi')
  if (!sbUrl(e) || !cleanEnv(e.SUPABASE_SERVICE_ROLE_KEY)) throw new Error('set SUPABASE_SERVICE_ROLE_KEY dulu di Cloudflare (butuh bypass RLS)')
  const res = await fetch(`${sbUrl(e)}/rest/v1/tiktok_posts?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: sbHPriv(e), signal: timeoutSignal(10_000) })
  if (!res.ok) throw new Error(`Hapus gagal HTTP ${res.status}`)
  return { ok: true, deleted: id }
}

/* ============================================================
   ROUTING (pengganti Hono — satu route, banyak action)
   ============================================================ */
const j = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json' } })

async function handle(req: Request): Promise<Response> {
  const e = env()
  const url = new URL(req.url)
  const action = url.searchParams.get('action') || 'info'
  const key = url.searchParams.get('key') || ''
  const auth = req.headers.get('authorization') || ''
  const isCron = !!e.CRON_SECRET && (key === e.CRON_SECRET || auth === `Bearer ${e.CRON_SECRET}`)
  const isAdmin = !!e.ADMIN_SECRET && (auth === `Bearer ${e.ADMIN_SECRET}` || key === e.ADMIN_SECRET)
  /* Fallback konsisten dengan route /api/cron/*: kalau CRON_SECRET dan
     ADMIN_SECRET dua-duanya belum diset di Worker, izinkan cron internal
     berjalan (mode tanpa secret). Begitu salah satu diset, auth wajib. */
  const noSecrets = !cleanEnv(e.CRON_SECRET) && !cleanEnv(e.ADMIN_SECRET)

  /* Browser mengirim anon key PUBLIK miliknya (yang terbukti jalan — dipakai
     seluruh situs). Env SUPABASE_ANON_KEY yang salah di Cloudflare tertimpa
     di sini, jadi query data & verifikasi email tetap hidup. Anon key memang
     publik — keamanan tetap di email-gate JWT di bawah. */
  const hKey = cleanEnv(req.headers.get('x-sb-key') || '')
  if (hKey.length > 20) (e as Record<string, string>).SUPABASE_ANON_KEY = hKey

  /* Email-gate: Bearer token = sesi login Supabase user.
     Cukup email owner (default luxtradee@gmail.com) — tanpa perlu secret apa pun. */
  let isOwner = false
  if (!isAdmin && auth.startsWith('Bearer ')) {
    const tok = auth.slice(7).trim()
    if (tok && tok !== e.ADMIN_SECRET && tok !== e.CRON_SECRET)
      isOwner = await verifyOwnerToken(e, tok)
  }

  if (action !== 'info' && !(isCron || isAdmin || isOwner || noSecrets))
    return j({ error: 'unauthorized — login sebagai ' + ownerEmail(e) + ' di situs, atau pakai ?key=CRON_SECRET / header Authorization: Bearer <ADMIN_SECRET>' }, 401)

  if (action !== 'info' && action !== 'quota' && action !== 'briefing-last' && action !== 'talk' && action !== 'talk-last' && action !== 'mem-last' && action !== 'mem-agent' && action !== 'analyst-last' && action !== 'growth-last' && action !== 'art-list' && action !== 'art-body') {
    const missing = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'].filter(k => (k === 'SUPABASE_URL' && !sbUrl(e)) || (k === 'SUPABASE_ANON_KEY' && !sbAnonKey(e)))
    if (missing.length) return j({ error: 'ENV belum diset: ' + missing.join(', ') }, 500)
  }

  switch (action) {
    case 'briefing':
      return j(await runMorningBriefing(e, req, key))
    case 'briefing-extras': {
      /* FASE 2 briefing — dipicu runMorningBriefing sbg self-call (invokasi
         terpisah = budget subrequest baru, fix "Too many subrequests").
         ?step=emails|qa|talk · context dibaca dari agent_kv (autoacc +
         briefing:last) supaya URL self-call tetap pendek. */
      const step = (url.searchParams.get('step') || 'all').toLowerCase()
      const day = wibDay()
      const autoOn = (await kvGet(e, 'autoacc').catch(() => null)) !== 'off'
      let briefingText = ''
      try { briefingText = String((JSON.parse((await kvGet(e, 'briefing:last')) || 'null') as { text?: string } | null)?.text || '') } catch { /* ignore */ }
      const summary: Record<string, unknown> = { extrasAt: new Date().toISOString(), extrasStep: step }
      await briefingExtras(e, { day, autoOn, briefingText, summary }, step).catch(() => {})
      return j({ ok: true, step, ...summary })
    }
    case 'briefing-last': {
      const raw = await kvGet(e, 'briefing:last')
      return raw ? j(JSON.parse(raw)) : j({ error: 'belum ada briefing' }, 404)
    }
    case 'agents': {
      // ?only=cto,cso,cfo,coo — jalankan subset agen (draf TikTok CMO
      // di-cache 1×/hari sesuai SOP "1 draf/hari" — hemat kuota model)
      const only = (url.searchParams.get('only') || '').split(',').map((s) => s.trim()).filter(Boolean)
      const want = (w: string) => !only.length || only.includes(w)
      const [cto, cso, cmo, cfo, coo] = await Promise.all([
        want('cto') ? ctoAgent(e).catch((x: any) => ({ error: String(x?.message || x) })) : Promise.resolve(undefined),
        want('cso') ? csoAgent(e).catch((x: any) => ({ error: String(x?.message || x) })) : Promise.resolve(undefined),
        want('cmo') ? cmoAgent(e).catch((x: any) => ({ error: String(x?.message || x) })) : Promise.resolve(undefined),
        want('cfo') ? cfoAgent(e).catch((x: any) => ({ error: String(x?.message || x) })) : Promise.resolve(undefined),
        want('coo') ? cooPending(e).catch(() => ({ pending: 0, approved24h: 0 })) : Promise.resolve(undefined),
      ])
      return j({ cto, cso, cmo, cfo, coo })
    }
    case 'diag': {
      // Diagnostik sistem untuk Ruang CTO — periksa env + tes tiap query
      const has = (k: string) => !!cfSecret(e, k)
      const out: Record<string, unknown> = {
        at: new Date().toISOString(),
        sbUrl: sbUrl(e),
        env: {
          SUPABASE_ANON_KEY: has('SUPABASE_ANON_KEY') || has('NEXT_PUBLIC_SUPABASE_ANON_KEY') || !!INLINED_SB_KEY,
        SUPABASE_SERVICE_ROLE_KEY: has('SUPABASE_SERVICE_ROLE_KEY'),
          GEMINI_API_KEY: has('GEMINI_API_KEY'),
          OPENROUTER_API_KEY: has('OPENROUTER_API_KEY'),
          OPENROUTER_MODEL: has('OPENROUTER_MODEL'),
          RESEND_API_KEY: has('RESEND_API_KEY'),
          DISCORD_WEBHOOK_URL: has('DISCORD_WEBHOOK_URL'),
          RESEND_WEBHOOK_SECRET: has('RESEND_WEBHOOK_SECRET'),
          DISCORD_BOT_TOKEN: has('DISCORD_BOT_TOKEN'),
          DISCORD_PUBLIC_KEY: has('DISCORD_PUBLIC_KEY'),
          DISCORD_APP_ID: has('DISCORD_APP_ID'),
          CRON_SECRET: has('CRON_SECRET'),
          ADMIN_SECRET: has('ADMIN_SECRET'),
          OWNER_EMAIL: has('OWNER_EMAIL'),
        },
        setup: {
          /* Task 35f: bedakan WAJIB vs OPSIONAL — dulu semua ❌ tampak "wajib
             diset" sehingga Bos bingung (bot token sudah ada kok ditandai ❌). */
          OPENROUTER_MODEL: 'Aman dilewati — hanya override model utama Sinta; kosong = pakai model default tim.',
          RESEND_WEBHOOK_SECRET: 'Aman dilewati — baru berguna kalau mau statistik email dibuka: resend.com → Webhooks → copy Signing Secret → secret RESEND_WEBHOOK_SECRET.',
          OWNER_EMAIL: 'Default sudah luxtradee@gmail.com. Set hanya kalau mau ganti email pemilik.',
          DISCORD_BOT_TOKEN: 'Hanya untuk chat 2 arah /bos di Discord (webhook 1 arah sudah jalan tanpa ini). Kalau Bos YAKIN sudah diset tapi masih ❌: (1) pastikan lokasinya Cloudflare → Workers & Pages → luxtradee → Settings → Variables & Secrets (bukan project lain), nama persis DISCORD_BOT_TOKEN tanpa spasi/kutip; (2) setelah set/ubah → klik Deploy ulang; (3) jalankan 🩺 lagi.',
          RESEND_API_KEY: 'Cloudflare → Workers & Pages → luxtradee → Settings → Variables & Secrets → Add: RESEND_API_KEY (re_...) Encrypt → Deploy. Lalu tes: tombol 🧪 Tes Email di Ruang Rapat.',
          DISCORD_WEBHOOK_URL: 'Cloudflare → Variables & Secrets → Add: DISCORD_WEBHOOK_URL (discord.com/api/webhooks/...) Encrypt → Deploy. Lalu tes: tombol 🧪 Tes Discord.',
        },
        setupHint: '💡 Secret baru/ubah di Cloudflare aktif setelah DEPLOY ulang — kalau baru diset dan masih ❌, klik Deploy lalu jalankan 🩺 lagi. Yang berlabel OPSIONAL aman dilewati.',
      }
      const t = async (name: string, fn: () => Promise<unknown>) => {
        try { out[name] = { ok: true, data: await fn() } }
        catch (x: any) { out[name] = { ok: false, error: String(x?.message || x).slice(0, 200) } }
      }
      await t('profiles', async () => ({ total: await supaCount(e, 'profiles') }))
      await t('trades', async () => ({ active24h: (await fetchActiveUserIds(e, isoAgo(24))).size }))
      await t('bug_reports', async () => ({ total24h: await supaCount(e, 'bug_reports', 'created_at=gte.' + isoAgo(24)) }))
      await t('agent_kv', async () => ({ briefingLastTersimpan: !!(await kvGet(e, 'briefing:last')) }))
      /* Task 35b: tes OTAK karyawan — panggil OpenRouter beneran (validitas
         key + hidup/matinya tiap model chain). Di sinilah penyebab "karyawan
         jatuh ke templat" akhirnya terlihat tanpa wrangler tail. */
      await t('openrouter', async () => orDiag(e))
      return j(out)
    }
    case 'quota': {
      const q = await cfoAgent(e)
      /* Memori pribadi CFO — sekali per WIB-day (bukan tiap refresh panel):
         Putri ingat angka kuota & pendapatan yang terakhir dia laporkan. */
      try {
        const mk = `cfo:mem:${wibDay()}`
        if (!(await kvGet(e, mk))) {
          await kvSet(e, mk, new Date().toISOString()).catch(() => {})
          await memAdd(e, 'CFO Putri', `Kuota hari ini ${Number(q?.usedToday ?? 0)}/${Number(q?.limit ?? 0)} vision, email ${Number(q?.emailToday ?? 0)}/${Number(q?.emailLimit ?? 0)}, status ${String(q?.status || '-').slice(0, 24)}, est MRR Rp${Number(q?.estMRR || 0).toLocaleString('id-ID')} (${Number(q?.proCount ?? 0)} user PRO)`)
        }
      } catch { /* memori opsional */ }
      return j(q)
    }
    case 'quota-track': {
      const limit = parseInt(e.DAILY_VISION_LIMIT || '1400', 10)
      const k = `quota:${wibDay()}`
      const used = parseInt((await kvGet(e, k)) || '0', 10)
      if (used >= limit)
        return j({ allowed: false, usedToday: used, limit, reason: 'kuota harian habis — tunda upload ke besok (anti 429)' }, 429)
      await kvSet(e, k, String(used + 1))
      return j({ allowed: true, usedToday: used + 1, remaining: limit - used - 1, limit })
    }
    case 'acc-email': {
      // Flow "ACC EMAIL" — dipicu tombol di dashboard CEO (owner login)
      // Task 35h: 2 GRUP — user vakum (pernah upload) & belum pernah upload,
      // masing-masing draf berbeda dari Maya.
      const day = wibDay()
      if (await kvGet(e, `acc_email:${day}`)) return j({ ok: true, dup: true })
      await kvSet(e, `acc_email:${day}`, new Date().toISOString())
      let emailsSent = -1, sentDormant = 0, sentNever = 0
      if (e.RESEND_API_KEY) {
        try {
          const r = await sendPassiveEmails(e)
          emailsSent = r.sent
          sentDormant = r.sentDormant
          sentNever = r.sentNever
        } catch { /* ignore */ }
      }
      const reply = emailsSent >= 0
        ? `Siap Bos! ✅ ${emailsSent} email terkirim ke 2 grup — ${sentDormant} user vakum (draf "kangen") + ${sentNever} belum pernah upload (draf ajakan pertama). Masing-masing dapat email yang beda.`
        : 'Siap Bos! ✅ ACC EMAIL dicatat. Set RESEND_API_KEY agar email terkirim otomatis.'
      try { await sendDiscord(e, reply) } catch { /* ignore */ }
      return j({ ok: true, accEmail: true, emailsSent, sentDormant, sentNever })
    }
    case 'reset-work': {
      /* ♻️ Task 35c — tombol Bos "Reset Kerjaan AI": bersihkan cache kerjaan
         HARI INI + proposal templat lama (masa otak mati) supaya tim
         generate ulang SEMUA dengan AI beneran.
         DIHAPUS: draf Sinta, diskusi CSO×CMO, NBA, briefing terakhir,
         laporan Dewi & Farhan (semua agent_kv) + ai_pending_actions status
         pending/rejected 24 jam terakhir (dedup menghitung SEMUA status —
         kalau tak dihapus, sweep menolak mengusulkan ulang).
         TIDAK disentuh: riwayat ACC/eksekusi (status approved), cmo:posted,
         memori kantor, dedup email harian. */
      const day = wibDay()
      const keys = [`cmo:${day}`, `cso-cmo:${day}`, 'cso-cmo:last', 'nba:last', 'briefing:last', 'da:last', 'gh:last']
      /* Task 35-e JUJUR: hitung cache yang BENAR-BENAR terhapus (kvDel kini
         return jumlah baris; 0 = tidak ada/gagal — bukan otomatis "sukses") */
      let clearedReal = 0
      for (const k of keys) clearedReal += await kvDel(e, k)
      let removedPending = -1, pendErr = ''
      try {
        const since = isoAgo(24)
        removedPending = await supaCount(e, 'ai_pending_actions', `created_at=gte.${encodeURIComponent(since)}&status=in.(pending,rejected)`)
        if (removedPending > 0) {
          const del = await fetch(`${sbUrl(e)}/rest/v1/ai_pending_actions?created_at=gte.${encodeURIComponent(since)}&status=in.(pending,rejected)`, {
            method: 'DELETE', headers: { ...sbHPriv(e), Prefer: 'return=minimal' }, signal: timeoutSignal(15_000),
          })
          if (!del.ok) { const b = await del.text().catch(() => ''); pendErr = `DELETE HTTP ${del.status} ${b.slice(0, 90)}`; removedPending = -1 }
        }
      } catch (x: any) { pendErr = String(x?.message || x).slice(0, 140); removedPending = -1 }
      const text = `♻️ Reset selesai — ${clearedReal}/${keys.length} cache kerjaan hari ini terhapus` +
        (removedPending >= 0 ? ` · ${removedPending} proposal lama dihapus` : pendErr ? ` · proposal: ${pendErr}` : '') +
        `. Lanjutan: 🌅 Briefing + 🧹 Sweep 7 Agen + ✍️ Buat 3 Draf — tim kerja ulang dengan AI beneran.`
      return j({ ok: true, cleared: keys, clearedReal, removedPending, text })
    }
    case 'discord-test':
      // Diagnosa: kirim pesan tes ke Discord, laporkan hasil mentahnya
      try {
        await sendDiscord(e, '🧪 Tes Ruang CEO — koneksi Discord webhook OK ✅')
        return j({ ok: true, message: 'tes terkirim — cek channel Discord' })
      } catch (x: any) {
        return j({ ok: false, error: String(x?.message || x) })
      }
    case 'nba-verdict': {
      // ⭐ Bos jawab prioritas NBA hari ini: oke (eksekusi) / not (ganti).
      // Dipicu tombol di Ruang Rapat ATAU slash command Discord /nba-oke · /nba-not.
      const v = (url.searchParams.get('verdict') || '').toLowerCase()
      if (v !== 'oke' && v !== 'not') return j({ ok: false, error: 'verdict harus oke atau not' }, 400)
      const day = wibDay()
      await kvSet(e, `nba-verdict:${day}`, v)
      const raw = await kvGet(e, 'nba:last').catch(() => null)
      let snippet = ''
      let fromChecklist = false
      try { const nb = JSON.parse(raw || '{}') as { text?: string; src?: string }; snippet = String(nb?.text || '').slice(0, 90); fromChecklist = nb?.src === 'checklist' } catch { /* ignore */ }
      /* Checklist peluncuran: langkah maju HANYA saat Bos jawab OKE
         (lib/ceo-phase.ts advanceLaunchStep). NOT → langkah tetap. */
      let advanced = false
      if (v === 'oke' && fromChecklist) {
        try { await advanceLaunchStep(phaseDeps(e)); advanced = true } catch { /* opsional */ }
      }
      await memAdd(e, 'CEO Alexander', v === 'oke'
        ? `Bos konfirmasi OKE untuk NBA hari ini: "${snippet}…" — dieksekusi${advanced ? ' · checklist peluncuran MAJU ke langkah berikutnya' : ''}`
        : `Bos jawab NOT OKE untuk NBA hari ini: "${snippet}…" — prioritas diganti${fromChecklist ? ' (langkah checklist TIDAK maju — coba penyelesaian beda besok)' : ''}`)
      try { await sendDiscord(e, v === 'oke'
        ? `✅ Bos: **OKE** — NBA hari ini dieksekusi: ${snippet}${advanced ? '\n✅ Checklist peluncuran maju ke langkah berikutnya.' : ''}`
        : `❌ Bos: **NOT OKE** — NBA hari ini diganti: ${snippet}`) } catch { /* ignore */ }
      return j({ ok: true, verdict: v, advanced, note: v === 'oke'
        ? (advanced ? 'OKE dicatat + checklist peluncuran maju ke langkah berikutnya' : 'NBA hari ini dicatat OKE — besok Alexander cek tuntasnya')
        : 'NBA diganti — Alexander pilih prioritas baru besok pagi' })
    }
    case 'nba-verdict-last':
      return j({ verdict: (await kvGet(e, `nba-verdict:${wibDay()}`)) || null })
    case 'email-test': {
      // ⭐ Diagnosa Resend: kirim email tes ke Bos (OWNER_EMAIL), laporkan
      // hasil mentahnya — biar kelihatan salah di mana (key/domain/kuota).
      let apiKey = cleanEnv(e.RESEND_API_KEY)
      if (!apiKey) {
        try {
          const sym = Symbol.for('__cloudflare-context__')
          const ctx = (globalThis as Record<symbol, unknown>)[sym] as { env?: Record<string, string> } | undefined
          apiKey = cleanEnv(ctx?.env?.RESEND_API_KEY) || ''
        } catch { /* ignore */ }
      }
      if (!apiKey)
        return j({
          ok: false,
          error: 'RESEND_API_KEY belum terbaca dari Worker',
          setup: [
            '1. Cloudflare → Workers & Pages → luxtradee → Settings → Variables & Secrets',
            '2. Add variable → Name: RESEND_API_KEY · Value: re_... · pilih Encrypt (Secret)',
            '3. Centang Production & Preview → Deploy',
            '4. Tunggu deploy selesai (±2-3 mnt) → coba lagi',
          ],
        })
      const to = ownerEmail(e)
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to,
            subject: '🧪 Tes Ruang CEO — koneksi Resend OK',
            text: `Tes koneksi Resend dari Ruang CEO Luxtradee.\n\nWaktu: ${wibNow()}\n\nKalau email ini masuk, RESEND_API_KEY sudah terpasang benar — karyawan AI (Maya CSO, Bagas COO) bisa kirim email.\n\nSatu langkah lagi biar fitur follow-up jalan: pasang webhook\nresend.com → Webhooks → https://luxtradee.web.id/api/webhooks/resend`,
          }),
          signal: timeoutSignal(15_000),
        })
        const data = (await res.json().catch(() => null)) as { id?: string; message?: string; name?: string } | null
        if (!res.ok) {
          const msg = String(data?.message || `HTTP ${res.status}`)
          const hint = res.status === 401 ? 'API key salah/kadaluarsa — buat ulang di resend.com/api-keys lalu update secret RESEND_API_KEY'
            : /not verified|domain/i.test(msg) ? `Domain belum diverifikasi di Resend — buka resend.com/domains → Add Domain luxtradee.web.id → pasang DNS record (${msg})`
            : res.status === 422 ? `${msg} — kalau soal "testing emails", verifikasi domain dulu di resend.com/domains`
            : msg
          return j({ ok: false, status: res.status, error: hint })
        }
        return j({ ok: true, message: `tes terkirim ke ${to} — cek inbox (atau folder spam)`, id: data?.id })
      } catch (x: any) {
        return j({ ok: false, error: String(x?.message || x) })
      }
    }
    case 'discord-setup': {
      // ⭐ Daftarkan slash command bot Alexander (/bos, /nba-oke, /nba-not)
      // ke Discord — dipanggil 1× setelah 3 secret dipasang.
      const appId = cleanEnv(e.DISCORD_APP_ID)
      const botToken = cleanEnv(e.DISCORD_BOT_TOKEN)
      if (!appId || !botToken)
        return j({
          ok: false,
          error: 'DISCORD_APP_ID & DISCORD_BOT_TOKEN belum diset',
          setup: [
            '1. discord.com/developers → New Application → copy APPLICATION ID → secret DISCORD_APP_ID',
            '2. Tab Bot → Reset Token → copy → secret DISCORD_BOT_TOKEN',
            '3. Tab General Information → copy PUBLIC KEY → secret DISCORD_PUBLIC_KEY',
            '4. Interactions Endpoint URL: https://luxtradee.web.id/api/discord-interactions',
            '5. OAuth2 → URL Generator → scope bot+applications.commands → invite ke server',
            '6. Klik tombol ini lagi untuk daftarkan perintah /bos',
          ],
        })
      try {
        const res = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bot ${botToken}` },
          body: JSON.stringify([
            {
              name: 'bos', description: 'Ngobrol langsung dengan Alexander (CEO AI Luxtradee)',
              options: [{ name: 'pesan', description: 'Apa yang mau kamu tanyakan?', type: 3, required: true }],
            },
            { name: 'nba-oke', description: 'Jawab OKE untuk prioritas NBA hari ini (dieksekusi)' },
            { name: 'nba-not', description: 'Jawab NOT OKE — minta Alexander ganti prioritas' },
          ]),
          signal: timeoutSignal(15_000),
        })
        const data = (await res.json().catch(() => null)) as unknown
        if (!res.ok) {
          const m = JSON.stringify(data).slice(0, 160)
          return j({ ok: false, error: `Discord HTTP ${res.status} — ${m}` })
        }
        return j({ ok: true, message: 'Perintah /bos · /nba-oke · /nba-not terdaftar — coba di channel Discord (mungkin perlu restart Discord)' })
      } catch (x: any) {
        return j({ ok: false, error: String(x?.message || x) })
      }
    }
    case 'watchdog':
      // CTO jaga situs 24/7 — Cloudflare cron tiap 15 menit (worker-entry.ts):
      // /api/ceo-agent?action=watchdog&key=CRON_SECRET
      return j(await watchdog(e, req, key))
    case 'qa':
      // CTO QA sweep — tes semua fitur/route utama (juga jalan otomatis di briefing 08:00)
      return j(await qaAgent(e))
    case 'e2e':
      // CTO E2E — LOGIN beneran (akun tes) + tes fitur satu-satu:
      // profil, buat/verifikasi/hapus trade, tes privasi RLS (juga otomatis di briefing 08:00)
      return j(await e2eAgent(e))
    case 'e2e-last': {
      // Hasil E2E terakhir (tanpa menjalankan tes lagi)
      const raw = await kvGet(e, 'e2e:last')
      return raw ? j(JSON.parse(raw)) : j({ error: 'belum ada hasil E2E' }, 404)
    }
    case 'weekly':
      // Laporan mingguan — Cloudflare cron Senin 10:00 WIB (worker-entry.ts):
      // /api/ceo-agent?action=weekly&key=CRON_SECRET
      return j(await weeklyReport(e))
    case 'auto-acc': {
      // Toggle mode otomatis: kalau ON, CSO kirim email pasif otomatis tiap briefing pagi.
      // DEFAULT = ON (tanpa klik apa pun) — set eksplisit 'off' untuk mematikan.
      // GET = baca status · POST ?on=1 / ?on=0 = ubah
      const cur = (await kvGet(e, 'autoacc')) !== 'off'
      const p = url.searchParams.get('on')
      if (p === '1' || p === '0') {
        await kvSet(e, 'autoacc', p === '1' ? 'on' : 'off')
        const msg = p === '1'
          ? '🤖 AUTO-ACC DIAKTIFKAN — CSO kirim email ke user pasif OTOMATIS tiap briefing pagi. Bos nggak perlu klik lagi.'
          : '🤖 AUTO-ACC dimatikan — ACC EMAIL kembali manual lewat Ruang CEO.'
        try { await sendDiscord(e, msg) } catch { /* ignore */ }
        return j({ set: true, autoacc: p === '1' })
      }
      return j({ autoacc: cur, default: true })
    }
    case 'tiktok-list':
      // Bahan analisis TikTok untuk CMO (Ruang CMO) — list semua post
      try { return j(await tikTokList(e)) } catch (x: any) { return j({ error: String(x?.message || x) }, 500) }
    case 'tiktok-add':
      // Tambah post: { url, views, likes, comments?, caption? } — caption
      // diambil otomatis via oEmbed kalau Bos tidak isi manual
      try {
        const body = await req.json().catch(() => ({}) as Record<string, unknown>)
        return j(await tikTokAdd(e, body as { url?: string; views?: number; likes?: number; comments?: number; caption?: string }))
      } catch (x: any) { return j({ error: String(x?.message || x) }, 400) }
    case 'tiktok-del':
      // Hapus post bahan analisis: ?id=<uuid>
      try { return j(await tikTokDel(e, url.searchParams.get('id') || '')) } catch (x: any) { return j({ error: String(x?.message || x) }, 400) }
    case 'cmo-post': {
      // Task 32 — Post NYATA draf utama hari ini ke Instagram/Facebook via
      // Meta Graph API (Sinta). ?force=1 lewati dedup harian (repost manual).
      // Status SELALU jujur: posted:true hanya kalau Graph API konfirmasi.
      try {
        let draftText = ''
        try { draftText = String(JSON.parse((await kvGet(e, `cmo:${wibDay()}`)) || 'null')?.draft || '') } catch { /* ignore */ }
        if (!draftText) return j({ error: 'belum ada draf hari ini — jalankan agen CMO dulu (✍️ Buat 3 Draf)' }, 404)
        const force = url.searchParams.get('force') === '1'
        if (!force) {
          const prev = await kvGet(e, `cmo:posted:${wibDay()}`)
          if (prev) { try { return j({ alreadyPosted: true, result: JSON.parse(prev) }) } catch { /* repost */ } }
        }
        const result: MetaPostResult = await metaAutoPost(draftText)
        if (result.posted) await kvSet(e, `cmo:posted:${wibDay()}`, JSON.stringify(result)).catch(() => {})
        return j({ result, diag: metaDiag() })
      } catch (x: any) { return j({ error: String(x?.message || x).slice(0, 160) }, 500) }
    }
    case 'cmo-autopost': {
      // Task 32 — Status/toggle auto-posting Sinta: GET status,
      // ?set=on|off untuk ubah. Menampilkan kredensial Meta yang terdeteksi.
      try {
        const set = url.searchParams.get('set')
        if (set === 'on' || set === 'off') await kvSet(e, 'cmo:autopost', set)
        const state = (await kvGet(e, 'cmo:autopost')) || 'on'
        const postedRaw = await kvGet(e, `cmo:posted:${wibDay()}`)
        return j({ autopost: state, postedToday: postedRaw ? JSON.parse(postedRaw) : null, diag: metaDiag() })
      } catch (x: any) { return j({ error: String(x?.message || x).slice(0, 160) }, 500) }
    }
    case 'talk':
      // Diskusi CSO × CMO (Ruang CSO): akar masalah user pasif + skrip konten.
      // Dedup per hari — kalau sudah jalan pagi ini, balikin hasil yang tersimpan.
      // Respons dibungkus {talk} — tanpa key `error` di root supaya state
      // dashboard ruangan lain tidak ikut menampilkan pesan ini.
      try {
        const dayKey = `cso-cmo:${wibDay()}`
        if (await kvGet(e, dayKey)) {
          const last = await kvGet(e, 'cso-cmo:last')
          return last ? j({ talk: { ...JSON.parse(last), dupToday: true } }) : j({ talk: await csoCmoTalk(e) })
        }
        await kvSet(e, dayKey, new Date().toISOString())
        return j({ talk: await csoCmoTalk(e) })
      } catch (x: any) { return j({ talkError: String(x?.message || x).slice(0, 160) }, 200) }
    case 'talk-last': {
      // Hasil diskusi CSO × CMO terakhir (dipakai Ruang CSO saat dibuka).
      // Selalu bentuk {talk} — tanpa key `error` di root (tidak bocor ke
      // panel ruangan lain). Gagal baca KV → talk:null (panel tampil kosong).
      try {
        const last = await kvGet(e, 'cso-cmo:last')
        return last ? j({ talk: JSON.parse(last) }) : j({ talk: null })
      } catch { return j({ talk: null }) }
    }
    case 'mem-last': {
      // Memori Kantor — catatan kesimpulan bersama semua karyawan AI
      // (Ruang Rapat). Tanpa ENV check — memori opsional, selalu aman.
      try { return j({ mem: await memList(e) }) } catch { return j({ mem: [] }) }
    }
    case 'mem-agent': {
      // Memori PRIBADI per karyawan — kartu detail karyawan (Ruang Struktur)
      // membaca riwayat kerja si karyawan. Tanpa ENV check — opsional, aman.
      const raw = String(url.searchParams.get('agent') || '').toLowerCase().trim()
      if (!AGENT_MEM_KEYS.includes(raw))
        return j({ error: 'parameter agent wajib salah satu dari: ' + AGENT_MEM_KEYS.join(', ') }, 400)
      try { return j({ agent: raw, mem: await agentMemList(e, raw) }) } catch { return j({ agent: raw, mem: [] }) }
    }
    case 'analyst': {
      // Dewi (Data Analyst) — analisis trades 30 hari → insight + rekomendasi.
      // Dedup per hari; kirim Discord (pesan terpisah) tiap hasil baru.
      try {
        const dk = `da:${wibDay()}`
        if (await kvGet(e, dk)) {
          const last = await kvGet(e, 'da:last')
          return last ? j({ da: { ...JSON.parse(last), dupToday: true } }) : j({ da: await analystAgent(e) })
        }
        await kvSet(e, dk, new Date().toISOString())
        const da = await analystAgent(e)
        try { await sendDiscord(e, daToDiscord(da)) } catch { /* ignore */ }
        return j({ da })
      } catch (x: any) { return j({ daError: String(x?.message || x).slice(0, 160) }, 200) }
    }
    case 'analyst-last': {
      // Hasil analisis Dewi terakhir (panel Ruang Data Analyst saat dibuka)
      try {
        const last = await kvGet(e, 'da:last')
        return last ? j({ da: JSON.parse(last) }) : j({ da: null })
      } catch { return j({ da: null }) }
    }
    case 'growth': {
      // Farhan (Growth Hacker) — funnel nyata + 3 eksperimen minggu ini.
      // Dedup per hari; kirim Discord (pesan terpisah) tiap hasil baru.
      try {
        const gk = `gh:${wibDay()}`
        if (await kvGet(e, gk)) {
          const last = await kvGet(e, 'gh:last')
          return last ? j({ gh: { ...JSON.parse(last), dupToday: true } }) : j({ gh: await growthAgent(e) })
        }
        await kvSet(e, gk, new Date().toISOString())
        const gh = await growthAgent(e)
        try { await sendDiscord(e, ghToDiscord(gh)) } catch { /* ignore */ }
        return j({ gh })
      } catch (x: any) { return j({ ghError: String(x?.message || x).slice(0, 160) }, 200) }
    }
    case 'growth-last': {
      // Hasil rancangan Farhan terakhir (panel Ruang Growth saat dibuka)
      try {
        const last = await kvGet(e, 'gh:last')
        return last ? j({ gh: JSON.parse(last) }) : j({ gh: null })
      } catch { return j({ gh: null }) }
    }
    case 'phase': {
      // FASE BISNIS saat ini (lib/ceo-phase.ts): pre-launch | early | growth.
      // Override manual: env PHASE_OVERRIDE. Dipakai briefing/NBA/artefak.
      try { return j(await getPhase(phaseDeps(e), cleanEnv(e.PHASE_OVERRIDE))) } catch (x: any) { return j({ error: String(x?.message || x) }, 500) }
    }
    case 'work': {
      // ARTEFAK MINGGUAN karyawan AI (lib/ceo-phase.ts runDailyWork) —
      // otomatis via briefing fase-2; tombol manual untuk uji/re-run.
      // ?only=<job-id> (mis. cmo:calendar) · ?force=1 abaikan dedup harian.
      try {
        const d = phaseDeps(e)
        const info = await getPhase(d, cleanEnv(e.PHASE_OVERRIDE))
        const only = url.searchParams.get('only') || undefined
        const force = url.searchParams.get('force') === '1'
        return j(await runDailyWork(d, info, { only, force }))
      } catch (x: any) { return j({ error: String(x?.message || x).slice(0, 160) }, 500) }
    }
    case 'tick': {
      // MESIN KERJA 24 JAM tanpa slot cron Cloudflare baru (lib/ceo-phase.ts
      // tickDailyWork) — mode pencicit: SATU panggilan = SATU job jatuh tempo
      // dikerjakan, sisanya nunggu tick berikutnya. Pemicu: slot */15 yang
      // SUDAH ada (worker-entry.ts, nol slot baru) dan/atau cron eksternal
      // gratis (cron-job.org / UptimeRobot):
      //   https://luxtradee.web.id/api/ceo-agent?action=tick&key=CRON_SECRET
      // Dedup work:done:<id>:<hari> internal → aman ditembak tiap 5–15 menit,
      // tidak ada dobel kerja LLM. idle = tak ada job → TANPA panggilan LLM.
      try {
        const d = phaseDeps(e)
        const info = await getPhase(d, cleanEnv(e.PHASE_OVERRIDE))
        return j(await tickDailyWork(d, info))
      } catch (x: any) { return j({ error: String(x?.message || x).slice(0, 160) }, 500) }
    }
    case 'art-list': {
      // ARTEFAK karyawan AI (lib/ceo-phase.ts) — metadata (maks 30 terakhir).
      // Dipakai panel "Antrean ACC — Artefak" di /kantor-ceo supaya barang
      // jadi karyawan TERLIHAT & bisa disalin Bos (bukan cuma laporan).
      try {
        const idx = JSON.parse((await kvGet(e, 'art:index')) || '[]') as Record<string, unknown>[]
        return j({ artifacts: Array.isArray(idx) ? idx : [] })
      } catch { return j({ artifacts: [] }) }
    }
    case 'art-body': {
      // Isi lengkap artefak (?id=<artefak-id>) — disimpan di art:body:<id>.
      const artId = url.searchParams.get('id') || ''
      if (!artId) return j({ error: 'id wajib — ?id=<artefak-id>' }, 400)
      try {
        const body = await kvGet(e, `art:body:${artId}`)
        return body != null ? j({ id: artId, body }) : j({ error: 'artefak tidak ditemukan (mungkin sudah dibuang dari index)' }, 404)
      } catch (x: any) { return j({ error: String(x?.message || x) }, 500) }
    }
    default: {
      /* Diagnosa otak karyawan: in-memory dulu (isolate hangat), kalau kosong
         baca dari agent_kv `brain:diag` (persist antar-isolate). Publik. */
      let diag = lastBrainDiag
      if (!diag) {
        try { const raw = await kvGet(e, 'brain:diag'); if (raw) diag = JSON.parse(raw) } catch { /* opsional */ }
      }
      return j({
        app: 'Luxtrade Super AI Agent — Multi-Agent (SOP: tiap karyawan model OpenRouter sendiri)',
        brainDiag: diag || { at: null, agent: null, hasil: 'belum ada panggilan sejak deploy terakhir' },
        models: {
          COO_Bagas: AGENT_MODELS.coo,
          CTO_Raka: AGENT_MODELS.cto,
          CSO_Maya: AGENT_MODELS.cso,
          CMO_Sinta: AGENT_MODELS.cmo,
          CFO_Putri: 'TANPA LLM — murni matematika hardcoded',
          CEO_Alexander: AGENT_MODELS.ceo,
        },
        notify: 'Discord webhook (DISCORD_WEBHOOK_URL)',
        owner: ownerEmail(e),
        actions: [
          'action=briefing (POST/GET) — laporan harian ke Discord: inti dulu (<60 dtk), lampiran QA/E2E + diskusi + NBA menyusul sebagai pesan terpisah',
          'action=briefing-extras [&step=emails|qa|talk] — fase 2 briefing di invokasi terpisah (fix budget subrequest CF Workers; dipicu otomatis oleh briefing)',
          'action=agents[&only=cto,cso,cfo] — data agen (subset via only)',
          'action=diag — diagnostik env & tes query Supabase (Ruang CTO)',
          'action=quota — laporan kuota (CFO)',
          'action=quota-track (POST) — gerbang anti-429 sebelum Gemini Vision',
          'action=briefing-last — briefing terakhir',
          'action=acc-email (POST/GET) — flow "ACC EMAIL": email sapaan ke user pasif (Resend)',
          'action=auto-acc [POST &on=1|0] — toggle kirim email pasif OTOMATIS tiap briefing pagi (default ON)',
          'action=watchdog — CTO jaga situs 24/7: DOWN/bug/kuota 80% → alarm Discord instan + triage bug otomatis (cron 15 mnt)',
          'action=qa — CTO tes semua fitur dashboard (15 route: halaman + endpoint kritis API) → hasil ikut laporan 08:00',
          'action=weekly — laporan mingguan 7 hari ke Discord (cron Minggu 20:00)',
          'action=tiktok-list — daftar bahan analisis TikTok (Ruang CMO)',
          'action=tiktok-add (POST JSON {url,views,likes}) — tambah post: caption auto via oEmbed',
          'action=tiktok-del (?id=) — hapus post bahan analisis',
          'action=cmo-post [?force=1] — Sinta posting NYATA draf hari ini ke Instagram/Facebook via Meta Graph API (butuh token; status jujur)',
          'action=cmo-autopost [?set=on|off] — status/toggle auto-posting Sinta 1×/hari (default ON, posting di fase 2 briefing)',
          'action=talk — diskusi harian CSO × CMO: akar masalah user pasif + skrip konten (Ruang CSO)',
          'action=talk-last — hasil diskusi CSO × CMO terakhir',
          'action=mem-last — 🧠 Memori Kantor: kesimpulan bersama semua karyawan AI (Ruang Rapat)',
          'action=analyst — Dewi (Data Analyst): trades 30 hari → insight + 3 rekomendasi (Ruang DA, cron Senin)',
          'action=analyst-last — hasil analisis Dewi terakhir',
          'action=growth — Farhan (Growth Hacker): funnel + 3 eksperimen growth (Ruang GH, cron Senin)',
          'action=growth-last — hasil rancangan Farhan terakhir',
          'action=phase — fase bisnis saat ini (pre-launch/early/growth; env PHASE_OVERRIDE utk paksa)',
          'action=work [&only=<job-id>][&force=1] — artefak mingguan karyawan AI (kalender konten, onboarding, titik impas, outbound, eksperimen, artikel SEO, audit SEO, seeding) — otomatis tiap briefing via fase-2 step "work"',
          'action=art-list — daftar artefak karyawan AI (panel Antrean ACC /kantor-ceo)',
          'action=art-body ?id= — isi lengkap satu artefak',
          'action=discord-test — kirim pesan tes ke Discord (diagnosa)',
        ],
      })
    }
  }
}

export const GET = handle
export const POST = handle
