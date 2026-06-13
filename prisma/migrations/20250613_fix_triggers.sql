-- Fix: Drop triggers that reference non-existent columns
-- This fixes the error: The column 'new' does not exist

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_trades_updated_at ON trades;
DROP TRIGGER IF EXISTS update_journal_entries_updated_at ON journal_entries;
DROP TRIGGER IF EXISTS update_tags_updated_at ON tags;
DROP TRIGGER IF EXISTS update_weekly_goals_updated_at ON weekly_goals;
DROP TRIGGER IF EXISTS update_trading_accounts_updated_at ON trading_accounts;
DROP TRIGGER IF EXISTS update_social_links_updated_at ON social_links;
DROP TRIGGER IF EXISTS update_user_submissions_updated_at ON user_submissions;
DROP TRIGGER IF EXISTS update_mission_progress_updated_at ON mission_progress;
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
DROP TRIGGER IF EXISTS update_withdrawals_updated_at ON withdrawals;
DROP TRIGGER IF EXISTS update_promo_codes_updated_at ON promo_codes;

DROP FUNCTION IF EXISTS update_updated_at_column();