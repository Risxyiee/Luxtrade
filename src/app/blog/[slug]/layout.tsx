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
 * dari DB (kolom ringan, try/catch fail-open ke metadata generik) supaya
 * tiap artikel punya title unik, description sendiri, dan canonical
 * /blog/<slug> — inti dari pabrik SEO Farhan.
 */
import type { Metadata } from 'next'
import { getCronAdmin } from '@/lib/cron-supabase'

interface PostMetaRow {
  title: string | null
  meta_description: string | null
  excerpt: string | null
}

const FALLBACK_TITLE = 'Artikel & Panduan Trading'
const FALLBACK_DESC =
  'Artikel & panduan trading berbahasa Indonesia dari LuxTradee: analisis pasar, strategi, manajemen risiko, dan psikologi trading.'

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
    if (slug) {
      const admin = await getCronAdmin()
      if (admin) {
        const q = await admin
          .from('blog_posts')
          .select('title,meta_description,excerpt')
          .eq('status', 'published')
          .eq('slug', slug)
          .limit(1)
        const row = (q.data || [])[0] as PostMetaRow | undefined
        if (row?.title && row.title.trim()) title = row.title.trim().slice(0, 65)
        const desc = (row?.meta_description || row?.excerpt || '').trim()
        if (desc) description = desc.slice(0, 170)
      }
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
