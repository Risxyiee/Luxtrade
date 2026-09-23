# 🚨 CRITICAL: Fix DATABASE_URL in Vercel Production

## Problem

Production is failing with this error:
```
PrismaClientInitializationError: Invalid `prisma.profile.findUnique()` invocation:
error: Error validating datasource `db`: the URL must start with the protocol `postgresql://` or `postgres://`.
```

This means the `DATABASE_URL` environment variable in Vercel is NOT set correctly.

## Solution

### Step 1: Go to Vercel Project Settings

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Find your `luxtrade-jade` project
3. Click on **Settings** → **Environment Variables**

### Step 2: Check DATABASE_URL

Look for the `DATABASE_URL` environment variable. You should see one of these:

**❌ WRONG (This is causing the error):**
```
file:./db/custom.db
```
or
```
```
(empty)

**✅ CORRECT:**
```
postgresql://postgres:YOUR_PASSWORD@db.klxkdrfsfcoankbaoejn.supabase.co:6543/postgres?pgbouncer=true&connection_limit=10
```

### Step 3: Update DATABASE_URL

If the DATABASE_URL is wrong or missing:

1. Click on the `DATABASE_URL` variable
2. Replace the value with:
```
postgresql://postgres:Riskiakbarp123@db.klxkdrfsfcoankbaoejn.supabase.co:6543/postgres?pgbouncer=true&connection_limit=10
```

3. Make sure to select **All Environments** (Production, Preview, Development)
4. Click **Save**

### Step 4: Verify Other Environment Variables

Make sure these are also set correctly:

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | `postgresql://postgres:Riskiakbarp123@db.klxkdrfsfcoankbaoejn.supabase.co:6543/postgres?pgbouncer=true&connection_limit=10` | ✅ YES |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://klxkdrfsfcoankbaoejn.supabase.co` | ✅ YES |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key | ✅ YES |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key | ✅ YES |

### Step 5: Redeploy

After updating the environment variables:

1. Go to the **Deployments** tab in Vercel
2. Find the latest deployment
3. Click the **three dots (⋯)** menu
4. Click **Redeploy**
5. Wait for the deployment to complete

### Step 6: Verify Fix

After redeployment, test the application:

1. Go to `https://luxtradee.web.id`
2. Try to login
3. Try to create a trading account

**If the error persists:**
- Check the production logs in Vercel
- Look for any new error messages
- The database tables might need to be created (see next section)

---

## Database Tables Setup

After fixing the DATABASE_URL, you might also see this error:
```
Could not find the table 'public.profiles' in the schema cache
```

This means the database tables don't exist yet. To create them:

### Option 1: Use Supabase SQL Editor (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**
5. Paste the content of `prisma/schema.prisma` converted to SQL, or run this Prisma command locally:

```bash
bunx prisma db push
```

### Option 2: Use Prisma Push from Local

Run this command from your project root (make sure DATABASE_URL is set correctly in `.env`):

```bash
bun run db:push
```

This will create all the tables in your Supabase PostgreSQL database.

---

## Testing the Fix

### Test 1: Health Check API

```bash
curl https://luxtradee.web.id/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-25T...",
  "version": "2.0",
  "message": "Server is running"
}
```

### Test 2: Database Connection

If you have access to the Vercel logs, check for any Prisma connection errors.

### Test 3: Create Trading Account

1. Login to the app
2. Go to Dashboard
3. Try to create a trading account
4. Should succeed without errors

---

## Common Issues

### Issue: Environment variables not updating

**Solution:**
- Make sure you selected "All Environments" when setting the variable
- Redeploy the project after changing environment variables
- Clear your browser cache

### Issue: Tables don't exist

**Solution:**
- Run `bun run db:push` to create tables
- Or use Supabase SQL Editor to run the schema

### Issue: Connection refused

**Solution:**
- Verify the DATABASE_URL is correct
- Check that your Supabase project is active
- Verify the port is `6543` (pgbouncer) not `5432`

---

## Summary

**Root Cause:** DATABASE_URL in Vercel is not set to the correct PostgreSQL connection string.

**Fix:** Update DATABASE_URL in Vercel to:
```
postgresql://postgres:Riskiakbarp123@db.klxkdrfsfcoankbaoejn.supabase.co:6543/postgres?pgbouncer=true&connection_limit=10
```

**Then:** Redeploy from Vercel and test.

---

## Need Help?

If you're still having issues:

1. Check Vercel deployment logs
2. Verify DATABASE_URL is set correctly
3. Make sure Supabase project is active
4. Run `bun run db:push` locally to ensure schema is up to date

**Production should work after fixing the DATABASE_URL!**
