import type { Metadata } from 'next'

/* FIX AUDIT SEO (2026-11-12): /about mewarisi metadata default root
   (title 91 char kembar, tanpa canonical). Metadata unik kini hidup di
   layout server rute ini — page-nya 'use client' sehingga tidak bisa
   mengekspor metadata sendiri. */
export const metadata: Metadata = {
  title: 'Tentang Kami — Misi & Teknologi AI',
  description:
    'Kenali LuxTradee lebih dekat: kenapa jurnal trading AI ini dibuat, teknologi di baliknya, dan misi kami membantu trader Indonesia naik kelas lewat data — bukan feeling.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'Tentang LuxTradee — Misi & Teknologi AI',
    description:
      'Kenapa jurnal trading AI ini dibuat, teknologi di baliknya, dan misi kami membantu trader Indonesia naik kelas lewat data — bukan feeling.',
    type: 'website',
    siteName: 'LuxTradee',
    locale: 'id_ID',
    url: '/about',
  },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children
}
