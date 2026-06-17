-- Create promo code TRADERCEPAT for 3 months free
-- Run this in Supabase SQL Editor

INSERT INTO promo_codes (
  id,
  code,
  description,
  "discountPercent",
  "maxQuota",
  "usedQuota",
  "durationMonths",
  "startDate",
  "endDate",
  "isActive",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'TRADERCEPAT',
  '3 Bulan Gratis PRO',
  100,
  100,
  0,
  3,
  NOW(),
  NULL,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (code) DO UPDATE SET
  "isActive" = true,
  "discountPercent" = 100,
  "durationMonths" = 3,
  "maxQuota" = 100,
  "endDate" = NULL,
  "updatedAt" = NOW();

-- Verify promo code was created
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