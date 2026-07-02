import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/admin-dashboard-secret/', '/admin-secure/'],
      },
    ],
    sitemap: 'https://luxtrade.id/sitemap.xml',
  }
}