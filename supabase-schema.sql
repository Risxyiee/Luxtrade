-- LuxTrade Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trades Table
CREATE TABLE IF NOT EXISTS trades (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('LONG', 'SHORT')),
  entry_price DECIMAL(20, 4) NOT NULL,
  exit_price DECIMAL(20, 4),
  quantity DECIMAL(20, 4) NOT NULL,
  entry_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  exit_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(10) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  profit_loss DECIMAL(20, 4),
  profit_loss_percent DECIMAL(10, 4),
  strategy VARCHAR(100),
  notes TEXT,
  tags TEXT[],
  screenshot_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Journal Entries Table
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  mood VARCHAR(20) CHECK (mood IN ('CONFIDENT', 'NEUTRAL', 'ANXIOUS', 'FRUSTRATED')),
  market_condition VARCHAR(20) CHECK (market_condition IN ('BULLISH', 'BEARISH', 'SIDEWAYS')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Watchlist Table
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(200),
  target_price DECIMAL(20, 4),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance Metrics Table (for historical tracking)
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  total_profit DECIMAL(20, 4) DEFAULT 0,
  win_rate DECIMAL(5, 2) DEFAULT 0,
  avg_profit DECIMAL(20, 4) DEFAULT 0,
  avg_loss DECIMAL(20, 4) DEFAULT 0,
  sharpe_ratio DECIMAL(10, 4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_entry_date ON trades(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_created_at ON journal_entries(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_trades_updated_at ON trades;
CREATE TRIGGER update_trades_updated_at
    BEFORE UPDATE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_journal_entries_updated_at ON journal_entries;
CREATE TRIGGER update_journal_entries_updated_at
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (optional - for production)
-- ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

-- For development, create policies that allow all operations
CREATE POLICY "Allow all operations on trades" ON trades FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on journal_entries" ON journal_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on watchlist" ON watchlist FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on performance_metrics" ON performance_metrics FOR ALL USING (true) WITH CHECK (true);

-- Insert some sample data for testing
INSERT INTO trades (symbol, type, entry_price, exit_price, quantity, entry_date, exit_date, status, profit_loss, profit_loss_percent, strategy, notes) VALUES
('AAPL', 'LONG', 175.50, 182.30, 100, '2024-01-15 09:30:00', '2024-01-17 14:00:00', 'CLOSED', 680.00, 3.87, 'Breakout', 'Strong earnings beat, entered on volume spike'),
('TSLA', 'SHORT', 245.00, 238.50, 50, '2024-01-18 10:15:00', '2024-01-19 15:30:00', 'CLOSED', 325.00, 2.65, 'Mean Reversion', 'Overextended on weak volume'),
('NVDA', 'LONG', 485.00, NULL, 25, '2024-01-22 09:45:00', NULL, 'OPEN', NULL, NULL, 'Swing', 'AI momentum play'),
('MSFT', 'LONG', 378.00, 385.20, 75, '2024-01-10 11:00:00', '2024-01-12 14:30:00', 'CLOSED', 540.00, 1.91, 'Trend Following', 'Cloud segment strength'),
('META', 'LONG', 355.00, 368.50, 40, '2024-01-08 09:30:00', '2024-01-11 10:00:00', 'CLOSED', 540.00, 3.80, 'Breakout', 'Ad revenue recovery');

INSERT INTO journal_entries (title, content, mood, market_condition) VALUES
('Market Analysis', 'Strong bullish momentum in tech sector. Watching NVDA and AMD for potential entries on pullbacks. Fed comments suggest rates may stay steady.', 'CONFIDENT', 'BULLISH'),
('Trading Session Review', 'Had some good trades today but missed a few opportunities due to hesitation. Need to improve execution speed on breakout setups.', 'NEUTRAL', 'SIDEWAYS'),
('Weekly Reflection', 'This week was challenging with volatile markets. Stick to the trading plan and avoid overtrading during uncertain conditions.', 'ANXIOUS', 'BEARISH');

INSERT INTO watchlist (symbol, name, target_price, notes) VALUES
('AMD', 'Advanced Micro Devices', 165.00, 'Watching for AI chip momentum'),
('GOOGL', 'Alphabet Inc.', 145.00, 'Cloud growth potential'),
('AMZN', 'Amazon.com', 178.00, 'E-commerce recovery play');
