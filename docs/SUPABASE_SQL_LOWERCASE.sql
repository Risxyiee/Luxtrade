-- ============================================================================
-- LuxTrade Database Setup - LOWERCASE TABLE NAMES
-- Script ini membuat tabel dengan nama lowercase sesuai Prisma @@map
-- ============================================================================

-- Enable UUID extension jika belum ada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Tabel: profiles (mapped from Profile)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "profiles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" TEXT,
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "achievements" JSONB NOT NULL DEFAULT '[]',
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "proExpiry" TIMESTAMP(3),
    "role" TEXT NOT NULL DEFAULT 'USER',
    "full_name" TEXT,
    "is_pro" BOOLEAN NOT NULL DEFAULT false,
    "subscription_until" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Tabel: users (mapped from User)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" TEXT NOT NULL,
    "name" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_email_key" UNIQUE ("email")
);

-- ============================================================================
-- Tabel: user_subscriptions (mapped from UserSubscription)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "user_subscriptions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Tabel: withdrawals (mapped from Withdrawal)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "withdrawals" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankAccount" TEXT NOT NULL,
    "bankHolder" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Tabel: trading_accounts (mapped from TradingAccount)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "trading_accounts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "broker" TEXT,
    "account_type" TEXT NOT NULL DEFAULT 'STANDARD',
    "account_number" TEXT,
    "initial_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "current_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leverage" INTEGER NOT NULL DEFAULT 100,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trading_accounts_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Tabel: trades (mapped from Trade)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "trades" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "account_id" UUID,
    "symbol" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "open_price" DOUBLE PRECISION NOT NULL,
    "close_price" DOUBLE PRECISION NOT NULL,
    "lot_size" DOUBLE PRECISION NOT NULL,
    "profit_loss" DOUBLE PRECISION NOT NULL,
    "open_time" TIMESTAMP(3) NOT NULL,
    "close_time" TIMESTAMP(3) NOT NULL,
    "session" TEXT,
    "notes" TEXT,
    "image_url" TEXT,
    "screenshot_url" TEXT,
    "emotion" TEXT,
    "setup_type" TEXT,
    "tags" TEXT,
    "risk_reward_ratio" DOUBLE PRECISION,
    "trade_duration" INTEGER,
    "linked_journal_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Tabel: journal_entries (mapped from JournalEntry)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "journal_entries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mood" TEXT,
    "market_condition" TEXT,
    "tags" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Tabel: tags (mapped from Tag)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "tags" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#a855f7',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Tabel: weekly_goals (mapped from WeeklyGoal)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "weekly_goals" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "week_start" TIMESTAMP(3) NOT NULL,
    "target_trades" INTEGER NOT NULL DEFAULT 10,
    "target_profit" DOUBLE PRECISION,
    "current_trades" INTEGER NOT NULL DEFAULT 0,
    "current_profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_goals_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Tabel: user_submissions (mapped from UserSubmission)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "user_submissions" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "achievementKey" TEXT NOT NULL,
    "proofUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_submissions_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Tabel: mission_progress (mapped from MissionProgress)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "mission_progress" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "missionKey" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL DEFAULT 1,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mission_progress_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Tabel: social_links (mapped from SocialLink)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "social_links" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "username" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_links_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Foreign Keys (Hanya buat jika belum ada)
-- ============================================================================

-- user_subscriptions -> users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_subscriptions_userId_fkey'
    ) THEN
        ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- withdrawals -> users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'withdrawals_userId_fkey'
    ) THEN
        ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- trades -> profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'trades_user_id_fkey'
    ) THEN
        ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- trades -> trading_accounts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'trades_account_id_fkey'
    ) THEN
        ALTER TABLE "trades" ADD CONSTRAINT "trades_account_id_fkey"
            FOREIGN KEY ("account_id") REFERENCES "trading_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;

-- trades -> journal_entries
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'trades_linked_journal_id_fkey'
    ) THEN
        ALTER TABLE "trades" ADD CONSTRAINT "trades_linked_journal_id_fkey"
            FOREIGN KEY ("linked_journal_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;

-- journal_entries -> profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'journal_entries_user_id_fkey'
    ) THEN
        ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- tags -> profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'tags_user_id_fkey'
    ) THEN
        ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- weekly_goals -> profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'weekly_goals_user_id_fkey'
    ) THEN
        ALTER TABLE "weekly_goals" ADD CONSTRAINT "weekly_goals_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- trading_accounts -> profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'trading_accounts_user_id_fkey'
    ) THEN
        ALTER TABLE "trading_accounts" ADD CONSTRAINT "trading_accounts_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- user_submissions -> profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_submissions_userId_fkey'
    ) THEN
        ALTER TABLE "user_submissions" ADD CONSTRAINT "user_submissions_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- mission_progress -> profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'mission_progress_userId_fkey'
    ) THEN
        ALTER TABLE "mission_progress" ADD CONSTRAINT "mission_progress_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- social_links -> profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'social_links_userId_fkey'
    ) THEN
        ALTER TABLE "social_links" ADD CONSTRAINT "social_links_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- ============================================================================
-- Indexes (Hanya buat jika belum ada)
-- ============================================================================

CREATE INDEX IF NOT EXISTS "user_submissions_userId_idx" ON "user_submissions"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "mission_progress_userId_missionKey_key" ON "mission_progress"("userId", "missionKey");
CREATE INDEX IF NOT EXISTS "mission_progress_userId_idx" ON "mission_progress"("userId");

CREATE INDEX IF NOT EXISTS "user_subscriptions_userId_idx" ON "user_subscriptions"("userId");

CREATE INDEX IF NOT EXISTS "withdrawals_userId_idx" ON "withdrawals"("userId");

CREATE INDEX IF NOT EXISTS "trades_user_id_idx" ON "trades"("user_id");
CREATE INDEX IF NOT EXISTS "trades_user_id_close_time_idx" ON "trades"("user_id", "close_time");

CREATE INDEX IF NOT EXISTS "journal_entries_user_id_idx" ON "journal_entries"("user_id");

CREATE INDEX IF NOT EXISTS "tags_user_id_idx" ON "tags"("user_id");

CREATE INDEX IF NOT EXISTS "weekly_goals_user_id_week_start_idx" ON "weekly_goals"("user_id", "week_start");

CREATE INDEX IF NOT EXISTS "trading_accounts_user_id_idx" ON "trading_accounts"("user_id");

CREATE INDEX IF NOT EXISTS "social_links_userId_idx" ON "social_links"("userId");
CREATE INDEX IF NOT EXISTS "social_links_status_idx" ON "social_links"("status");

-- ============================================================================
-- Functions untuk auto-updating updatedAt timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger ke semua tabel dengan updatedAt (hapus dulu jika sudah ada)
DROP TRIGGER IF EXISTS update_profiles_updated_at ON "profiles";
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON "profiles"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON "users";
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON "users"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON "user_subscriptions";
CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON "user_subscriptions"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_withdrawals_updated_at ON "withdrawals";
CREATE TRIGGER update_withdrawals_updated_at BEFORE UPDATE ON "withdrawals"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trades_updated_at ON "trades";
CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON "trades"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_journal_entries_updated_at ON "journal_entries";
CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON "journal_entries"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_weekly_goals_updated_at ON "weekly_goals";
CREATE TRIGGER update_weekly_goals_updated_at BEFORE UPDATE ON "weekly_goals"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trading_accounts_updated_at ON "trading_accounts";
CREATE TRIGGER update_trading_accounts_updated_at BEFORE UPDATE ON "trading_accounts"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_mission_progress_updated_at ON "mission_progress";
CREATE TRIGGER update_mission_progress_updated_at BEFORE UPDATE ON "mission_progress"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_submissions_updated_at ON "user_submissions";
CREATE TRIGGER update_user_submissions_updated_at BEFORE UPDATE ON "user_submissions"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_social_links_updated_at ON "social_links";
CREATE TRIGGER update_social_links_updated_at BEFORE UPDATE ON "social_links"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Selesai!
-- ============================================================================
SELECT 'LuxTrade database setup with lowercase tables completed successfully!' AS message;