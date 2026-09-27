#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# capacitor-patch-routes.sh
#
# Temporarily patches all API routes and metadata files to be compatible with
# Next.js `output: 'export'` (static HTML export) for Capacitor builds.
#
# This script MUST be paired with capacitor-unpatch-routes.sh to revert changes
# after the build completes (even on failure).
#
# Why: Next.js static export requires every route to have
#   `export const dynamic = 'force-static'` (or `revalidate`).
# API routes are normally dynamic, so we patch them only during the
# Capacitor build — the committed source stays untouched for Cloudflare.
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$PROJECT_ROOT/src/app/api"

echo "🔧 [cap-patch] Patching routes for Capacitor static export..."

# ─── 1. Add `export const dynamic = 'force-static'` to all API route files ─────
count=0
while IFS= read -r -d '' f; do
  if ! grep -q "export const dynamic" "$f" 2>/dev/null; then
    # Insert after the first line (covers both import and /** comment starts)
    sed -i '1a\export const dynamic = '\''force-static'\'';' "$f"
    count=$((count + 1))
  elif grep -q "export const dynamic = 'force-dynamic'" "$f" 2>/dev/null; then
    sed -i "s/export const dynamic = 'force-dynamic'/export const dynamic = 'force-static'/" "$f"
    count=$((count + 1))
  fi
done < <(find "$API_DIR" -name "route.ts" -print0 | sort -z)

echo "  ✅ Patched $count API route files with force-static"

# ─── 2. Fix routes where force-static landed inside JSDoc comments ────────────
# The sed '1a' inserts after line 1, which may be '/**' — move it after '*/'
python3 -c "
import os, re
api_dir = '$API_DIR'
for root, dirs, files in os.walk(api_dir):
    for f in files:
        if f == 'route.ts':
            path = os.path.join(root, f)
            with open(path) as fh:
                lines = fh.readlines()
            in_comment = False
            comment_depth = 0
            bad_lines = []
            for i, line in enumerate(lines):
                if '/*' in line and '*/' not in line:
                    in_comment = True
                    comment_depth = i
                if '*/' in line:
                    in_comment = False
                    continue
                if \"export const dynamic = 'force-static'\" in line and in_comment:
                    bad_lines.append(i)
            if bad_lines:
                # Remove bad lines and re-insert after comment end
                for i in reversed(bad_lines):
                    del lines[i]
                # Find comment end
                for i, line in enumerate(lines):
                    if '*/' in line:
                        lines.insert(i + 1, \"export const dynamic = 'force-static';\n\")
                        break
                with open(path, 'w') as fh:
                    fh.writelines(lines)
                print(f'  🔧 Fixed comment placement: {path}')
"

# ─── 3. Add generateStaticParams to dynamic [id] routes ───────────────────────
# Next.js requires generateStaticParams for dynamic segments with output: 'export'
DYNAMIC_DIRS=(
  "trading-accounts/[id]"
  "integrations/[id]"
  "admin/subscriptions/[id]"
  "admin/users/[id]"
  "admin/social-links/[id]"
  "admin/plans/[id]"
  "social-links/[id]"
)

gsp_count=0
for dir in "${DYNAMIC_DIRS[@]}"; do
  route_dir="$API_DIR/$dir"
  if [ -d "$route_dir" ]; then
    # Patch route.ts files in this directory (including nested ones like activate/deactivate)
    while IFS= read -r -d '' f; do
      if ! grep -q "generateStaticParams" "$f" 2>/dev/null; then
        sed -i "/export const dynamic = 'force-static';/a\\
export async function generateStaticParams() { return [{ id: '_' }] }" "$f"
        gsp_count=$((gsp_count + 1))
      fi
    done < <(find "$route_dir" -name "route.ts" -print0)
  fi
done

echo "  ✅ Added generateStaticParams to $gsp_count dynamic route files"

# ─── 4. Patch non-API route files ─────────────────────────────────────────────
# manifest.webmanifest/route.ts
MANIFEST_ROUTE="$PROJECT_ROOT/src/app/manifest.webmanifest/route.ts"
if [ -f "$MANIFEST_ROUTE" ] && ! grep -q "export const dynamic" "$MANIFEST_ROUTE" 2>/dev/null; then
  sed -i '1a\export const dynamic = '\''force-static'\'';' "$MANIFEST_ROUTE"
  echo "  ✅ Patched manifest.webmanifest/route.ts"
fi

# robots.ts
ROBOTS="$PROJECT_ROOT/src/app/robots.ts"
if [ -f "$ROBOTS" ] && ! grep -q "export const dynamic" "$ROBOTS" 2>/dev/null; then
  sed -i "1a\export const dynamic = 'force-static';" "$ROBOTS"
  echo "  ✅ Patched robots.ts"
fi

# sitemap.ts
SITEMAP="$PROJECT_ROOT/src/app/sitemap.ts"
if [ -f "$SITEMAP" ] && ! grep -q "export const dynamic" "$SITEMAP" 2>/dev/null; then
  sed -i "1a\export const dynamic = 'force-static';" "$SITEMAP"
  echo "  ✅ Patched sitemap.ts"
fi

# ─── 5. Create blog/[slug]/layout.tsx with generateStaticParams ──────────────
BLOG_LAYOUT="$PROJECT_ROOT/src/app/blog/[slug]/layout.tsx"
if [ ! -f "$BLOG_LAYOUT" ]; then
  cat > "$BLOG_LAYOUT" << 'BLOGEOF'
export const dynamic = 'force-static'

export async function generateStaticParams() {
  return [
    { slug: 'cara-menggunakan-jurnal-trading-untuk-menjadi-trader-konsisten' },
    { slug: '5-kesalahan-psikologi-trading-paling-umum' },
    { slug: 'manajemen-risiko-trading-pemula' },
    { slug: 'analisis-ai-dalam-trading-modern' },
    { slug: 'membangun-strategi-trading-yang-teruji' },
    { slug: 'mengapa-95-persen-trader-gagal' },
  ]
}

export default function BlogPostLayout({ children }: { children: React.ReactNode }) {
  return children
}
BLOGEOF
  echo "  ✅ Created blog/[slug]/layout.tsx"
fi

# ─── 6. Add static bailout to routes using dynamic request APIs ────────────────
# Routes that access request.nextUrl.searchParams, request.url, etc. will fail
# prerendering with force-static. We add a CAPACITOR_BUILD bailout at the top
# of each handler function that returns a placeholder JSON response.
echo "  🔍 Scanning for routes using dynamic request APIs..."

BAILOUT_CODE='if (process.env.CAPACITOR_BUILD === '\''true'\'') return NextResponse.json({ staticBuild: true });'

bailout_count=0
while IFS= read -r -d '' f; do
  # Check if this route uses dynamic request APIs
  if grep -q "request\.nextUrl\|nextUrl\.searchParams\|request\.url" "$f" 2>/dev/null; then
    # Add bailout right after the opening of each handler function
    # Pattern: "export async function GET(" or POST/PUT/DELETE/PATCH
    # We insert the bailout as the first line inside the try block or function body
    if ! grep -q "CAPACITOR_BUILD" "$f" 2>/dev/null; then
      # Insert after "try {" lines inside exported handler functions
      python3 -c "
import re
path = '$f'
with open(path) as fh:
    content = fh.read()
# Add bailout after 'try {' in exported async functions
bailout = '    if (process.env.CAPACITOR_BUILD === \"true\") return NextResponse.json({ staticBuild: true });\n'
# Match 'try {' inside exported handler functions and insert after it
content = re.sub(r'(export async function \w+\([^)]*\)\s*\{\s*try\s*\{)', r'\1\n' + bailout, content)
# Also handle functions without try block: after the opening {
if 'CAPACITOR_BUILD' not in content:
    content = re.sub(r'(export async function \w+\([^)]*\)\s*\{)', r'\1\n' + bailout, content)
with open(path, 'w') as fh:
    fh.write(content)
"
      bailout_count=$((bailout_count + 1))
    fi
  fi
done < <(find "$API_DIR" -name "route.ts" -print0 | sort -z)

echo "  ✅ Added static bailout to $bailout_count routes with dynamic request APIs"

# ─── 7. Patch non-API pages with force-dynamic ─────────────────────────────────
# Pages like /dashboard/admin use force-dynamic which is incompatible with
# output: 'export'. We change them to force-static for the Capacitor build.
echo "  🔍 Scanning non-API pages for force-dynamic..."
fd_count=0
while IFS= read -r -d '' f; do
  if grep -q "export const dynamic = 'force-dynamic'" "$f" 2>/dev/null; then
    sed -i "s/export const dynamic = 'force-dynamic'/export const dynamic = 'force-static'/" "$f"
    fd_count=$((fd_count + 1))
  fi
done < <(find "$PROJECT_ROOT/src/app" \( -name "page.tsx" -o -name "page.ts" -o -name "layout.tsx" -o -name "layout.ts" \) ! -path "*/api/*" -print0)

echo "  ✅ Patched $fd_count non-API pages from force-dynamic to force-static"

echo "🎉 [cap-patch] All routes patched for Capacitor static export!"

# ─── 8. Pre-clean .next API artifacts to prevent EISDIR export errors ──────────
# Next.js has a known bug where .body files for API routes conflict with
# directories during the export phase (EISDIR error). We remove these
# artifacts after build generates them but before the export copy.
# This is handled by the cap:build script.
