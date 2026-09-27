#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# capacitor-unpatch-routes.sh
#
# Reverts ALL changes made by capacitor-patch-routes.sh.
# This restores the original source code for Cloudflare deployment.
#
# Strategy:
#   1. Use git checkout to restore all modified files under src/app/ and src/middleware.ts
#   2. Remove .cap-backup files (created by patch script for safety)
#   3. Remove untracked files created by patch (blog/[slug]/layout.tsx)
#
# This script is ALWAYS called at the end of capacitor-build.sh, even on failure,
# to ensure no patches leak into the committed codebase.
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "🔄 [cap-unpatch] Reverting Capacitor route patches..."

cd "$PROJECT_ROOT"

# ─── 1. Revert all git-tracked files under src/app/ ────────────────────────────
# This restores all API route files, page files, metadata files, etc.
# that were modified by the patch script.
git checkout -- src/app/ 2>/dev/null || true
echo "  ✅ Reverted src/app/ to git HEAD"

# ─── 2. Revert middleware.ts ───────────────────────────────────────────────────
git checkout -- src/middleware.ts 2>/dev/null || true
echo "  ✅ Reverted src/middleware.ts to git HEAD"

# ─── 3. Remove .cap-backup files ──────────────────────────────────────────────
# The patch script creates .cap-backup files for safety. Remove them.
backup_count=0
while IFS= read -r -d '' f; do
  rm -f "$f"
  backup_count=$((backup_count + 1))
done < <(find "$PROJECT_ROOT/src" -name "*.cap-backup" -print0 2>/dev/null)

if [ $backup_count -gt 0 ]; then
  echo "  🗑️  Removed $backup_count .cap-backup file(s)"
fi

# ─── 4. Remove untracked files created by patch script ────────────────────────
# blog/[slug]/layout.tsx is created by the patch script and is not tracked by git
BLOG_LAYOUT="src/app/blog/[slug]/layout.tsx"
if [ -f "$BLOG_LAYOUT" ]; then
  # Only remove if it's NOT tracked by git (i.e., it was created by patch)
  if ! git ls-files --error-unmatch "$BLOG_LAYOUT" 2>/dev/null; then
    rm -f "$BLOG_LAYOUT"
    echo "  🗑️  Removed blog/[slug]/layout.tsx (created by patch)"
  fi
fi

echo ""
echo "✅ [cap-unpatch] All routes restored to original state!"

# ─── 5. Verify no leftover patches ────────────────────────────────────────────
# Quick sanity check: ensure no CAPACITOR_BUILD bailout remains in source
if grep -rq "CAPACITOR_BUILD" "$PROJECT_ROOT/src/app/" "$PROJECT_ROOT/src/middleware.ts" 2>/dev/null; then
  echo "  ⚠️  WARNING: CAPACITOR_BUILD references still found in source!"
  echo "     This may indicate incomplete unpatching. Check manually."
else
  echo "  ✅ Verified: No CAPACITOR_BUILD references in source"
fi
