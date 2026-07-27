-- Migration: Sync production DB with current schema.prisma
--
-- Two things happening here:
--   1) DROP trading_accounts.broker_gmt_offset (removed from schema — feature dropped)
--   2) ADD missing columns that were added to schema.prisma but never migrated
--      (causing Prisma P2022 "column does not exist" errors in production)
--
-- IMPORTANT: Prisma @@map() maps model names to actual table names:
--   Profile         -> profiles
--   Trade           -> trades
--   TradingAccount  -> trading_accounts
-- We query information_schema with the ACTUAL table name (lowercase via @@map).
--
-- All statements are idempotent (use DO $$ + information_schema check),
-- so this migration is safe to run multiple times.
--
-- Run via: Supabase SQL Editor

-- ==========================================================
-- 1) DROP trading_accounts.broker_gmt_offset
--    Column was removed from schema.prisma (feature dropped).
--    Session calc in auto-journal now uses UTC time directly (offset = 0).
-- ==========================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trading_accounts' AND column_name = 'broker_gmt_offset'
  ) THEN
    ALTER TABLE "trading_accounts" DROP COLUMN "broker_gmt_offset";
    RAISE NOTICE 'Dropped column: trading_accounts.broker_gmt_offset';
  ELSE
    RAISE NOTICE 'Column already absent: trading_accounts.broker_gmt_offset (skipped)';
  END IF;
END $$;

-- ==========================================================
-- 2) trades.stop_loss (DOUBLE PRECISION, nullable)
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'stop_loss'
  ) THEN
    ALTER TABLE "trades" ADD COLUMN "stop_loss" DOUBLE PRECISION;
    RAISE NOTICE 'Added column: trades.stop_loss';
  ELSE
    RAISE NOTICE 'Column already exists: trades.stop_loss (skipped)';
  END IF;
END $$;

-- ==========================================================
-- 3) trades.take_profit (DOUBLE PRECISION, nullable)
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'take_profit'
  ) THEN
    ALTER TABLE "trades" ADD COLUMN "take_profit" DOUBLE PRECISION;
    RAISE NOTICE 'Added column: trades.take_profit';
  ELSE
    RAISE NOTICE 'Column already exists: trades.take_profit (skipped)';
  END IF;
END $$;

-- ==========================================================
-- 4) trades.ticket_number (TEXT, nullable)
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'ticket_number'
  ) THEN
    ALTER TABLE "trades" ADD COLUMN "ticket_number" TEXT;
    RAISE NOTICE 'Added column: trades.ticket_number';
  ELSE
    RAISE NOTICE 'Column already exists: trades.ticket_number (skipped)';
  END IF;
END $$;

-- ==========================================================
-- 5) profiles.email_verified (BOOLEAN NOT NULL, default false)
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email_verified'
  ) THEN
    ALTER TABLE "profiles" ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE 'Added column: profiles.email_verified';
  ELSE
    RAISE NOTICE 'Column already exists: profiles.email_verified (skipped)';
  END IF;
END $$;

-- ==========================================================
-- 6) profiles.email_verify_token (TEXT, nullable, unique)
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email_verify_token'
  ) THEN
    ALTER TABLE "profiles" ADD COLUMN "email_verify_token" TEXT;
    RAISE NOTICE 'Added column: profiles.email_verify_token';
  ELSE
    RAISE NOTICE 'Column already exists: profiles.email_verify_token (skipped)';
  END IF;
END $$;

-- Unique index for email_verify_token (only enforce uniqueness on non-null values)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'profiles_email_verify_token_key'
  ) THEN
    CREATE UNIQUE INDEX "profiles_email_verify_token_key" ON "profiles"("email_verify_token") WHERE "email_verify_token" IS NOT NULL;
    RAISE NOTICE 'Added unique index: profiles_email_verify_token_key';
  ELSE
    RAISE NOTICE 'Index already exists: profiles_email_verify_token_key (skipped)';
  END IF;
END $$;

-- ==========================================================
-- 7) profiles.email_verify_exp_at (TIMESTAMP, nullable)
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email_verify_exp_at'
  ) THEN
    ALTER TABLE "profiles" ADD COLUMN "email_verify_exp_at" TIMESTAMP(3);
    RAISE NOTICE 'Added column: profiles.email_verify_exp_at';
  ELSE
    RAISE NOTICE 'Column already exists: profiles.email_verify_exp_at (skipped)';
  END IF;
END $$;

-- ==========================================================
-- 8) profiles.device_id (TEXT, nullable)
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'device_id'
  ) THEN
    ALTER TABLE "profiles" ADD COLUMN "device_id" TEXT;
    RAISE NOTICE 'Added column: profiles.device_id';
  ELSE
    RAISE NOTICE 'Column already exists: profiles.device_id (skipped)';
  END IF;
END $$;

-- ==========================================================
-- 9) profiles.my_referral_code (TEXT, nullable, unique)
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'my_referral_code'
  ) THEN
    ALTER TABLE "profiles" ADD COLUMN "my_referral_code" TEXT;
    RAISE NOTICE 'Added column: profiles.my_referral_code';
  ELSE
    RAISE NOTICE 'Column already exists: profiles.my_referral_code (skipped)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'profiles_my_referral_code_key'
  ) THEN
    CREATE UNIQUE INDEX "profiles_my_referral_code_key" ON "profiles"("my_referral_code") WHERE "my_referral_code" IS NOT NULL;
    RAISE NOTICE 'Added unique index: profiles_my_referral_code_key';
  ELSE
    RAISE NOTICE 'Index already exists: profiles_my_referral_code_key (skipped)';
  END IF;
END $$;

-- ==========================================================
-- 10) profiles.referred_by_code (TEXT, nullable)
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'referred_by_code'
  ) THEN
    ALTER TABLE "profiles" ADD COLUMN "referred_by_code" TEXT;
    RAISE NOTICE 'Added column: profiles.referred_by_code';
  ELSE
    RAISE NOTICE 'Column already exists: profiles.referred_by_code (skipped)';
  END IF;
END $$;

-- ==========================================================
-- 11) profiles.has_ever_been_pro (BOOLEAN NOT NULL, default false)
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'has_ever_been_pro'
  ) THEN
    ALTER TABLE "profiles" ADD COLUMN "has_ever_been_pro" BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE 'Added column: profiles.has_ever_been_pro';
  ELSE
    RAISE NOTICE 'Column already exists: profiles.has_ever_been_pro (skipped)';
  END IF;
END $$;

-- ==========================================================
-- 12) profiles.commission_paid (BOOLEAN NOT NULL, default false)
-- ==========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'commission_paid'
  ) THEN
    ALTER TABLE "profiles" ADD COLUMN "commission_paid" BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE 'Added column: profiles.commission_paid';
  ELSE
    RAISE NOTICE 'Column already exists: profiles.commission_paid (skipped)';
  END IF;
END $$;
