# ✅ Midtrans Setup — Complete

SakuraPay has been fully removed. Midtrans Snap is the only payment gateway.

## Active Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/midtrans/create-transaction` | Create Snap transaction (authenticated) |
| `POST /api/midtrans/create-transaction-unverified` | Create Snap transaction (unverified user) |
| `POST /api/midtrans/webhook` | Midtrans notification webhook |
| `GET /api/midtrans/create-transaction` | Config status + Snap.js URL |

## Environment Variables

```bash
MIDTRANS_SERVER_KEY=SB-Mid-server-XXXXX    # or Mid-server-XXXXX (production)
MIDTRANS_CLIENT_KEY=SB-Mid-client-XXXXX    # or Mid-client-XXXXX (production)
MIDTRANS_IS_PRODUCTION=false               # true for production
```

## Frontend Components Using Midtrans

- `LandingCheckoutModal.tsx` — Landing page checkout
- `PlanSelectionModal.tsx` — Dashboard plan upgrade
- `PaymentModal.tsx` — Dashboard payment modal (migrated from SakuraPay)
- `checkout/page.tsx` — Auth checkout page

## Webhook Configuration

Midtrans Dashboard → Settings → Notification URL:
```
https://luxtradee.web.id/api/midtrans/webhook
```

## Legacy DB Fields (still in use, no migration needed)

The `dokuTransactionId` and `dokuPaymentUrl` columns in `payment_orders` table
are legacy names from the SakuraPay era. They now store Midtrans transaction IDs.
Renaming would require a DB migration — not worth the risk.
