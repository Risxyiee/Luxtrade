#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# capacitor-build.sh
#
# Complete Capacitor build script that:
# 1. Patches all routes for static export compatibility
# 2. Runs next build with output: 'export'
# 3. If EISDIR error occurs (known Next.js bug with API routes),
#    manually completes the export by copying HTML/assets from .next/ to out/
# 4. Unpatches all routes (restores original code for Cloudflare)
# ═══════════════════════════════════════════════════════════════════════════════

set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🏗️  [cap-build] Starting Capacitor static export build..."
echo ""

# ─── 1. Clean previous build ──────────────────────────────────────────────────
echo "🧹 Cleaning previous build..."
rm -rf out .next

# ─── 2. Patch routes ──────────────────────────────────────────────────────────
bash scripts/capacitor-patch-routes.sh

# ─── 3. Build with output: 'export' ───────────────────────────────────────────
echo ""
echo "🔨 Running Next.js build with CAPACITOR_BUILD=true..."
CAPACITOR_BUILD=true npx next build 2>&1 | tee /tmp/cap-build.log
build_rc=$?

# Check if EISDIR error occurred
is_eisdir=0
if grep -q "EISDIR" /tmp/cap-build.log 2>/dev/null; then
  is_eisdir=1
fi

# ─── 4. Handle EISDIR bug by manual export ────────────────────────────────────
if [ $build_rc -ne 0 ] && [ $is_eisdir -eq 1 ]; then
  echo ""
  echo "🔧 EISDIR bug detected — performing manual export..."

  # Remove partial output and API artifacts
  rm -rf out
  rm -rf .next/server/app/api 2>/dev/null || true
  rm -f .next/server/app/api.body .next/server/app/api.rsc .next/server/app/api.meta 2>/dev/null || true

  # ── Manual export using Node.js for reliability ──
  node -e "
    const fs = require('fs');
    const path = require('path');

    const serverDir = '.next/server/app';
    const outDir = 'out';

    // Create output directory
    fs.mkdirSync(outDir, { recursive: true });

    // Copy _next/static assets
    const staticSrc = '.next/static';
    const staticDest = path.join(outDir, '_next', 'static');
    if (fs.existsSync(staticSrc)) {
      fs.mkdirSync(path.dirname(staticDest), { recursive: true });
      fs.cpSync(staticSrc, staticDest, { recursive: true });
    }

    // Copy public files
    const publicDir = 'public';
    if (fs.existsSync(publicDir)) {
      const files = fs.readdirSync(publicDir);
      for (const file of files) {
        const src = path.join(publicDir, file);
        const dest = path.join(outDir, file);
        if (fs.statSync(src).isDirectory()) {
          fs.cpSync(src, dest, { recursive: true });
        } else {
          fs.copyFileSync(src, dest);
        }
      }
    }

    // Copy HTML pages from .next/server/app/
    let htmlCount = 0;
    function copyPages(dir, outPath) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(dir, entry.name);
        const destPath = path.join(outPath, entry.name);

        if (entry.name.startsWith('_')) continue; // Skip internal files
        if (entry.name === 'api') continue; // Skip API routes

        if (entry.isDirectory()) {
          // Check if there's a corresponding .html file (parallel routes)
          const htmlFile = srcPath + '.html';
          if (fs.existsSync(htmlFile)) {
            // This is a page with nested routes
            fs.mkdirSync(destPath, { recursive: true });
            fs.copyFileSync(htmlFile, path.join(destPath, 'index.html'));
            htmlCount++;
          }
          // Recurse into directory for nested pages
          copyPages(srcPath, destPath);
        } else if (entry.name.endsWith('.html')) {
          // Get the page name without .html
          const pageName = entry.name.slice(0, -5);
          if (pageName === 'index') {
            // Root page
            fs.copyFileSync(srcPath, path.join(outPath, 'index.html'));
          } else {
            // Create directory and copy as index.html
            const pageDir = path.join(outPath, pageName);
            fs.mkdirSync(pageDir, { recursive: true });
            fs.copyFileSync(srcPath, path.join(pageDir, 'index.html'));
          }
          htmlCount++;
        }
      }
    }

    copyPages(serverDir, outDir);
    console.log('  ✅ Manually exported ' + htmlCount + ' HTML pages');
  "

  # Check if index.html exists
  if [ -f "out/index.html" ]; then
    build_rc=0
    echo "  ✅ Manual export successful!"
  else
    echo "  ❌ Manual export failed — index.html not found"
    build_rc=1
  fi
fi

# ─── 5. Final cleanup ─────────────────────────────────────────────────────────
echo ""
echo "🧹 Final cleanup — removing API artifacts from output..."
rm -rf out/api 2>/dev/null || true

# ─── 6. Verify output ──────────────────────────────────────────────────────────
if [ -f "out/index.html" ]; then
  file_count=$(find out -type f | wc -l)
  echo "✅ Build output: out/ ($file_count files)"
  echo "📄 index.html exists: YES"
else
  echo "❌ Build failed: out/index.html not found"
  build_rc=1
fi

# ─── 7. Unpatch routes (always, even on failure) ──────────────────────────────
echo ""
bash scripts/capacitor-unpatch-routes.sh

echo ""
if [ $build_rc -eq 0 ]; then
  echo "🎉 [cap-build] Capacitor build completed successfully!"
else
  echo "❌ [cap-build] Capacitor build failed!"
fi

exit $build_rc
