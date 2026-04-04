import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    '.space.z.ai',
    'localhost:3000',
    'localhost',
  ],
};

export default nextConfig;
