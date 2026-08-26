-- ============================================================================
-- LuxTrade Database Manual Setup Script
-- Run this in Supabase SQL Editor to create all required tables
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Table: Profile
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Profile" (
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

-- ============================================================================
-- Table: User
-- ============================================================================
CREATE TABLE IF NOT EXISTS "User" (
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

-- ============================================================================
-- Table: UserSubscription
-- ============================================================================
CREATE TABLE IF NOT EXISTS "UserSubscription" (
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

-- ============================================================================
-- Table: Withdrawal
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Withdrawal" (
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

-- ============================================================================
-- Table: TradingAccount
-- ============================================================================
CREATE TABLE IF NOT EXISTS "TradingAccount" (
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

-- ============================================================================
-- Table: Trade
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Trade" (
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

-- ============================================================================
-- Table: JournalEntry
-- ============================================================================
CREATE TABLE IF NOT EXISTS "JournalEntry" (
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

-- ============================================================================
-- Table: Tag
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Tag" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#a855f7',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Table: WeeklyGoal
-- ============================================================================
CREATE TABLE IF NOT EXISTS "WeeklyGoal" (
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

-- ============================================================================
-- Table: UserSubmission
-- ============================================================================
CREATE TABLE IF NOT EXISTS "UserSubmission" (
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

-- ============================================================================
-- Table: MissionProgress
-- ============================================================================
CREATE TABLE IF NOT EXISTS "MissionProgress" (
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

-- ============================================================================
-- Table: SocialLink
-- ============================================================================
CREATE TABLE IF NOT EXISTS "SocialLink" (
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

-- ============================================================================
-- Foreign Keys
-- ============================================================================

-- Profile relations
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_trades_user_id_fkey"
    FOREIGN KEY ("id") REFERENCES "Trade"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- UserSubmission
ALTER TABLE "UserSubmission" ADD CONSTRAINT "UserSubmission_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MissionProgress
ALTER TABLE "MissionProgress" ADD CONSTRAINT "MissionProgress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- UserSubscription
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Withdrawal
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Trade
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Trade" ADD CONSTRAINT "Trade_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "TradingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Trade" ADD CONSTRAINT "Trade_linked_journal_id_fkey"
    FOREIGN KEY ("linked_journal_id") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- JournalEntry
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tag
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- WeeklyGoal
ALTER TABLE "WeeklyGoal" ADD CONSTRAINT "WeeklyGoal_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TradingAccount
ALTER TABLE "TradingAccount" ADD CONSTRAINT "TradingAccount_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SocialLink
ALTER TABLE "SocialLink" ADD CONSTRAINT "SocialLink_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Indexes
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
-- Functions for auto-updating updatedAt timestamp
-- ============================================================================

-- Create generic update function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updatedAt
CREATE TRIGGER update_Profile_updated_at BEFORE UPDATE ON "Profile"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_User_updated_at BEFORE UPDATE ON "User"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_UserSubscription_updated_at BEFORE UPDATE ON "UserSubscription"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_Withdrawal_updated_at BEFORE UPDATE ON "Withdrawal"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_Trade_updated_at BEFORE UPDATE ON "Trade"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_JournalEntry_updated_at BEFORE UPDATE ON "JournalEntry"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_WeeklyGoal_updated_at BEFORE UPDATE ON "WeeklyGoal"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_TradingAccount_updated_at BEFORE UPDATE ON "TradingAccount"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_MissionProgress_updated_at BEFORE UPDATE ON "MissionProgress"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_UserSubmission_updated_at BEFORE UPDATE ON "UserSubmission"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_SocialLink_updated_at BEFORE UPDATE ON "SocialLink"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Completed!
-- ============================================================================
SELECT 'LuxTrade database setup completed successfully!' AS message;