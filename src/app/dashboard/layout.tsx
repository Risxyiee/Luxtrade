import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard - LuxTrade',
  description: 'Kelola trading journal, analisis performa, dan AI insights Anda.',
  robots: { index: false, follow: false },
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}