import { MetadataRoute } from 'next'
import { getCronAdmin } from '@/lib/cron-supabase'
import { slugify } from '@/lib/blog-html'

/**
 * SITEMAP DINAMIS (FIX SEO 11 Nov):
 * Dulu hanya 3 URL statis — artikel blog yang diterbitkan tim AI tidak
 * PERNAH ada di sitemap → Google tidak tahu halamannya ada → tidak
 * diindeks → trafik organic 0 walau artikel menumpuk.
 *
 * Kini: halaman statis publik + /blog + SEMUA artikel blog_posts
 * status='published' (maks 500, fallback slug dari judul bila kolom
 * slug kosong). DB gagal → tetap HTTP 200 dengan daftar statis
 * (degrade gracefully, pola api/blog/posts).
 *
 * IndexNow (Bing/Yandex/dll) diping otomatis oleh lib/seo-publish.ts
 * setiap artikel baru terbit; Google membaca sitemap ini.
 */

export const dynamic = 'force-dynamic'

const BASE = 'https://luxtradee.web.id'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const statics: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/auth/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    /* Halaman legal — WAJIB publik & terindeks (syarat review TikTok
       Login Kit: tautan aktif & terlihat tanpa membuka menu). */
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${BASE}/disclaimer`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/refund-policy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/upgrade`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/affiliate`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/auth/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ]

  try {
    const admin = await getCronAdmin()
    if (!admin) return statics
    const { data, error } = await admin
      .from('blog_posts')
      .select('slug,title,created_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error || !data?.length) return statics

    const posts: MetadataRoute.Sitemap = (data as Array<{ slug: string | null; title: string; created_at: string }>)
      .map((r) => ({
        url: `${BASE}/blog/${encodeURIComponent(r.slug || slugify(r.title))}`,
        lastModified: r.created_at ? new Date(r.created_at) : now,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }))
    return [...statics, ...posts]
  } catch {
    return statics
  }
}
