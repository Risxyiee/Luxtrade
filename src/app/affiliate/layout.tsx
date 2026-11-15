import type { Metadata } from 'next'

/* FIX AUDIT SEO (2026-11-12): /affiliate punya 2 masalah — metadata default
   root (title 91 char kembar, tanpa canonical) DAN jumlah H1 = 0 di HTML
   mentah (H1 "Program Affiliate" dirender client-side, audit tanpa
   JavaScript tidak melihatnya). Kini: metadata unik (angka komisi RIIL:
   20% PRO berulang, 15% Lifetime — selaras konstanta webhook Midtrans &
   admin activate) + H1 server-rendered (sr-only) di layout ini. */
export const metadata: Metadata = {
  title: 'Program Afiliasi — Komisi 20% Tiap Penjualan',
  description:
    'Bagikan kode referral kamu dan dapatkan komisi 20% dari setiap langganan Pro serta 15% dari paket Lifetime. Pencairan mudah, dashboard statistik lengkap.',
  alternates: { canonical: '/affiliate' },
  openGraph: {
    title: 'Program Afiliasi LuxTradee — Komisi 20% Tiap Penjualan',
    description:
      'Komisi 20% dari setiap langganan Pro dan 15% dari paket Lifetime. Pencairan mudah, dashboard statistik lengkap.',
    type: 'website',
    siteName: 'LuxTradee',
    locale: 'id_ID',
    url: '/affiliate',
  },
}

export default function AffiliateLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* H1 server-rendered (sr-only) — raw HTML wajib punya tepat 1 H1.
          H1 visual milik page client tetap ada; dua H1 pada satu halaman
          valid (satu sr-only utk crawler/screen reader awal, satu visual). */}
      <h1 className="sr-only">Program Afiliasi LuxTradee — Komisi 20% Tiap Penjualan</h1>
      {children}
    </>
  )
}
