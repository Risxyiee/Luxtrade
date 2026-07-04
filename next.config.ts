import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  compiler: {
    removeConsole: false,
  },

  typescript: {
    ignoreBuildErrors: true, // Keep true for now — fixing all TS errors would be a separate task
  },
  reactStrictMode: false, // TODO: Enable after fixing double-render side effects

  // Experimental settings to help with large files
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
};

export default nextConfig;
