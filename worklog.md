---
Task ID: 1
Agent: Main Agent
Task: Fix all 4 persistent bugs + SQL schema type mismatch

Work Log:
- Identified root cause of SQL FK error: `users.id` (UUID) vs `profiles.id` (TEXT) type mismatch
- Fixed Prisma schema: Changed `users.id`, `user_subscriptions.id/user_id`, `prop_firm_challenges.id/user_id` from UUID to TEXT
- Changed FK references from `users(id)` to `profiles(id)` for UserSubscription and PropFirmChallenge
- Fixed PropFirmGuard PATCH/DELETE ownership check: `String(existing.user_id) !== String(user.id)` to handle UUID/TEXT comparison
- Fixed news API: Commented out empty string API keys in wrangler.toml that override CF secrets; replaced `(request as any).env` with proper `getCloudflareContext().env` via `getEnvVar()` helper
- Fixed forex API: Added `fetchTwelveDataPrice()` using TwelveData `/price` endpoint for real-time prices; same env var fix as news API
- Fixed trades API: Removed `profit_loss` from required fields; added default 0 for `profit_loss` and `close_price`
- Fixed RLS policies: Created comprehensive migration with `auth.uid()::text = user_id` for all tables with TEXT user_id
- Created comprehensive migration SQL at `supabase/migrations/20261001_comprehensive_type_fix.sql`
- Updated `src/lib/cloudflare-bindings.ts` to use `getCloudflareContext()` instead of `(request as any).env`
- Dev server compiles and returns 200

Stage Summary:
- 4 bugs fixed: PropFirmGuard edit, news API, add trade, watchlist prices
- 1 SQL schema error fixed: UUID vs TEXT type mismatch
- Migration SQL created that fixes column types + RLS policies
- wrangler.toml fixed to not override secrets with empty strings
- CF Workers env var access fixed across news/forex/economic-calendar APIs
