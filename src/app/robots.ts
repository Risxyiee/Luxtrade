import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin-dashboard-secret/', '/admin-secure/'],
      },
    ],
    sitemap: 'https://luxtradee.web.id/sitemap.xml',
  }
}