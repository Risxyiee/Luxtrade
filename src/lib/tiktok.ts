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
const KV_SALT = 'luxtradee-tiktok-v1'

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

function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0))
}

async function kvSetEncrypted(value: string): Promise<boolean> {
  try {
    const key = await aesKey()
    if (!key) return false
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value))
    const admin = await getCronAdmin()
    if (!admin) return false
    await admin.from('agent_kv').upsert({ key: KV_KEY, value: `${toB64(iv)}:${toB64(ct)}` }, { onConflict: 'key' })
    return true
  } catch {
    return false
  }
}

async function kvGetEncrypted(): Promise<string | null> {
  try {
    const key = await aesKey()
    if (!key) return null
    const admin = await getCronAdmin()
    if (!admin) return null
    const { data } = await admin.from('agent_kv').select('value').eq('key', KV_KEY).maybeSingle()
    const raw = (data as { value?: string } | null)?.value
    if (!raw || !raw.includes(':')) return null
    const [ivB64, ctB64] = raw.split(':')
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(ivB64) }, key, fromB64(ctB64))
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
  source: 'refresh_token' | 'static_access_token'
}

export interface TiktokTokenResult {
  ok: boolean
  token?: TiktokTokenInfo
  error?: string
  /** refresh_token baru diterima tapi gagal disimpan KV — perlu dipasang ulang manual */
  warning?: string
}

/**
 * Ambil access token TikTok yang fresh:
 *  1) refresh via TIKTOK_CLIENT_KEY/SECRET + refresh token (KV terenkripsi → env)
 *  2) fallback: TIKTOK_ACCESS_TOKEN statis (bisa kedaluwarsa ±24 jam)
 * Return null-friendly result — caller wajib tampilkan hint kalau gagal.
 */
export async function getTiktokAccessToken(): Promise<TiktokTokenResult> {
  const clientKey = await tiktokEnv('TIKTOK_CLIENT_KEY')
  const clientSecret = await tiktokEnv('TIKTOK_CLIENT_SECRET')
  const refreshToken = (await kvGetEncrypted()) || (await tiktokEnv('TIKTOK_REFRESH_TOKEN'))

  if (clientKey && clientSecret && refreshToken) {
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
        let rotated = false
        let warning: string | undefined
        if (json.refresh_token && json.refresh_token !== refreshToken) {
          rotated = await kvSetEncrypted(json.refresh_token)
          if (!rotated) {
            warning =
              'TikTok merotasi refresh_token tapi penyimpanan terenkripsi tidak tersedia — ' +
              'pasang ulang TIKTOK_REFRESH_TOKEN terbaru di Cloudflare agar refresh berikutnya tidak gagal.'
          }
        }
        return {
          ok: true,
          token: { accessToken: json.access_token, expiresIn: json.expires_in, rotated, source: 'refresh_token' },
          warning,
        }
      }
      const errTxt = json?.error_description || json?.error || `HTTP ${res.status}`
      console.error(`[tiktok] refresh gagal: ${clip(errTxt, 200)}`)
      // jatuh ke token statis kalau ada — jangan langsung gagal
    } catch (e: unknown) {
      console.error(`[tiktok] refresh error: ${clip(e instanceof Error ? e.message : e, 160)}`)
    }
  }

  const staticToken = await tiktokEnv('TIKTOK_ACCESS_TOKEN')
  if (staticToken) {
    return {
      ok: true,
      token: { accessToken: staticToken, source: 'static_access_token' },
      warning: refreshToken
        ? undefined
        : 'Memakai TIKTOK_ACCESS_TOKEN statis — access token TikTok kedaluwarsa ±24 jam; set TIKTOK_REFRESH_TOKEN + CLIENT_KEY/SECRET agar refresh otomatis.',
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
