# Production Error Fixes - 2026-06-04

## Issues Fixed

### 1. ✅ Supabase Cookie Compatibility Issue

**Error:**
```
TypeError: t.getAll is not a function
at Object.getAll (.next/server/chunks/[root-of-the-server]__845e7a75._js:1:4081)
Node.js process exited with exit status: 128
```

**Root Cause:**
- Next.js 16 changed the cookies API in App Router
- Using `cookies()` from 'next/headers' directly in route handlers causes crashes
- The `cookieStore.getAll()` method is not compatible with Supabase's SSR client

**Solution:**
Created a shared helper function and updated all API routes:

1. **Created helper:** `src/lib/supabase/server-client.ts`
   - Uses NextRequest cookies API instead of next/headers
   - Compatible with Next.js 16 App Router

2. **Updated 7 API routes:**
   - `src/app/api/trading-accounts/[id]/route.ts`
   - `src/app/api/metaapi/connect/route.ts`
   - `src/app/api/integrations/[id]/route.ts`
   - `src/app/api/integrations/route.ts`
   - `src/app/api/trading-accounts/cleanup-pending/route.ts`
   - `src/app/api/trading-accounts/quota/route.ts`
   - `src/app/api/trading-accounts/cleanup-orphan/route.ts`

**Pattern Changed:**
```typescript
// OLD (causing crash):
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const cookieStore = cookies()
const supabase = createServerClient(...)

// NEW (fixed):
import { createSupabaseClient } from '@/lib/supabase/server-client'

const supabase = await createSupabaseClient(req)
```

### 2. ⚠️ OpenAI API Quota Exceeded

**Error:**
```
OpenAI API error: 429 {
    "error": {
        "message": "You exceeded your current quota, please check your plan and billing details.",
        "type": "insufficient_quota",
        "code": "insufficient_quota"
    }
}
```

**Impact:**
- VLM OCR screenshot analysis is failing
- Auto-fill trade details from screenshots not working

**Solution Required:**

#### Option A: Increase OpenAI Quota (Recommended for Production)
1. Go to [OpenAI Platform](https://platform.openai.com/account/usage)
2. Check current billing and quota limits
3. Upgrade plan or add credits
4. Set usage limits appropriately

#### Option B: Implement Fallback to Manual Entry
The application already has error handling, but we can improve UX:

```typescript
// Current behavior:
- Shows error toast
- User must manually enter trade details

// Improved behavior (future):
- VLM fails → Show friendly message
- Offer to retry or skip to manual entry
- Cache screenshot for later retry
```

#### Option C: Use Alternative OCR Provider
For future consideration:
- Google Cloud Vision API
- Amazon Textract
- Azure Computer Vision
- Local OCR with Tesseract.js

### 3. ✅ Delete Account Button Visibility

**Issue:**
- Delete button was only visible on hover
- Users couldn't easily find delete functionality

**Solution:**
- Button now always visible with opacity-60
- Hover effect increases opacity to 100%
- Allows deleting any account except the last one
- Auto-promotes another account if default is deleted

## Testing Checklist

- [x] Delete account functionality works
- [x] Delete button is visible on all accounts
- [x] Can delete default accounts
- [x] Auto-promotion of new default account works
- [x] All API routes use new cookie helper
- [x] No "TypeError: t.getAll is not a function" errors
- [ ] OpenAI VLM OCR works (needs quota increase)

## Environment Variables Required

For production deployment on Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## Next Steps

1. **OpenAI Quota:** Check and increase OpenAI quota or implement fallback
2. **Monitor:** Watch logs for any remaining cookie errors
3. **Test:** Test delete account functionality thoroughly in production

## Deployment Status

✅ All fixes committed and pushed to GitHub
✅ Ready for production deployment
⚠️ OpenAI quota issue requires manual action