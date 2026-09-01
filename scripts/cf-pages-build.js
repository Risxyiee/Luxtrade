// Post-build script: prepare .open-next/assets for Cloudflare Pages deployment.
//
// OpenNext generates .open-next/worker.js (for Workers), but Cloudflare Pages
// expects _worker.js inside the output directory (pages_build_output_dir).
//
// This script:
// 1. Copies worker.js and all its dependencies into .open-next/assets/
// 2. Creates a _worker.js wrapper that serves static assets via env.ASSETS
//    before delegating to the OpenNext worker for SSR
//
// The Cloudflare Pages dashboard build command MUST be: npm run build
// (which calls: npx opennextjs-cloudflare build && node scripts/cf-pages-build.js)

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const openNext = path.join(root, '.open-next');
const assets = path.join(openNext, 'assets');

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

if (!fs.existsSync(openNext)) {
  console.error('❌ .open-next/ directory not found! Did opennextjs-cloudflare build run?');
  process.exit(1);
}

const workerSrc = path.join(openNext, 'worker.js');
if (!fs.existsSync(workerSrc)) {
  console.error('❌ .open-next/worker.js not found!');
  process.exit(1);
}

// 1. Copy the original worker.js as opennext-worker.mjs
const originalWorkerDest = path.join(assets, 'opennext-worker.mjs');
copySync(workerSrc, originalWorkerDest);
console.log('✅ Copied worker.js → assets/opennext-worker.mjs');

// 2. Copy all supporting directories the worker needs for imports
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

// 3. Create _worker.js — the Cloudflare Pages Advanced Mode entrypoint
//    It tries env.ASSETS first for static files, then delegates to the OpenNext worker
const pagesWorkerJs = `// Cloudflare Pages _worker.js — static assets via ASSETS, SSR via OpenNext
import originalWorker from "./opennext-worker.mjs";

const STATIC_EXTENSIONS = new Set([
  ".js", ".mjs", ".cjs", ".css", ".woff", ".woff2", ".ttf", ".otf",
  ".eot", ".ico", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".avif", ".mp4", ".webm", ".mp3", ".ogg", ".wav", ".json", ".xml",
  ".txt", ".webmanifest", ".map",
]);

function isStaticAsset(pathname) {
  if (pathname.startsWith("/_next/static/")) return true;
  if (pathname.startsWith("/_next/image")) return false;
  const dotIndex = pathname.lastIndexOf(".");
  if (dotIndex !== -1) {
    return STATIC_EXTENSIONS.has(pathname.slice(dotIndex).toLowerCase());
  }
  return false;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Try serving static assets via the ASSETS binding first
    if (env.ASSETS && isStaticAsset(url.pathname)) {
      try {
        const response = await env.ASSETS.fetch(request);
        if (response.status !== 404) {
          return response;
        }
        await response.body?.cancel();
      } catch (e) {
        // Fall through to the worker
      }
    }

    // For non-static paths (API routes, RSC, etc.), go directly to the worker.
    // Skip ASSETS for /api/ and /_rsc to avoid serving HTML for JSON endpoints.
    if (url.pathname.startsWith("/api/") || url.searchParams.has("_rsc")) {
      return originalWorker.fetch(request, env, ctx);
    }

    // For HTML pages, try ASSETS first (serves pre-rendered static pages faster)
    if (env.ASSETS) {
      try {
        const response = await env.ASSETS.fetch(request);
        if (response.status !== 404) {
          return response;
        }
        await response.body?.cancel();
      } catch (e) {
        // Fall through to SSR
      }
    }

    // Delegate to the original OpenNext worker for SSR
    return originalWorker.fetch(request, env, ctx);
  },
};
`;

fs.writeFileSync(path.join(assets, '_worker.js'), pagesWorkerJs);
console.log('✅ Created assets/_worker.js (Pages Advanced Mode entrypoint)');

// 4. Verify critical files
const criticalPaths = [
  [path.join(assets, '_worker.js'), 'Pages _worker.js wrapper'],
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

const staticChunksDir = path.join(assets, '_next', 'static', 'chunks');
if (fs.existsSync(staticChunksDir)) {
  const chunkCount = fs.readdirSync(staticChunksDir).length;
  console.log(`✅ Static assets: ${chunkCount} JS chunks in _next/static/chunks/`);
}

console.log('\n🚀 Cloudflare Pages build ready!');
console.log('   pages_build_output_dir: .open-next/assets');
console.log('   _worker.js: Pages wrapper (ASSETS → OpenNext SSR fallback)');
