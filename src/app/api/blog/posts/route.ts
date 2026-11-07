import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCronAdmin, isMissingColumnError } from '@/lib/cron-supabase'
import { slugify, stripHtmlToText, computeReadMinutes } from '@/lib/blog-html'

/**
 * GET /api/blog/posts — daftar artikel terbit untuk halaman publik /blog.
 *
 * Sumber: tabel blog_posts (status='published', terbaru dulu, maks 60).
 * SEMUA kolom SEO opsional (slug/meta_description/keyword/views — migrasi
 * 040): kalau kolom belum ada, fallback:
 *   - slug  → dihitung dari judul (slugify)
 *   - meta  → agent_kv key 'blog_seo:<id>' (disimpan Farhan saat insert)
 *   - views → agent_kv key 'blog_views:<id>'
 * Selalu HTTP 200 dengan { posts: [...] } — kosong = halaman /blog fallback
 * ke artikel statis (degrade gracefully, pola cron-supabase).
 */

export const dynamic = 'force-dynamic'

interface BlogRow {
  id: string
  title: string
  content_body: string
  media_url?: string | null
  author: string
  status: string
  created_at: string
  slug?: string | null
  meta_description?: string | null
  keyword?: string | null
  views?: number | null
}

interface KvMeta {
  meta_description?: string
  keyword?: string
  slug?: string
  wordCount?: number
}

/** Meta SEO fallback dari agent_kv (dipakai kalau kolom migrasi 040 belum ada). */
async function fetchKvSeo(admin: SupabaseClient): Promise<Map<string, KvMeta>> {
  const map = new Map<string, KvMeta>()
  try {
    const { data, error } = await admin
      .from('agent_kv')
      .select('key,value')
      .like('key', 'blog_seo:%')
      .limit(400)
    if (error) return map
    for (const row of (data || []) as Array<{ key: string; value: string | null }>) {
      const id = row.key.slice('blog_seo:'.length)
      if (!id) continue
      try {
        const v = JSON.parse(row.value || '{}') as KvMeta
        if (v && typeof v === 'object') map.set(id, v)
      } catch {
        /* nilai rusak → skip baris itu saja */
      }
    }
  } catch {
    /* agent_kv belum ada → tanpa meta fallback */
  }
  return map
}

/** Views fallback dari agent_kv (dipakai kalau kolom views belum ada). */
async function fetchKvViews(admin: SupabaseClient): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  try {
    const { data, error } = await admin
      .from('agent_kv')
      .select('key,value')
      .like('key', 'blog_views:%')
      .limit(400)
    if (error) return map
    for (const row of (data || []) as Array<{ key: string; value: string | null }>) {
      const id = row.key.slice('blog_views:'.length)
      const n = parseInt(String(row.value || '0'), 10) || 0
      if (id && n > 0) map.set(id, n)
    }
  } catch {
    /* abaikan */
  }
  return map
}

export async function GET() {
  const admin = await getCronAdmin()
  if (!admin) {
    return NextResponse.json({ posts: [], source: 'unavailable' }, { status: 200 })
  }

  try {
    let rows: BlogRow[] = []
    let seoColumnsMissing = false

    const full = await admin
      .from('blog_posts')
      .select('id,title,content_body,media_url,author,status,created_at,slug,meta_description,keyword,views')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(60)

    if (full.error && isMissingColumnError(full.error)) {
      // Kolom SEO (migrasi 040) belum ada → pakai kolom inti saja
      seoColumnsMissing = true
      const core = await admin
        .from('blog_posts')
        .select('id,title,content_body,media_url,author,status,created_at')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(60)
      if (core.error) throw core.error
      rows = (core.data || []) as BlogRow[]
    } else if (full.error) {
      throw full.error
    } else {
      rows = (full.data || []) as BlogRow[]
    }

    const kvSeo = seoColumnsMissing ? await fetchKvSeo(admin) : new Map<string, KvMeta>()
    const kvViews = seoColumnsMissing ? await fetchKvViews(admin) : new Map<string, number>()

    const posts = rows.map((r) => {
      const meta = kvSeo.get(r.id) || {}
      const kvView = kvViews.get(r.id) || 0
      const text = stripHtmlToText(r.content_body)
      const metaDesc = r.meta_description || meta.meta_description || ''
      const views = r.views ?? kvView
      return {
        id: r.id,
        slug: r.slug || meta.slug || slugify(r.title),
        title: r.title,
        excerpt:
          metaDesc ||
          (text.length > 180 ? `${text.slice(0, 180).trimEnd()}…` : text),
        keyword: r.keyword || meta.keyword || '',
        author: r.author,
        created_at: r.created_at,
        views,
        readMinutes: computeReadMinutes(r.content_body),
        wordCount: text.split(/\s+/).filter(Boolean).length,
        hasImage: Boolean(r.media_url),
      }
    })

    return NextResponse.json(
      {
        posts,
        count: posts.length,
        totalViews: posts.reduce((a, p) => a + (p.views || 0), 0),
        source: 'supabase',
        seoMigrated: !seoColumnsMissing,
      },
      { status: 200 },
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[api/blog/posts] gagal baca blog_posts:', msg.slice(0, 200))
    return NextResponse.json(
      { posts: [], source: 'error', message: msg.slice(0, 160) },
      { status: 200 },
    )
  }
}
