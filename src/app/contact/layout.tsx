import type { Metadata } from 'next'

/* FIX AUDIT SEO (2026-11-12): /contact mewarisi metadata default root
   (title 91 char kembar, tanpa canonical). Metadata unik kini hidup di
   layout server rute ini. */
export const metadata: Metadata = {
  title: 'Kontak & Komunitas Trader',
  description:
    'Hubungi tim LuxTradee lewat Discord, email, atau media sosial. Laporan bug, usulan fitur, dan kerja sama kami terima — balasan biasanya kurang dari 24 jam.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Kontak LuxTradee — Discord, Email & Media Sosial',
    description:
      'Laporan bug, usulan fitur, dan kerja sama kami terima lewat Discord, email, atau media sosial — balasan biasanya kurang dari 24 jam.',
    type: 'website',
    siteName: 'LuxTradee',
    locale: 'id_ID',
    url: '/contact',
  },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
