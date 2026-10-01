-- Add consistency_rule and best_day_pl columns to prop_firm_challenges
ALTER TABLE prop_firm_challenges ADD COLUMN IF NOT EXISTS consistency_rule FLOAT DEFAULT 0;
ALTER TABLE prop_firm_challenges ADD COLUMN IF NOT EXISTS best_day_pl FLOAT DEFAULT 0;
