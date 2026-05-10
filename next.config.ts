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
};

export default nextConfig;
