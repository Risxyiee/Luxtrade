# 🛠️ FIX CHECKLIST - SakuraPay Cleanup & Midtrans Setup

## ✅ STEP 1: Remove SakuraPay References
**Estimated Time**: 15 menit

### 1.1 Update `.env.production`
```bash
# BEFORE:
SAKURA_API_ID=your_sakura_api_id_here
SAKURA_API_KEY=your_sakura_api_key_here
SAKURA_ENV=production
SAKURA_CALLBACK_URL=https://luxtradee.web.id/api/payment/callback
SAKURA_RETURN_URL=https://luxtradee.web.id/upgrade
SAKURA_SKIP_SIGNATURE=false

# AFTER: (Delete semua SAKURA_* lines)
# Only keep Midtrans:
MIDTRANS_SERVER_KEY=SB-Mid-server-XXXXX
MIDTRANS_CLIENT_KEY=SB-Mid-client-XXXXX
MIDTRANS_IS_PRODUCTION=false  # atau true kalau sudah production
```

### 1.2 Update `.env.example`
Remove SAKURA references, keep Midtrans:
```bash
# ❌ Delete:
# SAKURA_API_ID=your_sakura_api_id_here
# SAKURA_API_KEY=your_sakura_api_key_here
# SAKURA_ENV=sandbox
# SAKURA_SKIP_SIGNATURE=true

# ✅ Keep:
MIDTRANS_SERVER_KEY=SB-Mid-server-XXXXX
MIDTRANS_CLIENT_KEY=SB-Mid-client-XXXXX
MIDTRANS_IS_PRODUCTION=false
```

### 1.3 Cleanup Code References

**File**: `src/lib/payment/sakura.ts`  
**Action**: Optional delete (tidak used lagi)
```bash
# Jika sudah confirm tidak dipakai di mana2:
rm src/lib/payment/sakura.ts
```

**File**: `.env.production` (reference di komentar)
- Cek kalau ada commented-out `SAKURA_*` lines
- Delete semua, hanya tinggal `# Midtrans Configuration`

---

## ✅ STEP 2: Verify Midtrans Payment Flow

### 2.1 Check Environment Variables di Cloudflare Pages
```bash
Dashboard → Settings → Environment Variables

Verify ada:
✅ MIDTRANS_SERVER_KEY=SB-Mid-server-... (atau production key)
✅ MIDTRANS_CLIENT_KEY=SB-Mid-client-...
✅ MIDTRANS_IS_PRODUCTION=false (untuk sandbox) or true
✅ DATABASE_URL=postgresql://...
✅ NEXT_PUBLIC_SUPABASE_URL=https://...
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY=...
✅ SUPABASE_SERVICE_ROLE_KEY=...
```

### 2.2 Verify Frontend SDK Loading
**File**: `src/app/layout.tsx` (atau root layout)

```typescript
'use client'

import { useEffect } from 'react'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Load Midtrans Snap.js untuk payment popup
    const script = document.createElement('script')
    const isSandbox = process.env.NEXT_PUBLIC_MIDTRANS_ENV !== 'production'
    
    script.src = isSandbox 
      ? 'https://app.sandbox.midtrans.com/snap/snap.js'
      : 'https://app.midtrans.com/snap/snap.js'
    
    script.setAttribute('data-client-key', process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '')
    script.async = true
    
    document.body.appendChild(script)
    
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
  }, [])

  return (
    <html>
      <body>
        {children}
      </body>
    </html>
  )
}
```

**PENTING**: Verify di browser console:
```javascript
// Open DevTools (F12) → Console
console.log(typeof snap)  // Should print: function
```

Jika output `undefined` → Midtrans JS tidak load.

### 2.3 Verify Callback Signature Validation

**File**: `src/app/api/payment/callback/route.ts`

✅ **SHOULD HAVE**:
```typescript
import { verifyMidtransSignature } from '@/lib/payment/midtrans'

export async function POST(request: NextRequest) {
  const body = await request.json()
  
  // 1. Verify signature
  const isValid = await verifyMidtransSignature(
    body.order_id,
    body.status_code,
    body.gross_amount,
    process.env.MIDTRANS_SERVER_KEY!,
    body.signature_key
  )
  
  if (!isValid) {
    console.warn('⚠️ Invalid Midtrans signature:', body.order_id)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }
  
  // 2. Process payment (update database, activate PRO, etc)
  // ... rest of logic
}
```

❌ **SHOULD NOT HAVE**:
- Hardcoded logic without signature check
- Direct update to PRO without verification
- No console.error atau logging

**If missing**: Add signature verification now!

### 2.4 Verify Order Creation API

**File**: `src/app/api/payment/create-order/route.ts` (or `/api/midtrans/create-transaction`)

✅ **SHOULD HAVE**:
```typescript
// 1. Check Midtrans config
const config = getMidtransConfig()
if (!config.configured) {
  return NextResponse.json(
    { error: 'Midtrans not configured' },
    { status: 503 }
  )
}

// 2. Create transaction via Midtrans API
const response = await fetch('https://app.sandbox.midtrans.com/snap/v1/transactions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString('base64')}`
  },
  body: JSON.stringify(parameter)
})

// 3. Return token ke frontend
const { token, redirect_url } = await response.json()
return NextResponse.json({ token, paymentUrl: redirect_url })
```

---

## ✅ STEP 3: Test Payment Flow Manually

### 3.1 Test Sandbox Payment (RECOMMENDED FIRST)

**Setup**:
```
Environment: Sandbox
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_SERVER_KEY=SB-Mid-server-...
MIDTRANS_CLIENT_KEY=SB-Mid-client-...
```

**Test Case 1: Complete Payment**
```
1. Go to https://luxtradee.web.id/upgrade
2. Click "Upgrade to PRO"
3. Select plan: PRO_30_DAYS
4. Click "Bayar Sekarang"
5. Payment modal should open (Midtrans Snap)
6. Click "Transfer Bank"
7. Select bank → "Continue"
8. Should see payment instructions
9. Use test card (Midtrans docs): 4111111111111111
10. Complete payment → Redirect to success page
11. Check database: User should be PRO now
```

**Expected Flow**:
- Modal opens → Card/Bank options visible
- Payment processed → Webhook received
- User PRO activated → Dashboard shows "PRO" badge

**If fails**:
- [ ] Check browser console for JS errors
- [ ] Verify MIDTRANS_CLIENT_KEY set
- [ ] Verify Snap.js loaded (check Network tab)
- [ ] Check server logs: `MIDTRANS_SERVER_KEY` exists

### 3.2 Test Webhook Signature

**Steps**:
1. Complete payment di Snap
2. Check server logs for webhook received
3. Verify signature validation passed
4. Check database: `payment_orders` table updated

**If webhook not received**:
- Verify callback URL correct di Midtrans dashboard:
  ```
  Settings → Notification URL → Finish URL: https://luxtradee.web.id/api/payment/callback
  ```

### 3.3 Test Failure Cases

**Test Case: Invalid Signature**
```bash
curl -X POST https://luxtradee.web.id/api/payment/callback \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "LUX-TEST-123",
    "status_code": "200",
    "gross_amount": "39000",
    "signature_key": "INVALID_SIGNATURE"
  }'

# Expected: 403 Forbidden
```

**Test Case: Already PRO**
```
1. Login dengan user yang sudah PRO
2. Go to /upgrade
3. Try payment → Should show: "Akun kamu sudah PRO aktif"
```

---

## ✅ STEP 4: Production Checklist

### 4.1 Switch to Production Midtrans

Jika sudah tested sandbox:

```bash
# In Cloudflare Pages Environment Variables:

CHANGE:
MIDTRANS_IS_PRODUCTION=true (dari false)

AND/OR:

MIDTRANS_SERVER_KEY=Mid-server-xxxxx (production key, bukan SB-Mid-server)
MIDTRANS_CLIENT_KEY=Mid-client-xxxxx (production key, bukan SB-Mid-client)
```

### 4.2 Update Callback URL (if needed)

Jika domain berubah dari dev ke production:

Midtrans Dashboard → Settings → Notification URL
```
Finish URL: https://luxtradee.web.id/api/payment/callback
Error URL: https://luxtradee.web.id/api/payment/error
Pending URL: https://luxtradee.web.id/api/payment/pending
```

### 4.3 Security Review
- [ ] No hardcoded credentials di code
- [ ] MIDTRANS_SERVER_KEY only in Cloudflare env (not in .env files)
- [ ] MIDTRANS_CLIENT_KEY safe to be in browser
- [ ] Signature verification enabled
- [ ] Rate limiting on payment endpoints

### 4.4 Monitoring Setup
```typescript
// lib/monitoring.ts
export function logPaymentEvent(event: string, data: any) {
  console.log(`[PAYMENT] ${event}:`, data)
  // TODO: Send to Sentry/Firebase Analytics
}
```

---

## 📋 VERIFICATION COMMANDS

```bash
# 1. Verify env vars exist (local)
echo "MIDTRANS_SERVER_KEY: $MIDTRANS_SERVER_KEY"
echo "MIDTRANS_CLIENT_KEY: $MIDTRANS_CLIENT_KEY"

# 2. Test payment callback (replace with your server)
curl -X POST http://localhost:3000/api/payment/callback \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "LUX-TEST-123",
    "transaction_status": "settlement",
    "payment_type": "bank_transfer",
    "gross_amount": "39000",
    "status_code": "200",
    "signature_key": "test"
  }'

# 3. Check server logs
tail -f .vercel/output/functions/api/payment/callback.log
```

---

## 🚀 FINAL DEPLOYMENT STEPS

1. ✅ Remove all SakuraPay env vars
2. ✅ Verify Midtrans keys di Cloudflare dashboard
3. ✅ Test payment flow (sandbox first)
4. ✅ Verify callback working
5. ✅ Switch to production keys (if ready)
6. ✅ Monitor first 24 hours for issues
7. ✅ Setup alerts for failed payments

---

## ❓ TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| Snap.js not loading | Verify data-client-key, check CORS |
| Payment modal blank | Check browser console, verify SDK loaded |
| Webhook not received | Verify callback URL di Midtrans dashboard |
| Invalid signature error | Verify SERVER_KEY matches, check order_id |
| Already PRO error | Subscription not expired yet |

---

**Status**: READY FOR IMPLEMENTATION  
**Estimated Time**: 1-2 hours (including testing)  
**Risk Level**: LOW (payment tested in production-like env)

