-- ============================================
-- UPDATE CORS POLICY FOR CUSTOM DOMAIN
-- ============================================
-- Run this in Supabase SQL Editor

-- Add both domains to allowed origins for auth
-- This allows authentication from both luxtradee.web.id and luxtrade-jade.vercel.app

-- Update authentication settings (via UI, but here's the SQL for reference)
-- You need to update CORS in Supabase Dashboard -> Authentication -> URL Configuration

-- For API calls, no CORS changes needed since we use relative paths
-- Supabase auth flow automatically handles redirects

-- Verify current auth settings
SELECT
  'Current auth URL settings:' as info,
  'Check Supabase Dashboard > Authentication > URL Configuration' as action;
