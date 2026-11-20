/**
 * facebook-post.ts — Cross-post Facebook Page untuk antrean instagram_posts
 * =====================================================================
 * Keluhan Bos (19-11): "post IG cuma IG, FB ga sekalian gabungin" —
 * pipeline konten harian Sinta (video Remotion + carousel) tayang di IG
 * SAJA karena cron ig-auto-post / ig-video-post / ig-carousel-post dan
 * /api/instagram/post memanggil postToInstagram() langsung. Lib dual-post
 * metaAutoPostAll() hanya menjangkau jalur ceo-agent & execute-action.
 *
 * Lib ini MENGGABUNGKAN Facebook: setiap konten yang sukses tayang di IG
 * langsung di-cross-post ke feed Halaman Facebook pakai TOKEN HALAMAN
 * YANG SAMA (IgConfig.pageToken + IgConfig.pageId) — TIDAK ada kredensial
 * baru yang perlu diset Bos. Kalau IG-nya sukses, berarti Halaman + token
 * valid → jalur FB hampir pasti jalan juga.
 *
 * Pemetaan media (Graph API Page, versi v19.0 senada instagram.ts):
 *   IMAGE    → POST /{page-id}/photos {url, caption} → post_id (feed)
 *   REELS    → POST /{page-id}/videos {file_url, description} → video id
 *              (FB menunduh file server-side; id balik setelah selesai)
 *   CAROUSEL → per slide POST /{page-id}/photos {url, published=false}
 *              → POST /{page-id}/feed {message, attached_media[n][media_fbid]}
 *              (cara resmi multi-foto 1 post di Page API — max 10 slide)
 *
 * ATURAN JUJUR: hasil per-platform dilapor apa adanya — gagal FB TIDAK
 * menggagalkan baris IG (status antrean tetap 'published', TIDAK di-retry
 * → tidak ada risiko dobel post di IG). Hasil dicatat di meta.fb + lapor
 * Discord. TIDAK PERNAH mengarang "sukses".
 *
 * CF-safe: fetch saja, tanpa API Node, tanpa Prisma.
 * File ini WAJIB hanya diimpor dari server (API route).
 */

import type { IgConfig } from '@/lib/instagram'

const GRAPH_VERSION = 'v19.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

/** Batas pesan FB Page feed (limit API 8.000+; 5.000 lebih dari cukup). */
const FB_MESSAGE_MAX = 5000
/** Batas slide carousel FB (senada IG: 2–10). */
const FB_CAROUSEL_MAX = 10

export interface FbCrossPostResult {
  ok: boolean
  /** id post feed/video FB (page-id_post-id atau video id). */
  postId?: string
  /** URL post FB (best-effort — di-skip kalau Graph menolak). */
  permalink?: string
  error?: string
}

export interface FbCrossPostInput {
  mediaType?: 'IMAGE' | 'REELS' | 'CAROUSEL'
  imageUrl?: string
  videoUrl?: string
  imageUrls?: string[]
  caption?: string
}

/* ============================================================
   Klien Graph — pola sama dengan instagram.ts (error ternormalisasi)
   ============================================================ */

function parseGraphError(body: any, httpStatus: number): string {
  const g = body?.error
  if (!g) return `HTTP ${httpStatus}`
  let msg = String(g.message || 'Graph API error').slice(0, 220)
  const code = Number(g.code || 0)
  if (code === 190) msg = `Token tidak valid/kedaluwarsa (code 190): ${msg}`
  else if (code === 200 || code === 10) msg = `Izin Halaman kurang (code ${code}) — token perlu pages_manage_posts: ${msg}`
  else if (code === 4 || code === 17 || code === 32 || code === 613) msg = `Limit FB API tercapai (code ${code}): ${msg}`
  return msg
}

async function graphCall(
  method: 'GET' | 'POST',
  path: string,
  params: Record<string, string>,
  token: string,
  timeoutMs = 30_000
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

/** Permalink best-effort utk post feed / video / foto FB. */
async function fbPermalink(token: string, postId: string): Promise<string | undefined> {
  const r = await graphCall('GET', postId, { fields: 'permalink_url' }, token, 12_000)
  return r.ok && r.data?.permalink_url ? String(r.data.permalink_url) : undefined
}

/* ============================================================
   IMAGE — 1 foto + caption
   ============================================================ */

async function fbPostPhoto(cfg: IgConfig, imageUrl: string, caption: string): Promise<FbCrossPostResult> {
  const r = await graphCall('POST', `${cfg.pageId}/photos`, {
    url: imageUrl,
    caption: caption.slice(0, FB_MESSAGE_MAX),
  }, cfg.pageToken, 60_000)
  if (!r.ok) return { ok: false, error: `upload foto gagal: ${r.error}` }
  // Respons /photos: { id: "<photo-id>", post_id?: "<page-id>_<post-id>" }
  // post_id = entri FEED (yang muncul di halaman) → ini yang dipakai utk permalink.
  const postId = String(r.data?.post_id || r.data?.id || '')
  if (!postId) return { ok: false, error: 'Graph API tidak balik post id foto' }
  return { ok: true, postId, permalink: await fbPermalink(cfg.pageToken, postId) }
}

/* ============================================================
   REELS/video — POST /{page-id}/videos (file_url, server-side download)
   ============================================================ */

async function fbPostVideo(cfg: IgConfig, videoUrl: string, caption: string): Promise<FbCrossPostResult> {
  // file_url → FB mengunduh MP4 server-side; panggilan bisa puluhan detik
  // utk file besar → timeout longgar 180 detik (API balik id saat selesai).
  const r = await graphCall('POST', `${cfg.pageId}/videos`, {
    file_url: videoUrl,
    description: caption.slice(0, FB_MESSAGE_MAX),
  }, cfg.pageToken, 180_000)
  if (!r.ok) return { ok: false, error: `upload video gagal: ${r.error}` }
  const postId = String(r.data?.id || '')
  if (!postId) return { ok: false, error: 'Graph API tidak balik id video' }
  return { ok: true, postId, permalink: await fbPermalink(cfg.pageToken, postId) }
}

/* ============================================================
   CAROUSEL — N foto unpublished → 1 post feed attached_media
   ============================================================ */

async function fbPostCarousel(cfg: IgConfig, imageUrls: string[], caption: string): Promise<FbCrossPostResult> {
  const urls = imageUrls.map((u) => u.trim()).filter(Boolean)
  if (urls.length < 2 || urls.length > FB_CAROUSEL_MAX) {
    return { ok: false, error: `carousel FB butuh 2–${FB_CAROUSEL_MAX} foto, dapat ${urls.length}` }
  }

  // 1) Upload tiap slide TIDAK langsung tayang (published=false) → media_fbid
  const mediaFbids: string[] = []
  for (let i = 0; i < urls.length; i++) {
    const r = await graphCall('POST', `${cfg.pageId}/photos`, {
      url: urls[i],
      published: 'false',
    }, cfg.pageToken, 60_000)
    if (!r.ok) {
      return { ok: false, error: `slide ${i + 1}/${urls.length} gagal: ${r.error}` }
    }
    const id = String(r.data?.id || '')
    if (!id) return { ok: false, error: `slide ${i + 1}/${urls.length}: Graph API tidak balik id foto` }
    mediaFbids.push(id)
  }

  // 2) Satu post feed berisi semua foto (attached_media[0..n])
  const params: Record<string, string> = { message: caption.slice(0, FB_MESSAGE_MAX) }
  mediaFbids.forEach((fbid, idx) => {
    params[`attached_media[${idx}][media_fbid]`] = fbid
  })
  const feed = await graphCall('POST', `${cfg.pageId}/feed`, params, cfg.pageToken, 60_000)
  if (!feed.ok) return { ok: false, error: `publish carousel gagal: ${feed.error}` }
  const postId = String(feed.data?.id || '')
  if (!postId) return { ok: false, error: 'Graph API tidak balik id post carousel' }
  return { ok: true, postId, permalink: await fbPermalink(cfg.pageToken, postId) }
}

/* ============================================================
   Orkestrasi cross-post — dipanggil SETELAH IG sukses
   ============================================================ */

/**
 * Cross-post 1 konten (yang barusan tayang di IG) ke feed Halaman FB.
 * Caller WAJIB memanggil ini hanya setelah postToInstagram() sukses —
 * kegagalan di sini dilapor jujur tapi TIDAK mengubah status antrean IG.
 */
export async function crossPostToFacebook(
  cfg: IgConfig,
  opts: FbCrossPostInput
): Promise<FbCrossPostResult> {
  const caption = String(opts.caption || '').trim()
  const mediaType = opts.mediaType || 'IMAGE'

  if (mediaType === 'REELS') {
    const v = String(opts.videoUrl || '').trim()
    if (!v) return { ok: false, error: 'video_url kosong — FB video tidak bisa diposting' }
    return fbPostVideo(cfg, v, caption)
  }
  if (mediaType === 'CAROUSEL') {
    const urls = opts.imageUrls?.length
      ? opts.imageUrls
      : opts.imageUrl ? [opts.imageUrl] : []
    return fbPostCarousel(cfg, urls, caption)
  }
  const img = String(opts.imageUrl || '').trim()
  if (!img) return { ok: false, error: 'image_url kosong — FB foto tidak bisa diposting' }
  return fbPostPhoto(cfg, img, caption)
}

/** Bentuk ringkas utk disimpan ke kolom meta (jsonb) baris instagram_posts. */
export function fbMetaEntry(r: FbCrossPostResult): Record<string, unknown> {
  return {
    ok: r.ok,
    post_id: r.postId ?? null,
    permalink: r.permalink ?? null,
    error: r.ok ? null : String(r.error || '?').slice(0, 300),
    at: new Date().toISOString(),
  }
}
