/**
 * instagram.ts — Auto-post Instagram via Facebook Page Graph API v19.0
 * =====================================================================
 * Alur posting (persis spesifikasi):
 *   1) POST https://graph.facebook.com/v19.0/{FACEBOOK_PAGE_ID}/media
 *        ?image_url=<URL publik jpg/png>&caption=<teks>
 *      → { id: <creation_id> }  (container)
 *   2) Tunggu container status FINISHED (IG memproses beberapa detik)
 *   3) POST https://graph.facebook.com/v19.0/{FACEBOOK_PAGE_ID}/media_publish
 *        ?creation_id=<creation_id>
 *      → { id: <ig_post_id> }  → ambil permalink utk riwayat
 *
 * TOKEN 60 HARI:
 *   - Sumber token: DB (ig_token_state, hasil refresh runtime) DULU,
 *     fallback env FACEBOOK_PAGE_TOKEN (CF dashboard secrets / .env).
 *   - refreshPageToken(): fb_exchange_token pakai FACEBOOK_APP_ID +
 *     FACEBOOK_APP_SECRET → token baru ±60 hari → simpan ke DB.
 *   - ensureFreshToken(): kalau usia token > 55 hari (buffer sebelum
 *     expired 60 hari) → refresh otomatis. Dipanggil semua cron IG.
 *   - Token halaman hasil derive dari user-token panjang umumnya
 *     non-expiring; kolom expires_at tetap diisi (null = non-expiring).
 *
 * SYARAT IMAGE (ketat di sisi IG): URL PUBLIK https, file .jpg/.png,
 * maks 8MB. Caption maks 2.200 karakter.
 *
 * CF-safe: fetch saja, tanpa API Node, tanpa Prisma.
 * File ini WAJIB hanya diimpor dari server (API route).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const GRAPH_VERSION = 'v19.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

/** Usia maksimum token sebelum di-refresh (buffer 5 hari sebelum umur 60 hari). */
export const TOKEN_REFRESH_AFTER_MS = 55 * 24 * 60 * 60 * 1000
/** Umur token baru dari fb_exchange_token (±60 hari) — untuk info expires_at. */
const TOKEN_LIFETIME_MS = 60 * 24 * 60 * 60 * 1000
/** Batas caption Instagram. */
export const IG_CAPTION_MAX = 2200
/** Cap keamanan posting per 24 jam (batas API IG ±25 post/hari utk konten dibuat API). */
export const IG_DAILY_CAP = 25

/* ============================================================
   Tipe
   ============================================================ */

export interface IgConfig {
  pageId: string
  pageToken: string
  /** Epoch ms kapan token diterbitkan (null = tidak tercatat). */
  issuedAt: number | null
  /** Epoch ms kedaluwarsa (null = non-expiring). */
  expiresAt: number | null
  tokenSource: 'db' | 'env'
}

export interface IgPostResult {
  ok: boolean
  containerId?: string
  postId?: string
  permalink?: string
  error?: string
  /** Tahap gagal: 'config' | 'create' | 'status' | 'publish' | 'permalink' */
  stage?: string
}

export interface TokenRefreshResult {
  ok: boolean
  refreshed: boolean
  /** Token baru TIDAK dikembalikan ke caller (rahasia tetap di DB). */
  expiresAt?: number | null
  error?: string
}

/* ============================================================
   Env helper (CF binding → process.env fallback)
   ============================================================ */

function envOr(name: string): string {
  const v = process.env[name]
  return typeof v === 'string' ? v.trim() : ''
}

/* ============================================================
   State token — Supabase ig_token_state (singleton id=1)
   ============================================================ */

interface TokenStateRow {
  page_id: string | null
  page_token: string | null
  issued_at: string | null
  expires_at: string | null
}

export async function loadTokenState(
  admin: SupabaseClient
): Promise<{ pageToken: string; pageId: string; issuedAt: number | null; expiresAt: number | null } | null> {
  try {
    const { data, error } = await admin
      .from('ig_token_state')
      .select('page_id, page_token, issued_at, expires_at')
      .eq('id', 1)
      .maybeSingle<TokenStateRow>()
    if (error || !data?.page_token) return null
    return {
      pageToken: String(data.page_token),
      pageId: String(data.page_id || ''),
      issuedAt: data.issued_at ? new Date(data.issued_at).getTime() : null,
      expiresAt: data.expires_at ? new Date(data.expires_at).getTime() : null,
    }
  } catch {
    return null
  }
}

export async function saveTokenState(
  admin: SupabaseClient,
  opts: { pageToken: string; pageId?: string; issuedAt?: number; expiresAt?: number | null }
): Promise<void> {
  try {
    await admin
      .from('ig_token_state')
      .upsert(
        {
          id: 1,
          page_token: opts.pageToken,
          ...(opts.pageId ? { page_id: opts.pageId } : {}),
          ...(opts.issuedAt ? { issued_at: new Date(opts.issuedAt).toISOString() } : {}),
          ...(opts.expiresAt !== undefined
            ? { expires_at: opts.expiresAt ? new Date(opts.expiresAt).toISOString() : null }
            : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
  } catch (e) {
    // Non-fatal: refresh tetap sukses di memori isolate ini; isolate lain
    // masih pakai token lama sampai refresh berikutnya.
    console.error('[instagram] saveTokenState gagal:', e instanceof Error ? e.message : e)
  }
}

/* ============================================================
   Resolusi config — DB (token terbaru) dulu, env fallback
   ============================================================ */

export async function getIgConfig(admin?: SupabaseClient | null): Promise<IgConfig | null> {
  let pageId = envOr('FACEBOOK_PAGE_ID')
  let pageToken = envOr('FACEBOOK_PAGE_TOKEN')
  let issuedAt: number | null = null
  let expiresAt: number | null = null
  let source: 'db' | 'env' = 'env'

  const rawIssued = envOr('FACEBOOK_TOKEN_ISSUED_AT')
  if (rawIssued) {
    const t = Number(rawIssued) || Date.parse(rawIssued)
    if (Number.isFinite(t) && t > 0) issuedAt = t
  }

  if (admin) {
    const state = await loadTokenState(admin)
    if (state?.pageToken) {
      pageToken = state.pageToken
      if (state.pageId) pageId = state.pageId
      issuedAt = state.issuedAt ?? issuedAt
      expiresAt = state.expiresAt
      source = 'db'
    }
  }

  if (!pageId || !pageToken) return null
  return { pageId, pageToken, issuedAt, expiresAt, tokenSource: source }
}

/** Baseline: catat issued_at token env saat pemakaian pertama (kalau DB kosong). */
export async function ensureTokenBaseline(admin: SupabaseClient, cfg: IgConfig): Promise<void> {
  if (cfg.tokenSource !== 'env' || cfg.issuedAt) return
  await saveTokenState(admin, {
    pageToken: cfg.pageToken,
    pageId: cfg.pageId,
    issuedAt: Date.now(),
    expiresAt: null,
  })
  cfg.issuedAt = Date.now()
}

/* ============================================================
   Klien Graph — error ternormalisasi
   ============================================================ */

interface GraphError {
  message: string
  code?: number
  subcode?: number
  type?: string
}

function parseGraphError(body: any, httpStatus: number): string {
  const g: GraphError | undefined = body?.error
  if (!g) return `HTTP ${httpStatus}`
  let msg = String(g.message || 'Graph API error').slice(0, 220)
  if (g.code === 190) msg = `Token tidak valid/kedaluwarsa (code 190): ${msg}`
  return msg
}

async function graphCall(
  method: 'GET' | 'POST',
  path: string,
  params: Record<string, string>,
  token: string,
  timeoutMs = 20_000
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  const qs = new URLSearchParams({ ...params, access_token: token })
  const url = `${GRAPH_BASE}/${path}${method === 'GET' ? `?${qs}` : ''}`
  try {
    const res = await fetch(url, {
      method,
      ...(method === 'POST' ? { body: qs } : {}),
      headers: method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {},
      signal: AbortSignal.timeout(timeoutMs),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || data?.error) {
      return { ok: false, status: res.status, data, error: parseGraphError(data, res.status) }
    }
    return { ok: true, status: res.status, data }
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e instanceof Error ? e.message : String(e) }
  }
}

/* ============================================================
   1) Buat container — POST /{page-id}/media
   ============================================================ */

export async function createMediaContainer(
  cfg: IgConfig,
  opts: { imageUrl: string; caption?: string }
): Promise<{ ok: boolean; containerId?: string; error?: string }> {
  const params: Record<string, string> = { image_url: opts.imageUrl }
  if (opts.caption) params.caption = opts.caption
  const r = await graphCall('POST', `${cfg.pageId}/media`, params, cfg.pageToken, 30_000)
  if (!r.ok) return { ok: false, error: r.error }
  const id = String(r.data?.id || '')
  if (!id) return { ok: false, error: 'Graph API tidak balik container id' }
  return { ok: true, containerId: id }
}

/* ============================================================
   2) Status container — GET /{container-id}?fields=status_code
   ============================================================ */

export async function getContainerStatus(
  cfg: IgConfig,
  containerId: string
): Promise<{ statusCode: 'IN_PROGRESS' | 'FINISHED' | 'ERROR'; message?: string }> {
  const r = await graphCall('GET', containerId, { fields: 'status_code,status' }, cfg.pageToken)
  if (!r.ok) {
    // Gagal query status → anggap IN_PROGRESS biar caller retry/timeout sendiri
    return { statusCode: 'IN_PROGRESS', message: r.error }
  }
  const sc = String(r.data?.status_code || 'IN_PROGRESS')
  return {
    statusCode: sc === 'FINISHED' ? 'FINISHED' : sc === 'ERROR' ? 'ERROR' : 'IN_PROGRESS',
    message: r.data?.status ? String(r.data.status) : undefined,
  }
}

/* ============================================================
   3) Publish — POST /{page-id}/media_publish?creation_id=
   ============================================================ */

export async function publishContainer(
  cfg: IgConfig,
  containerId: string
): Promise<{ ok: boolean; postId?: string; error?: string }> {
  const r = await graphCall('POST', `${cfg.pageId}/media_publish`, { creation_id: containerId }, cfg.pageToken)
  if (!r.ok) return { ok: false, error: r.error }
  const id = String(r.data?.id || '')
  if (!id) return { ok: false, error: 'Graph API tidak balik post id' }
  return { ok: true, postId: id }
}

/** Ambil permalink post (riwayat antrean). */
export async function getPostPermalink(cfg: IgConfig, postId: string): Promise<string | undefined> {
  const r = await graphCall('GET', postId, { fields: 'permalink' }, cfg.pageToken)
  return r.ok && r.data?.permalink ? String(r.data.permalink) : undefined
}

/* ============================================================
   Orkestrasi lengkap: container → poll → publish → permalink
   ============================================================ */

export async function postToInstagram(
  cfg: IgConfig,
  opts: { imageUrl: string; caption?: string },
  poll?: { maxWaitMs?: number; intervalMs?: number }
): Promise<IgPostResult> {
  const maxWaitMs = poll?.maxWaitMs ?? 45_000
  const intervalMs = poll?.intervalMs ?? 3_000

  /* 1) Container */
  const created = await createMediaContainer(cfg, opts)
  if (!created.ok || !created.containerId) {
    return { ok: false, stage: 'create', error: created.error }
  }
  const containerId = created.containerId

  /* 2) Poll status (IG memproses gambar beberapa detik) */
  const deadline = Date.now() + maxWaitMs
  let lastMsg: string | undefined
  while (Date.now() < deadline) {
    const st = await getContainerStatus(cfg, containerId)
    lastMsg = st.message
    if (st.statusCode === 'ERROR') {
      return { ok: false, stage: 'status', containerId, error: st.message || 'IG menolak media (ERROR)' }
    }
    if (st.statusCode === 'FINISHED') break
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  // Kalau masih diproses sampai deadline → coba publish sekali; kalau
  // IG belum selesai, media_publish balik error jelas (jangan diam).
  const fin = await getContainerStatus(cfg, containerId)
  if (fin.statusCode === 'ERROR') {
    return { ok: false, stage: 'status', containerId, error: fin.message || 'IG menolak media (ERROR)' }
  }

  /* 3) Publish */
  const pub = await publishContainer(cfg, containerId)
  if (!pub.ok || !pub.postId) {
    return { ok: false, stage: 'publish', containerId, error: pub.error }
  }

  /* 4) Permalink (best-effort) */
  const permalink = await getPostPermalink(cfg, pub.postId)
  return { ok: true, containerId, postId: pub.postId, permalink }
}

/* ============================================================
   Refresh token 60 hari — fb_exchange_token
   ============================================================ */

/**
 * Tukar token sekarang → token baru ±60 hari (butuh FACEBOOK_APP_ID +
 * FACEBOOK_APP_SECRET). Kalau token hasil tukar adalah user-token,
 * derive ulang token halaman via GET /{page-id}?fields=access_token.
 * Token baru disimpan ke ig_token_state (DB) — env tidak bisa ditulis runtime.
 */
export async function refreshPageToken(
  admin: SupabaseClient | null,
  cfg: IgConfig
): Promise<TokenRefreshResult> {
  const appId = envOr('FACEBOOK_APP_ID')
  const appSecret = envOr('FACEBOOK_APP_SECRET')
  if (!appId || !appSecret) {
    return { ok: false, refreshed: false, error: 'FACEBOOK_APP_ID / FACEBOOK_APP_SECRET belum diset — refresh token tidak bisa jalan' }
  }

  /* 1) fb_exchange_token → token panjang baru */
  const ex = await graphCall(
    'GET',
    'oauth/access_token',
    {
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: cfg.pageToken,
    },
    cfg.pageToken,
    20_000
  )
  if (!ex.ok || !ex.data?.access_token) {
    return { ok: false, refreshed: false, error: `fb_exchange_token gagal: ${ex.error || 'tanpa access_token'}` }
  }
  const longLived = String(ex.data.access_token)
  const expiresInSec = Number(ex.data.expires_in || 0)
  const newExpiry = expiresInSec > 0 ? Date.now() + expiresInSec * 1000 : null

  /* 2) Derive token halaman (kalau step 1 balik user-token) */
  let finalToken = longLived
  let finalExpiry = newExpiry
  const derive = await graphCall('GET', cfg.pageId, { fields: 'access_token' }, longLived)
  if (derive.ok && derive.data?.access_token) {
    finalToken = String(derive.data.access_token)
    // Token halaman dari user-token panjang = non-expiring
    finalExpiry = null
  }
  // derive gagal → pakai token step 1 apa adanya (masih sah utk endpoint halaman
  // kalau token lama memang page-token; kalau tidak, posting berikutnya akan
  // beri error jelas code 190 dan admin dinotifikasi).

  /* 3) Simpan ke DB */
  const now = Date.now()
  if (admin) {
    await saveTokenState(admin, {
      pageToken: finalToken,
      pageId: cfg.pageId,
      issuedAt: now,
      expiresAt: finalExpiry,
    })
  }

  return { ok: true, refreshed: true, expiresAt: finalExpiry }
}

/**
 * Pastikan token segar sebelum posting: catat baseline usia (pemakaian
 * pertama), dan refresh otomatis kalau usia > 55 hari. Gagal refresh
 * TIDAK menggagalkan posting (token lama mungkin masih hidup) — error
 * dikembalikan agar cron memberi tahu admin.
 */
export async function ensureFreshToken(
  admin: SupabaseClient | null
): Promise<{ cfg: IgConfig | null; refreshed: boolean; refreshError?: string }> {
  const cfg = await getIgConfig(admin)
  if (!cfg) return { cfg: null, refreshed: false }

  if (admin) await ensureTokenBaseline(admin, cfg)

  const age = cfg.issuedAt ? Date.now() - cfg.issuedAt : 0
  const isOld = cfg.issuedAt ? age > TOKEN_REFRESH_AFTER_MS : false
  const isExpired = cfg.expiresAt ? Date.now() >= cfg.expiresAt : false

  if (isOld || isExpired) {
    const r = await refreshPageToken(admin, cfg)
    if (r.ok) {
      const fresh = await getIgConfig(admin)
      return { cfg: fresh || cfg, refreshed: true }
    }
    return { cfg, refreshed: false, refreshError: r.error }
  }
  return { cfg, refreshed: false }
}

/* ============================================================
   Util validasi input antrean
   ============================================================ */

export function validateIgPostInput(opts: { imageUrl: string; caption?: string }): string | null {
  let url: URL
  try {
    url = new URL(opts.imageUrl)
  } catch {
    return 'image_url bukan URL yang valid'
  }
  if (url.protocol !== 'https:') return 'image_url wajib https:// (syarat Instagram API)'
  const path = url.pathname.toLowerCase()
  if (!/\.(jpe?g|png)$/.test(path)) {
    return 'image_url harus menunjuk file .jpg/.jpeg/.png (syarat Instagram API)'
  }
  const cap = opts.caption || ''
  if (cap.length > IG_CAPTION_MAX) {
    return `caption ${cap.length} karakter — maksimal ${IG_CAPTION_MAX} (limit Instagram)`
  }
  return null
}
