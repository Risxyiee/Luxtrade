# Capacitor Build Scripts Worklog

---
Task ID: 1
Agent: main
Task: Audit codebase and redesign Capacitor build patch strategy

Work Log:
- Read all three existing scripts (patch, unpatch, build)
- Audited all 155 API route files under src/app/api/
- Found 13 API routes with force-dynamic, 0 with force-static (in committed source)
- Found 7 dynamic [id] route directories needing generateStaticParams
- Identified 16 routes using request.nextUrl.searchParams
- Found src/lib/supabase/server.ts uses cookies() from next/headers — CRITICAL
- Identified /upgrade/page.tsx as the ONLY non-API page using createClient (cookies)
- Found 2 server-component force-dynamic pages (admin, testimonials) using getServerClient
- Found 5 client-component force-dynamic pages (settings, system-health, etc.)
- Middleware uses createServerClient + force-dynamic

Stage Summary:
- Root cause identified: Old patch script blindly forced ALL routes to force-static,
  causing NEXT_STATIC_GEN_BAILOUT because cookies()/headers() cannot run during
  static prerendering
- New strategy: Add CAPACITOR_BUILD bailout BEFORE any dynamic API access,
  then force-static is safe because the bailout returns static JSON first

---
Task ID: 2
Agent: main
Task: Rewrite all three Capacitor build scripts

Work Log:
- Rewrote capacitor-patch-routes.sh with 9 selective steps:
  1. Add CAPACITOR_BUILD bailout to ALL API handlers (runs before cookies/Supabase)
  2. Add force-static to API routes (safe because bailout runs first)
  3. Fix JSDoc comment placement issues
  4. Add generateStaticParams to dynamic [id] API routes
  5. Replace /upgrade/page.tsx with client-only version
  6. Patch force-dynamic pages: client→remove fd, server→replace with stub
  7. Replace middleware.ts with pass-through
  8. Add force-static to metadata files (robots, sitemap, manifest)
  9. Create blog/[slug]/layout.tsx with generateStaticParams
- Rewrote capacitor-unpatch-routes.sh with:
  - git checkout for src/app/ and src/middleware.ts
  - Remove .cap-backup files
  - Remove untracked blog/[slug]/layout.tsx
  - Verify no CAPACITOR_BUILD remains
- Rewrote capacitor-build.sh with:
  - Precondition checks (git repo, uncommitted changes, npx)
  - Build with CAPACITOR_BUILD=true
  - EISDIR bug handling with manual export
  - NEXT_STATIC_GEN_BAILOUT detection and reporting
  - API artifact cleanup (rm -rf out/api)
  - Service worker cleanup
  - Output verification with key page checks
  - ALWAYS unpatch (even on failure)
- Updated next.config.ts to disable Serwist for Capacitor builds

Stage Summary:
- All three scripts rewritten with robust error handling
- next.config.ts: Serwist disabled when CAPACITOR_BUILD=true
- Round-trip test PASSED: patch → verify → unpatch → verify clean
- 155 API routes patched, 0 CAPACITOR_BUILD/force-static remains after unpatch

---
Task ID: 3
Agent: main
Task: Verify build logic and source code safety

Work Log:
- Ran full round-trip test: patch → unpatch → verify
- Confirmed 205 CAPACITOR_BUILD references added during patch
- Confirmed 155 force-static added during patch
- Confirmed ZERO CAPACITOR_BUILD/force-static/generateStaticParams after unpatch
- Verified committed source only has force-dynamic (for Cloudflare)
- Verified next.config.ts is correct (output: 'export' only when CAPACITOR_BUILD=true)

Stage Summary:
- Build scripts are safe: no source code pollution after unpatch
- Cloudflare deployment untouched: only force-dynamic in committed source
- All API routes, Supabase connections, auth routes are intact
