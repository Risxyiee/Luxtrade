-- Migration: Create trading_accounts table for MetaApi Auto-Journal feature
-- This table stores MT4/MT5 trading account connections

-- Drop table if exists (for development purposes)
DROP TABLE IF EXISTS public.trading_accounts CASCADE;

-- Create trading_accounts table
CREATE TABLE public.trading_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_number TEXT NOT NULL,
    broker_server TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('MT4', 'MT5')),
    metaapi_account_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'CONNECTED' CHECK (status IN ('CONNECTED', 'DISCONNECTED', 'PENDING', 'ERROR')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure one account_number per user (prevent duplicates)
    CONSTRAINT unique_account_per_user UNIQUE (user_id, account_number)
);

-- Create indexes for better query performance
CREATE INDEX idx_trading_accounts_user_id ON public.trading_accounts(user_id);
CREATE INDEX idx_trading_accounts_status ON public.trading_accounts(status);
CREATE INDEX idx_trading_accounts_platform ON public.trading_accounts(platform);

-- Add RLS (Row Level Security) policies
ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own trading accounts
CREATE POLICY "Users can view own trading accounts"
    ON public.trading_accounts
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own trading accounts
CREATE POLICY "Users can insert own trading accounts"
    ON public.trading_accounts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own trading accounts
    ON public.trading_accounts
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: Users can delete their own trading accounts
CREATE POLICY "Users can delete own trading accounts"
    ON public.trading_accounts
    FOR DELETE
    USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.trading_accounts TO authenticated;
GRANT SELECT ON public.trading_accounts TO anon;

-- Add comment for documentation
COMMENT ON TABLE public.trading_accounts IS 'Stores MT4/MT5 trading account connections for MetaApi Auto-Journal feature';
COMMENT ON COLUMN public.trading_accounts.user_id IS 'Reference to the user who owns this trading account';
COMMENT ON COLUMN public.trading_accounts.account_number IS 'MT4/MT5 account number (e.g., 12345678)';
COMMENT ON COLUMN public.trading_accounts.broker_server IS 'Broker server name (e.g., MetaQuotes-Demo)';
COMMENT ON COLUMN public.trading_accounts.platform IS 'Platform type: MT4 or MT5';
COMMENT ON COLUMN public.trading_accounts.metaapi_account_id IS 'Account ID from MetaApi service';
COMMENT ON COLUMN public.trading_accounts.status IS 'Connection status: CONNECTED, DISCONNECTED, PENDING, ERROR';
