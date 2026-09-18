# Deployment Guide

## Local Development (SQLite)

For local development, the app uses SQLite database.

**Current setup:**
- `.env` file uses: `DATABASE_URL="file:./db/dev.db"`
- `prisma/schema.prisma` uses: `provider = "sqlite"`

**Run locally:**
```bash
bun run dev
```

## Production Deployment (PostgreSQL/Supabase)

For production, the app uses Supabase PostgreSQL.

### Step 1: Set Environment Variables

In your production environment (Vercel, Railway, etc.), set:

```env
DATABASE_URL=postgresql://postgres:Riskiakbarp123@db.klxkdrfsfcoankbaoejn.supabase.co:5432/postgres
```

### Step 2: Switch Schema to PostgreSQL

Before building for production, switch the Prisma schema:

```bash
# Backup current SQLite schema
cp prisma/schema.prisma prisma/schema.prisma.sqlite.backup

# Switch to PostgreSQL schema
cp prisma/schema.prisma.pgsql.backup prisma/schema.prisma

# Generate Prisma Client
bun run db:generate
```

### Step 3: Create Database Tables

You need to create the database schema in Supabase. You have two options:

#### Option A: Use Prisma Migrate (Recommended)

```bash
# Create initial migration
bunx prisma migrate dev --name init

# Push schema to Supabase
bunx prisma db push
```

#### Option B: Manual SQL (If Prisma Push Fails)

If you can't connect to Supabase from your local machine, you can run the SQL manually in Supabase Dashboard:

1. Go to Supabase Dashboard → Project → SQL Editor
2. Run the following SQL to create all tables:

```sql
-- Create tables for Trading Journal App

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT,
  "streakCount" INTEGER DEFAULT 0,
  "lastLoginAt" TIMESTAMP,
  "bestStreak" INTEGER DEFAULT 0,
  achievements TEXT DEFAULT '[]',
  plan TEXT DEFAULT 'FREE',
  "proExpiry" TIMESTAMP,
  role TEXT DEFAULT 'USER',
  "full_name" TEXT,
  "is_pro" BOOLEAN DEFAULT false,
  "subscription_until" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  "emailVerified" TIMESTAMP,
  image TEXT,
  role TEXT DEFAULT 'USER',
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT,
  symbol TEXT NOT NULL,
  type TEXT NOT NULL,
  "open_price" FLOAT NOT NULL,
  "close_price" FLOAT NOT NULL,
  "lot_size" FLOAT NOT NULL,
  "profit_loss" FLOAT NOT NULL,
  "open_time" TIMESTAMP NOT NULL,
  "close_time" TIMESTAMP NOT NULL,
  session TEXT,
  notes TEXT,
  "image_url" TEXT,
  "screenshot_url" TEXT,
  emotion TEXT,
  "setup_type" TEXT,
  tags TEXT,
  "risk_reward_ratio" FLOAT,
  "trade_duration" INTEGER,
  "linked_journal_id" TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS trading_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  broker TEXT,
  "account_type" TEXT DEFAULT 'STANDARD',
  "account_number" TEXT,
  "initial_balance" FLOAT DEFAULT 0,
  "current_balance" FLOAT DEFAULT 0,
  leverage INTEGER DEFAULT 100,
  currency TEXT DEFAULT 'USD',
  "is_default" BOOLEAN DEFAULT false,
  "is_active" BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_close_time ON trades("close_time" DESC);
CREATE INDEX IF NOT EXISTS idx_trading_accounts_user_id ON trading_accounts(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies (you may need to adjust based on your auth setup)
CREATE POLICY "Users can view own profiles" ON profiles
  FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "Users can insert own profiles" ON profiles
  FOR INSERT WITH CHECK (auth.uid()::text = id);

CREATE POLICY "Users can view own trades" ON trades
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own trades" ON trades
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own trades" ON trades
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own trades" ON trades
  FOR DELETE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view own trading accounts" ON trading_accounts
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own trading accounts" ON trading_accounts
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
```

### Step 4: Build and Deploy

```bash
# Build the application
bun run build

# Deploy to your platform
# (Vercel, Railway, etc.)
```

### Step 5: Verify Deployment

After deployment, check the logs to ensure:
- Database connection is successful
- No Prisma initialization errors
- API endpoints are responding correctly

## Troubleshooting

### Error: "Unable to open the database file"

**Cause:** Using SQLite in production or DATABASE_URL not set correctly.

**Solution:**
1. Ensure DATABASE_URL is set in production environment variables
2. For production, use PostgreSQL connection string
3. Make sure Prisma schema uses `provider = "postgresql"`

### Error: "DATABASE_URL does not start with file:"

**Cause:** The `db.ts` file is trying to convert PostgreSQL URL to SQLite.

**Solution:**
- Check that your production DATABASE_URL starts with `postgresql://`
- The updated `db.ts` should handle both SQLite and PostgreSQL correctly

### Can't Connect to Supabase from Local Machine

**Solution:**
- Use Option B (Manual SQL) to create tables in Supabase Dashboard
- Set DATABASE_URL in production environment, not locally
- Deploy and test from production environment

## Switching Between Development and Production

### To Switch to Development (SQLite):
```bash
cp prisma/schema.prisma.sqlite.backup prisma/schema.prisma
bun run db:push
```

### To Switch to Production (PostgreSQL):
```bash
cp prisma/schema.prisma.pgsql.backup prisma/schema.prisma
bun run db:generate
```
