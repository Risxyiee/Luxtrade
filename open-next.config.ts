import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig({
  edge: {
    excludeRoutePatterns: [
      "/api/ai/*",
      "/api/generate-image/*"
    ]
  },
  // Exclude large static assets from Workers deployment
  // These are served from R2 or external CDN instead
  assets: {
    exclude: [
      "*.apk",
      "demo-tutorial.mp4",
      "*.mov"
    ]
  }
} as any);

// Add buildCommand at the top level
config.buildCommand = "next build";

export default config;
