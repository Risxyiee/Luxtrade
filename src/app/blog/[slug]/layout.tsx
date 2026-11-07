/**
 * Layout detail blog — konten dirender CLIENT-SIDE dari API
 * /api/blog/posts/[slug] (artikel riil dari blog_posts) dengan fallback
 * statis utk 6 artikel klasik. Tidak ada lagi prerender per-slug: dulu
 * generateStaticParams hard-code 6 slug + force-static → artikel BARU
 * hasil terbitan Farhan berisiko 404 karena slug-nya tidak dikenal build.
 */
export default function BlogPostLayout({ children }: { children: React.ReactNode }) {
  return children
}
