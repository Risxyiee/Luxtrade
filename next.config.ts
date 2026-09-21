import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    removeConsole: false,
  },

  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,

  allowedDevOrigins: ['http://127.0.0.1:8080', 'http://localhost:8080', 'http://localhost:3000', 'http://127.0.0.1:3000'],

  // Fix: Use top-level property for Next.js 15
  serverExternalPackages: [],

  images: {
    unoptimized: true,
  },

  // Use stable build ID based on package version
  generateBuildId: async () => {
    return 'luxtrade-v1'
  },
};

export default nextConfig;