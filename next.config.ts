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
  },

  // Enable static export for Capacitor (generates 'out/' directory)
  ...(isCapacitorBuild ? { output: 'export' as const } : {}),

  generateBuildId: async () => {
    return 'luxtrade-v1'
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
