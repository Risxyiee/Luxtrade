-- ============================================================
-- LuxTrade - Database Schema Creation Script
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: User (NextAuth integration)
-- ============================================================
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "name" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: Profile (User profile and settings)
-- ============================================================
CREATE TABLE IF NOT EXISTS "Profile" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT,
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "achievements" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "proExpiry" TIMESTAMP(3),
    "role" TEXT NOT NULL DEFAULT 'USER',
    "full_name" TEXT,
    "is_pro" BOOLEAN NOT NULL DEFAULT false,
    "subscription_until" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: TradingAccount
-- ============================================================
CREATE TABLE IF NOT EXISTS "TradingAccount" (
    "id" TEXT PRIMARY KEY,
    "user_id" TEXT NOT NULL,
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

    CONSTRAINT "TradingAccount_user_id_fkey"
        FOREIGN KEY ("user_id")
        REFERENCES "Profile"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================================
-- TABLE: Trade
-- ============================================================
CREATE TABLE IF NOT EXISTS "Trade" (
    "id" TEXT PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT,
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
    "linked_journal_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_user_id_fkey"
        FOREIGN KEY ("user_id")
        REFERENCES "Profile"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT "Trade_account_id_fkey"
        FOREIGN KEY ("account_id")
        REFERENCES "TradingAccount"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,

    CONSTRAINT "Trade_linked_journal_id_fkey"
        FOREIGN KEY ("linked_journal_id")
        REFERENCES "JournalEntry"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- ============================================================
-- TABLE: JournalEntry
-- ============================================================
CREATE TABLE IF NOT EXISTS "JournalEntry" (
    "id" TEXT PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mood" TEXT,
    "market_condition" TEXT,
    "tags" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_user_id_fkey"
        FOREIGN KEY ("user_id")
        REFERENCES "Profile"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================================
-- TABLE: Tag
-- ============================================================
CREATE TABLE IF NOT EXISTS "Tag" (
    "id" TEXT PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#a855f7',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_user_id_fkey"
        FOREIGN KEY ("user_id")
        REFERENCES "Profile"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================================
-- TABLE: WeeklyGoal
-- ============================================================
CREATE TABLE IF NOT EXISTS "WeeklyGoal" (
    "id" TEXT PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "week_start" TIMESTAMP(3) NOT NULL,
    "target_trades" INTEGER NOT NULL DEFAULT 10,
    "target_profit" DOUBLE PRECISION,
    "current_trades" INTEGER NOT NULL DEFAULT 0,
    "current_profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyGoal_user_id_fkey"
        FOREIGN KEY ("user_id")
        REFERENCES "Profile"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================================
-- TABLE: UserSubscription
-- ============================================================
CREATE TABLE IF NOT EXISTS "UserSubscription" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSubscription_userId_fkey"
        FOREIGN KEY ("userId")
        REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================================
-- TABLE: Withdrawal
-- ============================================================
CREATE TABLE IF NOT EXISTS "Withdrawal" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankAccount" TEXT NOT NULL,
    "bankHolder" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Withdrawal_userId_fkey"
        FOREIGN KEY ("userId")
        REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================================
-- TABLE: SocialLink
-- ============================================================
CREATE TABLE IF NOT EXISTS "SocialLink" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "username" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialLink_userId_fkey"
        FOREIGN KEY ("userId")
        REFERENCES "Profile"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================================
-- TABLE: UserSubmission
-- ============================================================
CREATE TABLE IF NOT EXISTS "UserSubmission" (
    "id" SERIAL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "achievementKey" TEXT NOT NULL,
    "proofUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSubmission_userId_fkey"
        FOREIGN KEY ("userId")
        REFERENCES "Profile"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================================
-- TABLE: MissionProgress
-- ============================================================
CREATE TABLE IF NOT EXISTS "MissionProgress" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "missionKey" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL DEFAULT 1,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionProgress_userId_fkey"
        FOREIGN KEY ("userId")
        REFERENCES "Profile"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================================
-- INDEXES
-- ============================================================

-- User indexes
CREATE UNIQUE INDEX IF NOT EXISTS "User.email_unique" ON "User"("email");

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

-- UserSubmission indexes
CREATE INDEX IF NOT EXISTS "UserSubmission_userId_idx" ON "UserSubmission"("userId");

-- MissionProgress indexes
CREATE INDEX IF NOT EXISTS "MissionProgress_userId_missionKey_key" ON "MissionProgress"("userId", "missionKey");
CREATE INDEX IF NOT EXISTS "MissionProgress_userId_idx" ON "MissionProgress"("userId");

-- ============================================================
-- UNIQUE CONSTRAINTS
-- ============================================================

-- MissionProgress unique combination
CREATE UNIQUE INDEX IF NOT EXISTS "MissionProgress_userId_missionKey_unique"
    ON "MissionProgress"("userId", "missionKey");

-- ============================================================
-- FUNCTION: Auto-update updatedAt timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS: Auto-update updatedAt
-- ============================================================

-- Profile
CREATE TRIGGER update_profile_updated_at
    BEFORE UPDATE ON "Profile"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trade
CREATE TRIGGER update_trade_updated_at
    BEFORE UPDATE ON "Trade"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- JournalEntry
CREATE TRIGGER update_journal_entry_updated_at
    BEFORE UPDATE ON "JournalEntry"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- WeeklyGoal
CREATE TRIGGER update_weekly_goal_updated_at
    BEFORE UPDATE ON "WeeklyGoal"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- TradingAccount
CREATE TRIGGER update_trading_account_updated_at
    BEFORE UPDATE ON "TradingAccount"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- User
CREATE TRIGGER update_user_updated_at
    BEFORE UPDATE ON "User"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- UserSubscription
CREATE TRIGGER update_user_subscription_updated_at
    BEFORE UPDATE ON "UserSubscription"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Withdrawal
CREATE TRIGGER update_withdrawal_updated_at
    BEFORE UPDATE ON "Withdrawal"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- SocialLink
CREATE TRIGGER update_social_link_updated_at
    BEFORE UPDATE ON "SocialLink"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- UserSubmission
CREATE TRIGGER update_user_submission_updated_at
    BEFORE UPDATE ON "UserSubmission"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- MissionProgress
CREATE TRIGGER update_mission_progress_updated_at
    BEFORE UPDATE ON "MissionProgress"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMPLETED!
-- ============================================================