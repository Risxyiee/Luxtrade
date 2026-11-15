import type { Metadata } from 'next'

/* FIX AUDIT SEO (2026-11-12): /blog mewarisi metadata default root
   (title 91 char kembar, tanpa canonical). Metadata unik kini hidup di
   layout server rute ini. Metadata PER-SLUG artikel ada di
   blog/[slug]/layout.tsx (generateMetadata). */
export const metadata: Metadata = {
  title: 'Blog & Panduan Trading',
  description:
    'Panduan trading berbahasa Indonesia: sinyal XAUUSD, jam pasar WIB, strategi breakout, manajemen risiko 1–2%, dan psikologi trading — artikel baru tiap hari.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'Blog & Panduan Trading | LuxTradee',
    description:
      'Panduan trading berbahasa Indonesia: sinyal XAUUSD, jam pasar WIB, strategi breakout, manajemen risiko, dan psikologi trading — artikel baru tiap hari.',
    type: 'website',
    siteName: 'LuxTradee',
    locale: 'id_ID',
    url: '/blog',
  },
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children
}
