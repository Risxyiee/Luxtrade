import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  edge: {
    // Skip edge bundling for routes that use node:stream
    excludeRoutePatterns: [
      "/api/ai/*",
      "/api/generate-image/*"
    ]
  }
});
