import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Disable minification for debugging chart issues
  compiler: {
    removeConsole: false,
  },

  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  // Experimental settings to help with large files
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
};

export default nextConfig;
