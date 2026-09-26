import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard - LuxTradee',
  description: 'Kelola trading journal, analisis performa, dan AI insights Anda.',
  robots: { index: false, follow: false },
  other: {
    // WebView/TWA compatibility - ensure latest rendering engine
    'http-equiv:X-UA-Compatible': 'IE=edge',
  },
}

export const viewport: Viewport = {
  // Optimize for mobile WebView/TWA - prevent zoom issues
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  // Theme color for TWA status bar
  themeColor: '#050507',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Preconnect hints for critical API endpoints - speeds up initial API calls */}
      <link rel="preconnect" href="/api" />
      <link rel="preconnect" href="/api/trades" />
      <link rel="preconnect" href="/api/analytics" />
      {/* DNS prefetch for external services */}
      <link rel="dns-prefetch" href="//supabase.co" />
      {/* Preload the dashboard route for faster subsequent visits */}
      <link rel="prefetch" href="/dashboard" />
      {children}
    </>
  )
}
