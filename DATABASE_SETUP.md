# Database Setup Guide for Production

## Problem
The production database is missing tables. Prisma is getting errors like:
```
Invalid `prisma.profile.findUnique()` invocation: The table `public.Profile` does not exist in the current database.
```

## Solution: Run Database Setup in Supabase

### Option 1: Using Supabase SQL Editor (Recommended)

1. **Go to Supabase Dashboard**
   - Visit https://supabase.com/dashboard
   - Select your LuxTrade project

2. **Open SQL Editor**
   - Navigate to **SQL Editor** in the left sidebar
   - Click **"New Query"**

3. **Run the Setup Script**
   - Open the file `prisma/setup.sql` from your project
   - Copy the entire SQL script
   - Paste it into the SQL Editor
   - Click **"Run"** (or press `Ctrl+Enter`)

4. **Verify Tables Were Created**
   - Go to **Table Editor** in the left sidebar
   - You should see all tables:
     - Profile
     - User
     - UserSubscription
     - Withdrawal
     - UserSubmission
     - MissionProgress
     - Trade
     - JournalEntry
     - Tag
     - WeeklyGoal
     - TradingAccount
     - SocialLink

### Option 2: Using Prisma Migrate

If you prefer using Prisma migrations:

1. **Install dependencies**
```bash
bun install
```

2. **Generate Prisma Client**
```bash
bun run prisma generate
```

3. **Create migration**
```bash
bun run prisma migrate dev --name init
```

4. **Push to production database**
```bash
bun run prisma db push
```

**Note:** For Option 2, make sure your `DATABASE_URL` environment variable is set in Vercel and points to your Supabase PostgreSQL database.

---

## Verify Database Connection

After running the setup script, verify the connection works:

### Test with API Routes

1. Deploy your updated code to Vercel
2. Test these endpoints:
   - `GET /api/trades` - Should return empty array `[]` (no 500 error)
   - `GET /api/trading-accounts` - Should return empty array `[]`
   - `GET /api/analytics` - Should return analytics data (no 500 error)

### Check Vercel Logs

1. Go to Vercel Dashboard → Your Project → **Logs**
2. Look for these successful messages:
   - `✅ [API] Authenticated user: ...`
   - `✅ [API] Found X trades for user ...`

If you see these messages, the database is working correctly!

---

## Common Issues

### Issue: "Relation 'Profile' does not exist"

**Cause:** The setup script wasn't run or didn't complete successfully.

**Solution:**
- Run the `prisma/setup.sql` script again in Supabase SQL Editor
- Check for any error messages in the SQL Editor output
- Make sure all tables were created (check Table Editor)

### Issue: "Foreign key constraint violation"

**Cause:** Tables were created in wrong order or some tables are missing.

**Solution:**
- Drop all tables and re-run the setup script:
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
COMMENT ON SCHEMA public IS 'standard public schema';
```
- Then run `prisma/setup.sql` again

### Issue: "Prisma Client Known Request Error: P2021"

**Cause:** Prisma can't find the table in the database.

**Solution:**
1. Check that `DATABASE_URL` in Vercel environment variables is correct
2. Verify tables exist in Supabase → Table Editor
3. Regenerate Prisma Client:
```bash
bun run prisma generate
```
4. Redeploy to Vercel

---

## Database Schema Overview

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| **Profile** | User profiles linked to Supabase Auth | id, email, plan, achievements |
| **User** | Additional user data | id, email, name |
| **Trade** | Trading journal entries | id, user_id, symbol, profit_loss |
| **TradingAccount** | User's trading accounts | id, user_id, name, broker |
| **JournalEntry** | Trading journals | id, user_id, title, content |

### Supporting Tables

| Table | Purpose |
|-------|---------|
| UserSubscription | Subscription management |
| Withdrawal | Withdrawal requests |
| UserSubmission | Achievement submissions |
| MissionProgress | Mission/tracking progress |
| Tag | Custom tags for trades |
| WeeklyGoal | Weekly trading goals |
| SocialLink | Social media links |

### Relationships

```
Profile (1) ───< (*) Trade
Profile (1) ───< (*) TradingAccount
Profile (1) ───< (*) JournalEntry
Profile (1) ───< (*) Tag
Profile (1) ───< (*) WeeklyGoal

Trade (1) ──< (1?) TradingAccount
Trade (1) ──< (1?) JournalEntry
```

---

## Database Backup

Before making any changes, consider backing up your database:

### Manual Backup (Supabase)

1. Go to Supabase Dashboard → **Database**
2. Click **Backups** in the left sidebar
3. Click **"Create backup"**

### Backup via SQL (Optional)

```sql
-- Export all data
COPY (
  SELECT json_agg(t)
  FROM (
    SELECT * FROM "Profile"
    UNION ALL
    SELECT * FROM "Trade"
    -- Add other tables as needed
  ) t
) TO '/tmp/backup.json';
```

---

## Security Notes

- **Never commit database credentials** to git
- **Use environment variables** for `DATABASE_URL`
- **Enable Row Level Security (RLS)** in Supabase for additional security
- **Regular backups** - Set up automated backups in Supabase

---

## Next Steps After Setup

1. ✅ Run `prisma/setup.sql` in Supabase SQL Editor
2. ✅ Verify all tables exist in Table Editor
3. ✅ Deploy updated code to Vercel
4. ✅ Test API endpoints (no 500 errors)
5. ✅ Create test user and verify profile creation works
6. ✅ Test creating a trade entry

---

## Support

If you encounter issues:

1. **Check Vercel Logs** - Look for specific error messages
2. **Check Supabase Logs** - Database query logs
3. **Verify Environment Variables** - `DATABASE_URL` must be correct
4. **Regenerate Prisma Client** - Run `bun run prisma generate`

---

Last Updated: January 2025
Version: 1.0