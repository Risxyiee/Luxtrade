# 🛠️ Fixing the Sync API Error

## Problem
The `/api/admin/sync-auth-users` endpoint is returning an error.

## Most Likely Cause
The `SUPABASE_SERVICE_ROLE_KEY` is not properly configured in Vercel Environment Variables.

## Solution Steps

### Step 1: Get Your Service Role Key from Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `biqtkulvmqtikflcmqad`
3. Go to **Project Settings** (gear icon in left sidebar)
4. Click on **API** in the menu
5. Scroll down to **Project API Keys**
6. Copy the **service_role** key (the long one labeled "service_role secret")
   - ⚠️ **IMPORTANT**: This is NOT the anon key!
   - ⚠️ **IMPORTANT**: Never share this key publicly!

### Step 2: Add the Key to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: `Luxtrade`
3. Go to **Settings** (top navigation)
4. Click on **Environment Variables** in the sidebar
5. Click **Add New** button
6. Enter:
   - **Key**: `SUPABASE_SERVICE_ROLE_KEY` (exact spelling, no spaces)
   - **Value**: Paste the service_role key you copied from Supabase
7. Click **Save**
8. **Select all environments** (Production, Preview, Development) to apply it everywhere
9. Click **Save** again

### Step 3: Redeploy to Apply Changes

1. Go to the **Deployments** tab in Vercel
2. Find the latest deployment
3. Click the three dots (⋯) next to it
4. Select **Redeploy**
5. Wait for the redeploy to complete (usually 1-2 minutes)

### Step 4: Verify the Fix

After redeploy completes, test the following endpoints:

#### 1. Check Environment Variables
```
GET https://luxtrade-2x18lq472-risyxiee.vercel.app/api/admin/check-env
```

Expected response should show:
```json
{
  "supabaseUrl": "✓ SET",
  "supabaseAnonKey": "✓ SET",
  "supabaseServiceRoleKey": "✓ SET",
  "databaseUrl": "✓ SET"
}
```

#### 2. Run Sync
```
POST https://luxtrade-2x18lq472-risyxiee.vercel.app/api/admin/sync-auth-users
```

Expected response:
```json
{
  "success": true,
  "message": "Sync completed",
  "syncedCount": 6,
  "skippedCount": 0,
  "totalPrismaUsers": 6
}
```

## Troubleshooting

### Still getting "SUPABASE_SERVICE_ROLE_KEY not configured"?

1. Double-check the variable name spelling (must be exactly: `SUPABASE_SERVICE_ROLE_KEY`)
2. Make sure there are no extra spaces before/after the key
3. Verify you selected ALL environments when adding the variable
4. Make sure you completed a redeploy after adding the variable

### Getting a different error?

Visit `/api/admin/check-env` to see which environment variables are loaded:
```
https://luxtrade-2x18lq472-risyxiee.vercel.app/api/admin/check-env
```

This will show you exactly what's missing.

## Quick Reference: Required Environment Variables

Your Vercel project needs these environment variables:

| Variable Name | Source | Required |
|--------------|--------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API | ✅ Yes |
| `DATABASE_URL` | Prisma / SQLite connection string | ✅ Yes |

## Support

If you're still having issues after following these steps, please:
1. Visit `/api/admin/check-env` and share the response
2. Check the Vercel deployment logs for errors
3. Make sure you copied the correct key (service_role, not anon)
