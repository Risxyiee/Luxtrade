# Task 2-5: Push Notification Backend

## Summary
Created all 6 Push Notification backend files as specified.

## Files Created

1. **`/home/z/my-project/src/lib/web-push.ts`** — Web Push utility
   - VAPID key configuration from env vars
   - `getVapidPublicKey()` — returns public key for frontend
   - `sendPushNotification()` — sends to a single subscription with TTL/urgency, handles 410/404 expired subscriptions
   - `sendPushToUser()` — sends to multiple subscriptions for a user, returns sent count and expired endpoints

2. **`/home/z/my-project/src/app/api/push/vapid-key/route.ts`** — GET endpoint returning VAPID public key (503 if not configured)

3. **`/home/z/my-project/src/app/api/push/subscribe/route.ts`** — POST endpoint to upsert push subscription (by endpoint)

4. **`/home/z/my-project/src/app/api/push/unsubscribe/route.ts`** — POST endpoint to delete push subscription by endpoint

5. **`/home/z/my-project/src/app/api/push/send/route.ts`** — POST endpoint to send push to a single user, auto-cleans expired subscriptions

6. **`/home/z/my-project/src/app/api/push/send-batch/route.ts`** — POST endpoint to broadcast push to multiple users (max 1000), batches 50 concurrent, auto-cleans expired

## Dependencies
- `web-push` package (used in web-push.ts)
- `@/lib/db` (Prisma client, used in subscribe/unsubscribe/send/send-batch routes)
- Prisma model `PushSubscription` with unique `endpoint` field
