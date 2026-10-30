import type { NextConfig } from "next";
import withSerwist from "@serwist/next";

// ─── Static Export Mode ─────────────────────────────────────────────────────
// Set CAPACITOR_BUILD=true to enable static export (output: 'export') for
// Capacitor Android/iOS builds. The Cloudflare deployment uses opennextjs-cloudflare
// which does NOT need static export.
const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true';

const nextConfig: NextConfig = {
  compiler: {
    removeConsole: false,
  },

  reactStrictMode: true,

  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  allowedDevOrigins: ['http://127.0.0.1:8080', 'http://localhost:8080', 'http://localhost:3000', 'http://127.0.0.1:3000'],

  serverExternalPackages: [],

  images: {
    unoptimized: true,
    qualities: [100],
  },

  // Enable static export for Capacitor (generates 'out/' directory)
  ...(isCapacitorBuild ? { output: 'export' as const } : {}),

  // BUILD ID UNIK PER BUILD — fix "chart sama kek awal padahal udah diperbaiki".
  // Dulu konstan 'luxtrade-v1' → semua deploy dianggap build yang sama:
  // router cache / RSC prefetch / prerender manifest tidak ke-invalidate
  // → browser & CDN bisa melanjutkan bundle lama. Sekarang tiap build
  // dapat id baru → chunk lama pasti usang → client selalu segar.
  generateBuildId: async () => {
    return `luxtrade-${Date.now().toString(36)}`
  },

  // sw.js WAJIB no-store — kalau ke-cache browser/CDN, Service Worker
  // baru tak pernah terunduh → user terjebak versi lama berhari-hari.
  // SECURITY HEADERS (P0 hardening):
  //  - HSTS          : paksa HTTPS 1 tahun (Cloudflare sudah TLS, ini lapisan browser)
  //  - X-Frame-Options DENY : situs tak bisa di-iframe pihak lain (anti clickjacking)
  //  - nosniff       : browser wajib hormati Content-Type (anti XSS via MIME sniffing)
  //  - Referrer-Policy : jangan bocorkan URL penuh ke situs luar
  //  - Permissions-Policy : kunci kamera/mic/geolokasi ke origin sendiri
  // (CSP belum dipasang — butuh audit inline script dulu, jangan asal pasang.)
  async headers() {
    const securityHeaders = [
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self), payment=()' },
    ]
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
    ]
  },
};

// Service Worker configuration via @serwist/next
// - Production (including Cloudflare OpenNext): ALWAYS enabled (disable: false)
// - Development: disabled by default unless ENABLE_SW=true
// - Capacitor: DISABLED (service workers don't work in Capacitor apps)
// - swDest: "public/sw.js" ensures the file is in the public root
//   so Cloudflare serves it at https://luxtradee.web.id/sw.js
const isDev = process.env.NODE_ENV === "development";
const forceEnableSW = process.env.ENABLE_SW === "true";

// For Capacitor static export, skip Serwist entirely (SW not needed in mobile apps)
// IMPORTANT: swSrc and swDest MUST always be provided — @serwist/next's Zod schema
// validates them as required strings even when disable: true.
const swConfig = {
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: false,
  reloadOnOnline: true,
  // Capacitor: DISABLED (service workers don't work in mobile apps)
  // Production (including Cloudflare OpenNext): ALWAYS enabled (disable: false)
  // Development: disabled by default unless ENABLE_SW=true
  disable: isCapacitorBuild || (isDev && !forceEnableSW),
};

export default withSerwist(swConfig)(nextConfig);
