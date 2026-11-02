/**
 * 🎬 TikTok Content Posting API — client untuk bot video Luxtradee
 *
 * Referensi (dokumen resmi, diverifikasi):
 *   - Init upload : POST https://open.tiktokapis.com/v2/post/publish/video/init/
 *                   source_info: { source: "FILE_UPLOAD", video_size, chunk_size, total_chunk_count }
 *   - Upload chunk: PUT {upload_url} — header Content-Range: bytes {awal}-{akhir}/{total}
 *                   (upload_url dikembalikan init, host open-upload.tiktokapis.com)
 *   - Status      : POST https://open.tiktokapis.com/v2/post/publish/status/fetch/
 *                   body { publish_id } → data.status: PROCESSING | PUBLISH_COMPLETE | PUBLISH_FAILED
 *   - Refresh     : POST https://open.tiktokapis.com/v2/oauth/token/
 *                   x-www-form-urlencoded: client_key, client_secret,
 *                   grant_type=refresh_token, refresh_token
 *
 * SANDBOX (app belum lolos audit):
 *   - privacy_level WAJIB "SELF_ONLY" (postingan privat, hanya terlihat akun sendiri)
 *   - PULL_FROM_URL butuh domain ter-audit → kita selalu pakai FILE_UPLOAD
 *
 * KEAMANAN SECRET (zero-knowledge):
 *   - TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / TIKTOK_REFRESH_TOKEN /
 *     TIKTOK_ACCESS_TOKEN hidup di env Cloudflare (dipasang Bos sendiri).
 *   - TikTok bisa MEROTASI refresh_token saat refresh. Token baru TIDAK boleh
 *     disimpan polos di agent_kv (tabel itu bisa dibaca anon key) → disimpan
 *     TERENKRIPSI AES-GCM dengan kunci turunan CRON_SECRET. Kalau enkripsi
 *     tidak tersedia, token lama tetap dipakai + caller diberi tahu.
 *
 * KEPATUHAN POLICY OAUTH BARU TIKTOK (efektif 1 Des 2026):
 *   - Access token 2 jam / refresh token 180 hari, refresh token BEROTASI
 *     (yang lama langsung mati begitu refresh sukses).
 *   → access token di-CACHE terenkripsi sampai mendekati kedaluwarsa, jadi
 *     refresh (dan rotasi) cuma terjadi ~1× per hari, bukan tiap panggilan.
 *   → refresh_token hasil rotasi WAJIB langsung disimpan (kvSetEncrypted).
 *   → kalau refresh dengan token KV gagal, dicoba 1× lagi dengan
 *     TIKTOK_REFRESH_TOKEN statis di env (jalan pudar aman).
 *   → re-auth manual (≤180 hari sekali) lewat /api/tiktok/connect → callback.
 */

import { getEnvVar } from '@/lib/cloudflare-bindings'
import { getCronAdmin } from '@/lib/cron-supabase'

const TIKTOK_API = 'https://open.tiktokapis.com'

/* ═══════════════════════ helpers dasar ═══════════════════════ */

function clip(s: unknown, n: number): string {
  const t = String(s ?? '')
  return t.length <= n ? t : t.slice(0, n) + '…'
}

/** Env resolver — pola master route: CF binding → process.env. */
async function tiktokEnv(name: string): Promise<string> {
  try {
    const v = await getEnvVar(name, { quiet: true })
    return (v || process.env[name] || '').trim()
  } catch {
    return (process.env[name] || '').trim()
  }
}

/* ═══════════════ KV terenkripsi (refresh token hasil rotasi) ═══════════════ */

const KV_KEY = 'tiktok:refresh_token'
const KV_ACCESS_KEY = 'tiktok:access_cache'
const KV_SALT = 'luxtradee-tiktok-v1'

/** Cache access token terenkripsi — hindari refresh (rotasi) tiap panggilan. */
interface TiktokAccessCache {
  accessToken: string
  expiresAt: number // epoch ms
}

async function kvGetAccessCache(): Promise<TiktokAccessCache | null> {
  try {
    const raw = await kvGetEncrypted(KV_ACCESS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TiktokAccessCache
    if (!parsed?.accessToken || typeof parsed.expiresAt !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

async function kvSetAccessCache(accessToken: string, expiresInSec: number): Promise<boolean> {
  try {
    // Simpan dengan margin 5 menit — jangan sampai token nyaris mati terpakai
    const ttlMs = Math.max(60, (Number(expiresInSec) || 7200) - 300) * 1000
    const payload: TiktokAccessCache = { accessToken, expiresAt: Date.now() + ttlMs }
    return await kvSetEncrypted(KV_ACCESS_KEY, JSON.stringify(payload))
  } catch {
    return false
  }
}

export async function invalidateTiktokAccessCache(): Promise<void> {
  try {
    const admin = await getCronAdmin()
    if (admin) await admin.from('agent_kv').delete().eq('key', KV_ACCESS_KEY)
  } catch {
    // diam — cache gagal dihapus pun retry 401 tetap aman
  }
}

async function aesKey(): Promise<CryptoKey | null> {
  try {
    const secret = await tiktokEnv('CRON_SECRET')
    if (!secret || typeof crypto === 'undefined' || !crypto.subtle) return null
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret + KV_SALT))
    return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  } catch {
    return null
  }
}

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

/** Decode base64 → Uint8Array dengan buffer ArrayBuffer persis (aman untuk WebCrypto). */
function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  const buf = new ArrayBuffer(bin.length)
  const arr = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

async function kvSetEncrypted(key: string, value: string): Promise<boolean> {
  try {
    const aes = await aesKey()
    if (!aes) return false
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(value))
    const admin = await getCronAdmin()
    if (!admin) return false
    await admin.from('agent_kv').upsert({ key, value: `${toB64(iv)}:${toB64(ct)}` }, { onConflict: 'key' })
    return true
  } catch {
    return false
  }
}

async function kvGetEncrypted(key: string): Promise<string | null> {
  try {
    const aes = await aesKey()
    if (!aes) return null
    const admin = await getCronAdmin()
    if (!admin) return null
    const { data } = await admin.from('agent_kv').select('value').eq('key', key).maybeSingle()
    const raw = (data as { value?: string } | null)?.value
    if (!raw || !raw.includes(':')) return null
    const [ivB64, ctB64] = raw.split(':')
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(ivB64) }, aes, fromB64(ctB64))
    return new TextDecoder().decode(pt)
  } catch {
    return null
  }
}

/* ═══════════════════════ token ═══════════════════════ */

export interface TiktokTokenInfo {
  accessToken: string
  expiresIn?: number
  /** true = TikTok mengeluarkan refresh_token baru & sudah disimpan terenkripsi */
  rotated: boolean
  source: 'cache' | 'refresh_token' | 'static_access_token'
}

/**
 * Refresh 1× ke TikTok. Return hasil mentah (ok = HTTP ok + access_token ada).
 * Dipakai ulang untuk percobaan fallback refresh token statis.
 */
async function refreshTiktokToken(
  clientKey: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ ok: boolean; accessToken?: string; refreshToken?: string; expiresIn?: number; error?: string }> {
  try {
    const body = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
    const res = await fetch(`${TIKTOK_API}/v2/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
      body,
      signal: AbortSignal.timeout(30_000),
    })
    const json = (await res.json().catch(() => null)) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
      error?: string
      error_description?: string
    } | null
    if (res.ok && json?.access_token) {
      return { ok: true, accessToken: json.access_token, refreshToken: json.refresh_token, expiresIn: json.expires_in }
    }
    return { ok: false, error: json?.error_description || json?.error || `HTTP ${res.status}` }
  } catch (e: unknown) {
    return { ok: false, error: clip(e instanceof Error ? e.message : e, 160) }
  }
}

export interface TiktokTokenResult {
  ok: boolean
  token?: TiktokTokenInfo
  error?: string
  /** refresh_token baru diterima tapi gagal disimpan KV — perlu dipasang ulang manual */
  warning?: string
}

/**
 * Ambil access token TikTok yang fresh (patuh policy rotasi Des 2026):
 *  1) cache terenkripsi kalau masih berlaku (> 5 menit) — TIDAK refresh
 *  2) refresh via TIKTOK_CLIENT_KEY/SECRET + refresh token (KV terenkripsi → env)
 *     → refresh_token hasil rotasi langsung disimpan; cache access diperbarui
 *  3) kalau refresh dengan token KV gagal → 1× coba lagi dengan
 *     TIKTOK_REFRESH_TOKEN statis dari env (kalau berbeda)
 *  4) fallback terakhir: TIKTOK_ACCESS_TOKEN statis (bisa kedaluwarsa)
 */
export async function getTiktokAccessToken(): Promise<TiktokTokenResult> {
  const clientKey = await tiktokEnv('TIKTOK_CLIENT_KEY')
  const clientSecret = await tiktokEnv('TIKTOK_CLIENT_SECRET')

  // ── 1. Cache access token masih segar? Jangan refresh — rotasi itu mahal ──
  const cached = await kvGetAccessCache()
  if (cached && cached.expiresAt - Date.now() > 300_000) {
    return {
      ok: true,
      token: {
        accessToken: cached.accessToken,
        expiresIn: Math.floor((cached.expiresAt - Date.now()) / 1000),
        rotated: false,
        source: 'cache',
      },
    }
  }

  const kvRefresh = await kvGetEncrypted(KV_KEY)
  const envRefresh = await tiktokEnv('TIKTOK_REFRESH_TOKEN')

  if (clientKey && clientSecret) {
    // ── 2. Refresh dengan refresh token terbaru (KV) ──
    if (kvRefresh) {
      const r = await refreshTiktokToken(clientKey, clientSecret, kvRefresh)
      if (r.ok && r.accessToken) {
        let rotated = false
        let warning: string | undefined
        if (r.refreshToken && r.refreshToken !== kvRefresh) {
          rotated = await kvSetEncrypted(KV_KEY, r.refreshToken)
          if (!rotated) {
            warning =
              'TikTok merotasi refresh_token tapi penyimpanan terenkripsi tidak tersedia — ' +
              'pasang ulang TIKTOK_REFRESH_TOKEN terbaru di Cloudflare agar refresh berikutnya tidak gagal.'
          }
        }
        await kvSetAccessCache(r.accessToken, r.expiresIn || 7200)
        return {
          ok: true,
          token: { accessToken: r.accessToken, expiresIn: r.expiresIn, rotated, source: 'refresh_token' },
          warning,
        }
      }
      console.error(`[tiktok] refresh (KV) gagal: ${clip(r.error, 200)}`)

      // ── 3. Fallback 1×: refresh token statis di env (kalau masih beda) ──
      if (envRefresh && envRefresh !== kvRefresh) {
        console.error('[tiktok] coba fallback refresh token statis env...')
        const r2 = await refreshTiktokToken(clientKey, clientSecret, envRefresh)
        if (r2.ok && r2.accessToken) {
          const rotated = await kvSetEncrypted(KV_KEY, r2.refreshToken || envRefresh)
          await kvSetAccessCache(r2.accessToken, r2.expiresIn || 7200)
          return {
            ok: true,
            token: { accessToken: r2.accessToken, expiresIn: r2.expiresIn, rotated, source: 'refresh_token' },
            warning: rotated
              ? undefined
              : 'Refresh token baru berhasil dipakai tapi tidak bisa disimpan terenkripsi — pasang ulang manual.',
          }
        }
        console.error(`[tiktok] fallback env juga gagal: ${clip(r2.error, 200)}`)
      }
    } else if (envRefresh) {
      // KV kosong (belum pernah sukses) — langsung pakai token statis env
      const r = await refreshTiktokToken(clientKey, clientSecret, envRefresh)
      if (r.ok && r.accessToken) {
        if (r.refreshToken) await kvSetEncrypted(KV_KEY, r.refreshToken)
        await kvSetAccessCache(r.accessToken, r.expiresIn || 7200)
        return {
          ok: true,
          token: { accessToken: r.accessToken, expiresIn: r.expiresIn, rotated: Boolean(r.refreshToken), source: 'refresh_token' },
        }
      }
      console.error(`[tiktok] refresh (env) gagal: ${clip(r.error, 200)}`)
    }
  }

  const staticToken = await tiktokEnv('TIKTOK_ACCESS_TOKEN')
  if (staticToken) {
    return {
      ok: true,
      token: { accessToken: staticToken, rotated: false, source: 'static_access_token' },
      warning:
        'Memakai TIKTOK_ACCESS_TOKEN statis — access token TikTok cepat kedaluwarsa (24 jam, Des 2026 jadi 2 jam). ' +
        'Set TIKTOK_REFRESH_TOKEN + CLIENT_KEY/SECRET agar refresh otomatis, atau re-auth di /api/tiktok/connect.',
    }
  }

  return {
    ok: false,
    error:
      'Kredensial TikTok belum lengkap. Pasang di Cloudflare (wrangler secret put): ' +
      'TIKTOK_CLIENT_KEY + TIKTOK_CLIENT_SECRET + TIKTOK_REFRESH_TOKEN (cadangan: TIKTOK_ACCESS_TOKEN). ' +
      'Ambil nilainya dari TikTok Developer Portal → Toolbox → Token Management (sandbox).',
  }
}

/* ═══════════════════════ init + upload + status ═══════════════════════ */

export interface TiktokInitOptions {
  accessToken: string
  videoSize: number
  chunkSize: number
  title: string
  /** sandbox wajib SELF_ONLY (privat) — produksi boleh PUBLIC_TO_EVERYONE */
  privacyLevel?: string
  draft?: boolean
  disableDuet?: boolean
  disableComment?: boolean
  disableStitch?: boolean
}

export interface TiktokInitResult {
  ok: boolean
  publishId?: string
  uploadUrl?: string
  error?: string
  httpStatus?: number
}

/** POST /v2/post/publish/video/init/ — FILE_UPLOAD. */
export async function initVideoUpload(opts: TiktokInitOptions): Promise<TiktokInitResult> {
  const totalChunkCount = Math.max(1, Math.ceil(opts.videoSize / opts.chunkSize))
  const postInfo: Record<string, unknown> = {
    title: opts.title.slice(0, 1800),
    privacy_level: opts.privacyLevel || 'SELF_ONLY',
  }
  if (opts.draft !== undefined) postInfo.draft = opts.draft
  if (opts.disableDuet !== undefined) postInfo.disable_duet = opts.disableDuet
  if (opts.disableComment !== undefined) postInfo.disable_comment = opts.disableComment
  if (opts.disableStitch !== undefined) postInfo.disable_stitch = opts.disableStitch

  try {
    const res = await fetch(`${TIKTOK_API}/v2/post/publish/video/init/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: postInfo,
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: opts.videoSize,
          chunk_size: opts.chunkSize,
          total_chunk_count: totalChunkCount,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    })
    const json = (await res.json().catch(() => null)) as {
      data?: { publish_id?: string; upload_url?: string }
      error?: { code?: string; message?: string }
    } | null
    const errCode = json?.error?.code
    const errMsg =
      errCode && errCode !== 'ok'
        ? `${errCode}: ${json?.error?.message || ''}`.trim()
        : res.ok
          ? ''
          : `HTTP ${res.status}`
    if (!res.ok || errMsg) return { ok: false, error: errMsg || 'init gagal', httpStatus: res.status }
    return {
      ok: true,
      publishId: json?.data?.publish_id,
      uploadUrl: json?.data?.upload_url,
      httpStatus: res.status,
    }
  } catch (e: unknown) {
    return { ok: false, error: clip(e instanceof Error ? e.message : e, 200) }
  }
}

/** PUT satu chunk ke upload_url TikTok. Semua chunk kecuali terakhir wajib = chunk_size. */
export async function uploadVideoChunk(opts: {
  uploadUrl: string
  chunk: Uint8Array
  start: number
  totalSize: number
}): Promise<{ ok: boolean; status: number; error?: string }> {
  const end = opts.start + opts.chunk.byteLength - 1
  try {
    const res = await fetch(opts.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes ${opts.start}-${end}/${opts.totalSize}`,
        'Content-Length': String(opts.chunk.byteLength),
      },
      body: opts.chunk as unknown as BodyInit,
      signal: AbortSignal.timeout(120_000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, status: res.status, error: clip(body || `HTTP ${res.status}`, 200) }
    }
    return { ok: true, status: res.status }
  } catch (e: unknown) {
    return { ok: false, status: 0, error: clip(e instanceof Error ? e.message : e, 200) }
  }
}

export interface TiktokStatusResult {
  ok: boolean
  /** PROCESSING | PUBLISH_COMPLETE | PUBLISH_FAILED | FAILED (defensif) */
  status?: string
  failReason?: string
  publishId?: string
  error?: string
  httpStatus?: number
}

/** POST /v2/post/publish/status/fetch/ — cek status publikasi. */
export async function fetchPublishStatus(accessToken: string, publishId: string): Promise<TiktokStatusResult> {
  try {
    const res = await fetch(`${TIKTOK_API}/v2/post/publish/status/fetch/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ publish_id: publishId }),
      signal: AbortSignal.timeout(30_000),
    })
    const json = (await res.json().catch(() => null)) as {
      data?: { status?: string; fail_reason?: string; publish_id?: string }
      error?: { code?: string; message?: string }
    } | null
    if (!res.ok) {
      return { ok: false, error: json?.error?.message || `HTTP ${res.status}`, httpStatus: res.status }
    }
    return {
      ok: true,
      status: json?.data?.status,
      failReason: json?.data?.fail_reason,
      publishId: json?.data?.publish_id || publishId,
      httpStatus: res.status,
    }
  } catch (e: unknown) {
    return { ok: false, error: clip(e instanceof Error ? e.message : e, 200) }
  }
}

export const TIKTOK_PRIVACY = {
  SELF_ONLY: 'SELF_ONLY',
  PUBLIC: 'PUBLIC_TO_EVERYONE',
  MUTUAL: 'MUTUAL_FOLLOW_FRIENDS',
} as const

/* ═══════════════ OAuth connect/callback (re-auth ≤180 hari) ═══════════════ */

/**
 * Tukar authorization code → token (GET /api/tiktok/callback).
 * grant_type=authorization_code — response berisi access_token + refresh_token baru.
 */
export async function exchangeTiktokAuthCode(
  code: string,
  redirectUri: string,
): Promise<{ ok: boolean; accessToken?: string; refreshToken?: string; expiresIn?: number; error?: string }> {
  const clientKey = await tiktokEnv('TIKTOK_CLIENT_KEY')
  const clientSecret = await tiktokEnv('TIKTOK_CLIENT_SECRET')
  if (!clientKey || !clientSecret) {
    return { ok: false, error: 'TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET belum dipasang di Cloudflare' }
  }
  try {
    const body = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    })
    const res = await fetch(`${TIKTOK_API}/v2/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
      body,
      signal: AbortSignal.timeout(30_000),
    })
    const json = (await res.json().catch(() => null)) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
      error?: string
      error_description?: string
    } | null
    if (res.ok && json?.access_token) {
      return { ok: true, accessToken: json.access_token, refreshToken: json.refresh_token, expiresIn: json.expires_in }
    }
    return { ok: false, error: json?.error_description || json?.error || `HTTP ${res.status}` }
  } catch (e: unknown) {
    return { ok: false, error: clip(e instanceof Error ? e.message : e, 200) }
  }
}

/** Simpan refresh token (hasil callback OAuth) ke KV terenkripsi + reset cache access. */
export async function saveTiktokOAuthTokens(accessToken: string, refreshToken: string, expiresIn?: number): Promise<boolean> {
  const savedRt = await kvSetEncrypted(KV_KEY, refreshToken)
  if (accessToken) await kvSetAccessCache(accessToken, expiresIn || 7200)
  return savedRt
}

/** State CSRF stateless: `expiry.hmac` — HMAC-SHA256(kunci CRON_SECRET). */
export async function createTiktokOAuthState(): Promise<string> {
  const secret = (await tiktokEnv('CRON_SECRET')) || 'dev-only-secret'
  const expiry = String(Date.now() + 10 * 60 * 1000)
  const sig = await hmacB64Url(`${expiry}.tiktok-connect`, secret)
  return `${expiry}.${sig}`
}

export async function verifyTiktokOAuthState(state: string | null): Promise<boolean> {
  if (!state || !state.includes('.')) return false
  const [expiry, sig] = state.split('.')
  if (!expiry || !sig) return false
  if (Number(expiry) < Date.now()) return false
  const secret = (await tiktokEnv('CRON_SECRET')) || 'dev-only-secret'
  const expect = await hmacB64Url(`${expiry}.tiktok-connect`, secret)
  return sig === expect
}

async function hmacB64Url(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return toB64(mac).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
