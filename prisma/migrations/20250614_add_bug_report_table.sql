-- Migration: Add BugReport table
-- Description: Create bug_reports table for tracking bug submissions and rewards

-- Create bug_reports table
CREATE TABLE IF NOT EXISTS bug_reports (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    description TEXT NOT NULL,
    screenshot_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_id ON bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);

-- Create comments for documentation
COMMENT ON TABLE bug_reports IS 'Stores bug reports submitted by users';
COMMENT ON COLUMN bug_reports.id IS 'Primary key UUID';
COMMENT ON COLUMN bug_reports.user_id IS 'Foreign key to profiles table';
COMMENT ON COLUMN bug_reports.description IS 'Bug description (max 5000 characters)';
COMMENT ON COLUMN bug_reports.screenshot_url IS 'URL to screenshot in Supabase Storage';
COMMENT ON COLUMN bug_reports.status IS 'Status: PENDING, REWARDED';
COMMENT ON COLUMN bug_reports.created_at IS 'Timestamp when bug report was created';
COMMENT ON COLUMN bug_reports.updated_at IS 'Timestamp when bug report was last updated';

-- Enable Row Level Security (optional, recommended)
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can read their own bug reports
CREATE POLICY "Users can view own bug reports"
    ON bug_reports FOR SELECT
    USING (auth.uid()::text = user_id);

-- Users can insert their own bug reports
CREATE POLICY "Users can insert own bug reports"
    ON bug_reports FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

-- Admins can read all bug reports
CREATE POLICY "Admins can view all bug reports"
    ON bug_reports FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()::text
            AND profiles.role = 'ADMIN'
        )
    );

-- Admins can update bug reports (for rewarding)
CREATE POLICY "Admins can update bug reports"
    ON bug_reports FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()::text
            AND profiles.role = 'ADMIN'
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_bug_reports_updated_at
    BEFORE UPDATE ON bug_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();