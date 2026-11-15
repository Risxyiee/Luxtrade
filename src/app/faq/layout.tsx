import type { Metadata } from 'next'

/* FIX AUDIT SEO (2026-11-12): /faq mewarisi metadata default root
   (title 91 char kembar, tanpa canonical). Metadata unik kini hidup di
   layout server rute ini. */
export const metadata: Metadata = {
  title: 'FAQ — Tanya Jawab Jurnal Trading AI',
  description:
    'Jawaban pertanyaan yang paling sering ditanyakan: fitur gratis vs Pro, harga, keamanan data, impor CSV MT4/MT5, cara kerja AI, install PWA, dan program afiliasi.',
  alternates: { canonical: '/faq' },
  openGraph: {
    title: 'FAQ LuxTradee — Tanya Jawab Jurnal Trading AI',
    description:
      'Fitur gratis vs Pro, harga, keamanan data, impor CSV MT4/MT5, cara kerja AI, install PWA, dan program afiliasi — semua dijawab di sini.',
    type: 'website',
    siteName: 'LuxTradee',
    locale: 'id_ID',
    url: '/faq',
  },
}

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children
}
