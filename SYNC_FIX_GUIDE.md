# 🔧 Sync Auth Fix Guide

## Problem
The sync functionality is failing with "Gagal sinkronisasi: Sync failed" because required Supabase environment variables are missing.

## What's Missing
The `.env.local` file needs these variables:
1. `NEXT_PUBLIC_SUPABASE_ANON_KEY` - From Supabase Dashboard
2. `SUPABASE_SERVICE_ROLE_KEY` - From Supabase Dashboard

## Quick Fix Steps

### Step 1: Get Your Keys from Supabase

1. Go to: https://supabase.com/dashboard/project/klxkdrfsfcoankbaoejn/settings/api
2. Scroll down to **Project API keys**
3. You'll see two keys:
   - **anon key** (starts with `eyJ...`) - Copy this
   - **service_role** (starts with `eyJ...`) - Copy this

### Step 2: Update .env.local File

Open `/home/z/my-project/.env.local` and replace the empty values:

```bash
DATABASE_URL=postgres://postgres.klxkdrfsfcoankbaoejn:oW0TKZUMb295pa4h@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x
NEXT_PUBLIC_SUPABASE_URL=https://klxkdrfsfcoankbaoejn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...<paste your anon key here>
SUPABASE_SERVICE_ROLE_KEY=eyJ...<paste your service role key here>
```

**IMPORTANT:**
- Replace `eyJ...<paste your anon key here>` with the actual anon key from Supabase
- Replace `eyJ...<paste your service role key here>` with the actual service_role key from Supabase
- Do NOT include quotes or extra spaces
- Make sure there are no line breaks in the keys

### Step 3: Restart the Dev Server

After updating the .env.local file:
1. Kill any existing dev server: `pkill -f "bun run dev"`
2. Start fresh: `bun run dev`

### Step 4: Test the Sync

1. Open the admin panel: http://localhost:3000/admin-subscriptions
2. Click the "Sync Auth" button
3. It should now work successfully!

## Alternative: If You Don't Have Access to Supabase Keys

If you cannot access the Supabase Dashboard to get the keys, I can help you with an alternative approach that uses the database directly to sync users. However, the proper solution is to use the Supabase Auth API.

## Verification

After completing the steps, you can verify the configuration:

```bash
curl http://localhost:3000/api/check-env
```

Expected response:
```json
{
  "environment": {
    "NEXT_PUBLIC_SUPABASE_URL": "✓ SET",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "✓ SET",
    "SUPABASE_SERVICE_ROLE_KEY": "✓ SET",
    "DATABASE_URL": "✓ SET"
  },
  "supabaseAdmin": "✓ INITIALIZED",
  "message": "All environment variables are configured"
}
```

## Need Help?

If you're having trouble:
1. Make sure you copied the CORRECT keys (anon for ANON_KEY, service_role for SERVICE_ROLE_KEY)
2. Ensure there are no extra spaces or quotes in the .env.local file
3. Check that the file was saved correctly
4. Restart the dev server after making changes
