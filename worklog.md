---
Task ID: 1
Agent: Main Agent
Task: Critical backend audit + fix + luxurious equity curve + account saldo info

Work Log:
- Ran comprehensive audit of 105 API route files and 98+ frontend components
- Fixed CRITICAL: delete-account route used wrong Prisma model names (db.journal→db.journalEntry, db.mission→db.missionProgress), also added missing cascade deletes for weeklyGoal, socialLink, tag
- Fixed HIGH: 12 silent catches across 8 files — all AI routes (analyze-trade, chat, generate-image, search, tts, vlm, insight), tags (GET+POST), admin/email-broadcast (GET+POST), admin/withdrawals
- Fixed MEDIUM: admin/reward-bug and bugs route only checked role==='ADMIN' — added SUPER_ADMIN check
- Fixed MEDIUM: admin/social-links used non-existent column 'name' → changed to 'full_name' (both /route.ts and /[id]/route.ts)
- Rebuilt /api/analytics to use real trading account initial_balance instead of hardcoded $10,000
- Passed tradingAccounts from LuxTradeDashboard → TabContent → DashboardTab
- Completely rewrote DashboardTab.tsx with luxurious equity curve component (LuxuryEquityCurve)
- Equity curve now shows: account name, type badge (BACKTEST/DEMO/REAL), broker, account number, leverage
- Shows current saldo (equity), initial balance, max drawdown in the account info bar
- When multiple accounts exist, shows a scrollable account summary row
- Added peak equity, trough equity, max drawdown, total return in bottom stats bar
- Chart features: gradient stroke (purple→amber), glow effect, animated ambient backgrounds, grid pattern, custom rich tooltip with per-point change percentage
- All lint checks pass (0 errors, 0 warnings)

Stage Summary:
- 15 files modified across 5 critical/medium fixes + 1 major feature rebuild
- No more runtime crash bugs in delete-account
- All AI routes now log errors properly
- SUPER_ADMIN access fixed in 2 admin routes
- Equity curve is now luxurious with real account data and saldo display
