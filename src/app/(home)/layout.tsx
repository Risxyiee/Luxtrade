import type { Metadata } from 'next'

/**
 * Layout rute HOME (/) — metadata khusus halaman depan.
 *
 * LATAR (audit SEO teknis 2026-11-12): semua halaman publik memakai
 * metadata default root layout (title 91 char kembar semua, tanpa
 * canonical). Halaman home adalah 'use client' → metadata tidak bisa
 * diekspor dari page-nya; solusi standar App Router: layout server
 * per rute. Canonical '/' hanya diatur DI SINI (bukan di root layout)
 * supaya rute lain tidak mewarisi canonical home secara keliru.
 */
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: {
    title: 'LuxTradee — Jurnal Trading AI untuk Trader Indonesia',
    description:
      'Jurnal trading AI untuk trader Indonesia: impor CSV MT4/MT5, screenshot auto-dibaca AI, deteksi pola kesalahan, equity curve & analisis psikologi. Gratis dimulai.',
    type: 'website',
    siteName: 'LuxTradee',
    locale: 'id_ID',
    url: '/',
  },
}

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return children
}
