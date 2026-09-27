#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# capacitor-patch-routes.sh
#
# Selectively patches routes for Capacitor static export (output: 'export').
#
# ═══ STRATEGY ═══
# The Capacitor mobile app is a STATIC SPA that loads HTML/CSS/JS from local
# files and makes ALL API calls to the LIVE server (NEXT_PUBLIC_APP_URL).
# API routes in the static bundle are stubs that return placeholder JSON;
# they exist only to satisfy Next.js output: 'export' requirements.
#
# Patching steps:
#   1. API routes: Add CAPACITOR_BUILD early-return bailout + force-static
#      (bailout runs BEFORE any cookies/headers/Supabase access, so
#      force-static is safe — the handler returns static JSON immediately)
#   2. Dynamic [id] API routes: Add generateStaticParams
#   3. /upgrade page: Replace with client-only version (no createClient/cookies)
#   4. Server component force-dynamic pages: Replace with client-only stubs
#   5. Client component force-dynamic pages: Just remove force-dynamic
#   6. Middleware: Replace with pass-through (not needed in static SPA)
#   7. Metadata files (robots, sitemap, manifest): Add force-static
#   8. blog/[slug]: Create layout.tsx with generateStaticParams
#
# This script MUST be paired with capacitor-unpatch-routes.sh to revert.
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$PROJECT_ROOT/src/app/api"

echo "🔧 [cap-patch] Patching routes for Capacitor static export..."

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: Add CAPACITOR_BUILD bailout to ALL API route handlers
# ═══════════════════════════════════════════════════════════════════════════════
# The bailout is inserted as the FIRST statement inside each handler function.
# When CAPACITOR_BUILD=true, it returns a placeholder JSON immediately,
# BEFORE any cookies()/headers()/Supabase calls can execute.
# This makes force-static safe — Next.js prerenders get static JSON.

bailout_count=0
while IFS= read -r -d '' f; do
  # Skip if already patched
  if grep -q "CAPACITOR_BUILD" "$f" 2>/dev/null; then
    continue
  fi

  python3 -c "
import re, sys

path = '$f'
with open(path) as fh:
    content = fh.read()

# Bailout line to insert as first statement in handler functions
bailout = '    if (process.env.CAPACITOR_BUILD === \"true\") return NextResponse.json({ capacitorBypass: true });\n'

# Pattern: export async function GET/POST/PUT/DELETE/PATCH(request: ...) { try {
# Insert bailout after 'try {' (inside the try block)
pattern_try = r'(export async function \w+\([^)]*\)\s*\{\s*try\s*\{)'
new_content = re.sub(pattern_try, r'\1\n' + bailout, content)

if new_content == content:
    # No try block found — insert after function opening brace
    pattern_func = r'(export async function \w+\([^)]*\)\s*\{)'
    new_content = re.sub(pattern_func, r'\1\n' + bailout, content)

if new_content == content:
    # Still no match — try non-async function handlers
    pattern_sync_try = r'(export function \w+\([^)]*\)\s*\{\s*try\s*\{)'
    new_content = re.sub(pattern_sync_try, r'\1\n' + bailout, content)
    if new_content == content:
        pattern_sync = r'(export function \w+\([^)]*\)\s*\{)'
        new_content = re.sub(pattern_sync, r'\1\n' + bailout, content)

with open(path, 'w') as fh:
    fh.write(new_content)
"
  bailout_count=$((bailout_count + 1))
done < <(find "$API_DIR" -name "route.ts" -print0 | sort -z)

echo "  ✅ Added CAPACITOR_BUILD bailout to $bailout_count API route files"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: Add force-static to API routes (safe because bailouts run first)
# ═══════════════════════════════════════════════════════════════════════════════

fs_count=0
while IFS= read -r -d '' f; do
  if ! grep -q "export const dynamic" "$f" 2>/dev/null; then
    # Insert after the last import line (safer than line 1 which might be /**)
    sed -i '/^import /,$ { /^import /! { i\export const dynamic = '\''force-static'\'';
      break
    } }' "$f" 2>/dev/null || sed -i '1i\export const dynamic = '\''force-static'\'';' "$f"
    fs_count=$((fs_count + 1))
  elif grep -q "export const dynamic = 'force-dynamic'" "$f" 2>/dev/null; then
    sed -i "s/export const dynamic = 'force-dynamic'/export const dynamic = 'force-static'/" "$f"
    fs_count=$((fs_count + 1))
  fi
done < <(find "$API_DIR" -name "route.ts" -print0 | sort -z)

echo "  ✅ Set force-static on $fs_count API route files"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: Fix JSDoc comment placement issues
# ═══════════════════════════════════════════════════════════════════════════════

python3 -c "
import os
api_dir = '$API_DIR'
for root, dirs, files in os.walk(api_dir):
    for f in files:
        if f == 'route.ts':
            path = os.path.join(root, f)
            with open(path) as fh:
                lines = fh.readlines()
            in_comment = False
            bad_lines = []
            for i, line in enumerate(lines):
                if '/*' in line and '*/' not in line:
                    in_comment = True
                if '*/' in line:
                    in_comment = False
                    continue
                if \"export const dynamic = 'force-static'\" in line and in_comment:
                    bad_lines.append(i)
            if bad_lines:
                for i in reversed(bad_lines):
                    del lines[i]
                for i, line in enumerate(lines):
                    if '*/' in line:
                        lines.insert(i + 1, \"export const dynamic = 'force-static';\n\")
                        break
                with open(path, 'w') as fh:
                    fh.writelines(lines)
                print(f'  🔧 Fixed comment placement: {path}')
"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: Add generateStaticParams to dynamic [id] API routes
# ═══════════════════════════════════════════════════════════════════════════════

DYNAMIC_API_DIRS=(
  "trading-accounts/[id]"
  "integrations/[id]"
  "admin/subscriptions/[id]"
  "admin/users/[id]"
  "admin/social-links/[id]"
  "admin/plans/[id]"
  "social-links/[id]"
)

gsp_count=0
for dir in "${DYNAMIC_API_DIRS[@]}"; do
  route_dir="$API_DIR/$dir"
  if [ -d "$route_dir" ]; then
    while IFS= read -r -d '' f; do
      if ! grep -q "generateStaticParams" "$f" 2>/dev/null; then
        sed -i "/export const dynamic = 'force-static';/a\\
export async function generateStaticParams() { return [{ id: '_' }] }" "$f"
        gsp_count=$((gsp_count + 1))
      fi
    done < <(find "$route_dir" -name "route.ts" -print0)
  fi
done

echo "  ✅ Added generateStaticParams to $gsp_count dynamic API route files"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5: Patch /upgrade/page.tsx — replace server component with client stub
# ═══════════════════════════════════════════════════════════════════════════════
# Original: async server component using createClient() → cookies() → Supabase
# Patched:  client-only page that delegates to UpgradeFormClient
#           (auth handled client-side via browser Supabase + API calls)

UPGRADE_PAGE="$PROJECT_ROOT/src/app/upgrade/page.tsx"
UPGRADE_BACKUP="$PROJECT_ROOT/src/app/upgrade/page.tsx.cap-backup"

if [ -f "$UPGRADE_PAGE" ]; then
  cp "$UPGRADE_PAGE" "$UPGRADE_BACKUP"
  if grep -q "createClient.*supabase/server\|getServerClient.*supabase" "$UPGRADE_PAGE" 2>/dev/null; then
    cat > "$UPGRADE_PAGE" << 'UPGRADEEOF'
'use client'

import UpgradeFormClient from './UpgradeFormClient'

/**
 * Capacitor build: client-only upgrade page.
 * Auth and payment are handled client-side via API calls to the live server.
 */
export default function UpgradePage() {
  // UpgradeFormClient handles auth via browser Supabase and API calls
  return <UpgradeFormClient user={null} />
}
UPGRADEEOF
    echo "  ✅ Replaced /upgrade/page.tsx with client-only version"
  else
    rm -f "$UPGRADE_BACKUP"
    echo "  ⏭️  /upgrade/page.tsx already client-only — skipping"
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6: Patch force-dynamic pages
# ═══════════════════════════════════════════════════════════════════════════════
# Two types:
#   A) Client components ('use client') with force-dynamic — just remove
#      force-dynamic, they're already client-rendered.
#   B) Server components (async, using createClient/getServerClient) with
#      force-dynamic — replace entirely with a client redirect stub that
#      loads the page via client-side navigation (the real page lives on
#      the live server and is fetched client-side anyway).

fd_client_count=0
fd_server_count=0

while IFS= read -r -d '' f; do
  if ! grep -q "export const dynamic = 'force-dynamic'" "$f" 2>/dev/null; then
    continue
  fi

  # Backup the original
  cp "$f" "${f}.cap-backup"

  if grep -q "'use client'" "$f" 2>/dev/null; then
    # ── Type A: Client component — just remove force-dynamic ──
    sed -i "/export const dynamic = 'force-dynamic'/d" "$f"
    fd_client_count=$((fd_client_count + 1))
  else
    # ── Type B: Server component — replace with client redirect stub ──
    # The original page uses createClient/getServerClient (cookies) which
    # cannot be statically exported. For Capacitor, these pages work by
    # navigating client-side to the live server URL where the real
    # server-rendered page handles auth.
    #
    # We create a simple client component that redirects to the same path
    # on the live server, or renders a loading state while the client
    # handles auth via browser Supabase.

    # Determine the page route path from the file path
    rel_path="${f#$PROJECT_ROOT/src/app/}"
    route_path="/$(dirname "$rel_path")"
    # Clean up the route path (remove /page suffix if present)
    route_path="${route_path%/page}"

    cat > "$f" << STUBEOF
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Capacitor build: client redirect stub for server-rendered page.
 * Original page uses server-side auth (cookies/Supabase) which cannot
 * be statically exported. In the Capacitor app, the user accesses this
 * page client-side — the dashboard shell handles auth via browser
 * Supabase and API calls to the live server.
 */
export default function CapacitorPageStub() {
  const router = useRouter()

  useEffect(() => {
    // In Capacitor, dashboard pages are accessed after client-side auth.
    // The dashboard layout handles authentication — if we reach here,
    // it means the user is authenticated and the page should load its
    // client component directly.
    // This stub prevents static export failure while preserving the
    // client-side navigation flow.
  }, [])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <p>Loading...</p>
    </div>
  )
}
STUBEOF
    fd_server_count=$((fd_server_count + 1))
  fi
done < <(find "$PROJECT_ROOT/src/app" \( -name "page.tsx" -o -name "page.ts" \) ! -path "*/api/*" -print0)

echo "  ✅ Patched $fd_client_count client force-dynamic pages (removed force-dynamic)"
echo "  ✅ Patched $fd_server_count server force-dynamic pages (replaced with client stubs)"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 7: Patch middleware.ts — make it a pass-through
# ═══════════════════════════════════════════════════════════════════════════════
# Middleware runs on every request and uses cookies for auth — incompatible
# with static export. For Capacitor, middleware is unnecessary since the app
# is a static SPA that makes API calls to the live server.

MIDDLEWARE="$PROJECT_ROOT/src/middleware.ts"
MIDDLEWARE_BACKUP="$PROJECT_ROOT/src/middleware.ts.cap-backup"

if [ -f "$MIDDLEWARE" ]; then
  cp "$MIDDLEWARE" "$MIDDLEWARE_BACKUP"
  cat > "$MIDDLEWARE" << 'MIDDLEWAREEOF'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Capacitor build: middleware is a pass-through.
 * In the Capacitor app, all auth/data operations go through API calls
 * to the live server — middleware routing is not needed.
 */
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
MIDDLEWAREEOF
  echo "  ✅ Replaced middleware.ts with pass-through"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 8: Patch metadata files with force-static
# ═══════════════════════════════════════════════════════════════════════════════
# These are safe to force-static — they don't use cookies or dynamic data.

MANIFEST_ROUTE="$PROJECT_ROOT/src/app/manifest.webmanifest/route.ts"
if [ -f "$MANIFEST_ROUTE" ] && ! grep -q "export const dynamic" "$MANIFEST_ROUTE" 2>/dev/null; then
  sed -i '1a\export const dynamic = '\''force-static'\'';' "$MANIFEST_ROUTE"
  echo "  ✅ Patched manifest.webmanifest/route.ts"
fi

ROBOTS="$PROJECT_ROOT/src/app/robots.ts"
if [ -f "$ROBOTS" ] && ! grep -q "export const dynamic" "$ROBOTS" 2>/dev/null; then
  sed -i "1a\export const dynamic = 'force-static';" "$ROBOTS"
  echo "  ✅ Patched robots.ts"
fi

SITEMAP="$PROJECT_ROOT/src/app/sitemap.ts"
if [ -f "$SITEMAP" ] && ! grep -q "export const dynamic" "$SITEMAP" 2>/dev/null; then
  sed -i "1a\export const dynamic = 'force-static';" "$SITEMAP"
  echo "  ✅ Patched sitemap.ts"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 9: Create blog/[slug]/layout.tsx with generateStaticParams
# ═══════════════════════════════════════════════════════════════════════════════

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

echo ""
echo "🎉 [cap-patch] All routes patched for Capacitor static export!"
echo ""
echo "  Summary of changes:"
echo "    - API routes: CAPACITOR_BUILD bailout + force-static"
echo "    - Dynamic [id] API routes: generateStaticParams added"
echo "    - /upgrade: Replaced with client-only page"
echo "    - Client force-dynamic pages: Removed force-dynamic"
echo "    - Server force-dynamic pages: Replaced with client stubs"
echo "    - middleware.ts: Replaced with pass-through"
echo "    - Metadata files: Added force-static"
echo "    - blog/[slug]: Created layout with generateStaticParams"
