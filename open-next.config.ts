import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig({
  edge: {
    excludeRoutePatterns: [
      "/api/ai/*",
      "/api/generate-image/*"
    ]
  },
  // Exclude large static assets from Workers deployment
  // Cloudflare Workers has a 25 MiB per-asset limit
  // Large videos should be served from R2/CDN instead
  assets: {
    exclude: [
      "*.apk",
      "*.mov",
      "demo-tutorial.mp4",
    ]
  }
} as any);

// Add buildCommand at the top level
config.buildCommand = "next build";

export default config;
