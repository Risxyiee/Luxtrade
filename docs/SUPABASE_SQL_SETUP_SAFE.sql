-- ============================================================================
-- LuxTrade Database Manual Setup Script - SAFE VERSION
-- Script ini hanya membuat tabel yang BELUM ada
-- ============================================================================

-- Enable UUID extension jika belum ada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Cek dan buat tabel yang belum ada
-- ============================================================================

-- Table: Profile
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Profile') THEN
        CREATE TABLE "Profile" (
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
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
        );
        RAISE NOTICE 'Table Profile created';
    ELSE
        RAISE NOTICE 'Table Profile already exists, skipping';
    END IF;
END
$$;

-- Table: User
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'User') THEN
        CREATE TABLE "User" (
            "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
            "email" TEXT NOT NULL,
            "name" TEXT,
            "emailVerified" TIMESTAMP(3),
            "image" TEXT,
            "role" TEXT NOT NULL DEFAULT 'USER',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
            CONSTRAINT "User_email_key" UNIQUE ("email")
        );
        RAISE NOTICE 'Table User created';
    ELSE
        RAISE NOTICE 'Table User already exists, skipping';
    END IF;
END
$$;

-- Table: UserSubscription
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'UserSubscription') THEN
        CREATE TABLE "UserSubscription" (
            "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
            "userId" UUID NOT NULL,
            "plan" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'active',
            "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "endDate" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
        );
        RAISE NOTICE 'Table UserSubscription created';
    ELSE
        RAISE NOTICE 'Table UserSubscription already exists, skipping';
    END IF;
END
$$;

-- Table: Withdrawal
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Withdrawal') THEN
        CREATE TABLE "Withdrawal" (
            "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
            "userId" UUID NOT NULL,
            "amount" DOUBLE PRECISION NOT NULL,
            "bankName" TEXT NOT NULL,
            "bankAccount" TEXT NOT NULL,
            "bankHolder" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'pending',
            "adminNote" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
        );
        RAISE NOTICE 'Table Withdrawal created';
    ELSE
        RAISE NOTICE 'Table Withdrawal already exists, skipping';
    END IF;
END
$$;

-- Table: TradingAccount
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'TradingAccount') THEN
        CREATE TABLE "TradingAccount" (
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
            "updated_at" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "TradingAccount_pkey" PRIMARY KEY ("id")
        );
        RAISE NOTICE 'Table TradingAccount created';
    ELSE
        RAISE NOTICE 'Table TradingAccount already exists, skipping';
    END IF;
END
$$;

-- Table: Trade
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Trade') THEN
        CREATE TABLE "Trade" (
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
            "updated_at" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
        );
        RAISE NOTICE 'Table Trade created';
    ELSE
        RAISE NOTICE 'Table Trade already exists, skipping';
    END IF;
END
$$;

-- Table: JournalEntry
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'JournalEntry') THEN
        CREATE TABLE "JournalEntry" (
            "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
            "user_id" UUID NOT NULL,
            "title" TEXT NOT NULL,
            "content" TEXT NOT NULL,
            "mood" TEXT,
            "market_condition" TEXT,
            "tags" TEXT,
            "image_url" TEXT,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
        );
        RAISE NOTICE 'Table JournalEntry created';
    ELSE
        RAISE NOTICE 'Table JournalEntry already exists, skipping';
    END IF;
END
$$;

-- Table: Tag
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Tag') THEN
        CREATE TABLE "Tag" (
            "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
            "user_id" UUID NOT NULL,
            "name" TEXT NOT NULL,
            "color" TEXT NOT NULL DEFAULT '#a855f7',
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
        );
        RAISE NOTICE 'Table Tag created';
    ELSE
        RAISE NOTICE 'Table Tag already exists, skipping';
    END IF;
END
$$;

-- Table: WeeklyGoal
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'WeeklyGoal') THEN
        CREATE TABLE "WeeklyGoal" (
            "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
            "user_id" UUID NOT NULL,
            "week_start" TIMESTAMP(3) NOT NULL,
            "target_trades" INTEGER NOT NULL DEFAULT 10,
            "target_profit" DOUBLE PRECISION,
            "current_trades" INTEGER NOT NULL DEFAULT 0,
            "current_profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "status" TEXT NOT NULL DEFAULT 'active',
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "WeeklyGoal_pkey" PRIMARY KEY ("id")
        );
        RAISE NOTICE 'Table WeeklyGoal created';
    ELSE
        RAISE NOTICE 'Table WeeklyGoal already exists, skipping';
    END IF;
END
$$;

-- Table: UserSubmission
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'UserSubmission') THEN
        CREATE TABLE "UserSubmission" (
            "id" SERIAL NOT NULL,
            "userId" UUID NOT NULL,
            "achievementKey" TEXT NOT NULL,
            "proofUrl" TEXT,
            "status" TEXT NOT NULL DEFAULT 'PENDING',
            "reviewedBy" TEXT,
            "reviewedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "UserSubmission_pkey" PRIMARY KEY ("id")
        );
        RAISE NOTICE 'Table UserSubmission created';
    ELSE
        RAISE NOTICE 'Table UserSubmission already exists, skipping';
    END IF;
END
$$;

-- Table: MissionProgress
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'MissionProgress') THEN
        CREATE TABLE "MissionProgress" (
            "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
            "userId" UUID NOT NULL,
            "missionKey" TEXT NOT NULL,
            "progress" INTEGER NOT NULL DEFAULT 0,
            "target" INTEGER NOT NULL DEFAULT 1,
            "completed" BOOLEAN NOT NULL DEFAULT false,
            "claimed" BOOLEAN NOT NULL DEFAULT false,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "MissionProgress_pkey" PRIMARY KEY ("id")
        );
        RAISE NOTICE 'Table MissionProgress created';
    ELSE
        RAISE NOTICE 'Table MissionProgress already exists, skipping';
    END IF;
END
$$;

-- Table: SocialLink
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'SocialLink') THEN
        CREATE TABLE "SocialLink" (
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
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "SocialLink_pkey" PRIMARY KEY ("id")
        );
        RAISE NOTICE 'Table SocialLink created';
    ELSE
        RAISE NOTICE 'Table SocialLink already exists, skipping';
    END IF;
END
$$;

-- ============================================================================
-- Foreign Keys (Hanya buat jika belum ada)
-- ============================================================================

-- UserSubscription
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'UserSubscription_userId_fkey'
    ) THEN
        ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        RAISE NOTICE 'FK UserSubscription_userId_fkey created';
    END IF;
END
$$;

-- Withdrawal
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Withdrawal_userId_fkey'
    ) THEN
        ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        RAISE NOTICE 'FK Withdrawal_userId_fkey created';
    END IF;
END
$$;

-- Trade - user_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Trade_user_id_fkey'
    ) THEN
        ALTER TABLE "Trade" ADD CONSTRAINT "Trade_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        RAISE NOTICE 'FK Trade_user_id_fkey created';
    END IF;
END
$$;

-- Trade - account_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Trade_account_id_fkey'
    ) THEN
        ALTER TABLE "Trade" ADD CONSTRAINT "Trade_account_id_fkey"
            FOREIGN KEY ("account_id") REFERENCES "TradingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        RAISE NOTICE 'FK Trade_account_id_fkey created';
    END IF;
END
$$;

-- Trade - linked_journal_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Trade_linked_journal_id_fkey'
    ) THEN
        ALTER TABLE "Trade" ADD CONSTRAINT "Trade_linked_journal_id_fkey"
            FOREIGN KEY ("linked_journal_id") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        RAISE NOTICE 'FK Trade_linked_journal_id_fkey created';
    END IF;
END
$$;

-- JournalEntry
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'JournalEntry_user_id_fkey'
    ) THEN
        ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        RAISE NOTICE 'FK JournalEntry_user_id_fkey created';
    END IF;
END
$$;

-- Tag
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Tag_user_id_fkey'
    ) THEN
        ALTER TABLE "Tag" ADD CONSTRAINT "Tag_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        RAISE NOTICE 'FK Tag_user_id_fkey created';
    END IF;
END
$$;

-- WeeklyGoal
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'WeeklyGoal_user_id_fkey'
    ) THEN
        ALTER TABLE "WeeklyGoal" ADD CONSTRAINT "WeeklyGoal_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        RAISE NOTICE 'FK WeeklyGoal_user_id_fkey created';
    END IF;
END
$$;

-- TradingAccount
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'TradingAccount_user_id_fkey'
    ) THEN
        ALTER TABLE "TradingAccount" ADD CONSTRAINT "TradingAccount_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        RAISE NOTICE 'FK TradingAccount_user_id_fkey created';
    END IF;
END
$$;

-- UserSubmission
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'UserSubmission_userId_fkey'
    ) THEN
        ALTER TABLE "UserSubmission" ADD CONSTRAINT "UserSubmission_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        RAISE NOTICE 'FK UserSubmission_userId_fkey created';
    END IF;
END
$$;

-- MissionProgress
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'MissionProgress_userId_fkey'
    ) THEN
        ALTER TABLE "MissionProgress" ADD CONSTRAINT "MissionProgress_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        RAISE NOTICE 'FK MissionProgress_userId_fkey created';
    END IF;
END
$$;

-- SocialLink
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'SocialLink_userId_fkey'
    ) THEN
        ALTER TABLE "SocialLink" ADD CONSTRAINT "SocialLink_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        RAISE NOTICE 'FK SocialLink_userId_fkey created';
    END IF;
END
$$;

-- ============================================================================
-- Indexes (Hanya buat jika belum ada)
-- ============================================================================

-- UserSubmission indexes
CREATE INDEX IF NOT EXISTS "UserSubmission_userId_idx" ON "UserSubmission"("userId");

-- MissionProgress indexes
CREATE UNIQUE INDEX IF NOT EXISTS "MissionProgress_userId_missionKey_key" ON "MissionProgress"("userId", "missionKey");
CREATE INDEX IF NOT EXISTS "MissionProgress_userId_idx" ON "MissionProgress"("userId");

-- UserSubscription indexes
CREATE INDEX IF NOT EXISTS "UserSubscription_userId_idx" ON "UserSubscription"("userId");

-- Withdrawal indexes
CREATE INDEX IF NOT EXISTS "Withdrawal_userId_idx" ON "Withdrawal"("userId");

-- Trade indexes
CREATE INDEX IF NOT EXISTS "Trade_user_id_idx" ON "Trade"("user_id");
CREATE INDEX IF NOT EXISTS "Trade_user_id_close_time_idx" ON "Trade"("user_id", "close_time");

-- JournalEntry indexes
CREATE INDEX IF NOT EXISTS "JournalEntry_user_id_idx" ON "JournalEntry"("user_id");

-- Tag indexes
CREATE INDEX IF NOT EXISTS "Tag_user_id_idx" ON "Tag"("user_id");

-- WeeklyGoal indexes
CREATE INDEX IF NOT EXISTS "WeeklyGoal_user_id_week_start_idx" ON "WeeklyGoal"("user_id", "week_start");

-- TradingAccount indexes
CREATE INDEX IF NOT EXISTS "TradingAccount_user_id_idx" ON "TradingAccount"("user_id");

-- SocialLink indexes
CREATE INDEX IF NOT EXISTS "SocialLink_userId_idx" ON "SocialLink"("userId");
CREATE INDEX IF NOT EXISTS "SocialLink_status_idx" ON "SocialLink"("status");

-- ============================================================================
-- Functions untuk auto-updating updatedAt timestamp
-- ============================================================================

-- Buat function update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger ke semua tabel dengan updatedAt (hapus dulu jika sudah ada)
DROP TRIGGER IF EXISTS update_Profile_updated_at ON "Profile";
CREATE TRIGGER update_Profile_updated_at BEFORE UPDATE ON "Profile"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_User_updated_at ON "User";
CREATE TRIGGER update_User_updated_at BEFORE UPDATE ON "User"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_UserSubscription_updated_at ON "UserSubscription";
CREATE TRIGGER update_UserSubscription_updated_at BEFORE UPDATE ON "UserSubscription"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_Withdrawal_updated_at ON "Withdrawal";
CREATE TRIGGER update_Withdrawal_updated_at BEFORE UPDATE ON "Withdrawal"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_Trade_updated_at ON "Trade";
CREATE TRIGGER update_Trade_updated_at BEFORE UPDATE ON "Trade"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_JournalEntry_updated_at ON "JournalEntry";
CREATE TRIGGER update_JournalEntry_updated_at BEFORE UPDATE ON "JournalEntry"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_WeeklyGoal_updated_at ON "WeeklyGoal";
CREATE TRIGGER update_WeeklyGoal_updated_at BEFORE UPDATE ON "WeeklyGoal"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_TradingAccount_updated_at ON "TradingAccount";
CREATE TRIGGER update_TradingAccount_updated_at BEFORE UPDATE ON "TradingAccount"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_MissionProgress_updated_at ON "MissionProgress";
CREATE TRIGGER update_MissionProgress_updated_at BEFORE UPDATE ON "MissionProgress"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_UserSubmission_updated_at ON "UserSubmission";
CREATE TRIGGER update_UserSubmission_updated_at BEFORE UPDATE ON "UserSubmission"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_SocialLink_updated_at ON "SocialLink";
CREATE TRIGGER update_SocialLink_updated_at BEFORE UPDATE ON "SocialLink"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Selesai!
-- ============================================================================
SELECT 'LuxTrade database setup completed successfully!' AS message;