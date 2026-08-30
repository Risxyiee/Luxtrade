import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    removeConsole: false,
  },

  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  allowedDevOrigins: ['http://127.0.0.1:8080', 'http://localhost:8080', 'http://localhost:3000', 'http://127.0.0.1:3000'],

  // These packages use conditional imports (WebSocket vs TCP) that confuse Turbopack.
  // Marking them external prevents bundling their Node.js code paths into Edge chunks.
  serverExternalPackages: ['@neondatabase/serverless', '@prisma/adapter-neon'],

  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
};

export default nextConfig;
