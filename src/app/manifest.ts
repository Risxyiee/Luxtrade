import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LuxTradee — AI Trading Journal Indonesia',
    short_name: 'LuxTradee',
    description: 'AI-powered trading journal untuk trader forex Indonesia. Track, analisis, & tingkatkan performa trading kamu.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    scope: '/',
    lang: 'id',
    dir: 'ltr',
    theme_color: '#050507',
    background_color: '#050507',
    categories: ['finance', 'business', 'education'],
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [],
    prefer_related_applications: false,
  }
}
