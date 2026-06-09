-- ============================================================================
-- LuxTrade Database Setup - ULTRA SAFE VERSION
-- Script ini akan cek constraint detail dan hanya buat yang belum ada
-- ============================================================================

-- Enable UUID extension jika belum ada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Fungsi untuk cek apakah constraint ada
-- ============================================================================
CREATE OR REPLACE FUNCTION constraint_exists(table_name TEXT, constraint_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = constraint_name
        AND conrelid::regclass = table_name::regclass
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Fungsi untuk cek apakah tabel ada
-- ============================================================================
CREATE OR REPLACE FUNCTION table_exists(table_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = table_name
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Buat tabel dengan nama yang unik (hanya jika belum ada)
-- ============================================================================

-- Table: Profile
DO $$
BEGIN
    IF NOT table_exists('Profile') THEN
        EXECUTE 'CREATE TABLE "Profile" (
            "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
            "email" TEXT,
            "streakCount" INTEGER NOT NULL DEFAULT 0,
            "lastLoginAt" TIMESTAMP(3),
            "bestStreak" INTEGER NOT NULL DEFAULT 0,
            "achievements" JSONB NOT NULL DEFAULT ''[]''::jsonb,
            "plan" TEXT NOT NULL DEFAULT ''FREE'',
            "proExpiry" TIMESTAMP(3),
            "role" TEXT NOT NULL DEFAULT ''USER'',
            "full_name" TEXT,
            "is_pro" BOOLEAN NOT NULL DEFAULT false,
            "subscription_until" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL
        )';
        RAISE NOTICE 'Table Profile created';
    ELSE
        RAISE NOTICE 'Table Profile already exists, skipping';
    END IF;

    -- Tambah constraint pkey jika belum ada
    IF NOT constraint_exists('Profile', 'Profile_pkey') THEN
        EXECUTE 'ALTER TABLE "Profile" ADD CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")';
        RAISE NOTICE 'Constraint Profile_pkey added';
    ELSE
        RAISE NOTICE 'Constraint Profile_pkey already exists, skipping';
    END IF;
END
$$;

-- Table: User
DO $$
BEGIN
    IF NOT table_exists('User') THEN
        EXECUTE 'CREATE TABLE "User" (
            "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
            "email" TEXT NOT NULL,
            "name" TEXT,
            "emailVerified" TIMESTAMP(3),
            "image" TEXT,
            "role" TEXT NOT NULL DEFAULT ''USER'',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL
        )';
        RAISE NOTICE 'Table User created';
    ELSE
        RAISE NOTICE 'Table User already exists, skipping';
    END IF;

    IF NOT constraint_exists('User', 'User_pkey') THEN
        EXECUTE 'ALTER TABLE "User" ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id")';
        RAISE NOTICE 'Constraint User_pkey added';
    ELSE
        RAISE NOTICE 'Constraint User_pkey already exists, skipping';
    END IF;

    IF NOT constraint_exists('User', 'User_email_key') THEN
        EXECUTE 'ALTER TABLE "User" ADD CONSTRAINT "User_email_key" UNIQUE ("email")';
        RAISE NOTICE 'Constraint User_email_key added';
    ELSE
        RAISE NOTICE 'Constraint User_email_key already exists, skipping';
    END IF;
END
$$;

-- Table: UserSubscription
DO $$
BEGIN
    IF NOT table_exists('UserSubscription') THEN
        EXECUTE 'CREATE TABLE "UserSubscription" (
            "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
            "userId" UUID NOT NULL,
            "plan" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT ''active'',
            "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "endDate" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL
        )';
        RAISE NOTICE 'Table UserSubscription created';
    ELSE
        RAISE NOTICE 'Table UserSubscription already exists, skipping';
    END IF;

    IF NOT constraint_exists('UserSubscription', 'UserSubscription_pkey') THEN
        EXECUTE 'ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")';
        RAISE NOTICE 'Constraint UserSubscription_pkey added';
    ELSE
        RAISE NOTICE 'Constraint UserSubscription_pkey already exists, skipping';
    END IF;
END
$$;

-- Table: Withdrawal
DO $$
BEGIN
    IF NOT table_exists('Withdrawal') THEN
        EXECUTE 'CREATE TABLE "Withdrawal" (
            "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
            "userId" UUID NOT NULL,
            "amount" DOUBLE PRECISION NOT NULL,
            "bankName" TEXT NOT NULL,
            "bankAccount" TEXT NOT NULL,
            "bankHolder" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT ''pending'',
            "adminNote" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL
        )';
        RAISE NOTICE 'Table Withdrawal created';
    ELSE
        RAISE NOTICE 'Table Withdrawal already exists, skipping';
    END IF;

    IF NOT constraint_exists('Withdrawal', 'Withdrawal_pkey') THEN
        EXECUTE 'ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")';
        RAISE NOTICE 'Constraint Withdrawal_pkey added';
    ELSE
        RAISE NOTICE 'Constraint Withdrawal_pkey already exists, skipping';
    END IF;
END
$$;

-- Table: TradingAccount
DO $$
BEGIN
    IF NOT table_exists('TradingAccount') THEN
        EXECUTE 'CREATE TABLE "TradingAccount" (
            "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
            "user_id" UUID NOT NULL,
            "name" TEXT NOT NULL,
            "broker" TEXT,
            "account_type" TEXT NOT NULL DEFAULT ''STANDARD'',
            "account_number" TEXT,
            "initial_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "current_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "leverage" INTEGER NOT NULL DEFAULT 100,
            "currency" TEXT NOT NULL DEFAULT ''USD'',
            "is_default" BOOLEAN NOT NULL DEFAULT false,
            "is_active" BOOLEAN NOT NULL DEFAULT true,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL
        )';
        RAISE NOTICE 'Table TradingAccount created';
    ELSE
        RAISE NOTICE 'Table TradingAccount already exists, skipping';
    END IF;

    IF NOT constraint_exists('TradingAccount', 'TradingAccount_pkey') THEN
        EXECUTE 'ALTER TABLE "TradingAccount" ADD CONSTRAINT "TradingAccount_pkey" PRIMARY KEY ("id")';
        RAISE NOTICE 'Constraint TradingAccount_pkey added';
    ELSE
        RAISE NOTICE 'Constraint TradingAccount_pkey already exists, skipping';
    END IF;
END
$$;

-- Table: Trade
DO $$
BEGIN
    IF NOT table_exists('Trade') THEN
        EXECUTE 'CREATE TABLE "Trade" (
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
            "updated_at" TIMESTAMP(3) NOT NULL
        )';
        RAISE NOTICE 'Table Trade created';
    ELSE
        RAISE NOTICE 'Table Trade already exists, skipping';
    END IF;

    IF NOT constraint_exists('Trade', 'Trade_pkey') THEN
        EXECUTE 'ALTER TABLE "Trade" ADD CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")';
        RAISE NOTICE 'Constraint Trade_pkey added';
    ELSE
        RAISE NOTICE 'Constraint Trade_pkey already exists, skipping';
    END IF;
END
$$;

-- Table: JournalEntry
DO $$
BEGIN
    IF NOT table_exists('JournalEntry') THEN
        EXECUTE 'CREATE TABLE "JournalEntry" (
            "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
            "user_id" UUID NOT NULL,
            "title" TEXT NOT NULL,
            "content" TEXT NOT NULL,
            "mood" TEXT,
            "market_condition" TEXT,
            "tags" TEXT,
            "image_url" TEXT,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL
        )';
        RAISE NOTICE 'Table JournalEntry created';
    ELSE
        RAISE NOTICE 'Table JournalEntry already exists, skipping';
    END IF;

    IF NOT constraint_exists('JournalEntry', 'JournalEntry_pkey') THEN
        EXECUTE 'ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")';
        RAISE NOTICE 'Constraint JournalEntry_pkey added';
    ELSE
        RAISE NOTICE 'Constraint JournalEntry_pkey already exists, skipping';
    END IF;
END
$$;

-- Table: Tag
DO $$
BEGIN
    IF NOT table_exists('Tag') THEN
        EXECUTE 'CREATE TABLE "Tag" (
            "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
            "user_id" UUID NOT NULL,
            "name" TEXT NOT NULL,
            "color" TEXT NOT NULL DEFAULT ''#a855f7'',
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )';
        RAISE NOTICE 'Table Tag created';
    ELSE
        RAISE NOTICE 'Table Tag already exists, skipping';
    END IF;

    IF NOT constraint_exists('Tag', 'Tag_pkey') THEN
        EXECUTE 'ALTER TABLE "Tag" ADD CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")';
        RAISE NOTICE 'Constraint Tag_pkey added';
    ELSE
        RAISE NOTICE 'Constraint Tag_pkey already exists, skipping';
    END IF;
END
$$;

-- Table: WeeklyGoal
DO $$
BEGIN
    IF NOT table_exists('WeeklyGoal') THEN
        EXECUTE 'CREATE TABLE "WeeklyGoal" (
            "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
            "user_id" UUID NOT NULL,
            "week_start" TIMESTAMP(3) NOT NULL,
            "target_trades" INTEGER NOT NULL DEFAULT 10,
            "target_profit" DOUBLE PRECISION,
            "current_trades" INTEGER NOT NULL DEFAULT 0,
            "current_profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "status" TEXT NOT NULL DEFAULT ''active'',
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL
        )';
        RAISE NOTICE 'Table WeeklyGoal created';
    ELSE
        RAISE NOTICE 'Table WeeklyGoal already exists, skipping';
    END IF;

    IF NOT constraint_exists('WeeklyGoal', 'WeeklyGoal_pkey') THEN
        EXECUTE 'ALTER TABLE "WeeklyGoal" ADD CONSTRAINT "WeeklyGoal_pkey" PRIMARY KEY ("id")';
        RAISE NOTICE 'Constraint WeeklyGoal_pkey added';
    ELSE
        RAISE NOTICE 'Constraint WeeklyGoal_pkey already exists, skipping';
    END IF;
END
$$;

-- Table: UserSubmission
DO $$
BEGIN
    IF NOT table_exists('UserSubmission') THEN
        EXECUTE 'CREATE TABLE "UserSubmission" (
            "id" SERIAL NOT NULL,
            "userId" UUID NOT NULL,
            "achievementKey" TEXT NOT NULL,
            "proofUrl" TEXT,
            "status" TEXT NOT NULL DEFAULT ''PENDING'',
            "reviewedBy" TEXT,
            "reviewedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL
        )';
        RAISE NOTICE 'Table UserSubmission created';
    ELSE
        RAISE NOTICE 'Table UserSubmission already exists, skipping';
    END IF;

    IF NOT constraint_exists('UserSubmission', 'UserSubmission_pkey') THEN
        EXECUTE 'ALTER TABLE "UserSubmission" ADD CONSTRAINT "UserSubmission_pkey" PRIMARY KEY ("id")';
        RAISE NOTICE 'Constraint UserSubmission_pkey added';
    ELSE
        RAISE NOTICE 'Constraint UserSubmission_pkey already exists, skipping';
    END IF;
END
$$;

-- Table: MissionProgress
DO $$
BEGIN
    IF NOT table_exists('MissionProgress') THEN
        EXECUTE 'CREATE TABLE "MissionProgress" (
            "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
            "userId" UUID NOT NULL,
            "missionKey" TEXT NOT NULL,
            "progress" INTEGER NOT NULL DEFAULT 0,
            "target" INTEGER NOT NULL DEFAULT 1,
            "completed" BOOLEAN NOT NULL DEFAULT false,
            "claimed" BOOLEAN NOT NULL DEFAULT false,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL
        )';
        RAISE NOTICE 'Table MissionProgress created';
    ELSE
        RAISE NOTICE 'Table MissionProgress already exists, skipping';
    END IF;

    IF NOT constraint_exists('MissionProgress', 'MissionProgress_pkey') THEN
        EXECUTE 'ALTER TABLE "MissionProgress" ADD CONSTRAINT "MissionProgress_pkey" PRIMARY KEY ("id")';
        RAISE NOTICE 'Constraint MissionProgress_pkey added';
    ELSE
        RAISE NOTICE 'Constraint MissionProgress_pkey already exists, skipping';
    END IF;
END
$$;

-- Table: SocialLink
DO $$
BEGIN
    IF NOT table_exists('SocialLink') THEN
        EXECUTE 'CREATE TABLE "SocialLink" (
            "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
            "userId" UUID NOT NULL,
            "platform" TEXT NOT NULL,
            "url" TEXT NOT NULL,
            "username" TEXT,
            "status" TEXT NOT NULL DEFAULT ''PENDING'',
            "reviewedBy" TEXT,
            "reviewedAt" TIMESTAMP(3),
            "rejectionReason" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL
        )';
        RAISE NOTICE 'Table SocialLink created';
    ELSE
        RAISE NOTICE 'Table SocialLink already exists, skipping';
    END IF;

    IF NOT constraint_exists('SocialLink', 'SocialLink_pkey') THEN
        EXECUTE 'ALTER TABLE "SocialLink" ADD CONSTRAINT "SocialLink_pkey" PRIMARY KEY ("id")';
        RAISE NOTICE 'Constraint SocialLink_pkey added';
    ELSE
        RAISE NOTICE 'Constraint SocialLink_pkey already exists, skipping';
    END IF;
END
$$;

-- ============================================================================
-- Foreign Keys (Hanya buat jika belum ada)
-- ============================================================================

DO $$
BEGIN
    -- UserSubscription
    IF NOT constraint_exists('UserSubscription', 'UserSubscription_userId_fkey') THEN
        EXECUTE 'ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE';
        RAISE NOTICE 'FK UserSubscription_userId_fkey created';
    END IF;

    -- Withdrawal
    IF NOT constraint_exists('Withdrawal', 'Withdrawal_userId_fkey') THEN
        EXECUTE 'ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE';
        RAISE NOTICE 'FK Withdrawal_userId_fkey created';
    END IF;

    -- Trade - user_id
    IF NOT constraint_exists('Trade', 'Trade_user_id_fkey') THEN
        EXECUTE 'ALTER TABLE "Trade" ADD CONSTRAINT "Trade_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE';
        RAISE NOTICE 'FK Trade_user_id_fkey created';
    END IF;

    -- Trade - account_id
    IF NOT constraint_exists('Trade', 'Trade_account_id_fkey') THEN
        EXECUTE 'ALTER TABLE "Trade" ADD CONSTRAINT "Trade_account_id_fkey"
            FOREIGN KEY ("account_id") REFERENCES "TradingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE';
        RAISE NOTICE 'FK Trade_account_id_fkey created';
    END IF;

    -- Trade - linked_journal_id
    IF NOT constraint_exists('Trade', 'Trade_linked_journal_id_fkey') THEN
        EXECUTE 'ALTER TABLE "Trade" ADD CONSTRAINT "Trade_linked_journal_id_fkey"
            FOREIGN KEY ("linked_journal_id") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE';
        RAISE NOTICE 'FK Trade_linked_journal_id_fkey created';
    END IF;

    -- JournalEntry
    IF NOT constraint_exists('JournalEntry', 'JournalEntry_user_id_fkey') THEN
        EXECUTE 'ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE';
        RAISE NOTICE 'FK JournalEntry_user_id_fkey created';
    END IF;

    -- Tag
    IF NOT constraint_exists('Tag', 'Tag_user_id_fkey') THEN
        EXECUTE 'ALTER TABLE "Tag" ADD CONSTRAINT "Tag_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE';
        RAISE NOTICE 'FK Tag_user_id_fkey created';
    END IF;

    -- WeeklyGoal
    IF NOT constraint_exists('WeeklyGoal', 'WeeklyGoal_user_id_fkey') THEN
        EXECUTE 'ALTER TABLE "WeeklyGoal" ADD CONSTRAINT "WeeklyGoal_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE';
        RAISE NOTICE 'FK WeeklyGoal_user_id_fkey created';
    END IF;

    -- TradingAccount
    IF NOT constraint_exists('TradingAccount', 'TradingAccount_user_id_fkey') THEN
        EXECUTE 'ALTER TABLE "TradingAccount" ADD CONSTRAINT "TradingAccount_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE';
        RAISE NOTICE 'FK TradingAccount_user_id_fkey created';
    END IF;

    -- UserSubmission
    IF NOT constraint_exists('UserSubmission', 'UserSubmission_userId_fkey') THEN
        EXECUTE 'ALTER TABLE "UserSubmission" ADD CONSTRAINT "UserSubmission_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE';
        RAISE NOTICE 'FK UserSubmission_userId_fkey created';
    END IF;

    -- MissionProgress
    IF NOT constraint_exists('MissionProgress', 'MissionProgress_userId_fkey') THEN
        EXECUTE 'ALTER TABLE "MissionProgress" ADD CONSTRAINT "MissionProgress_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE';
        RAISE NOTICE 'FK MissionProgress_userId_fkey created';
    END IF;

    -- SocialLink
    IF NOT constraint_exists('SocialLink', 'SocialLink_userId_fkey') THEN
        EXECUTE 'ALTER TABLE "SocialLink" ADD CONSTRAINT "SocialLink_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE';
        RAISE NOTICE 'FK SocialLink_userId_fkey created';
    END IF;
END
$$;

-- ============================================================================
-- Indexes (Hanya buat jika belum ada)
-- ============================================================================

CREATE INDEX IF NOT EXISTS "UserSubmission_userId_idx" ON "UserSubmission"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "MissionProgress_userId_missionKey_key" ON "MissionProgress"("userId", "missionKey");
CREATE INDEX IF NOT EXISTS "MissionProgress_userId_idx" ON "MissionProgress"("userId");
CREATE INDEX IF NOT EXISTS "UserSubscription_userId_idx" ON "UserSubscription"("userId");
CREATE INDEX IF NOT EXISTS "Withdrawal_userId_idx" ON "Withdrawal"("userId");
CREATE INDEX IF NOT EXISTS "Trade_user_id_idx" ON "Trade"("user_id");
CREATE INDEX IF NOT EXISTS "Trade_user_id_close_time_idx" ON "Trade"("user_id", "close_time");
CREATE INDEX IF NOT EXISTS "JournalEntry_user_id_idx" ON "JournalEntry"("user_id");
CREATE INDEX IF NOT EXISTS "Tag_user_id_idx" ON "Tag"("user_id");
CREATE INDEX IF NOT EXISTS "WeeklyGoal_user_id_week_start_idx" ON "WeeklyGoal"("user_id", "week_start");
CREATE INDEX IF NOT EXISTS "TradingAccount_user_id_idx" ON "TradingAccount"("user_id");
CREATE INDEX IF NOT EXISTS "SocialLink_userId_idx" ON "SocialLink"("userId");
CREATE INDEX IF NOT EXISTS "SocialLink_status_idx" ON "SocialLink"("status");

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