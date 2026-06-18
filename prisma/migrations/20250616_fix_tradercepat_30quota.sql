-- Update TRADERCEPAT promo code to 100% discount (FREE) with 30 quota
-- Run this in Supabase SQL Editor

UPDATE promo_codes
SET
  "discountPercent" = 100,
  "maxQuota" = 30,
  "usedQuota" = 0,
  "durationMonths" = 3,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE code = 'TRADERCEPAT';

-- Verify the update
SELECT
  id,
  code,
  description,
  "discountPercent" as discount_percent,
  "maxQuota" as max_quota,
  "usedQuota" as used_quota,
  "durationMonths" as duration_months,
  "startDate" as start_date,
  "endDate" as end_date,
  "isActive" as is_active,
  "maxQuota" - "usedQuota" as remaining_quota
FROM promo_codes
WHERE code = 'TRADERCEPAT';