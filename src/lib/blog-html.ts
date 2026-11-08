/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BLOG HTML HELPERS — dipakai API blog publik + agent Farhan (Growth Hacker)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Semua fungsi murni string (tanpa dependency) — aman di Cloudflare Workers.
 *
 *  - slugify()             : judul → URL slug SEO (lowercase, dash, tanpa unicode)
 *  - stripHtmlToText()     : HTML → teks polos (excerpt, hitung kata)
 *  - computeReadMinutes()  : estimasi waktu baca (±200 kata/menit)
 *  - renderSafeArticleHtml(): whitelist sanitizer utk html_body artikel
 *                            (sumber: agent Farhan / draf AI) — buang
 *                            script/iframe/event-handler/javascript:, semua
 *                            atribut dibuang KECUALI href <a> yang lolos
 *                            (path relatif "/..." atau domain sendiri).
 *                            Defense in depth sebelum dangerouslySetInnerHTML
 *                            di halaman /blog.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const ALLOWED_TAGS = new Set([
  'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong', 'em',
  'br', 'blockquote', 'a', 'code', 'pre',
])

/** Judul artikel → slug URL deterministik ("Strategi RR 1:3!" → "strategi-rr-1-3"). */
export function slugify(input: string, maxLen = 90): string {
  const base = String(input ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
    .replace(/-+$/g, '')
  return base || 'artikel'
}

/** HTML → teks polos (entity umum ikut dibenerin) — buat excerpt & hitung kata. */
export function stripHtmlToText(html: string): string {
  return String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Waktu baca ±200 kata/menit (dibulatkan ke atas, minimal 1). */
export function computeReadMinutes(html: string): number {
  const words = stripHtmlToText(html).split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

/**
 * Whitelist sanitizer final — SATU pass, href <a> ditangani langsung:
 *   - href RELATIF ("/...", bukan "//") atau https://luxtradee.web.id/ → lolos
 *   - selain itu (termasuk javascript:, data:, http eksternal) → href dibuang
 *     (tag <a> tanpa href tetap valid, teks isinya aman)
 * Tag di luar whitelist dibuang (isi <script>/<style> ikut dihapus).
 */
export function renderSafeArticleHtml(html: string): string {
  if (!html) return ''
  let s = String(html)

  // 1) Buang blok berbahaya utuh (dengan isi) + versi self-closing/kosong
  s = s.replace(
    /<\s*(script|style|iframe|object|embed|svg|math|link|meta|form|input|button|textarea)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    '',
  )
  s = s.replace(
    /<\s*(script|style|iframe|object|embed|svg|math|link|meta|form|input|button|textarea)[^>]*\/?\s*>/gi,
    '',
  )

  // 2) Filter per-tag — hanya whitelist yang lolos, atribut dibuang
  //    (KECUALI href <a> yang lolos verifikasi domain)
  s = s.replace(
    /<\s*(\/?)\s*([a-zA-Z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*)>/g,
    (_m, close: string, tagRaw: string, attrs: string) => {
      const tag = tagRaw.toLowerCase()
      if (!ALLOWED_TAGS.has(tag)) return ''
      if (close) return `</${tag}>`
      if (tag === 'br') return '<br/>'
      if (tag === 'a') {
        const href = attrs.match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)
        const url = (href?.[1] || href?.[2] || href?.[3] || '').trim()
        const ok =
          /^\/(?!\/)/.test(url) ||
          /^https:\/\/(www\.)?luxtradee\.web\.id\//i.test(url)
        if (!ok) return '<a>'
        return `<a href="${url.replace(/"/g, '&quot;')}" rel="noopener">`
      }
      return `<${tag}>`
    },
  )

  return s.trim()
}
