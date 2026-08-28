# Task 3a — Notification Agent

## Files Created
1. `src/app/api/notifications/preferences/route.ts` — GET/PUT notification preferences (JSONB in profiles)
2. `src/app/dashboard/components/NotificationPreferences.tsx` — Settings dialog UI with i18n
3. `src/lib/trade-alerts.ts` — `generateTradeAlerts()` function for in-memory alert generation
4. `src/app/api/notifications/send-alert/route.ts` — POST email alert endpoint with rate limiting

## Files Modified
1. `src/components/NotificationCenter.tsx` — Added trade_alert type, severity, preference-based dedup
2. `src/app/dashboard/components/Header.tsx` — Added Settings gear icon, fetches prefs, passes to NotificationCenter

## Key Decisions
- Stored prefs as JSONB column `notification_preferences` on profiles table (auto-created via raw SQL, no Prisma schema change)
- Trade alerts generated client-side in NotificationCenter from trade data + preferences
- Email alerts are server-side only, triggered via POST to `/api/notifications/send-alert`
- Rate limit: 3 alert emails/user/day (in-memory Map)
- All text in Indonesian by default with English option

## Lint Status
- `bun run lint` → 0 errors, 0 warnings