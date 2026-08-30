// OpenNext Cloudflare configuration
// See https://opennext.js.org/cloudflare/get-started
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const cloudflareConfig = defineCloudflareConfig({
  // R2 incremental cache — enable it for production
  // to leverage Cloudflare R2 for ISR/SSG caching.
  // See https://opennext.js.org/cloudflare/caching
  // incrementalCache: r2IncrementalCache,
});

// buildCommand is NOT passed through by defineCloudflareConfig,
// so we add it at the top level to prevent recursive build loop.
// Without this, OpenNext detects bun and runs `bun run build`,
// which re-invokes opennextjs-cloudflare build infinitely.
const config = {
  ...cloudflareConfig,
  buildCommand: "next build",
};

export default config;
