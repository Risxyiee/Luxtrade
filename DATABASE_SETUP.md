# Production Database Setup

This document provides instructions for setting up the production database for LuxTrade.

## Step 1: Create Database in Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor**
4. Run the migration SQL below

## Step 2: Run Migration SQL

Copy and paste the contents of `prisma/migrations/20250106_create_initial_tables/migration.sql` into the Supabase SQL Editor and click **Run**.

Alternatively, you can run it using psql:

```bash
psql $DATABASE_URL -f prisma/migrations/20250106_create_initial_tables/migration.sql
```

## Step 3: Generate Prisma Client

After running the migration, regenerate the Prisma client:

```bash
bunx prisma generate
```

## Step 4: Verify Tables

Check that all tables were created by running:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see these tables:
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

## Step 5: Test Connection

Test the database connection by running:

```bash
bun run db:push
```

Or use the Prisma Studio:

```bash
bunx prisma studio
```

## Troubleshooting

### Error: "Relation does not exist"
This means the tables haven't been created yet. Run the migration SQL.

### Error: "Foreign key constraint fails"
Make sure the migration SQL was run completely in the correct order.

### Error: "Already exists"
Drop the database or table and re-run the migration.

---

**Note:** The local development uses SQLite (`file:./db/custom.db`), but production uses PostgreSQL via Supabase. The Prisma schema is configured for PostgreSQL.