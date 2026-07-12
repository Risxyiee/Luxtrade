-- ============================================
-- CORRECT FIX: Insert missing profiles for existing data
-- Based on exact schema.prisma structure
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Insert missing profiles from trades data (using created_at)
INSERT INTO profiles (id, email, plan, role, "createdAt", "updatedAt")
SELECT DISTINCT
    t.user_id,
    'user_' || substring(t.user_id, 1, 8) || '@luxtradee.com',
    'FREE',
    'USER',
    COALESCE(t.created_at, NOW()),
    NOW()
FROM trades t
WHERE NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = t.user_id
);

-- Step 2: Insert missing profiles from trading_accounts data (using created_at)
INSERT INTO profiles (id, email, plan, role, "createdAt", "updatedAt")
SELECT DISTINCT
    ta.user_id,
    'user_' || substring(ta.user_id, 1, 8) || '@luxtradee.com',
    'FREE',
    'USER',
    COALESCE(ta.created_at, NOW()),
    NOW()
FROM trading_accounts ta
WHERE NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = ta.user_id
);

-- Step 3: Insert missing profiles from journal_entries data (using created_at)
INSERT INTO profiles (id, email, plan, role, "createdAt", "updatedAt")
SELECT DISTINCT
    je.user_id,
    'user_' || substring(je.user_id, 1, 8) || '@luxtradee.com',
    'FREE',
    'USER',
    COALESCE(je.created_at, NOW()),
    NOW()
FROM journal_entries je
WHERE NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = je.user_id
);

-- Step 4: Insert missing profiles from tags data (using created_at)
INSERT INTO profiles (id, email, plan, role, "createdAt", "updatedAt")
SELECT DISTINCT
    tg.user_id,
    'user_' || substring(tg.user_id, 1, 8) || '@luxtradee.com',
    'FREE',
    'USER',
    COALESCE(tg.created_at, NOW()),
    NOW()
FROM tags tg
WHERE NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = tg.user_id
);

-- Step 5: Insert missing profiles from weekly_goals data (using created_at)
INSERT INTO profiles (id, email, plan, role, "createdAt", "updatedAt")
SELECT DISTINCT
    wg.user_id,
    'user_' || substring(wg.user_id, 1, 8) || '@luxtradee.com',
    'FREE',
    'USER',
    COALESCE(wg.created_at, NOW()),
    NOW()
FROM weekly_goals wg
WHERE NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = wg.user_id
);

-- Verification: Show all profiles that were created
SELECT 'Missing profiles created successfully!' AS status;
SELECT id, email, plan, role, "createdAt"
FROM profiles
ORDER BY "createdAt" DESC
LIMIT 10;

-- Verification: Check if there are still trades with missing profiles
SELECT 'Trades with missing profiles:' AS check_status;
SELECT COUNT(*) AS missing_profiles_count
FROM trades t
WHERE NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = t.user_id
);
