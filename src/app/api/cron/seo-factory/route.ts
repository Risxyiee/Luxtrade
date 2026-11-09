import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCronAdmin, isMissingTableError, isMissingColumnError } from '@/lib/cron-supabase'
import { sendDiscordNotification } from '@/lib/discord'
import {
  pickSeoPages,
  buildSeoPageHtml,
  seoInternalLinks,
  type SeoPagePlan,
  type SeoPageData,
} from '@/lib/seo-factory'

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🏭 SEO FACTORY — FARHAN (mode pabrik halaman SEO terprogram)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ⚠️ CATATAN WAJIB: route ini NUMPANG slot cron 15-menit (Cloudflare Free
 * maks 5 cron trigger — SEMUA slot sudah terpakai; jadwal "bintang/15" =
 * setiap 15 menit — karyawan baru WAJIB numpang dengan throttle internal).
 * Wiring-nya di-edit MANUAL
 * oleh Bos di worker-entry.ts — FILE INI TIDAK MENYENTUH worker-entry.ts.
 * Karena dipanggil tiap 15 menit, throttle internal WAJIB:
 *   - MAKS 1 halaman per run (inheren: satu run = satu insert),
 *   - cooldown KV 14 menit antar publish (anti dobel-publish antar isolate
 *     CF — lock in-memory hanya berlaku per isolate),
 *   - MAKS 3 halaman per hari WIB (counter di agent_kv, reset ganti hari).
 *
 * ALUR 1 PUBLISH (semua data RIIL — gagal sumber → null, JANGAN mengarang):
 *   1. existingSlugs dari blog_posts (slug bisa null → difilter).
 *   2. pickSeoPages(existingSlugs, …, daySeedWib) — deterministik &
 *      rotasi per hari WIB; plan pertama = target terbit.
 *   3. Data riil per-sumber (try/catch terpisah):
 *      - Harga    : self-fetch /api/candles (bar terakhir = bar berjalan →
 *                   dipakai bar kedua-terakhir).
 *      - Member   : profiles count.
 *      - Kalender : economic_events ≥ hari ini (tabel mungkin tidak ada →
 *                   [] — error 42P01/does-not-exist DILARANG bikin crash).
 *   4. buildSeoPageHtml + seoInternalLinks → insert blog_posts (kolom isi
 *      artikel = `content_body` — migrasi 015). Kolom SEO (slug/keyword/
 *      meta_description — migrasi 040) belum ada? → FALLBACK insert kolom
 *      inti + meta disimpan agent_kv 'blog_seo:<id>' (dibaca API blog),
 *      dicatat di respon. Tetap gagal → respon jujur { ok:false }.
 *   5. Ringkasan → Discord (try/catch — Discord gagal TIDAK menggagalkan
 *      publish).
 *
 * AUTH: fail-closed — Bearer/x-cron-secret vs CRON_SECRET atau
 * PINE_ALERT_CRON_SECRET; dev tanpa secret terdaftar diizinkan
 * (pola growth-sentinel).
 *
 * OTAK MURNI di @/lib/seo-factory (dites langsung dari kode asli via
 * scripts/test-seo-factory.mjs).
 * ═══════════════════════════════════════════════════════════════════════
 */

export const dynamic = 'force-dynamic'

const RUN_VERSION = 'seo-factory@1-farhan'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'
const STATE_KEY = 'seo-factory:state'
const MAX_HARIAN_WIB = 3
const PUBLISH_COOLDOWN_MS = 14 * 60_000

/* ── Lock in-memory anti dobel-jalan (pola route cron lain) ──────────── */
let running = false

function clip(s: unknown, n: number): string {
  const t = String(s ?? '')
  return t.length <= n ? t : t.slice(0, n) + '…'
}

/* ── AUTH fail-closed (pola growth-sentinel + Bearer/x-cron-secret) ──── */
function isAuthorized(request: NextRequest): boolean {
  const provided = String(
    request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.headers.get('x-cron-secret') ||
      ''
  ).trim()
  const validSecrets = [
    String(process.env.CRON_SECRET || '').trim(),
    String(process.env.PINE_ALERT_CRON_SECRET || '').trim(),
  ].filter(Boolean)
  // Dev & tanpa secret terdaftar → izinkan; selain itu HARUS cocok.
  if (!validSecrets.length) return process.env.NODE_ENV !== 'production'
  return !!provided && validSecrets.includes(provided)
}

/* ── WIB helpers (Intl Asia/Jakarta — format yyyymmdd untuk daySeed) ─── */
function wibStamp(d = new Date()): { ymd: string; todayIso: string; hour: number; weekday: string } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hour12: false, hourCycle: 'h23', weekday: 'short',
  })
  const get = (t: string) => fmt.formatToParts(d).find((p) => p.type === t)?.value || ''
  const y = get('year'), mo = get('month'), da = get('day')
  return {
    ymd: `${y}${mo}${da}`,
    todayIso: `${y}-${mo}-${da}`,
    hour: Number(get('hour')) || 0,
    weekday: get('weekday'),
  }
}

/** Forex/CFD tutup akhir pekan — perkiraan kasar (Sabtu pagi masih jalan). */
function pasarBuka(weekday: string, hour: number): boolean {
  if (weekday === 'Sat') return hour < 5
  if (weekday === 'Sun') return false
  return true
}

function sesiWib(hour: number): string {
  if (hour >= 4 && hour < 13) return 'Sydney–Tokyo'
  if (hour >= 13 && hour < 19) return 'London'
  return 'New York'
}

/* ── KV kecil (agent_kv — pola growth-sentinel) ──────────────────────── */
async function kvGet(admin: SupabaseClient, key: string): Promise<string | null> {
  try {
    const { data } = await admin.from('agent_kv').select('value').eq('key', key).maybeSingle()
    return (data as { value?: string } | null)?.value ?? null
  } catch { return null }
}
async function kvSet(admin: SupabaseClient, key: string, value: string): Promise<void> {
  try { await admin.from('agent_kv').upsert({ key, value }, { onConflict: 'key' }) } catch { /* non-kritis */ }
}

interface SeoFactoryState {
  lastRunAt?: string
  lastPublishAt?: string
  publishedToday?: number
  todayWib?: string
}

/* ── DATA RIIL (try/catch per sumber — gagal → null, JANGAN mengarang) ── */

/** Harga: self-fetch /api/candles — bar terakhir = bar berjalan → dibuang
 *  (pola vip-signals); lastPrice = close bar kedua-terakhir. */
async function fetchHarga(symbol: string): Promise<{ lastPrice: number | null; priceChangePct: number | null }> {
  try {
    const url =
      `${SITE_URL}/api/candles?symbol=${encodeURIComponent(symbol)}` +
      `&interval=15m&limit=80`
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return { lastPrice: null, priceChangePct: null }
    const json = await res.json()
    const bars = Array.isArray(json?.data) ? json.data : []
    if (bars.length < 2) return { lastPrice: null, priceChangePct: null }
    const tertutup = bars.slice(0, -1)
    const closes: number[] = []
    for (const b of tertutup) {
      const c = Number((b as { close?: unknown })?.close)
      if (Number.isFinite(c) && c > 0) closes.push(c)
    }
    if (!closes.length) return { lastPrice: null, priceChangePct: null }
    const lastPrice = closes[closes.length - 1]
    const first = closes[0]
    const pct = first > 0 ? ((lastPrice - first) / first) * 100 : null
    return {
      lastPrice,
      priceChangePct: pct !== null && Number.isFinite(pct) ? pct : null,
    }
  } catch {
    return { lastPrice: null, priceChangePct: null }
  }
}

/** Hitung baris (head:true) — gagal → 0 (social proof dilewati, bukan dikarang). */
async function hitungBaris(admin: SupabaseClient, table: string, gte?: { col: string; iso: string }): Promise<number> {
  try {
    let q = admin.from(table).select('id', { count: 'exact', head: true })
    if (gte) q = q.gte(gte.col, gte.iso)
    const { count, error } = await q
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

/** Kalender ekonomi — tabel mungkin tidak ada (42P01/does-not-exist) → []. */
async function fetchEventEkonomi(
  admin: SupabaseClient,
  todayIso: string,
): Promise<SeoPageData['economicEvents']> {
  try {
    const { data, error } = await admin
      .from('economic_events')
      .select('time,country,title,impact')
      .gte('time', todayIso)
      .limit(5)
    if (error) {
      const code = (error as { code?: string }).code || ''
      const msg = String((error as { message?: string }).message || '')
      if (code === '42P01' || /does not exist/i.test(msg) || isMissingTableError(error)) return []
      return []
    }
    const rows = (data as Array<{ time?: string; country?: string; title?: string; impact?: string }> | null) || []
    return rows
      .filter((r) => r && (r.title || r.country))
      .map((r) => ({
        time: String(r.time || ''),
        country: String(r.country || ''),
        title: String(r.title || ''),
        impact: String(r.impact || ''),
      }))
  } catch {
    return []
  }
}

/** Fallback migrasi 040: meta SEO disimpan agent_kv 'blog_seo:<id>' —
 *  dibaca API blog publik sebagai fallback (pola master-autonomous). */
async function simpanSeoKv(admin: SupabaseClient, plan: SeoPagePlan): Promise<void> {
  try {
    const { data } = await admin
      .from('blog_posts')
      .select('id')
      .eq('title', plan.title)
      .order('created_at', { ascending: false })
      .limit(1)
    const id = (data as Array<{ id?: string }> | null)?.[0]?.id
    if (!id) return
    await kvSet(
      admin,
      `blog_seo:${id}`,
      JSON.stringify({ slug: plan.slug, meta_description: plan.metaDescription, keyword: plan.keyword }),
    )
  } catch { /* non-kritis */ }
}

/* ── HANDLER ─────────────────────────────────────────────────────────── */
async function handle(): Promise<NextResponse> {
  const startedAt = Date.now()

  const admin = await getCronAdmin()
  if (!admin) {
    return NextResponse.json(
      { ok: false, action: 'skipped', error: 'Database unavailable (Supabase admin client gagal dibuat)' },
      { status: 503 },
    )
  }

  /* ── State (agent_kv 'seo-factory:state') + reset counter ganti hari WIB ── */
  const wib = wibStamp()
  let state: SeoFactoryState = {}
  try { state = JSON.parse((await kvGet(admin, STATE_KEY)) || '{}') as SeoFactoryState } catch { state = {} }
  if (state.todayWib !== wib.ymd) {
    state = { ...state, todayWib: wib.ymd, publishedToday: 0 }
  }
  state.lastRunAt = new Date().toISOString()
  await kvSet(admin, STATE_KEY, JSON.stringify(state))

  const obs = { publishedToday: state.publishedToday || 0, maxPerDay: MAX_HARIAN_WIB, todayWib: wib.ymd }

  /* ── Cap harian: MAKS 3 halaman/hari WIB ── */
  if ((state.publishedToday || 0) >= MAX_HARIAN_WIB) {
    return NextResponse.json({
      ok: true, action: 'daily-cap', ...obs,
      note: `kuota ${MAX_HARIAN_WIB} halaman/hari WIB tercapai — lanjut besok (throttle numpang slot 15-menit)`,
    })
  }

  /* ── Cooldown antar-isolate: jangan publish < 14 menit sejak terakhir ── */
  const lastPublishMs = state.lastPublishAt ? Date.parse(state.lastPublishAt) : NaN
  if (Number.isFinite(lastPublishMs) && Date.now() - lastPublishMs < PUBLISH_COOLDOWN_MS) {
    return NextResponse.json({
      ok: true, action: 'cooldown', ...obs,
      note: 'halaman terbaru diterbitkan < 14 menit lalu — cooldown aktif (anti dobel-publish antar isolate)',
    })
  }

  /* ── 1. existingSlugs (slug bisa null → filter string kosong) ── */
  let existingSlugs: string[] = []
  try {
    const { data, error } = await admin.from('blog_posts').select('slug').limit(1000)
    if (error) throw error
    existingSlugs = ((data as Array<{ slug?: string | null }> | null) || [])
      .map((r) => String(r?.slug || '').trim())
      .filter((s) => s.length > 0)
  } catch (err) {
    if (isMissingTableError(err)) {
      return NextResponse.json({
        ok: false, action: 'skipped', ...obs,
        error: 'tabel blog_posts belum ada — jalankan supabase-migrations/015_create_ai_pending_actions.sql',
      })
    }
    // Tidak bisa baca slug → rawan terbit dobel; lebih jujur skip daripada nekat.
    return NextResponse.json({
      ok: false, action: 'skipped', ...obs,
      error: `gagal baca slug blog_posts: ${clip(err instanceof Error ? err.message : err, 200)}`,
    })
  }

  /* ── 2. Pilih halaman (deterministik dari daySeed = yyyymmdd WIB).
     pickSeoPages(…, 4, …) = superset: elemen pertama PERSIS hasil
     pickSeoPages(…, 1, daySeed) (urutan scan deterministik) — 3 sisanya
     jadi tautan internal "Baca juga". Maks 1 halaman per run tetap. ── */
  const daySeed = Number(wib.ymd)
  const plans = pickSeoPages(existingSlugs, 4, daySeed)
  if (!plans.length) {
    return NextResponse.json({
      ok: true, action: 'skipped', ...obs,
      note: 'semua 30 kombinasi symbol×intent sudah terbit — matriks penuh (evaluasi konten lama dulu)',
    })
  }
  const target = plans[0]

  /* ── 3. DATA RIIL (paralel; tiap sumber gagal → null/[], bukan mengarang) ── */
  const [harga, memberCount, economicEvents] = await Promise.all([
    fetchHarga(target.symbol),
    hitungBaris(admin, 'profiles'),
    fetchEventEkonomi(admin, wib.todayIso),
  ])

  const pageData: SeoPageData = {
    lastPrice: harga.lastPrice,
    priceChangePct: harga.priceChangePct,
    marketOpen: pasarBuka(wib.weekday, wib.hour),
    sessionWib: sesiWib(wib.hour),
    todayIso: wib.todayIso,
    economicEvents,
    memberCount,
  }

  /* ── 4. Susun HTML + insert resilient (kolom inti = content_body, migrasi 015;
     slug/keyword/meta_description = migrasi 040, bisa belum dijalankan) ── */
  const content = `${buildSeoPageHtml(target, pageData)}\n${seoInternalLinks(plans.slice(1))}`.trim()
  const baseRow = {
    title: target.title,
    content_body: content,
    author: 'Farhan (SEO Factory)',
    status: 'published',
    created_at: new Date().toISOString(),
  }
  const seoRow = {
    ...baseRow,
    slug: target.slug,
    keyword: target.keyword,
    meta_description: target.metaDescription,
  }

  let fallbackUsed = false
  const first = await admin.from('blog_posts').insert(seoRow)
  if (first.error && isMissingColumnError(first.error)) {
    // Migrasi 040 belum jalan → fallback kolom inti + meta ke agent_kv.
    fallbackUsed = true
    const second = await admin.from('blog_posts').insert(baseRow)
    if (second.error) {
      return NextResponse.json({
        ok: false, action: 'skipped', slug: target.slug, title: target.title, ...obs,
        error: `insert blog_posts (fallback kolom inti) gagal: ${clip(second.error.message, 200)}`,
      })
    }
    await simpanSeoKv(admin, target)
  } else if (first.error) {
    return NextResponse.json({
      ok: false, action: 'skipped', slug: target.slug, title: target.title, ...obs,
      error: `insert blog_posts gagal: ${clip(first.error.message, 200)}`,
    })
  }

  /* ── 5. State publish + Discord (gagal Discord TIDAK boleh gagalkan publish) ── */
  const nowIso = new Date().toISOString()
  const publishedToday = (state.publishedToday || 0) + 1
  await kvSet(admin, STATE_KEY, JSON.stringify({
    lastRunAt: nowIso,
    lastPublishAt: nowIso,
    publishedToday,
    todayWib: wib.ymd,
  }))

  let discordOk: boolean | null = null
  try {
    const res = await sendDiscordNotification(
      `🏭 Farhan (SEO Factory) terbitkan: ${target.title} → /blog/${target.slug}`,
    )
    discordOk = res.ok
  } catch { discordOk = null /* publish tetap sah */ }

  return NextResponse.json({
    ok: true,
    action: 'published',
    slug: target.slug,
    title: target.title,
    keyword: target.keyword,
    version: RUN_VERSION,
    fallbackUsed,
    publishedToday,
    maxPerDay: MAX_HARIAN_WIB,
    todayWib: wib.ymd,
    dataQuality: {
      harga: harga.lastPrice !== null,
      eventEkonomi: economicEvents.length,
      member: memberCount,
    },
    discordOk,
    durationMs: Date.now() - startedAt,
    hint: fallbackUsed
      ? 'kolom SEO (slug/keyword/meta_description) belum ada — jalankan supabase-migrations/040_blog_seo.sql; meta disimpan sementara di agent_kv'
      : undefined,
  })
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (running) {
    return NextResponse.json({
      ok: true, action: 'skipped',
      note: 'run sebelumnya masih jalan (lock in-memory anti dobel)',
    })
  }
  running = true
  try {
    return await handle()
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[seo-factory] Fatal:', clip(msg, 400))
    return NextResponse.json({ ok: false, action: 'skipped', error: clip(msg, 400) }, { status: 500 })
  } finally {
    running = false
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
