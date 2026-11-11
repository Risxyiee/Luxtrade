/**
 * seo-publish.ts — MESIN TERBIT SEO (otak penerbit artefak → blog publik)
 * ==============================================================================
 * MASALAH YANG DIPERBAIKI (audit Bos 11 Nov):
 *   Sinta menulis artikel SEO tiap Rabu (job cmo:seo-article) → artefak
 *   nyimpin di agent_kv (art:index + art:body:<id>) → TIDAK PERNAH
 *   diterbitkan ke tabel blog_posts → /blog tetap sepi → Google tidak
 *   pernah mengirim trafik. Rapat mingguan mengevaluasi bet "signups"
 *   dari kanal yang realitanya tidak pernah dieksekusi.
 *
 * SOLUSI:
 *   1. publishLatestArticle() — ambil artefak artikel terbaru yang belum
 *      terbit → parse (meta description / slug / kata kunci / isi) →
 *      INSERT ke blog_posts (status='published') → ping IndexNow
 *      (Bing/Yandex/Seznam/dsb — gratis, tanpa login) → lapor Discord.
 *   2. Dipanggil otomatis setiap action work/tick (self-dedup per id
 *      artefak via kv `seo:pub:<id>` → murah: 1x baca KV saat idle).
 *   3. Sitemap dinamis (src/app/sitemap.ts) menyertakan semua artikel
 *      terbit → Google punya peta lengkap.
 *
 * KONSEKUENSI DESAIN:
 *   - Zero-import (pola comment-hunter/harness-prompt): murni operasi
 *     string + fetch + AbortController — aman CF Workers & CPU budget.
 *   - Autonomy: seo-article = tipe 'auto' (ceo-loop) → terbit TANPA ACC,
 *     Bos bisa memangkas via action unpublish (?mode=unpublish).
 *   - Gagal insert diulang maks 3x per artefak (kv `seo:pub:fail:<id>`)
 *     supaya tick tidak menggedor Supabase selamanya.
 * ==============================================================================
 */

/* ── KONFIG ── */

/** Kunci IndexNow (publik by design — filenya harus dilayani di situs:
 *  public/8bf5bbcf9fff3cf1e5751f1aeced152c.txt). */
export const IDXNOW_KEY = '8bf5bbcf9fff3cf1e5751f1aeced152c'

/** Jenis artefak yang layak diterbitkan ke blog (urut prioritas). */
const PUBLISHABLE_KINDS = ['seo-article', 'content', 'seo-audit']

/** Maks percobaan insert per artefak sebelum menyerah. */
const MAX_ATTEMPTS = 3

/* ── KONTRAK INPUT (dependency injection — route yang menyuntik) ── */
export interface PublishInput {
  kvGet: (key: string) => Promise<string | null>
  kvSet: (key: string, val: string) => Promise<boolean | unknown>
  /** Base URL Supabase tanpa trailing slash, mis. https://xxx.supabase.co */
  sbUrl: string
  /** Service role key (REST insert butuh level admin). */
  sbService: string
  /** Base URL situs publik, mis. https://luxtradee.web.id */
  baseUrl: string
  /** Notifikasi Discord (opsional). */
  notify?: (text: string) => Promise<unknown>
}

export interface PublishResult {
  published?: boolean
  skipped?: string
  id?: string
  slug?: string
  title?: string
  url?: string
  indexNow?: 'ok' | 'gagal' | 'dilewati'
  error?: string
}

/* ── PARSER ARTIKEL (format bebas hasil LLM → terstruktur) ── */
export interface ParsedArticle {
  title: string
  slug: string
  metaDescription: string
  keyword: string
  html: string
  wordCount: number
}

/** Slug kecil versi sendiri (tanpa import — pola zero-import). */
export function slugifyId(input: string, maxLen = 90): string {
  const s = (input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return s.slice(0, maxLen).replace(/-$/, '') || 'artikel'
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inlineMd(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

/** Markdown ringan → HTML (heading/list/paragraf). Blok HTML asli
 *  dipertahankan apa adanya (API blog menyaring ulang saat dibaca). */
export function markdownishToHtml(raw: string): string {
  const text = (raw || '').replace(/\r\n/g, '\n').trim()
  if (!text) return ''
  /* Kalau LLM sudah menghasilkan HTML utuh, pakai apa adanya. */
  if (/<h[1-6][\s>]|<p[\s>]|<ul[\s>]|<ol[\s>]|<li[\s>]/i.test(text)) return text

  const lines = text.split('\n')
  const out: string[] = []
  let listOpen: 'ul' | 'ol' | null = null
  const closeList = () => {
    if (listOpen) { out.push(`</${listOpen}>`); listOpen = null }
  }
  let para: string[] = []
  const flushPara = () => {
    if (para.length) { out.push(`<p>${inlineMd(para.join(' '))}</p>`); para = [] }
  }
  for (const line of lines) {
    const t = line.trim()
    if (!t) { flushPara(); closeList(); continue }
    const h = /^(#{1,4})\s+(.*)$/.exec(t)
    if (h) {
      flushPara(); closeList()
      const lvl = Math.min(h[1].length + 1, 4) /* # → h2, ## → h3 dst */
      out.push(`<h${lvl}>${inlineMd(h[2])}</h${lvl}>`)
      continue
    }
    const ul = /^[-*•]\s+(.*)$/.exec(t)
    if (ul) {
      flushPara()
      if (listOpen !== 'ul') { closeList(); out.push('<ul>'); listOpen = 'ul' }
      out.push(`<li>${inlineMd(ul[1])}</li>`)
      continue
    }
    const ol = /^\d+[.)]\s+(.*)$/.exec(t)
    if (ol) {
      flushPara()
      if (listOpen !== 'ol') { closeList(); out.push('<ol>'); listOpen = 'ol' }
      out.push(`<li>${inlineMd(ol[1])}</li>`)
      continue
    }
    flushPara()
    para.push(t)
  }
  flushPara(); closeList()
  return out.join('\n')
}

/** Parse isi artefak: baris awal bisa berisi meta description/slug/kata
 *  kunci/judul (format diminta di prompt Sinta), sisanya isi artikel. */
export function parseArticleBody(raw: string, fallbackTitle: string): ParsedArticle {
  const text = (raw || '').replace(/\r\n/g, '\n').trim()
  let title = ''
  let slug = ''
  let metaDescription = ''
  let keyword = ''
  const contentLines: string[] = []

  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!contentLines.length) {
      let m = /^meta\s*(description)?\s*[:\-—]\s*(.+)$/i.exec(t)
      if (m) { metaDescription = m[2].slice(0, 160); continue }
      m = /^slug\s*[:\-—]\s*(.+)$/i.exec(t)
      if (m) { slug = slugifyId(m[1]); continue }
      m = /^(kata\s*kunci|keyword|keywords)\s*[:\-—]\s*(.+)$/i.exec(t)
      if (m) { keyword = m[2].slice(0, 90); continue }
      m = /^(judul|title)\s*[:\-—]\s*(.+)$/i.exec(t)
      if (m) { title = m[2].slice(0, 180); continue }
    }
    contentLines.push(line)
  }

  let body = contentLines.join('\n').trim()
  /* Judul fallback: heading pertama atau meta title artefak. */
  if (!title) {
    const hm = /^#{1,2}\s+(.+)$/m.exec(body)
    title = (hm ? hm[1] : fallbackTitle || 'Artikel dari Tim AI').replace(/[*#]/g, '').trim().slice(0, 180)
  }
  /* Buang heading pertama dari isi kalau identik dengan judul (hindari dobel). */
  const firstH = /^#{1,2}\s+(.+)$/m.exec(body)
  if (firstH && firstH[1].replace(/[*#]/g, '').trim().toLowerCase() === title.toLowerCase()) {
    body = body.replace(firstH[0], '').trim()
  }
  if (!metaDescription) {
    const plain = body.replace(/[#*`>\-]|\n/g, ' ').replace(/\s+/g, ' ').trim()
    metaDescription = plain.slice(0, 155)
  }
  if (!slug) slug = slugifyId(title)

  const html = markdownishToHtml(body)
  const wordCount = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
  return { title, slug, metaDescription: metaDescription.slice(0, 160), keyword, html, wordCount }
}

/* ── SUPABASE REST (insert blog_posts) ── */
function sbHeaders(service: string): Record<string, string> {
  return { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
}

async function insertBlogRow(input: PublishInput, row: Record<string, unknown>): Promise<{ id?: string; error?: string }> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15_000)
  try {
    const res = await fetch(`${input.sbUrl}/rest/v1/blog_posts`, {
      method: 'POST', headers: sbHeaders(input.sbService),
      body: JSON.stringify([row]), signal: ctrl.signal,
    })
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 180)
      return { error: `HTTP ${res.status}: ${detail}` }
    }
    const arr = (await res.json().catch(() => [])) as Array<{ id?: string }>
    return { id: arr?.[0]?.id }
  } catch (x: unknown) {
    return { error: String((x as Error)?.message || x).slice(0, 160) }
  } finally { clearTimeout(t) }
}

/* ── INDEXNOW (ping mesin pencari non-Google: Bing/Yandex/Seznam/Naver/dst) ── */
async function pingIndexNow(input: PublishInput, urls: string[]): Promise<'ok' | 'gagal' | 'dilewati'> {
  const list = urls.filter(Boolean).slice(0, 20)
  if (!list.length) return 'dilewati'
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 10_000)
  try {
    const res = await fetch('https://api.indexnow.org/IndexNow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: input.baseUrl.replace(/^https?:\/\//, ''),
        key: IDXNOW_KEY,
        keyLocation: `${input.baseUrl}/${IDXNOW_KEY}.txt`,
        urlList: list,
      }),
      signal: ctrl.signal,
    })
    return res.ok || res.status === 202 ? 'ok' : 'gagal'
  } catch { return 'gagal' } finally { clearTimeout(t) }
}

/* ── ORKESTRATOR UTAMA ── */
export async function publishLatestArticle(
  input: PublishInput,
  opts?: { id?: string; force?: boolean; quiet?: boolean },
): Promise<PublishResult> {
  /* 1. Baca index artefak — paling baru ada di depan (ceo-phase unshift). */
  let index: Array<Record<string, unknown>> = []
  try { index = JSON.parse((await input.kvGet('art:index')) || '[]') } catch { index = [] }
  if (!Array.isArray(index) || !index.length) return { skipped: 'belum ada artefak' }

  const isArticle = (a: Record<string, unknown>) =>
    PUBLISHABLE_KINDS.includes(String(a.kind || '')) && String(a.body || '') !== 'missing'
  const art = opts?.id
    ? index.find((a) => a.id === opts.id)
    : index.find(isArticle)
  if (!art) return { skipped: opts?.id ? 'artefak tidak ditemukan di index' : 'belum ada artefak artikel' }
  const id = String(art.id || '')
  if (!id) return { skipped: 'artefak tanpa id' }

  /* 2. Dedup + penjaga percobaan. */
  const already = await input.kvGet(`seo:pub:${id}`).catch(() => null)
  if (already && !opts?.force) {
    try { return { skipped: 'sudah terbit', ...JSON.parse(already) as PublishResult } } catch { return { skipped: 'sudah terbit' } }
  }
  const fails = parseInt((await input.kvGet(`seo:pub:fail:${id}`).catch(() => null)) || '0', 10) || 0
  if (fails >= MAX_ATTEMPTS && !opts?.force) return { skipped: `gagal ${fails}x — berhenti (force=1 untuk ulang)` }

  /* 3. Ambil isi, parse. */
  const body = await input.kvGet(`art:body:${id}`).catch(() => null)
  if (!body) return { skipped: 'isi artefak kosong', id }
  const parsed = parseArticleBody(body, String(art.title || ''))
  if (parsed.html.length < 400) return { skipped: `isi terlalu pendek (${parsed.html.length} char) — dianggap bukan artikel jadi`, id }

  /* 4. Insert ke blog_posts (full kolom → fallback minimal kalau kolom SEO belum ada). */
  const day = new Date().toISOString()
  const author = String(art.who || 'Sinta (CMO — AI Agent)') || 'Sinta (CMO — AI Agent)'
  const fullRow = {
    title: parsed.title, slug: parsed.slug, meta_description: parsed.metaDescription,
    keyword: parsed.keyword, content_body: parsed.html, media_url: null,
    author, status: 'published', created_at: day,
  }
  let ins = await insertBlogRow(input, fullRow)
  if (ins.error && /column|PGRST204|42703/i.test(ins.error)) {
    ins = await insertBlogRow(input, {
      title: parsed.title, content_body: parsed.html, media_url: null,
      author, status: 'published', created_at: day,
    })
    if (ins.id) {
      /* Kolom SEO belum ada → simpan meta via KV (pola fallback api/blog/posts). */
      await input.kvSet(`blog_seo:${ins.id}`, JSON.stringify({
        meta_description: parsed.metaDescription, keyword: parsed.keyword, slug: parsed.slug, wordCount: parsed.wordCount,
      })).catch(() => false)
    }
  }
  if (ins.error || !ins.id) {
    await input.kvSet(`seo:pub:fail:${id}`, String(fails + 1)).catch(() => false)
    return { error: `insert blog_posts gagal: ${ins.error || 'tanpa id'}`, id }
  }

  /* 5. Tandai terbit + ping mesin pencari + lapor Discord. */
  const url = `${input.baseUrl}/blog/${parsed.slug}`
  await input.kvSet(`seo:pub:${id}`, JSON.stringify({
    at: day, blogId: ins.id, slug: parsed.slug, url, title: parsed.title,
  })).catch(() => false)
  const idx = await pingIndexNow(input, [url, `${input.baseUrl}/blog`, `${input.baseUrl}/sitemap.xml`])
  if (!opts?.quiet) {
    await input.notify?.(
      `📰 **ARTIKEL TERBIT OTOMATIS** (mesin SEO)\n` +
      `• ${parsed.title}\n` +
      `• URL: ${url}\n` +
      `• Slug: \`${parsed.slug}\` · ${parsed.wordCount} kata\n` +
      `• Ping IndexNow (Bing/Yandex/dll): ${idx === 'ok' ? '✅' : idx === 'dilewati' ? '➖' : '⚠️ gagal (artikel tetap terbit)'}\n` +
      `_(terbit tanpa ACC — tipe konten "auto"; Bos bisa pangkas via /api/ceo-agent?action=seo-publish&mode=unpublish&slug=${parsed.slug})_`,
    ).catch(() => {})
  }
  return { published: true, id, slug: parsed.slug, title: parsed.title, url, indexNow: idx }
}

/* ── UNPUBLISH (pangkas Bos) ── */
export async function unpublishBySlug(input: PublishInput, slug: string): Promise<PublishResult> {
  if (!slug) return { error: 'slug wajib' }
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15_000)
  try {
    const res = await fetch(
      `${input.sbUrl}/rest/v1/blog_posts?slug=eq.${encodeURIComponent(slug)}`,
      { method: 'PATCH', headers: sbHeaders(input.sbService), body: JSON.stringify({ status: 'archived' }), signal: ctrl.signal },
    )
    if (!res.ok) return { error: `HTTP ${res.status}` }
    return { published: false, slug, skipped: 'diarsipkan (status=archived)' }
  } catch (x: unknown) {
    return { error: String((x as Error)?.message || x).slice(0, 160) }
  } finally { clearTimeout(t) }
}
