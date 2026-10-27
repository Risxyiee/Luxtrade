-- ============================================================================
-- CHECK AND FIX: Verify all tables exist with correct columns
-- ============================================================================
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Check if tables exist
SELECT
    'achievements' as table_name,
    COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'achievements'
UNION ALL
SELECT
    'user_achievements',
    COUNT(*)
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_achievements'
UNION ALL
SELECT
    'user_submissions',
    COUNT(*)
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_submissions'
UNION ALL
SELECT
    'mission_progress',
    COUNT(*)
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'mission_progress';

-- Check columns in user_submissions
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_submissions'
ORDER BY ordinal_position;

-- Check columns in mission_progress
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'mission_progress'
ORDER BY ordinal_position;

-- Check columns in user_achievements
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_achievements'
ORDER BY ordinal_position;