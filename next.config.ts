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

  // NOTE: Do NOT use serverExternalPackages for Cloudflare Pages.
  // @opennextjs/cloudflare needs to bundle everything into Workers-compatible chunks.
  // serverExternalPackages prevents bundling, causing Module not found errors for
  // Node.js natives like 'dns', 'net', 'tls', 'fs'.
  // Neon serverless uses conditional WebSocket/HTTP — it bundles fine without this flag.

  // Force Webpack instead of Turbopack for OpenNext Cloudflare compatibility.
  // Next.js 16 defaults to Turbopack, but OpenNext does not support it.
  // Without this, the Worker crashes at runtime:
  //   "Failed to load external module next/dist/compiled/next-server/app-page-turbo.runtime.prod.js:
  //    TypeError: Cannot read properties of undefined (reading 'require')"
  webpack: (config) => {
    return config;
  },

  outputFileTracingIncludes: {
    "*": ["./node_modules/@opentelemetry/api/build/**/*"],
  },

  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
};

export default nextConfig;
