-- Create promo_codes table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS promo_codes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  "discountPercent" DOUBLE PRECISION NOT NULL,
  "maxQuota" INTEGER NOT NULL,
  "usedQuota" INTEGER NOT NULL DEFAULT 0,
  "durationMonths" INTEGER NOT NULL,
  "startDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "endDate" TIMESTAMP WITH TIME ZONE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active_dates ON promo_codes("isActive", "startDate", "endDate");

-- Create TRADERCEPAT promo code for 3 months free
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