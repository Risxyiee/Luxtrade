import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages compatibility
  // Do NOT use "standalone" — @cloudflare/next-on-pages handles the build
  // Do NOT set output — let the adapter decide

  compiler: {
    removeConsole: false,
  },

  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  allowedDevOrigins: ['http://127.0.0.1:8080', 'http://localhost:8080', 'http://localhost:3000', 'http://127.0.0.1:3000'],

  // No serverExternalPackages needed — all edge-compatible now

  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
};

export default nextConfig;
