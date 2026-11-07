import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCronAdmin, isMissingColumnError } from '@/lib/cron-supabase'
import { slugify, stripHtmlToText, computeReadMinutes, renderSafeArticleHtml } from '@/lib/blog-html'

/**
 * GET /api/blog/posts/[slug] — detail artikel terbit (halaman publik /blog/<slug>).
 *
 * Resolusi slug (urut): kolom slug (migrasi 040) → slugify(judul) → id UUID.
 * html_body DI-SANITIZE di sini (whitelist tag, href internal saja) — client
 * boleh dangerouslySetInnerHTML aman.
 * View counter: UPDATE kolom views (migrasi 040) → kalau kolom belum ada,
 * counter fallback di agent_kv 'blog_views:<id>' (read-modify-write; race
 * view kecil dihitung toleran — bukan data uang).
 * 404 → halaman /blog/<slug> fallback ke konten statis / UI not-found.
 */

export const dynamic = 'force-dynamic'

interface LightRow {
  id: string
  title: string
  author: string
  created_at: string
  slug?: string | null
  meta_description?: string | null
  keyword?: string | null
  views?: number | null
}

async function kvGetSet(
  admin: SupabaseClient,
  key: string,
  mode: 'get' | 'inc',
): Promise<number> {
  try {
    if (mode === 'get' || mode === 'inc') {
      const { data } = await admin.from('agent_kv').select('value').eq('key', key).limit(1)
      const cur = parseInt(String((data?.[0] as { value?: string } | undefined)?.value || '0'), 10) || 0
      if (mode === 'get') return cur
      await admin
        .from('agent_kv')
        .upsert({ key, value: String(cur + 1), updated_at: new Date().toISOString() })
      return cur + 1
    }
    return 0
  } catch {
    return 0
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await params
  const slugWanted = decodeURIComponent(rawSlug || '').toLowerCase().trim()

  const admin = await getCronAdmin()
  if (!admin || !slugWanted) {
    return NextResponse.json({ post: null, source: 'unavailable' }, { status: 404 })
  }

  try {
    // ── Langkah 1: cari id artikel (kolom ringan; slug opsional) ──
    let target: LightRow | null = null
    let seoMissing = false

    const q = await admin
      .from('blog_posts')
      .select('id,title,author,created_at,slug,meta_description,keyword,views')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(200)

    if (q.error && isMissingColumnError(q.error)) {
      seoMissing = true
      const q2 = await admin
        .from('blog_posts')
        .select('id,title,author,created_at')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(200)
      if (q2.error) throw q2.error
      const rows = (q2.data || []) as LightRow[]
      target = rows.find((r) => slugify(r.title) === slugWanted || r.id === slugWanted) || null
    } else if (q.error) {
      throw q.error
    } else {
      const rows = (q.data || []) as LightRow[]
      target =
        rows.find(
          (r) =>
            (r.slug && r.slug.toLowerCase() === slugWanted) ||
            slugify(r.title) === slugWanted ||
            r.id === slugWanted,
        ) || null
    }

    if (!target) {
      return NextResponse.json({ post: null, source: 'supabase' }, { status: 404 })
    }

    // ── Langkah 2: ambil isi penuh (kolom inti dijamin ada) ──
    const full = await admin
      .from('blog_posts')
      .select('id,title,content_body,media_url,author,created_at')
      .eq('id', target.id)
      .limit(1)
    if (full.error) throw full.error
    const row = (full.data || [])[0] as
      | { id: string; title: string; content_body: string; media_url: string | null; author: string; created_at: string }
      | undefined
    if (!row) {
      return NextResponse.json({ post: null, source: 'supabase' }, { status: 404 })
    }

    // ── Langkah 3: meta SEO (kolom → agent_kv fallback) ──
    let metaDescription = target.meta_description || ''
    let keyword = target.keyword || ''
    if (seoMissing || (!metaDescription && !keyword)) {
      try {
        const { data: kv } = await admin
          .from('agent_kv')
          .select('value')
          .eq('key', `blog_seo:${target.id}`)
          .limit(1)
        const parsed = JSON.parse(String((kv?.[0] as { value?: string } | undefined)?.value || '{}')) as {
          meta_description?: string
          keyword?: string
        }
        if (!metaDescription) metaDescription = parsed.meta_description || ''
        if (!keyword) keyword = parsed.keyword || ''
      } catch {
        /* tanpa kv meta — lanjut */
      }
    }

    // ── Langkah 4: view counter (kolom views → agent_kv fallback) ──
    let views = target.views ?? 0
    if (seoMissing) {
      views = await kvGetSet(admin, `blog_views:${target.id}`, 'inc')
    } else {
      try {
        const { error: upErr } = await admin
          .from('blog_posts')
          .update({ views: (target.views || 0) + 1 })
          .eq('id', target.id)
        if (upErr && isMissingColumnError(upErr)) {
          views = await kvGetSet(admin, `blog_views:${target.id}`, 'inc')
        } else if (!upErr) {
          views = (target.views || 0) + 1
        }
      } catch {
        views = await kvGetSet(admin, `blog_views:${target.id}`, 'inc')
      }
    }

    const text = stripHtmlToText(row.content_body)
    const excerpt =
      metaDescription || (text.length > 180 ? `${text.slice(0, 180).trimEnd()}…` : text)

    return NextResponse.json(
      {
        post: {
          id: row.id,
          slug: (target as LightRow).slug || slugify(row.title),
          title: row.title,
          html: renderSafeArticleHtml(row.content_body),
          excerpt,
          meta_description: metaDescription,
          keyword,
          author: row.author,
          created_at: row.created_at,
          media_url: row.media_url || null,
          views,
          readMinutes: computeReadMinutes(row.content_body),
          wordCount: text.split(/\s+/).filter(Boolean).length,
        },
        source: 'supabase',
        seoMigrated: !seoMissing,
      },
      { status: 200 },
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[api/blog/posts/[slug]] gagal:', msg.slice(0, 200))
    return NextResponse.json({ post: null, source: 'error', message: msg.slice(0, 160) }, { status: 200 })
  }
}
