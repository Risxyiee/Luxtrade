-- ============================================
-- FIX: Add missing columns to existing tables
-- Run this in Supabase SQL Editor if tables already exist
-- ============================================

-- Check if close_time column exists in trades table and add if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'trades'
        AND column_name = 'close_time'
    ) THEN
        ALTER TABLE trades ADD COLUMN "close_time" TIMESTAMP NOT NULL DEFAULT NOW();
    END IF;
END $$;

-- Check if open_time column exists and add if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'trades'
        AND column_name = 'open_time'
    ) THEN
        ALTER TABLE trades ADD COLUMN "open_time" TIMESTAMP NOT NULL DEFAULT NOW();
    END IF;
END $$;

-- Check if other required columns exist in trades table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'account_id') THEN
        ALTER TABLE trades ADD COLUMN "account_id" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'screenshot_url') THEN
        ALTER TABLE trades ADD COLUMN "screenshot_url" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'emotion') THEN
        ALTER TABLE trades ADD COLUMN "emotion" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'linked_journal_id') THEN
        ALTER TABLE trades ADD COLUMN "linked_journal_id" TEXT;
    END IF;
END $$;

-- Check if foreign key constraint exists for linked_journal_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'trades_linked_journal_id_fkey'
    ) THEN
        ALTER TABLE trades
        ADD CONSTRAINT "trades_linked_journal_id_fkey"
        FOREIGN KEY ("linked_journal_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- Check if foreign key constraint exists for account_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'trades_account_id_fkey'
    ) THEN
        ALTER TABLE trades
        ADD CONSTRAINT "trades_account_id_fkey"
        FOREIGN KEY ("account_id") REFERENCES "trading_accounts"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- Check if index exists for close_time
CREATE INDEX IF NOT EXISTS idx_trades_close_time ON trades("close_time" DESC);

-- Verify the trades table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'trades'
ORDER BY ordinal_position;
