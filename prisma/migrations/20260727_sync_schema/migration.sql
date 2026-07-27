-- Migration: Sync production DB with current schema.prisma
--
-- Two things happening here:
--   1) DROP TradingAccount.broker_gmt_offset (removed from schema — feature dropped)
--   2) ADD missing columns that were added to schema.prisma but never migrated
--      (causing Prisma P2022 "column does not exist" errors in production)
--
-- Commits that added schema fields without migration:
--   - 8c0a572: Trade.stop_loss, Trade.take_profit, Trade.ticket_number
--   - 18153c1 / 8d95ee5: Profile.email_verified, email_verify_token, email_verify_exp_at, device_id
--   - 51e77be / 27f2c1b: Profile.my_referral_code, referred_by_code, has_ever_been_pro, commission_paid
--
-- All statements are idempotent (use DO $$ + information_schema check),
-- so this migration is safe to run multiple times.
--
-- Run via: Supabase SQL Editor, or `bun run db:migrate:deploy`

-- ==========================================================
-- 1) DROP TradingAccount.broker_gmt_offset
--    Column was removed from schema.prisma (feature dropped).
--    Session calc in auto-journal now uses UTC time directly (offset = 0).
-- ==========================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'TradingAccount' AND column_name = 'broker_gmt_offset'
  ) THEN
    ALTER TABLE "TradingAccount" DROP COLUMN "broker_gmt_offset";
    RAISE NOTICE 'Dropped column: TradingAccount.broker_gmt_offset';
  ELSE
    RAISE NOTICE 'Column already absent: TradingAccount.broker_gmt_offset (skipped)';
  END IF;
END $$;

-- ==========================================================
-- 2) Trade.stop_loss (DOUBLE PRECISION, nullable)
--    Added in commit 8c0a572
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Trade' AND column_name = 'stop_loss'
  ) THEN
    ALTER TABLE "Trade" ADD COLUMN "stop_loss" DOUBLE PRECISION;
    RAISE NOTICE 'Added column: Trade.stop_loss';
  ELSE
    RAISE NOTICE 'Column already exists: Trade.stop_loss (skipped)';
  END IF;
END $$;

-- ==========================================================
-- 3) Trade.take_profit (DOUBLE PRECISION, nullable)
--    Added in commit 8c0a572
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Trade' AND column_name = 'take_profit'
  ) THEN
    ALTER TABLE "Trade" ADD COLUMN "take_profit" DOUBLE PRECISION;
    RAISE NOTICE 'Added column: Trade.take_profit';
  ELSE
    RAISE NOTICE 'Column already exists: Trade.take_profit (skipped)';
  END IF;
END $$;

-- ==========================================================
-- 4) Trade.ticket_number (TEXT, nullable)
--    Added in commit 8c0a572
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Trade' AND column_name = 'ticket_number'
  ) THEN
    ALTER TABLE "Trade" ADD COLUMN "ticket_number" TEXT;
    RAISE NOTICE 'Added column: Trade.ticket_number';
  ELSE
    RAISE NOTICE 'Column already exists: Trade.ticket_number (skipped)';
  END IF;
END $$;

-- ==========================================================
-- 5) Profile.email_verified (BOOLEAN NOT NULL, default false)
--    Added in commit 18153c1 (custom email verification system)
--    NOTE: Profile table currently has "emailVerified" TIMESTAMP column
--    (on User table, not Profile). Profile needs its own boolean column.
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Profile' AND column_name = 'email_verified'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE 'Added column: Profile.email_verified';
  ELSE
    RAISE NOTICE 'Column already exists: Profile.email_verified (skipped)';
  END IF;
END $$;

-- ==========================================================
-- 6) Profile.email_verify_token (TEXT, nullable, unique)
--    Added in commit 18153c1
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Profile' AND column_name = 'email_verify_token'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "email_verify_token" TEXT;
    RAISE NOTICE 'Added column: Profile.email_verify_token';
  ELSE
    RAISE NOTICE 'Column already exists: Profile.email_verify_token (skipped)';
  END IF;
END $$;

-- Unique index for email_verify_token (only enforce uniqueness on non-null values)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'Profile_email_verify_token_key'
  ) THEN
    CREATE UNIQUE INDEX "Profile_email_verify_token_key" ON "Profile"("email_verify_token") WHERE "email_verify_token" IS NOT NULL;
    RAISE NOTICE 'Added unique index: Profile_email_verify_token_key';
  ELSE
    RAISE NOTICE 'Index already exists: Profile_email_verify_token_key (skipped)';
  END IF;
END $$;

-- ==========================================================
-- 7) Profile.email_verify_exp_at (TIMESTAMP, nullable)
--    Added in commit 18153c1
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Profile' AND column_name = 'email_verify_exp_at'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "email_verify_exp_at" TIMESTAMP(3);
    RAISE NOTICE 'Added column: Profile.email_verify_exp_at';
  ELSE
    RAISE NOTICE 'Column already exists: Profile.email_verify_exp_at (skipped)';
  END IF;
END $$;

-- ==========================================================
-- 8) Profile.device_id (TEXT, nullable)
--    Added in commit 18153c1
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Profile' AND column_name = 'device_id'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "device_id" TEXT;
    RAISE NOTICE 'Added column: Profile.device_id';
  ELSE
    RAISE NOTICE 'Column already exists: Profile.device_id (skipped)';
  END IF;
END $$;

-- ==========================================================
-- 9) Profile.my_referral_code (TEXT, nullable, unique)
--    Added in commit 27f2c1b (affiliate system)
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Profile' AND column_name = 'my_referral_code'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "my_referral_code" TEXT;
    RAISE NOTICE 'Added column: Profile.my_referral_code';
  ELSE
    RAISE NOTICE 'Column already exists: Profile.my_referral_code (skipped)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'Profile_my_referral_code_key'
  ) THEN
    CREATE UNIQUE INDEX "Profile_my_referral_code_key" ON "Profile"("my_referral_code") WHERE "my_referral_code" IS NOT NULL;
    RAISE NOTICE 'Added unique index: Profile_my_referral_code_key';
  ELSE
    RAISE NOTICE 'Index already exists: Profile_my_referral_code_key (skipped)';
  END IF;
END $$;

-- ==========================================================
-- 10) Profile.referred_by_code (TEXT, nullable)
--     Added in commit 27f2c1b
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Profile' AND column_name = 'referred_by_code'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "referred_by_code" TEXT;
    RAISE NOTICE 'Added column: Profile.referred_by_code';
  ELSE
    RAISE NOTICE 'Column already exists: Profile.referred_by_code (skipped)';
  END IF;
END $$;

-- ==========================================================
-- 11) Profile.has_ever_been_pro (BOOLEAN NOT NULL, default false)
--     Added in commit 27f2c1b
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Profile' AND column_name = 'has_ever_been_pro'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "has_ever_been_pro" BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE 'Added column: Profile.has_ever_been_pro';
  ELSE
    RAISE NOTICE 'Column already exists: Profile.has_ever_been_pro (skipped)';
  END IF;
END $$;

-- ==========================================================
-- 12) Profile.commission_paid (BOOLEAN NOT NULL, default false)
--     Added in commit 27f2c1b
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Profile' AND column_name = 'commission_paid'
  ) THEN
    ALTER TABLE "Profile" ADD COLUMN "commission_paid" BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE 'Added column: Profile.commission_paid';
  ELSE
    RAISE NOTICE 'Column already exists: Profile.commission_paid (skipped)';
  END IF;
END $$;

-- ==========================================================
-- DONE
-- ==========================================================
RAISE NOTICE 'Migration 20260727_add_missing_columns completed successfully.';
