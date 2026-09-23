# 🚨 URGENT: Production Database Setup Required

Your application is currently returning 500 errors because the database tables don't exist in Supabase.

## Errors Found

```
The table `public.Profile` does not exist in the current database.
The table `public.Trade` does not exist in the current database.
ENOENT: no such file or directory, mkdir '/home/z'
```

## ✅ Fixes Applied

1. ✅ Fixed `analyze-screenshot` API to use Supabase Storage only (removed filesystem code)
2. ✅ Created PostgreSQL migration file with all required tables
3. ✅ Updated `src/app/api/analyze-screenshot/route.ts`

## 🔧 YOU NEED TO DO: Run Database Migration

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your LuxTrade project
3. Navigate to **SQL Editor** on the left sidebar
4. Click **New Query**
5. Copy the contents of this file: `prisma/migrations/20250106_create_initial_tables/migration.sql`
6. Paste it into the SQL Editor
7. Click **Run** (or press Ctrl+Enter)
8. Wait for all tables to be created

### Option 2: Using psql (if you have SSH access)

```bash
psql $DATABASE_URL -f prisma/migrations/20250106_create_initial_tables/migration.sql
```

## ✅ Verify Migration Worked

After running the migration, check the tables:

1. In Supabase Dashboard, go to **Table Editor**
2. You should see these tables:
   - Profile
   - User
   - UserSubscription
   - Withdrawal
   - Trade
   - JournalEntry
   - Tag
   - WeeklyGoal
   - TradingAccount
   - SocialLink
   - UserSubmission
   - MissionProgress

## 🔄 After Migration

The production site should automatically work after the migration. No code deployment needed!

Vercel will use the updated code with the fixed `analyze-screenshot` API.

## 🧪 Test These Endpoints

After migration, test:
1. `/api/trades` - Should return trades list
2. `/api/analytics` - Should return analytics data
3. `/api/analyze-screenshot` - Should analyze screenshots without ENOENT error

## 📋 Environment Variables Checklist

Make sure these are set in Vercel:
- ✅ `DATABASE_URL` - PostgreSQL connection string from Supabase
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Service role key for storage uploads
- ✅ `OPENAI_API_KEY` - For AI screenshot analysis

## 🔍 If Errors Persist

1. Check Supabase logs for any SQL errors
2. Verify all tables were created in Supabase Table Editor
3. Check DATABASE_URL in Vercel matches Supabase connection string
4. Make sure Supabase project is active (not paused)

---

**Next Steps:**
1. Run the migration SQL in Supabase Dashboard
2. Verify tables are created
3. Test the production site
4. Monitor Vercel logs for any remaining errors

Good luck! 🚀