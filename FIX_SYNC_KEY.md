# Fix Step 3: SUPABASE_SERVICE_ROLE_KEY Not Configured

## Problem
The sync API is returning error: `{"error":"Failed to check sync status"}`

## Root Cause
The `SUPABASE_SERVICE_ROLE_KEY` is NOT configured in Vercel Environment Variables.

This key is required to access the Supabase Auth admin API to list users.

---

## How to Fix

### Step 1: Get the SUPABASE_SERVICE_ROLE_KEY from Supabase

1. Go to: https://supabase.com/dashboard
2. Click on your project: **luxtrade** (klxkdrfsfcoankbaoejn)
3. Navigate to: **Settings** → **API** (left sidebar)
4. Scroll down to **Project API keys**
5. Find **service_role** key (NOT anon key!)
6. Click the "Copy" button to copy the full key

⚠️ **IMPORTANT**: The key starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

### Step 2: Add SUPABASE_SERVICE_ROLE_KEY to Vercel

1. Go to your Vercel project: https://vercel.com/risyxiee/luxtrade/settings
2. Navigate to: **Settings** → **Environment Variables**
3. Click **"Add New"**
4. Fill in:
   - **Name**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: Paste the key you copied from Supabase
   - **Environment**: Select **All** (Production, Preview, Development)
5. Click **"Save"**

---

### Step 3: Redeploy to Apply Changes

After adding the environment variable, you need to redeploy:

**Option A - Quick Redeploy from Vercel Dashboard:**
1. Go to: https://vercel.com/risyxiee/luxtrade/deployments
2. Click on the most recent deployment (top of the list)
3. Click the **"..."** (three dots) menu in the top-right
4. Click **"Redeploy"**
5. Confirm by clicking **"Redeploy"** again

**Option B - Push a New Commit:**
If you've just pushed changes to GitHub, Vercel will automatically redeploy.

---

### Step 4: Wait for Redeploy

Wait for the deployment to complete (usually 1-2 minutes).

You can monitor the progress at:
https://vercel.com/risyxiee/luxtrade/deployments

Wait for the status to change to:
✅ **Ready**

---

### Step 5: Test the Sync API

After redeploy is complete, test the sync:

**Step 5a - Check Sync Status (GET):**
```
https://luxtrade-2x18lq472-risyxiee.vercel.app/api/admin/sync-auth-users
```

Expected response:
```json
{
  "success": true,
  "supabaseAuthUsers": 6,
  "prismaUsers": 0,
  "syncNeeded": true,
  "authUsers": [
    { "id": "...", "email": "iyan@...", "name": "iyan" },
    ...
  ]
}
```

**Step 5b - Run Sync (POST):**
Use Postman, curl, or any HTTP client to send a POST request to:
```
https://luxtrade-2x18lq472-risyxiee.vercel.app/api/admin/sync-auth-users
```

Expected response:
```json
{
  "success": true,
  "message": "Sync completed",
  "syncedCount": 6,
  "skippedCount": 0,
  "errorCount": 0,
  "totalPrismaUsers": 6
}
```

---

### Step 6: Verify Admin Panel

After sync is complete, open the Admin Panel:
```
https://luxtrade-2x18lq472-risyxiee.vercel.app/admin-subscriptions
```

You should see all 6 users displayed:
- iyan
- Galang
- (and 4 others)

---

## Troubleshooting

### Error: "SUPABASE_SERVICE_ROLE_KEY not configured"
- Double-check that you added the variable in Vercel Settings → Environment Variables
- Make sure the variable name is exactly: `SUPABASE_SERVICE_ROLE_KEY`
- Verify you redeployed after adding the variable

### Error: "Failed to fetch Supabase Auth users"
- Check that you copied the **service_role** key (NOT anon key)
- Verify your Supabase project is active and not paused
- Check Vercel Function Logs for detailed error messages

### Error: "Synced count is 0 but users exist in Supabase Auth"
- This means users already exist in Prisma database
- Check the `skippedCount` in the response
- Users are only synced once (by UUID)

---

## Summary of Changes Made

1. ✅ Updated Supabase URL from old project to new project (klxkdrfsfcoankbaoejn)
2. ✅ Improved error logging in sync API to show detailed error messages
3. ✅ Added auth user details in GET response for debugging
4. ✅ Committed and pushed changes to GitHub

---

## Next Steps After Sync Completes

Once the 6 users are synced successfully, you can:

1. ✅ Verify Admin Panel shows all users
2. ✅ Test activation of "Lifetime Ultra Rp 100.000" subscription
3. ✅ Assign packages to specific users from the Admin Panel

Good luck! 🚀
