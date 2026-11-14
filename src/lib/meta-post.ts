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

/**
 * Petunjuk perbaikan dalam bahasa Indonesia untuk error Graph yang umum
 * (Bos harus tahu CARA FIX, bukan cuma teks mentah Graph API).
 */
function hintGraphError(json: unknown, status: number, base: string): string {
  const j = (json || {}) as { error?: { message?: string; code?: number; error_subcode?: number } }
  const g = j.error || {}
  const code = Number(g.code || 0)
  const subcode = Number(g.error_subcode || 0)
  const msg = String(g.message || '')
  const low = msg.toLowerCase()
  let hint = ''
  if (code === 190) {
    hint = ' → TOKEN IG kedaluwarsa/tidak valid. CARA FIX: buat token baru (Graph API Explorer → pilih app + izin instagram_basic, instagram_content_publish, pages_show_list → Generate Access Token), lalu update secret INSTAGRAM_ACCESS_TOKEN di Cloudflare dashboard.'
  } else if (/unsupported post request/i.test(low) || subcode === 33) {
    hint = ' → INSTAGRAM_USER_ID kemungkinan SALAH (harus ID akun IG PROFESIONAL 17841…, bukan ID halaman FB 1xxxxx). CARA FIX: buka Graph API Explorer → GET /me?fields=instagram_business_account → pakai ID yang muncul.'
  } else if (subcode === 2207082 || /media upload has failed/i.test(low)) {
    hint = ' → IG gagal MENGAMBIL file media. Pastikan URL publik https, file .jpg/.png ≤8MB (atau .mp4 video) yang langsung terunduh TANPA redirect/HTML.'
  } else if (code === 4 || code === 32 || /rate limit/i.test(low)) {
    hint = ' → Limit IG API tercapai (±25 post/hari). Tunggu dan coba lagi nanti.'
  } else if (/permission|not authorized|authorize/i.test(low)) {
    hint = ' → Izin app kurang. Token wajib punya izin instagram_basic + instagram_content_publish + pages_show_list, dan akun IG harus tipe PROFESIONAL (Business/Creator) yang tertaut ke app.'
  } else if (/expires|expired/i.test(low) && code === 102) {
    hint = ' → Sesi token habis — buat ulang token di Graph API Explorer.'
  }
  const cd = code ? ` [Graph code ${code}${subcode ? ` subcode ${subcode}` : ''}]` : ''
  return `${base}${cd}${hint}`
}

/** 1 panggilan Graph API GET (query string). */
async function graphGet(path: string, token: string, params: Record<string, string>, timeoutMs = 15_000): Promise<{ ok: true; json: any } | { ok: false; err: string; json: any }> {
  const qs = new URLSearchParams({ ...params, access_token: token })
  try {
    const res = await fetch(`${GRAPH}/${path}?${qs}`, { signal: AbortSignal.timeout(timeoutMs) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, err: graphErrorText(json, res.status), json }
    return { ok: true, json }
  } catch (x: any) {
    return { ok: false, err: `Graph fetch gagal: ${String(x?.message || x).slice(0, 140)}`, json: {} }
  }
}

/**
 * TUNGGU container status FINISHED sebelum media_publish.
 *
 * ROOT CAUSE "auto post IG error" (fix 9 Nov 2026): dulu publish
 * DITEMBAHKAN SEGERA setelah container dibuat — padahal IG wajib container
 * FINISHED dulu. Kalau publish datang lebih cepat dari proses server IG,
 * Graph balik error ("media not ready"/code 24 dst) → post gagal padahal
 * gambarnya valid. Foto biasanya siap dalam hitungan detik → poll 60 dtk.
 */
async function waitForContainerReady(
  c: MetaCreds,
  creationId: string,
  opts: { maxWaitMs?: number; intervalMs?: number } = {}
): Promise<{ ready: true } | { ready: false; reason: string }> {
  const maxWaitMs = opts.maxWaitMs ?? 60_000
  const intervalMs = opts.intervalMs ?? 3_000
  const deadline = Date.now() + maxWaitMs
  let lastNote = ''
  while (Date.now() < deadline) {
    const st = await graphGet(String(creationId), c.igToken, { fields: 'status_code,status' })
    if (st.ok) {
      const sc = String(st.json?.status_code || '')
      if (sc === 'FINISHED') return { ready: true }
      if (sc === 'ERROR') {
        return { ready: false, reason: hintGraphError(st.json, 200, `IG menolak media saat diproses: ${String(st.json?.status || st.json?.error?.message || 'ERROR').slice(0, 140)}`) }
      }
      lastNote = sc || 'status kosong'
    } else {
      // Gagal query status → anggap belum siap, coba lagi sampai deadline
      lastNote = st.err
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return { ready: false, reason: `container belum FINISHED dalam ${Math.round(maxWaitMs / 1000)} detik (status terakhir: ${lastNote || '?'}). Publish dibatalkan supaya tidak menabrak error "media belum siap" — coba lagi.` }
}

/** 1 panggilan Graph API POST (JSON body). json ikut dibalik saat gagal
 *  supaya hintGraphError bisa membaca code/subcode Graph. */
async function graphPost(path: string, token: string, body: Record<string, unknown>, timeoutMs = 20_000): Promise<{ ok: true; json: any } | { ok: false; err: string; json: any }> {
  try {
    const res = await fetch(`${GRAPH}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, access_token: token }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, err: graphErrorText(json, res.status), json }
    return { ok: true, json }
  } catch (x: any) {
    return { ok: false, err: `Graph fetch gagal: ${String(x?.message || x).slice(0, 140)}`, json: {} }
  }
}

/**
 * Post NYATA ke Instagram (image + caption) — 3 langkah:
 * 1) POST /{ig-user-id}/media → creation_id (butuh image_url publik)
 * 2) TUNGGU status container FINISHED (wajib — lihat waitForContainerReady)
 * 3) POST /{ig-user-id}/media_publish {creation_id} → media id + permalink
 */
async function postInstagram(c: MetaCreds, caption: string, imageUrl?: string): Promise<MetaPostResult> {
  if (!c.igToken || !c.igUserId)
    return { posted: false, platform: 'instagram', reason: 'token IG belum diset (INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_USER_ID) — set keduanya di Cloudflare Secrets (kadaluarsa? buat token baru via Graph API Explorer dgn izin instagram_content_publish)' }
  const img = (imageUrl || '').trim() || c.igDefaultImage
  const container = await graphPost(`${c.igUserId}/media`, c.igToken, { image_url: img, caption: caption.slice(0, 2200) })
  if (!container.ok) {
    return { posted: false, platform: 'instagram', reason: hintGraphError(container.json, 0, `container gagal: ${container.err}`) }
  }
  const creationId = String(container.json?.id || '')
  if (!creationId) return { posted: false, platform: 'instagram', reason: 'container tanpa id' }

  const ready = await waitForContainerReady(c, creationId)
  if (!ready.ready) return { posted: false, platform: 'instagram', reason: ready.reason }

  const publish = await graphPost(`${c.igUserId}/media_publish`, c.igToken, { creation_id: creationId }, 30_000)
  if (!publish.ok) {
    return { posted: false, platform: 'instagram', reason: hintGraphError(publish.json, 0, `publish gagal: ${publish.err}`) }
  }
  const postId = String(publish.json?.id || creationId)
  /* Permalink best-effort — konfirmasi tambahan bahwa post benar-benar tayang. */
  let permalink: string | undefined
  const pl = await graphGet(postId, c.igToken, { fields: 'permalink' })
  if (pl.ok && pl.json?.permalink) permalink = String(pl.json.permalink)
  return { posted: true, platform: 'instagram', id: postId, permalink }
}

/* FIX ID GRUP (laporan Bos 2026-11-14): FACEBOOK_PAGE_ID berisi ID GRUP
 * Facebook — posting ke grup via API butuh app di-install di grup + izin
 * publish_to_groups (setup manual, kode tidak bisa menyembuhkan).
 * AUTO-RESOLVE: kalau ID salah/grup, token yang BENAR biasanya masih bisa
 * mendaftar Page yang dikelola via GET /me/accounts → ambil Page pertama
 * (id + access_token Page dari respons) → post ke situ. Hasil resolve
 * di-cache per invocation (worker ephemeral — cache hidup 10 menit).
 * JADI BOS TIDAK PERLU GANTI SECRET — token yang sudah ada dipakai
 * mencari Page yang benar otomatis. */
let resolvedPageCache: { id: string; token: string; name: string; at: number } | null = null
const RESOLVED_TTL_MS = 10 * 60 * 1000

async function resolvePageFromToken(
  c: MetaCreds
): Promise<{ page: { id: string; token: string; name: string } | null; err: string }> {
  if (resolvedPageCache && Date.now() - resolvedPageCache.at < RESOLVED_TTL_MS) {
    return { page: resolvedPageCache, err: '' }
  }
  const acc = await graphGet('me/accounts', c.fbToken, { fields: 'id,name,access_token' })
  if (!acc.ok) {
    return { page: null, err: `GET /me/accounts gagal: ${acc.err}` }
  }
  const pages = Array.isArray(acc.json?.data) ? acc.json.data : []
  const p = pages.find((x: { id?: string; access_token?: string }) => x?.id && x?.access_token) || pages[0]
  if (!p?.id) {
    return { page: null, err: 'GET /me/accounts sukses tapi KOSONG — token ini tidak punya akses ke Page/Halaman mana pun (token USER tanpa izin pages_show_list, atau Page belum tertaut ke app).' }
  }
  const page = {
    id: String(p.id),
    token: String(p.access_token || c.fbToken),
    name: String(p.name || 'Page'),
  }
  resolvedPageCache = { ...page, at: Date.now() }
  return { page, err: '' }
}

/** Post NYATA ke Facebook Page feed (teks polos didukung).
 *
 * Penanganan 3 lapis:
 *   1. AUTO-RESOLVE (baru): kalau FACEBOOK_PAGE_ID menunjuk GRUP (error
 *      #200 publish_to_groups) → GET /me/accounts cari Page asli milik
 *      token → post pakai id + access_token Page itu. Bos tidak perlu
 *      ganti secret manual.
 *   2. AUTO-HEAL: POST /me/feed memakai token apa adanya — kalau
 *      token-nya memang token Page (non-expiring), post tetap masuk
 *      ke halaman walau PAGE_ID-nya salah/kosong.
 *   3. Kalau tetap gagal → reason berisi DIAGNOSA + CARA FIX dalam
 *      bahasa Indonesia (bukan cuma error mentah Graph). */
async function postFacebook(c: MetaCreds, message: string): Promise<MetaPostResult> {
  if (!c.fbToken || !c.fbPageId)
    return { posted: false, platform: 'facebook', reason: 'token FB belum diset (FACEBOOK_PAGE_TOKEN + FACEBOOK_PAGE_ID)' }
  const feed = await graphPost(`${c.fbPageId}/feed`, c.fbToken, { message: message.slice(0, 5000) })
  if (feed.ok) return { posted: true, platform: 'facebook', id: String(feed.json?.id || '') }

  /* Kasus khusus: ID menunjuk GRUP FB (error #200 publish_to_groups). */
  if (/publish_to_groups|posting to a group|app being installed in the group/i.test(feed.err)) {
    /* 1) AUTO-RESOLVE: token valid → /me/accounts daftar Page asli →
       post ke Page pertama yang bisa dikelola (secret salah TETAP
       jalan — tidak perlu Bos ganti FACEBOOK_PAGE_ID manual). */
    const { page, err: resolveErr } = await resolvePageFromToken(c)
    if (page) {
      const rp = await graphPost(`${page.id}/feed`, page.token, { message: message.slice(0, 5000) })
      if (rp.ok) {
        return { posted: true, platform: 'facebook', id: String(rp.json?.id || '') }
      }
      /* Page ketemu tapi post tetap gagal → fallback /me/feed */
      const me = await graphPost('me/feed', c.fbToken, { message: message.slice(0, 5000) })
      if (me.ok) return { posted: true, platform: 'facebook', id: String(me.json?.id || '') }
      return {
        posted: false,
        platform: 'facebook',
        reason: `FACEBOOK_PAGE_ID adalah ID GRUP — Page "${page.name}" (${page.id}) ketemu via /me/accounts tapi post tetap gagal: ${rp.err} · fallback /me: ${me.err}`,
      }
    }
    /* 2) Token tidak bisa mendaftar Page → diagnosa + CARA FIX. */
    return {
      posted: false,
      platform: 'facebook',
      reason: 'FACEBOOK_PAGE_ID adalah ID GRUP Facebook, bukan ID Page/Halaman, dan token tidak bisa auto-resolve Page. ' +
        `${resolveErr}. ` +
        'CARA FIX: buat token BARU di Graph API Explorer dgn izin pages_show_list + pages_manage_posts → saat generate, PILIH Page Luxtradee → set FACEBOOK_PAGE_TOKEN + FACEBOOK_PAGE_ID (ID Page, bukan grup) di Cloudflare Secrets. ' +
        `Detail: feed gagal: ${feed.err}`,
    }
  }
  return { posted: false, platform: 'facebook', reason: `feed gagal: ${feed.err}` }
}

/**
 * DUAL-POST SEKALIGUS (permintaan Bos 14 Nov: "FB sendiri besoknya kontenya
 * dipost di IG ga sekalian gitu") — dulu metaAutoPost IG dulu → kalau IG
 * gagal baru FB → konten jadi GANTIAN antar platform (hari ini FB, besok IG).
 * Sekarang: IG + FB DIPOST BERSAMAAN (paralel), hasil per-platform dilapor
 * JUJUR. Platform tanpa kredensial dilapor sebagai gagal jelas.
 */
export interface MetaMultiResult {
  postedAny: boolean
  /** platform yang SUKSES, contoh: ['Instagram','Facebook'] */
  platforms: string[]
  ig: MetaPostResult
  fb: MetaPostResult
  /** ringkasan manusiawi 1 baris (Discord / laporan karyawan) */
  summary: string
}

export async function metaAutoPostAll(caption: string, imageUrl?: string): Promise<MetaMultiResult> {
  const c = metaCreds()
  const text = String(caption || '').trim()
  const emptyResult = (reason: string): MetaMultiResult => ({
    postedAny: false,
    platforms: [],
    ig: { posted: false, platform: 'instagram', reason },
    fb: { posted: false, platform: 'facebook', reason },
    summary: reason,
  })
  if (!text) return emptyResult('caption kosong')

  const wantIg = !!(c.igToken && c.igUserId)
  const wantFb = !!(c.fbToken && c.fbPageId)
  if (!wantIg && !wantFb) {
    return emptyResult('belum ada kredensial Meta — set INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_USER_ID (atau FACEBOOK_PAGE_TOKEN + FACEBOOK_PAGE_ID) di Cloudflare Secrets')
  }

  const [ig, fb] = await Promise.all([
    wantIg
      ? postInstagram(c, text, imageUrl)
      : Promise.resolve<MetaPostResult>({ posted: false, platform: 'instagram', reason: 'token IG belum diset (INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_USER_ID)' }),
    wantFb
      ? postFacebook(c, text)
      : Promise.resolve<MetaPostResult>({ posted: false, platform: 'facebook', reason: 'token FB belum diset (FACEBOOK_PAGE_TOKEN + FACEBOOK_PAGE_ID)' }),
  ])

  const platforms: string[] = []
  if (ig.posted) platforms.push('Instagram')
  if (fb.posted) platforms.push('Facebook')
  const parts = [
    ig.posted ? 'Instagram OK' : `Instagram gagal: ${(ig.reason || '?').slice(0, 110)}`,
    fb.posted ? 'Facebook OK' : `Facebook gagal: ${(fb.reason || '?').slice(0, 110)}`,
  ]
  const summary = platforms.length
    ? `Tayang di ${platforms.join(' + ')} (${parts.join(' · ')})`
    : `Gagal semua — ${parts.join(' · ')}`

  return { postedAny: platforms.length > 0, platforms, ig, fb, summary }
}

/**
 * Auto-posting nyata (LAMA — kompatibilitas): coba Instagram dulu
 * (kalau kredensial + gambar ada), lalu Facebook Page sebagai jalur
 * kedua. Return HONEST — tidak pernah bohong sukses. Platform 'none'
 * = tidak ada kredensial sama sekali.
 * PENTING: alur baru = metaAutoPostAll (dual-post sekaligus). Fungsi ini
 * dipertahankan untuk pemanggil yang memang cuma boleh 1 platform.
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
