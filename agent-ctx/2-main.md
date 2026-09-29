# Task 2 — Prop Firm Challenge Tracking API Routes

**Agent:** main
**Task ID:** 2
**Status:** Completed

## Work Log

### 1. Created `/api/prop-firm/route.ts` — CRUD for PropFirmRules
- **GET**: Lists all prop firm rules for the authenticated user, filtered by `user_id`, ordered by `created_at` desc
- **POST**: Creates a new prop firm rule with fields: `firm_name`, `challenge_size`, `phase`, `max_drawdown`, `max_daily_drawdown`, `daily_drawdown_type`, `profit_target`, `profit_target_percent`, `min_trading_days`, `profit_split`, `start_date`, `account_id`
- Uses `createClientForApi(req)` for auth
- Uses `req.text()` + `JSON.parse()` pattern to avoid CF Workers stream consumed error
- Uses `edgeCrypto.randomUUID()` for ID generation
- Returns 401 for unauthenticated, 400 for validation errors, 201 on create

### 2. Created `/api/prop-firm/[id]/route.ts` — Update/Delete specific rule
- **PATCH**: Updates any editable field on a prop firm rule. Verifies ownership via `user_id` check before update
- **DELETE**: Deletes a prop firm rule with ownership verification (combined `eq('id', id).eq('user_id', user.id)` pattern)
- Both methods use `createClientForApi(req)` for auth and `req.text()` + `JSON.parse()` for body parsing

### 3. Created `/api/prop-firm/templates/route.ts` — Pre-configured firm templates
- **GET**: Returns static templates for 5 prop firms: FTMO, MFF (MyForexFunds), FundedNext, The5ers, SurgeTrader
- Each template includes: `challenge_sizes`, `max_drawdown`, `max_daily_drawdown`, `daily_drawdown_type`, `profit_target_phase1`, `profit_target_phase2`, `min_trading_days`, `profit_split`, `description`
- No auth required (public reference data)

### 4. Created `/api/prop-firm/calculate/route.ts` — Drawdown calculation
- **POST**: Accepts `{ ruleId, accountId? }` and calculates comprehensive drawdown metrics
- Fetches the prop firm rule (verifies ownership)
- Fetches all trades filtered by `user_id`, optionally `account_id`, and `start_date`
- Calculates:
  - `current_balance` = challenge_size + sum(all trade PnL)
  - `peak_balance` = highest balance reached
  - `current_drawdown` = peak - current balance
  - `current_drawdown_percent` = drawdown relative to peak
  - `daily_pnl` for today
  - `daily_starting_balance` (balance before today's trades)
  - `current_daily_drawdown` with support for both `relative` and `absolute` types
  - `profit_target` (from absolute value or percentage × challenge_size)
  - `progress_percent` = current_pnl / profit_target × 100
  - `days_traded` count (unique trading days)
  - `is_violated` flag with `violation_reason`
- After calculation, updates the rule in DB with computed values (non-fatal on failure)

### Implementation Details
- All routes use `export const dynamic9 = 'force-dynamic'`
- All routes use `createClientForApi(req)` from `@/lib/supabase/server`
- Auth errors return 401, validation errors return 400, not found returns 404
- Body parsing uses `req.text()` + `JSON.parse()` pattern throughout
- Lint passes clean with no errors

## Files Created
- `src/app/api/prop-firm/route.ts`
- `src/app/api/prop-firm/[id]/route.ts`
- `src/app/api/prop-firm/templates/route.ts`
- `src/app/api/prop-firm/calculate/route.ts`
