/**
 * src-track.ts — ATRIBUSI SUMBER KUNJUNGAN & PENDAFTAR (data untuk Loop Belajar).
 *
 * Data mentah: KV agent_kv `src:day:<tanggal-WIB>` berisi JSON
 *   { v: { <sumber>: jumlahKunjungan }, s: { <sumber>: jumlahPendaftar } }
 * Diagregasi & pemakaian: lib/ceo-loop.ts (loadDayAggs/summarizeSources) →
 * dipakai rapat mingguan (debat memakai fakta sumber trafik) dan metrik
 * taruhan (metric "signups:tiktok" / "visits:ig").
 *
 * Sumber di-resolve di CLIENT (landing page): utm_source → ?src= → ?ref= →
 * hostname referrer → 'direct'. Server cuma mencatat + pasang cookie:
 *   lux_src     = sumber terakhir (30 hari) → dibaca saat pendaftaran
 *   lux_src_day = tanda kunjungan sudah dihitung hari ini (dedup pageview)
 *   lux_src_used= tanda pendaftar sudah dihitung (anti dobel)
 *
 * TANPA dependensi berat — semua KV lewat REST Supabase (pola sama dengan
 * /api/discord-interactions), aman dipakai route Next.js mana pun.
 */

/* ---------- env helpers (process.env → fallback binding CF Workers) ---------- */
function envGet(name: string): string {
  const v = (process.env[name] || '').trim()
  if (v) return v
  try {
    const sym = Symbol.for('__cloudflare-context__')
    const ctx = (globalThis as Record<symbol, unknown>)[sym] as { env?: Record<string, string> } | undefined
    return (ctx?.env?.[name] || '').trim()
  } catch { return '' }
}
function sbUrl() { return (envGet('SUPABASE_URL') || envGet('NEXT_PUBLIC_SUPABASE_URL') || '').replace(/\/$/, '') }
/* agent_kv terkunci client sejak migrasi 027 — tulis wajib service_role. */
function sbKey() { return envGet('SUPABASE_SERVICE_ROLE_KEY') || envGet('NEXT_PUBLIC_SUPABASE_ANON_KEY') }
function sbH(): Record<string, string> {
  const k = sbKey()
  return { apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' }
}
async function kvGetRaw(key: string): Promise<string | null> {
  const url = sbUrl(); if (!url || !sbKey()) return null
  try {
    const res = await fetch(`${url}/rest/v1/agent_kv?select=value&key=eq.${encodeURIComponent(key)}`, { headers: sbH(), signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const rows = (await res.json()) as { value?: string }[]
    return rows[0]?.value ?? null
  } catch { return null }
}
async function kvSetRaw(key: string, value: string): Promise<void> {
  const url = sbUrl(); if (!url || !sbKey()) return
  try {
    await fetch(`${url}/rest/v1/agent_kv?on_conflict=key`, {
      method: 'POST', headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ key, value }), signal: AbortSignal.timeout(8000),
    })
  } catch { /* non-kritis */ }
}

/* ---------- nama cookie & util ---------- */
export const SRC_COOKIE = 'lux_src'
export const SRC_DAY_COOKIE = 'lux_src_day'
export const SRC_USED_COOKIE = 'lux_src_used'

/** Tanggal WIB (YYYY-MM-DD) — kunci agregat harian. */
export function wibDayStr(now: number = Date.now()): string {
  return new Date(now + 7 * 3600_000).toISOString().slice(0, 10)
}

/** Sumber dibersihkan: lowercase, [a-z0-9_-], maks 32 char, default 'direct'. */
export function sanitizeSrc(raw: unknown): string {
  const s = String(raw ?? '').toLowerCase().trim().slice(0, 64)
  const clean = s.replace(/[^a-z0-9_-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').slice(0, 32)
  return clean || 'direct'
}

export interface DayAggJson { v: Record<string, number>; s: Record<string, number> }

/** Naikkan penghitung satu sumber untuk hari WIB ini (read-modify-write KV). */
export async function trackEvent(srcRaw: string, kind: 'visit' | 'signup'): Promise<boolean> {
  const src = sanitizeSrc(srcRaw)
  const key = `src:day:${wibDayStr()}`
  let agg: DayAggJson = { v: {}, s: {} }
  try {
    const raw = await kvGetRaw(key)
    if (raw) {
      const p = JSON.parse(raw) as Partial<DayAggJson> | null
      if (p) agg = { v: p.v || {}, s: p.s || {} }
    }
  } catch { /* mulai baru */ }
  const bag = kind === 'visit' ? agg.v : agg.s
  bag[src] = (bag[src] || 0) + 1
  try { await kvSetRaw(key, JSON.stringify(agg)); return true } catch { return false }
}

/**
 * Catat PENDAFTAR dari cookie request (dipanggil server-side di
 * /api/auth/register dan via GET /api/src-track?signup=1 untuk alur client).
 * Return { src, recorded, dup } — dup = sudah pernah dicatat (cookie used).
 */
export async function trackSignupFromCookies(
  cookies: { get?: (name: string) => { value?: string } | undefined },
  fallbackSrc = '',
): Promise<{ src: string; recorded: boolean; dup: boolean }> {
  const used = cookies.get?.(SRC_USED_COOKIE)?.value
  if (used === '1') return { src: '', recorded: false, dup: true }
  const src = sanitizeSrc(cookies.get?.(SRC_COOKIE)?.value || fallbackSrc)
  const recorded = await trackEvent(src, 'signup')
  return { src, recorded, dup: false }
}

/** Cookie attributes standar — sameSite lax, bukan httpOnly? lux_src perlu
    dibaca server saja → httpOnly aman; lux_src_day & used juga server-only. */
export const SRC_COOKIE_OPTS = { maxAge: 30 * 86400, path: '/', sameSite: 'lax' as const, httpOnly: false }
export const SRC_DAY_COOKIE_OPTS = { maxAge: 86400, path: '/', sameSite: 'lax' as const, httpOnly: false }
export const SRC_USED_COOKIE_OPTS = { maxAge: 30 * 86400, path: '/', sameSite: 'lax' as const, httpOnly: false }
