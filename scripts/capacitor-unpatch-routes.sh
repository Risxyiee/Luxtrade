#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# capacitor-unpatch-routes.sh
#
# Reverts ALL changes made by capacitor-patch-routes.sh using git checkout.
# This restores the original source code for Cloudflare deployment.
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "🔄 [cap-unpatch] Reverting Capacitor route patches..."

cd "$PROJECT_ROOT"

# Revert ALL source file changes (API routes, pages, metadata files, etc.)
git checkout -- src/app/ 2>/dev/null || true

# Remove the blog layout if it was created by the patch script (untracked file)
BLOG_LAYOUT="src/app/blog/[slug]/layout.tsx"
if [ -f "$BLOG_LAYOUT" ]; then
  if git ls-files --error-unmatch "$BLOG_LAYOUT" 2>/dev/null; then
    : # It's tracked — git checkout already handled it
  else
    rm -f "$BLOG_LAYOUT"
    echo "  🗑️  Removed blog/[slug]/layout.tsx (created by patch)"
  fi
fi

echo "✅ [cap-unpatch] All routes restored to original state!"
