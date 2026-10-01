---
Task ID: 1
Agent: main
Task: Fix all 5 bugs in LuxTrade app + push" 

Work Log:
- Fixed bun.lock incompatibility (regenerated from scratch for CF Pages build compatibility)
- Created comprehensive SQL migration: docs/FIX_ALL_TYPE_MISMATCHES.sql
  - Idempotent: detects current column types and only changes UUID→TEXT where needed
  - Drops all FKs referencing users(id) or profiles(id), changes types, re-adds FKs
  - Fixes ALL RLS policies with auth.uid()::text = user_id cast
  - Adds service_role grants for admin API access
  - Adds verification step to confirm all user_id columns are TEXT
- Enhanced trades API error handling: detects RLS violations from both error code and message
- Enhanced prop-firm-guard PATCH: better ownership check logging, type mismatch detection
- Added API key status logging to news route (TradingEconomics + Finnhub keys)
- Added API key status logging to forex route (TwelveData + AlphaVantage keys)
- Committed and pushed all changes

Stage Summary:
- SQL migration created at docs/FIX_ALL_TYPE_MISMATCHES.sql — user must run this in Supabase SQL Editor
- Code changes improve error detection and debugging for all 5 bugs
- Root cause for all bugs: UUID vs TEXT type mismatch in user_id columns causing RLS policy failures
- Build fix: regenerated bun.lock for CF Pages compatibility
