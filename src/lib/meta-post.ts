/**
 * META / INSTAGRAM GRAPH API — integrasi auto-posting NYATA untuk Sinta (CMO).
 *
 * Task 32 (SOP Bos): agen CMO WAJIB punya fungsi fetch ke Instagram/Meta
 * Graph API memakai kredensial token untuk auto-posting nyata — bukan
 * simulasi. Lib ini dipakai oleh /api/ceo-agent (action cmo & cmo-post).
 *
 * KREDENSIAL (Cloudflare Workers Secrets / .env lokal):
 *  - INSTAGRAM_ACCESS_TOKEN : token IG Business (Graph API)
 *  - INSTAGRAM_USER_ID      : ID akun IG Business/Business Suite
 *  - FACEBOOK_PAGE_TOKEN    : token Page Facebook (alternatif / cadangan)
 *  - FACEBOOK_PAGE_ID       : ID Page Facebook
 *  - INSTAGRAM_DEFAULT_IMAGE_URL : (opsional) gambar publik utk post IG
 *     tanpa gambar lampiran. Default: ikon aplikasi 1024px dari situs.
 *
 * ATURAN JUJUR: kalau token belum diset → kembalikan posted:false +
 * reason yang jelas. TIDAK PERNAH mengarang "sukses" — Bos harus bisa
 * membedakan post nyata vs gagal.
 *
 * Instagram Graph API butuh GAMBAR untuk membuat media (tidak ada post
 * teks polos). Kalau tidak ada imageUrl, lib pakai INSTAGRAM_DEFAULT_IMAGE_URL,
 * lalu fallback ke ikon aplikasi. Facebook Page feed mendukung teks polos.
 */

const GRAPH = 'https://graph.facebook.com/v21.0'

export interface MetaPostResult {
  posted: boolean
  platform: 'instagram' | 'facebook' | 'none'
  id?: string
  permalink?: string
  reason?: string
}

export interface MetaCreds {
  igToken: string
  igUserId: string
  fbToken: string
  fbPageId: string
  igDefaultImage: string
}

/** Baca secret dari process.env ATAU binding CF Workers (pola cfSecret). */
function secret(name: string): string {
  const direct = process.env[name]
  if (direct) return direct.trim()
  try {
    const sym = Symbol.for('__cloudflare-context__')
    const ctx = (globalThis as Record<symbol, unknown>)[sym] as { env?: Record<string, string> } | undefined
    const v = ctx?.env?.[name]
    if (v) return String(v).trim()
  } catch { /* ignore */ }
  return ''
}

export function metaCreds(): MetaCreds {
  return {
    igToken: secret('INSTAGRAM_ACCESS_TOKEN'),
    igUserId: secret('INSTAGRAM_USER_ID'),
    fbToken: secret('FACEBOOK_PAGE_TOKEN'),
    fbPageId: secret('FACEBOOK_PAGE_ID'),
    igDefaultImage: secret('INSTAGRAM_DEFAULT_IMAGE_URL') || 'https://luxtradee.web.id/icon-1024x1024-new.png',
  }
}

/** Diagnosa kredensial — dipakai action diag & dashboard. */
export function metaDiag(): { ig: boolean; fb: boolean; igUserId?: string; fbPageId?: string } {
  const c = metaCreds()
  return {
    ig: !!(c.igToken && c.igUserId),
    fb: !!(c.fbToken && c.fbPageId),
    igUserId: c.igUserId || undefined,
    fbPageId: c.fbPageId || undefined,
  }
}

function graphErrorText(json: any, status: number): string {
  const m = json?.error?.message || json?.message || ''
  return `Graph HTTP ${status}${m ? ' — ' + String(m).slice(0, 160) : ''}`
}

/** 1 panggilan Graph API POST (JSON body). */
async function graphPost(path: string, token: string, body: Record<string, unknown>, timeoutMs = 20_000): Promise<{ ok: true; json: any } | { ok: false; err: string }> {
  try {
    const res = await fetch(`${GRAPH}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, access_token: token }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, err: graphErrorText(json, res.status) }
    return { ok: true, json }
  } catch (x: any) {
    return { ok: false, err: `Graph fetch gagal: ${String(x?.message || x).slice(0, 140)}` }
  }
}

/**
 * Post NYATA ke Instagram (image + caption) — 2 langkah:
 * 1) POST /{ig-user-id}/media → creation_id (butuh image_url publik)
 * 2) POST /{ig-user-id}/media_publish {creation_id} → media id
 */
async function postInstagram(c: MetaCreds, caption: string, imageUrl?: string): Promise<MetaPostResult> {
  if (!c.igToken || !c.igUserId)
    return { posted: false, platform: 'instagram', reason: 'token IG belum diset (INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_USER_ID)' }
  const img = (imageUrl || '').trim() || c.igDefaultImage
  const container = await graphPost(`${c.igUserId}/media`, c.igToken, { image_url: img, caption: caption.slice(0, 2200) })
  if (!container.ok) return { posted: false, platform: 'instagram', reason: `container gagal: ${container.err}` }
  const creationId = String(container.json?.id || '')
  if (!creationId) return { posted: false, platform: 'instagram', reason: 'container tanpa id' }
  const publish = await graphPost(`${c.igUserId}/media_publish`, c.igToken, { creation_id: creationId }, 30_000)
  if (!publish.ok) return { posted: false, platform: 'instagram', reason: `publish gagal: ${publish.err}` }
  return { posted: true, platform: 'instagram', id: String(publish.json?.id || creationId) }
}

/** Post NYATA ke Facebook Page feed (teks polos didukung).
 *
 * FIX ERROR BOS: "feed gagal: Graph HTTP 403 — (#200) If posting to a
 * group, requires app being installed in the group, and either
 * publish_to_groups permission…" → artinya FACEBOOK_PAGE_ID yang
 * diset bos adalah ID **GRUP** Facebook, bukan ID **PAGE/Halaman**.
 * Posting ke grup via API butuh app di-install di grup itu + izin
 * publish_to_groups (setup manual di FB — kode tidak bisa menyembuhkan).
 * Penanganan 2 lapis di sini:
 *   1. AUTO-HEAL: coba POST /me/feed memakai token apa adanya — kalau
 *      token-nya memang token Page (non-expiring), post tetap masuk
 *      ke halaman walau PAGE_ID-nya salah/kosong.
 *   2. Kalau tetap gagal → reason berisi DIAGNOSA + CARA FIX dalam
 *      bahasa Indonesia (bukan cuma error mentah Graph). */
async function postFacebook(c: MetaCreds, message: string): Promise<MetaPostResult> {
  if (!c.fbToken || !c.fbPageId)
    return { posted: false, platform: 'facebook', reason: 'token FB belum diset (FACEBOOK_PAGE_TOKEN + FACEBOOK_PAGE_ID)' }
  const feed = await graphPost(`${c.fbPageId}/feed`, c.fbToken, { message: message.slice(0, 5000) })
  if (feed.ok) return { posted: true, platform: 'facebook', id: String(feed.json?.id || '') }

  /* Kasus khusus: ID menunjuk GRUP FB (error #200 publish_to_groups). */
  if (/publish_to_groups|posting to a group|app being installed in the group/i.test(feed.err)) {
    /* 1) Auto-heal: token Page valid → /me/feed tetap posting ke halaman. */
    const me = await graphPost('me/feed', c.fbToken, { message: message.slice(0, 5000) })
    if (me.ok) {
      return { posted: true, platform: 'facebook', id: String(me.json?.id || '') }
    }
    /* 2) Tetap gagal → diagnosa lengkap + langkah perbaikan. */
    return {
      posted: false,
      platform: 'facebook',
      reason: 'FACEBOOK_PAGE_ID adalah ID GRUP Facebook, bukan ID Page/Halaman. ' +
        'Posting ke grup butuh app di-install di grup + izin publish_to_groups. ' +
        `CARA FIX: (a) ganti FACEBOOK_PAGE_ID dgn ID Halaman FB (lihat about page → Page ID), ATAU (b) install app Meta di grup + beri izin publish_to_groups. Detail: feed gagal: ${feed.err} · fallback /me: ${me.err}`,
    }
  }
  return { posted: false, platform: 'facebook', reason: `feed gagal: ${feed.err}` }
}

/**
 * Auto-posting nyata: coba Instagram dulu (kalau kredensial + gambar ada),
 * lalu Facebook Page sebagai jalur kedua. Return HONEST — tidak pernah
 * bohong sukses. Platform 'none' = tidak ada kredensial sama sekali.
 */
export async function metaAutoPost(caption: string, imageUrl?: string): Promise<MetaPostResult> {
  const c = metaCreds()
  const text = String(caption || '').trim()
  if (!text) return { posted: false, platform: 'none', reason: 'caption kosong' }

  if (c.igToken && c.igUserId) {
    const ig = await postInstagram(c, text, imageUrl)
    if (ig.posted) return ig
    // IG gagal → lanjut coba FB (kalau ada), tapi bawa alasan gagal IG
    if (c.fbToken && c.fbPageId) {
      const fb = await postFacebook(c, text)
      return fb.posted ? fb : { posted: false, platform: 'none', reason: `IG: ${ig.reason} · FB: ${fb.reason}` }
    }
    return ig
  }
  if (c.fbToken && c.fbPageId) return postFacebook(c, text)
  return {
    posted: false,
    platform: 'none',
    reason: 'belum ada kredensial Meta — set INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_USER_ID (atau FACEBOOK_PAGE_TOKEN + FACEBOOK_PAGE_ID) di Cloudflare Secrets',
  }
}
