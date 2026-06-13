-- Fix: Drop triggers that reference non-existent columns
-- This fixes the error: The column 'new' does not exist

DROP TRIGGER IF EXISTS update_Profile_updated_at ON "Profile";
DROP TRIGGER IF EXISTS update_User_updated_at ON "User";
DROP TRIGGER IF EXISTS update_Trade_updated_at ON "Trade";
DROP TRIGGER IF EXISTS update_JournalEntry_updated_at ON "JournalEntry";
DROP TRIGGER IF EXISTS update_Tag_updated_at ON "Tag";
DROP TRIGGER IF EXISTS update_WeeklyGoal_updated_at ON "WeeklyGoal";
DROP TRIGGER IF EXISTS update_TradingAccount_updated_at ON "TradingAccount";
DROP TRIGGER IF EXISTS update_SocialLink_updated_at ON "SocialLink";
DROP TRIGGER IF EXISTS update_UserSubmission_updated_at ON "UserSubmission";
DROP TRIGGER IF EXISTS update_MissionProgress_updated_at ON "MissionProgress";
DROP TRIGGER IF EXISTS update_UserSubscription_updated_at ON "UserSubscription";
DROP TRIGGER IF EXISTS update_Withdrawal_updated_at ON "Withdrawal";
DROP TRIGGER IF EXISTS update_PromoCode_updated_at ON "PromoCode";

DROP FUNCTION IF EXISTS update_updated_at_column();