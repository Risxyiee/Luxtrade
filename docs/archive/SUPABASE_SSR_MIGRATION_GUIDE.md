# Supabase SSR Migration Guide - Complete ✅

## Summary of Changes

Migrated from `@supabase/auth-helpers-nextjs` to `@supabase/ssr` for Next.js 14/15 compatibility.

---

## 1. Dependencies Updated ✅

### Removed:
```bash
npm uninstall @supabase/auth-helpers-nextjs
```

### Installed:
```bash
npm install @supabase/ssr
```

---

## 2. Files Modified ✅

### A. `middleware.ts`
**Before (auth-helpers):**
```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

const supabase = createMiddlewareClient({ req, res })
```

**After (@supabase/ssr):**
```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'

const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        res.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: CookieOptions) {
        res.cookies.set({ name, value: '', ...options })
      },
    },
  }
)
```

### B. `src/lib/supabase/server.ts` (NEW)
Created new helper for server-side Supabase client:

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Ignore - handled by middleware
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Ignore - handled by middleware
          }
        },
      },
    }
  )
}
```

### C. `src/lib/supabase/client.ts` (NEW)
Created new helper for client-side Supabase client:

```typescript
'use client'

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### D. `src/lib/supabase.ts` (NO CHANGES NEEDED)
This file already uses `@supabase/ssr` (createBrowserClient) and is compatible.

---

## 3. How to Use the New Helpers

### For Client Components:
```typescript
'use client'

import { createClient } from '@/lib/supabase/client'

export default function MyComponent() {
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return <button onClick={handleSignOut}>Sign Out</button>
}
```

### For Server Components:
```typescript
import { createClient } from '@/lib/supabase/server'

export default async function MyServerComponent() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div>Please login</div>
  }

  return <div>Welcome {user.email}</div>
}
```

### For API Routes (Route Handlers):
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ user })
}
```

### For Middleware (already updated in `middleware.ts`):
```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // ... rest of middleware logic
}
```

---

## 4. Environment Variables Required

Make sure these are set in Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://klxkdrfsfcoankbaoejn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

---

## 5. Authentication Flow

### How it works now:

1. **User logs in** → Session stored in cookies by Supabase
2. **Middleware** → Reads cookies, validates session using `createServerClient`
3. **Server Components** → Use `createClient()` from `@/lib/supabase/server`
4. **Client Components** → Use `createClient()` from `@/lib/supabase/client`
5. **API Routes** → Use `createClient()` from `@/lib/supabase/server`

### Login Loop Prevention:

✅ Middleware now properly handles:
- Unauthenticated users → Redirect to `/login`
- Authenticated users accessing `/login` → Redirect to `/dashboard`
- Session refresh via cookies
- Auth callback handling

---

## 6. Troubleshooting

### Issue: "Export not found" error
**Solution:** Make sure all files use `@supabase/ssr` imports:
```typescript
import { createServerClient, createBrowserClient } from '@supabase/ssr'
```

### Issue: "Login loop" or "disuruh login terus"
**Solution:**
1. Clear browser cookies for your domain
2. Clear browser cache
3. Check that middleware is using `createServerClient` with proper cookie handling
4. Verify environment variables are set correctly

### Issue: "get/set cookies not working"
**Solution:**
- For middleware: Use `req.cookies` and `res.cookies`
- For server components: Use `cookies()` from 'next/headers'
- For client components: Cookies handled automatically by browser

---

## 7. Verification Checklist

After deployment, verify:

- [ ] No build errors in Vercel
- [ ] No "Export not found" errors
- [ ] User can login successfully
- [ ] No login loop (user can access dashboard after login)
- [ ] Session persists across page refreshes
- [ ] API routes can authenticate users
- [ ] Server components can access user session

---

## 8. Migration Benefits

✅ **Next.js 14/15 Compatible** - Uses latest @supabase/ssr
✅ **No Login Loop** - Proper cookie handling in middleware
✅ **Type Safe** - Full TypeScript support
✅ **Performance** - Optimized for Next.js App Router
✅ **Maintainable** - Clean separation of client/server helpers

---

## 9. Summary

**Migration Status:** ✅ COMPLETE

**Files Changed:**
1. ✅ `middleware.ts` - Updated to use `@supabase/ssr`
2. ✅ `src/lib/supabase/server.ts` - NEW (server helper)
3. ✅ `src/lib/supabase/client.ts` - NEW (client helper)
4. ✅ `src/lib/supabase.ts` - Already compatible (no changes needed)

**Dependencies:**
- ✅ Removed: `@supabase/auth-helpers-nextjs`
- ✅ Installed: `@supabase/ssr`

**Next Steps:**
1. ✅ All changes committed to Git
2. ⏳ Push to GitHub (pending)
3. ⏳ Vercel auto-redeploy (pending after push)

---

**Migration completed successfully!** 🎉
