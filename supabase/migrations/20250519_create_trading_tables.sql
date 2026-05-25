-- ===========================================
-- Trading Integration & Trades Schema
-- ===========================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- Table: trading_integrations
-- Menyimpan konfigurasi integrasi trading pihak ketiga
-- ===========================================
CREATE TABLE IF NOT EXISTS trading_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Basic Info
  name VARCHAR(255) NOT NULL, -- Nama custom untuk integrasi (contoh: "Akun Utama FxBlue")
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('fxblue', 'myfxbook', 'custom')),

  -- Credentials
  account_id VARCHAR(100) NOT NULL, -- Account Number MT5
  investor_password TEXT NOT NULL, -- Investor Password (sebaiknya dienkripsi)
  broker_server VARCHAR(255) NOT NULL, -- Nama server broker (contoh: "Exness-MT5")
  account_type VARCHAR(20) DEFAULT 'MT5' CHECK (account_type IN ('MT4', 'MT5')),

  -- Webhook Configuration
  webhook_url TEXT, -- URL webhook untuk menerima data dari provider
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  last_sync TIMESTAMP WITH TIME ZONE,

  -- Settings
  sync_settings JSONB DEFAULT '{}', -- Pengaturan sync custom

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_trading_integrations_user_id ON trading_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_integrations_provider ON trading_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_trading_integrations_status ON trading_integrations(status);

-- ===========================================
-- Table: trades
-- Menyimpan semua data transaksi dari berbagai source
-- ===========================================
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Account Info
  account_number VARCHAR(100) NOT NULL,
  ticket VARCHAR(100) NOT NULL, -- Unique trade ID per account

  -- Trade Details
  symbol VARCHAR(50) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('buy', 'sell')),
  lot DECIMAL(10, 2) NOT NULL,
  open_price DECIMAL(18, 8) NOT NULL,
  close_price DECIMAL(18, 8),
  open_time TIMESTAMP WITH TIME ZONE NOT NULL,
  close_time TIMESTAMP WITH TIME ZONE,

  -- Financials
  profit DECIMAL(18, 2) NOT NULL DEFAULT 0,
  commission DECIMAL(18, 2) DEFAULT 0,
  swap DECIMAL(18, 2) DEFAULT 0,

  -- Meta
  comment TEXT,
  source VARCHAR(50) NOT NULL CHECK (source IN ('fxblue', 'myfxbook', 'custom', 'metaapi')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_account_number ON trades(account_number);
CREATE INDEX IF NOT EXISTS idx_trades_ticket ON trades(ticket);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_source ON trades(source);
CREATE INDEX IF NOT EXISTS idx_trades_open_time ON trades(open_time);
CREATE INDEX IF NOT EXISTS idx_trades_close_time ON trades(close_time);

-- Unique constraint to prevent duplicate trades
CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_unique_trade
ON trades(account_number, ticket)
WHERE status = 'open';

-- ===========================================
-- Table: trading_accounts (jika belum ada)
-- Menyimpan koneksi trading account langsung (MetaApi, dll)
-- ===========================================
CREATE TABLE IF NOT EXISTS trading_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- MetaApi Credentials
  metaapi_account_id VARCHAR(255) UNIQUE,
  metaapi_token TEXT,

  -- Account Info
  account_number VARCHAR(100),
  broker_name VARCHAR(255),
  broker_server VARCHAR(255),
  account_type VARCHAR(20) DEFAULT 'MT5',
  currency VARCHAR(10) DEFAULT 'USD',
  leverage INTEGER,
  balance DECIMAL(18, 2) DEFAULT 0,
  equity DECIMAL(18, 2) DEFAULT 0,
  margin DECIMAL(18, 2) DEFAULT 0,
  free_margin DECIMAL(18, 2) DEFAULT 0,
  profit DECIMAL(18, 2) DEFAULT 0,

  -- Status
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('CONNECTED', 'PENDING', 'ERROR')),
  error_message TEXT,

  -- Timestamps
  last_sync TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_trading_accounts_user_id ON trading_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_accounts_status ON trading_accounts(status);
CREATE INDEX IF NOT EXISTS idx_trading_accounts_metaapi_id ON trading_accounts(metaapi_account_id);

-- ===========================================
-- Row Level Security (RLS) Policies
-- ===========================================

-- Enable RLS
ALTER TABLE trading_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own integrations
CREATE POLICY "Users can view own integrations"
ON trading_integrations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations"
ON trading_integrations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations"
ON trading_integrations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations"
ON trading_integrations FOR DELETE
USING (auth.uid() = user_id);

-- Policy: Users can only see their own trades
CREATE POLICY "Users can view own trades"
ON trades FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades"
ON trades FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trades"
ON trades FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Webhook service can insert trades for users
-- This allows the webhook endpoint (using service role key) to insert trades
CREATE POLICY "Service role can insert trades"
ON trades FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update trades"
ON trades FOR UPDATE
TO service_role
WITH CHECK (true);

-- Policy: Users can only see their own trading accounts
CREATE POLICY "Users can view own trading accounts"
ON trading_accounts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trading accounts"
ON trading_accounts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trading accounts"
ON trading_accounts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trading accounts"
ON trading_accounts FOR DELETE
USING (auth.uid() = user_id);

-- ===========================================
-- Functions & Triggers for updated_at
-- ===========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables
CREATE TRIGGER update_trading_integrations_updated_at
  BEFORE UPDATE ON trading_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trading_accounts_updated_at
  BEFORE UPDATE ON trading_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- Grant permissions
-- ===========================================

-- Grant access to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON trading_integrations TO authenticated;
GRANT ALL ON trades TO authenticated;
GRANT ALL ON trading_accounts TO authenticated;

-- Grant access to service role
GRANT ALL ON trading_integrations TO service_role;
GRANT ALL ON trades TO service_role;
GRANT ALL ON trading_accounts TO service_role;

-- ===========================================
-- Comments for documentation
-- ===========================================

COMMENT ON TABLE trading_integrations IS 'Menyimpan konfigurasi integrasi trading pihak ketiga (FxBlue, Myfxbook, dll)';
COMMENT ON TABLE trades IS 'Menyimpan semua data transaksi dari berbagai source webhook';
COMMENT ON TABLE trading_accounts IS 'Menyimpan koneksi trading account langsung (MetaApi, dll)';

COMMENT ON COLUMN trading_integrations.investor_password IS 'Investor password (gunakan enkripsi di production)';
COMMENT ON COLUMN trading_integrations.webhook_url IS 'URL webhook untuk menerima data dari provider pihak ketiga';

COMMENT ON COLUMN trades.ticket IS 'Unique trade ID per account number';
COMMENT ON COLUMN trades.source IS 'Sumber data: fxblue, myfxbook, custom, metaapi';
