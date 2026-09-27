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
// - swDest: "public/sw.js" ensures the file is in the public root
//   so Cloudflare serves it at https://luxtradee.web.id/sw.js
const isDev = process.env.NODE_ENV === "development";
const forceEnableSW = process.env.ENABLE_SW === "true";

export default withSerwist({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: false,
  reloadOnOnline: true,
  // Force-enable in production — always generate sw.js
  // In dev, only enable when explicitly requested
  disable: isDev && !forceEnableSW,
})(nextConfig);
