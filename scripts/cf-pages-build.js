// Post-build script: prepare .open-next/assets for Cloudflare Pages deployment.
//
// OpenNext generates .open-next/worker.js (for Workers), but Cloudflare Pages
// expects _worker.js in the output directory (pages_build_output_dir).
//
// This script:
// 1. Copies worker.js → _worker.js (CF Pages Advanced Mode entrypoint)
// 2. Creates a _worker.js that serves static assets via env.ASSETS
//    before delegating to the OpenNext worker for SSR
// 3. Copies supporting directories (middleware, server-functions, cloudflare,
//    cloudflare-templates, .build) into assets/ so the worker can resolve imports
//
// IMPORTANT: The Cloudflare Pages dashboard build command MUST be: npm run build

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const openNext = path.join(root, '.open-next');
const assets = path.join(openNext, 'assets');

// Copy file or directory recursively
function copySync(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copySync(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

// Verify .open-next exists
if (!fs.existsSync(openNext)) {
  console.error('❌ .open-next/ directory not found! Did opennextjs-cloudflare build run?');
  process.exit(1);
}

// 1. Copy the original worker.js as opennext-worker.mjs (the actual SSR worker)
const workerSrc = path.join(openNext, 'worker.js');
const originalWorkerDest = path.join(assets, 'opennext-worker.mjs');
if (fs.existsSync(workerSrc)) {
  copySync(workerSrc, originalWorkerDest);
  console.log('✅ Copied worker.js → assets/opennext-worker.mjs');
} else {
  console.error('❌ .open-next/worker.js not found!');
  process.exit(1);
}

// 2. Create a custom _worker.js that serves static assets via env.ASSETS
//    and delegates to the OpenNext worker for SSR
const pagesWorkerJs = `// Cloudflare Pages _worker.js — serves static assets then delegates to OpenNext
import originalWorker from "./opennext-worker.mjs";

// Re-export Durable Objects from the original worker
export { DOQueueHandler } from "./.build/durable-objects/queue.js";
export { DOShardedTagCache } from "./.build/durable-objects/sharded-tag-cache.js";
export { BucketCachePurge } from "./.build/durable-objects/bucket-cache-purge.js";

// Paths that should be served as static assets
const STATIC_EXTENSIONS = new Set([
  ".js", ".mjs", ".cjs", ".css", ".woff", ".woff2", ".ttf", ".otf",
  ".eot", ".ico", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".avif", ".mp4", ".webm", ".mp3", ".ogg", ".wav", ".json", ".xml",
  ".txt", ".webmanifest", ".html", ".htm", ".map",
]);

function isStaticAsset(pathname) {
  // _next/static/ is always static
  if (pathname.startsWith("/_next/static/")) return true;
  // _next/image needs to go through the worker (image optimization)
  if (pathname.startsWith("/_next/image")) return false;
  // Check file extension
  const dotIndex = pathname.lastIndexOf(".");
  if (dotIndex !== -1) {
    const ext = pathname.slice(dotIndex).toLowerCase();
    return STATIC_EXTENSIONS.has(ext);
  }
  return false;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Try serving static assets via ASSETS binding first
    if (env.ASSETS && isStaticAsset(url.pathname)) {
      try {
        const response = await env.ASSETS.fetch(request);
        if (response.status !== 404) {
          return response;
        }
        // If ASSETS returns 404, fall through to the worker
        await response.body?.cancel();
      } catch (e) {
        // Fall through to the worker on error
      }
    }

    // Delegate to the original OpenNext worker for SSR and other dynamic routes
    return originalWorker.fetch(request, env, ctx);
  },
};
`;

fs.writeFileSync(path.join(assets, '_worker.js'), pagesWorkerJs);
console.log('✅ Created assets/_worker.js (Pages wrapper with ASSETS support)');

// 3. Copy supporting directories that the worker imports via relative paths
const dirsToCopy = [
  'middleware',
  'server-functions',
  'cloudflare',
  'cloudflare-templates',
  '.build',
];

for (const dir of dirsToCopy) {
  const src = path.join(openNext, dir);
  if (fs.existsSync(src)) {
    copySync(src, path.join(assets, dir));
    console.log(`✅ Copied ${dir}/ → assets/${dir}/`);
  } else {
    console.warn(`⚠️  ${dir}/ not found in .open-next/ (skipping)`);
  }
}

// 4. Verify critical files exist
const criticalPaths = [
  [path.join(assets, '_worker.js'), 'Pages worker wrapper'],
  [path.join(assets, 'opennext-worker.mjs'), 'Original OpenNext worker'],
  [path.join(assets, 'cloudflare', 'init.js'), 'Cloudflare init'],
  [path.join(assets, 'middleware', 'handler.mjs'), 'Middleware handler'],
  [path.join(assets, 'server-functions', 'default', 'handler.mjs'), 'Server function handler'],
];

let hasErrors = false;
for (const [p, label] of criticalPaths) {
  if (!fs.existsSync(p)) {
    console.error(`❌ Missing: ${label} (${path.relative(root, p)})`);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error('\n❌ Build verification failed!');
  process.exit(1);
}

// 5. Verify static assets exist
const staticAssetsDir = path.join(assets, '_next', 'static');
if (!fs.existsSync(staticAssetsDir)) {
  console.warn('⚠️  No _next/static/ directory found in assets/');
} else {
  const chunkCount = fs.readdirSync(path.join(staticAssetsDir, 'chunks')).length;
  console.log(`✅ Static assets: ${chunkCount} JS chunks in _next/static/chunks/`);
}

console.log('\n🚀 Cloudflare Pages build ready in .open-next/assets/');
console.log('   pages_build_output_dir: .open-next/assets');
console.log('   _worker.js: Pages wrapper (serves static via ASSETS, delegates SSR)');
console.log('   opennext-worker.mjs: Original OpenNext SSR worker');
