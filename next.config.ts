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

  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
    // Include the full @opentelemetry/api build output in the standalone trace.
    // OpenNext's edge middleware bundler uses `conditions: ["module"]` which resolves
    // to build/esm/index.js, but Next.js standalone trace only copies build/src/ by default.
    // Without this, Cloudflare Pages builds fail with:
    //   Could not resolve "@opentelemetry/api" (or the resolved ESM path doesn't exist)
    outputFileTracingIncludes: {
      "*": ["./node_modules/@opentelemetry/api/build/**/*"],
    },
  },
};

export default nextConfig;
