import type { NextConfig } from "next";
import withSerwist from "@serwist/next";

// ─── Static Export Mode ─────────────────────────────────────────────────────
// Set CAPACITOR_BUILD=true to enable static export (output: 'export') for
// Capacitor Android/iOS builds. The Cloudflare deployment uses opennextjs-cloudflare
// which does NOT need static export.
const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true';

const nextConfig: NextConfig = {
  // PERF: buang console.* dari bundle produksi (kecuali error/warn)
  // — kurangi main-thread work + jangan bocorkan detail internal.
  compiler: {
    removeConsole: { exclude: ['error', 'warn'] },
  },

  reactStrictMode: true,

  // PERF: tree-shaking agresif utk library besar — kurangi JS di chunk awal
  // (dashboard entry) → time-to-first-fetch lebih cepat.
  experimental: {
    optimizePackageImports: ['framer-motion', 'lucide-react', 'recharts', 'date-fns'],
  },

  // SECURITY (#4 hardening): jangan paparkan fingerprint "x-powered-by: Next.js"
  // di response header — memperkecil info recon bagi attacker.
  poweredByHeader: false,

  // CATATAN #18: gate eslint/tsc saat build SEMPAT diaktifkan (tsc lokal exit 0)
  // tapi deploy CF jadi gagal/stuck ±20 menit (tidak ada deployment baru) —
  // build env CF berbeda dari sandbox. Di-rollback agar perbaikan keamanan
  // tetap bisa ship. Re-enable nanti setelah build logs CF dicek (butuh
  // CLOUDFLARE_API_TOKEN). Gate tetap jalan via `bun run lint` + tsc manual.
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
  //  - CSP Report-Only  : draft policy TIDAK memblokir apa pun; pelanggaran
  //    dilaporkan ke /api/security/csp-report (log → CF Observability).
  //    Datanya dipakai untuk menyusun CSP ENFORCE tanpa merusak fitur.
  async headers() {
    // DEV-ONLY 'unsafe-eval': React/Next dev runtime (Fast Refresh) memakai
    // eval di main-app.js — tanpa ini CSP enforce memblokirnya → hydration
    // gagal → animasi framer-motion macet di state awal (teks hero opacity 0).
    // Production TETAP ketat tanpa eval (build produksi Next tidak pakai eval).
    const isDevCsp = process.env.NODE_ENV === 'development';
    const securityHeaders = [
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self), payment=()' },
      {
        // SECURITY (audit #16): CSP kini ENFORCE (dulu Report-Only yang tidak
        // memblokir apa pun). Domain Midtrans di-whitelist eksplisit untuk
        // snap.js + iframe pembayaran. 'unsafe-inline' dipertahankan untuk
        // bootstrap Next.js (nonce = project terpisah); pelanggaran tetap
        // terkirim ke /api/security/csp-report (log CF Observability).
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          // static.cloudflareinsights.com = beacon Cloudflare Web Analytics yang
          // diinjeksi otomatis CF pada domain ter-proxy (log csp-report Bos:
          // script-src-elem blocked). Tanpa ini, analytics keblock diam-diam.
          "script-src 'self' 'unsafe-inline' " +
            (isDevCsp ? "'unsafe-eval' " : "") +
            "https://app.midtrans.com https://app.sandbox.midtrans.com https://static.cloudflareinsights.com",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "media-src 'self' https: blob:",
          "font-src 'self' data:",
          "connect-src 'self' https: wss:",
          "worker-src 'self' blob:",
          "manifest-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-src https://app.midtrans.com https://app.sandbox.midtrans.com",
          "frame-ancestors 'none'",
          'report-uri /api/security/csp-report',
        ].join('; '),
      },
    ]
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      // CACHE LIFETIMES (Lighthouse: "Use efficient cache lifetimes") —
      // asset statis public/ tidak ber-fingerprint nama → set TTL panjang
      // + stale-while-revalidate. Ganti konten = naikkan versi nama file
      // (pattern -v2 → -v3) sebagai cache-busting manual.
      // /_next/static/* SUDAH immutable otomatis dari Next (1 tahun).
      {
        source: '/:path*.(png|jpg|jpeg|webp|svg|ico|avif)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' },
        ],
      },
      {
        source: '/screenshots/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' },
        ],
      },
      {
        source: '/luxtradee.apk',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' },
        ],
      },
      // Manifest berubah saat update PWA — TTL 1 hari cukup
      {
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, must-revalidate' },
        ],
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
