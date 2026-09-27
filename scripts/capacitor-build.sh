#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# capacitor-build.sh
#
# Complete Capacitor build script that:
# 1. Validates preconditions (git repo, env vars)
# 2. Cleans previous build artifacts
# 3. Patches routes for static export compatibility
# 4. Runs `next build` with CAPACITOR_BUILD=true (output: 'export')
# 5. Handles the EISDIR export bug (known Next.js issue with API routes)
# 6. Cleans API route output from out/ (not needed in Capacitor static bundle)
# 7. Verifies the output
# 8. ALWAYS unpatches routes (restores original code for Cloudflare)
#
# The Capacitor mobile app works by:
# - Loading the static HTML/CSS/JS shell from the exported pages
# - Making API calls to the LIVE server (NEXT_PUBLIC_APP_URL) for all
#   dynamic operations (auth, trades, payments, admin, etc.)
# - API routes in the static bundle are stubs that return placeholder JSON;
#   they exist only to satisfy Next.js output: 'export' requirements.
# ═══════════════════════════════════════════════════════════════════════════════

set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🏗️  [cap-build] Starting Capacitor static export build..."
echo ""

# ─── 1. Precondition checks ───────────────────────────────────────────────────
echo "🔍 Precondition checks..."

# Check git repo (needed for patch/unpatch via git checkout)
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "❌ Not inside a git repository. Patch/unpatch requires git."
  exit 1
fi
echo "  ✅ Git repository detected"

# Check for uncommitted changes in src/app/ (would be lost by git checkout)
if ! git diff --quiet src/app/ src/middleware.ts 2>/dev/null; then
  echo "  ⚠️  WARNING: Uncommitted changes detected in src/app/ or src/middleware.ts"
  echo "     These changes may be lost during unpatch. Consider committing first."
  echo "     Proceeding anyway in 3 seconds..."
  sleep 3
fi

# Check that Next.js is available
if ! command -v npx &>/dev/null; then
  echo "❌ npx not found. Ensure Node.js/npm is installed."
  exit 1
fi
echo "  ✅ npx available"

# ─── 2. Clean previous build ──────────────────────────────────────────────────
echo ""
echo "🧹 Cleaning previous build..."
rm -rf out .next
echo "  ✅ Removed out/ and .next/"

# ─── 3. Patch routes ──────────────────────────────────────────────────────────
echo ""
bash scripts/capacitor-patch-routes.sh

# ─── 4. Build with output: 'export' ───────────────────────────────────────────
echo ""
echo "🔨 Running Next.js build with CAPACITOR_BUILD=true..."
echo "   (output: 'export' is enabled via next.config.ts)"
echo ""

CAPACITOR_BUILD=true npx next build 2>&1 | tee /tmp/cap-build.log
build_rc=$?

echo ""
echo "📊 Build exit code: $build_rc"

# Check if EISDIR error occurred
is_eisdir=0
if grep -q "EISDIR" /tmp/cap-build.log 2>/dev/null; then
  is_eisdir=1
  echo "  ⚠️  EISDIR bug detected in build log"
fi

# Check for static generation bailout errors
bailout_errors=0
if grep -q "NEXT_STATIC_GEN_BAILOUT" /tmp/cap-build.log 2>/dev/null; then
  bailout_errors=1
  echo "  ⚠️  NEXT_STATIC_GEN_BAILOUT errors detected in build log"
fi

# ─── 5. Handle build failures ─────────────────────────────────────────────────

if [ $build_rc -ne 0 ] && [ $is_eisdir -eq 1 ]; then
  # ── EISDIR bug: Next.js export fails when API .body files conflict with dirs ──
  echo ""
  echo "🔧 EISDIR bug detected — performing manual export..."

  # Remove partial output and problematic API artifacts
  rm -rf out
  rm -rf .next/server/app/api 2>/dev/null || true
  rm -f .next/server/app/api.body .next/server/app/api.rsc .next/server/app/api.meta 2>/dev/null || true

  # Manual export using Node.js — copies HTML pages and static assets
  # from .next/server/app/ to out/, skipping API routes
  node -e "
    const fs = require('fs');
    const path = require('path');

    const serverDir = '.next/server/app';
    const outDir = 'out';

    if (!fs.existsSync(serverDir)) {
      console.error('  ❌ .next/server/app/ not found — build may have failed before compilation');
      process.exit(1);
    }

    fs.mkdirSync(outDir, { recursive: true });

    // Copy _next/static assets
    const staticSrc = '.next/static';
    const staticDest = path.join(outDir, '_next', 'static');
    if (fs.existsSync(staticSrc)) {
      fs.mkdirSync(path.dirname(staticDest), { recursive: true });
      fs.cpSync(staticSrc, staticDest, { recursive: true });
    }

    // Copy _next/build-manifest.json and similar files
    const nextDir = '.next';
    for (const file of ['build-manifest.json', 'react-loadable-manifest.json', 'routes-manifest.json']) {
      const src = path.join(nextDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(outDir, '_next', file));
      }
    }

    // Copy public files
    const publicDir = 'public';
    if (fs.existsSync(publicDir)) {
      const files = fs.readdirSync(publicDir);
      for (const file of files) {
        if (file === 'sw.js') continue; // Skip service worker for Capacitor
        const src = path.join(publicDir, file);
        const dest = path.join(outDir, file);
        if (fs.statSync(src).isDirectory()) {
          fs.cpSync(src, dest, { recursive: true });
        } else {
          fs.copyFileSync(src, dest);
        }
      }
    }

    // Copy HTML pages from .next/server/app/ recursively
    let htmlCount = 0;
    function copyPages(dir, outPath) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(dir, entry.name);
        const destPath = path.join(outPath, entry.name);

        if (entry.name.startsWith('_')) continue;  // Skip _next, _app, etc.
        if (entry.name === 'api') continue;         // Skip API routes entirely

        if (entry.isDirectory()) {
          // Check if there's a corresponding .html file at this level
          const htmlFile = srcPath + '.html';
          if (fs.existsSync(htmlFile)) {
            fs.mkdirSync(destPath, { recursive: true });
            fs.copyFileSync(htmlFile, path.join(destPath, 'index.html'));
            htmlCount++;
          }
          // Recurse into directory for nested pages
          copyPages(srcPath, destPath);
        } else if (entry.name.endsWith('.html')) {
          const pageName = entry.name.slice(0, -5);
          if (pageName === 'index') {
            fs.copyFileSync(srcPath, path.join(outPath, 'index.html'));
          } else {
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

  # Check if manual export succeeded
  if [ -f "out/index.html" ]; then
    build_rc=0
    echo "  ✅ Manual export successful!"
  else
    echo "  ❌ Manual export failed — index.html not found"
    build_rc=1
  fi

elif [ $build_rc -ne 0 ] && [ $bailout_errors -eq 1 ]; then
  # ── Bailout errors: Some routes still use dynamic features ──
  echo ""
  echo "⚠️  NEXT_STATIC_GEN_BAILOUT errors detected."
  echo "   This means some routes still use cookies()/headers()/dynamic features"
  echo "   that cannot be statically rendered. The patch script may need updating."
  echo ""
  echo "   Common causes:"
  echo "     - New API routes using createClient() without CAPACITOR_BUILD bailout"
  echo "     - New pages using force-dynamic without being patched"
  echo "     - Library code calling cookies()/headers() at module level"
  echo ""
  echo "   Attempting to continue with partial output..."
  # Check if any output was generated despite errors
  if [ -f "out/index.html" ]; then
    echo "  ✅ Partial output found — continuing"
    build_rc=0
  else
    echo "  ❌ No output generated"
  fi
fi

# ─── 6. Final cleanup ─────────────────────────────────────────────────────────
echo ""
echo "🧹 Final cleanup — removing API artifacts from output..."
rm -rf out/api 2>/dev/null || true

# Remove service worker files (not needed in Capacitor)
rm -f out/sw.js out/sw.js.map 2>/dev/null || true
rm -rf out/_next/static/sw 2>/dev/null || true

# ─── 7. Verify output ──────────────────────────────────────────────────────────
echo ""
echo "📊 Verifying build output..."

if [ -f "out/index.html" ]; then
  file_count=$(find out -type f 2>/dev/null | wc -l)
  html_count=$(find out -name "*.html" -type f 2>/dev/null | wc -l)
  echo "  ✅ out/index.html exists"
  echo "  📁 Total files: $file_count"
  echo "  📄 HTML pages: $html_count"

  # List key pages
  for page in \
    "out/index.html" \
    "out/auth/login/index.html" \
    "out/dashboard/index.html" \
    "out/upgrade/index.html" \
    "out/blog/index.html"; do
    if [ -f "$page" ]; then
      echo "  ✅ $page"
    else
      echo "  ⚠️  $page NOT FOUND"
    fi
  done
else
  echo "  ❌ Build failed: out/index.html not found"
  build_rc=1
fi

# ─── 8. Unpatch routes (ALWAYS, even on failure) ──────────────────────────────
echo ""
echo "🔄 Unpatching routes (restoring original source code)..."
bash scripts/capacitor-unpatch-routes.sh

# ─── 9. Final status ───────────────────────────────────────────────────────────
echo ""
if [ $build_rc -eq 0 ]; then
  echo "🎉 [cap-build] Capacitor build completed successfully!"
  echo ""
  echo "   Next steps:"
  echo "     1. npx cap sync android   — Copy web assets to Android project"
  echo "     2. cd android && ./gradlew assembleRelease  — Build APK"
  echo "     3. Find APK at android/app/build/outputs/apk/release/"
else
  echo "❌ [cap-build] Capacitor build failed!"
  echo ""
  echo "   Troubleshooting:"
  echo "     - Check /tmp/cap-build.log for detailed error messages"
  echo "     - Ensure all new API routes have CAPACITOR_BUILD bailout"
  echo "     - Ensure no new pages use server-side features without being patched"
fi

exit $build_rc
