import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig({
  edge: {
    excludeRoutePatterns: [
      "/api/ai/*",
      "/api/generate-image/*"
    ]
  }
});

// Add buildCommand at the top level
config.buildCommand = "next build";

export default config;