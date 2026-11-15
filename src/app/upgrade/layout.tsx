import type { Metadata } from 'next'

/* FIX AUDIT SEO (2026-11-12): /upgrade punya 2 masalah — metadata default
   root (title 91 char kembar, tanpa canonical) DAN jumlah H1 = 0 di HTML
   mentah (konten halaman dirender client-side setelah JS jalan, audit
   tanpa JavaScript tidak melihat heading apa pun).
   Kini: metadata unik di layout server ini + H1 server-rendered (sr-only,
   tidak mengubah desain) yang PASTI muncul di HTML mentah — dibaca audit
   maupun crawler. */
export const metadata: Metadata = {
  title: 'Upgrade Pro — Buka Semua Fitur AI',
  description:
    'Buka semua fitur LuxTradee Pro: analisis AI unlimited, laporan mingguan, prop firm guard. Mulai Rp49.000/bulan atau Lifetime Rp299.000 sekali bayar.',
  alternates: { canonical: '/upgrade' },
  openGraph: {
    title: 'Upgrade Pro LuxTradee — Buka Semua Fitur AI',
    description:
      'Analisis AI unlimited, laporan mingguan, prop firm guard. Mulai Rp49.000/bulan atau Lifetime Rp299.000 sekali bayar.',
    type: 'website',
    siteName: 'LuxTradee',
    locale: 'id_ID',
    url: '/upgrade',
  },
}

export default function UpgradeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* H1 server-rendered (sr-only) — raw HTML wajib punya tepat 1 H1
          (audit SEO: "jumlah H1 = 0 (ideal 1)"). Tidak mengganggu desain:
          disembunyikan visual, tetap terbaca screen reader & crawler. */}
      <h1 className="sr-only">Upgrade Pro LuxTradee — Buka Semua Fitur AI</h1>
      {children}
    </>
  )
}
