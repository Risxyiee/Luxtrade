/**
 * Layout detail blog — konten dirender CLIENT-SIDE dari API
 * /api/blog/posts/[slug] (artikel riil dari blog_posts) dengan fallback
 * statis utk 6 artikel klasik. Tidak ada lagi prerender per-slug: dulu
 * generateStaticParams hard-code 6 slug + force-static → artikel BARU
 * hasil terbitan Farhan berisiko 404 karena slug-nya tidak dikenal build.
 *
 * FIX AUDIT SEO (2026-11-12): dulu layout ini polos → SEMUA artikel blog
 * mewarisi title default root (91 char, kembar semua, tanpa canonical).
 * Kini generateMetadata menarik title + meta_description artikel langsung
 * dari DB supaya tiap artikel punya title unik, description sendiri, dan
 * canonical /blog/<slug> — inti dari pabrik SEO Farhan.
 *
 * Resolusi identik dgn API /api/blog/posts/[slug] (jangan sampai metadata
 * fallback padahal artikel ada):
 *   1. kolom slug (migrasi 040)  → .eq('slug')
 *   2. kolom slug TIDAK ADA      → slugify(title) (skema lama)
 *   3. meta_description kosong   → agent_kv 'blog_seo:<id>'
 * Semua gagal → metadata generik (halaman tetap render normal).
 */
import type { Metadata } from 'next'
import { getCronAdmin, isMissingColumnError } from '@/lib/cron-supabase'
import { slugify } from '@/lib/blog-html'

const FALLBACK_TITLE = 'Artikel & Panduan Trading'
const FALLBACK_DESC =
  'Artikel & panduan trading berbahasa Indonesia dari LuxTradee: analisis pasar, strategi, manajemen risiko, dan psikologi trading.'

interface MetaRow {
  id?: string
  title: string | null
  slug?: string | null
  meta_description?: string | null
}

async function fetchPostMeta(
  slug: string,
): Promise<{ title: string; description: string } | null> {
  const admin = await getCronAdmin()
  if (!admin || !slug) return null

  /* Langkah 1: kolom SEO lengkap (slug + meta_description). Kalau kolom
     slug/meta_description belum ada (skema lama) → PGRST204/42703 →
     ulangi tanpa kolom itu. */
  let rows: MetaRow[] = []
  const first = await admin
    .from('blog_posts')
    .select('id,title,slug,meta_description')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(200)

  if (first.error && isMissingColumnError(first.error)) {
    const second = await admin
      .from('blog_posts')
      .select('id,title')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(200)
    if (second.error) return null
    rows = (second.data || []) as MetaRow[]
  } else if (first.error) {
    return null
  } else {
    rows = (first.data || []) as MetaRow[]
  }

  const target =
    rows.find(
      (r) =>
        (r.slug && r.slug.toLowerCase() === slug) ||
        (r.title ? slugify(r.title) === slug : false),
    ) || null
  if (!target?.title) return null

  const title = target.title.trim()

  /* Langkah 2: meta_description dari kolom → fallback agent_kv. */
  let description = (target.meta_description || '').trim()
  if (!description && target.id) {
    try {
      const { data: kv } = await admin
        .from('agent_kv')
        .select('value')
        .eq('key', `blog_seo:${target.id}`)
        .limit(1)
      const parsed = JSON.parse(
        String((kv?.[0] as { value?: string } | undefined)?.value || '{}'),
      ) as { meta_description?: string }
      description = (parsed.meta_description || '').trim()
    } catch {
      /* tanpa kv meta — lanjut ke fallback umum */
    }
  }

  return {
    title: title.slice(0, 65),
    description: (description || FALLBACK_DESC).slice(0, 170),
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug: rawSlug } = await params
  const slug = decodeURIComponent(rawSlug || '').toLowerCase().trim()

  let title = FALLBACK_TITLE
  let description = FALLBACK_DESC

  try {
    const meta = await fetchPostMeta(slug)
    if (meta) {
      title = meta.title
      description = meta.description
    }
  } catch {
    /* DB gagal/tidak tersedia → fallback generik; halaman tetap render. */
  }

  return {
    title,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: `${title} | LuxTradee`,
      description,
      type: 'article',
      siteName: 'LuxTradee',
      locale: 'id_ID',
      url: `/blog/${slug}`,
    },
  }
}

export default function BlogPostLayout({ children }: { children: React.ReactNode }) {
  return children
}
