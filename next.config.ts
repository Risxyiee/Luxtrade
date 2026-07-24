import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Suppresses source map uploading logs during build
  silent: true,

  // Upload source maps for better stack traces
  hideSourceMaps: true,

  // Keep automatic instrumentation enabled (our sentry.*.config.ts files handle init)
  disableAutomaticInstrumentation: false,

  // Expands the build scope for better coverage
  widenClientFileUpload: true,

  // Enables automatic release annotation via Vercel
  automaticVercelMonitorsIntegration: true,
});
