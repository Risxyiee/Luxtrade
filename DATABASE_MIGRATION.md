# Database Migration Guide for Achievement System

Due to cross-schema references between `public` and `auth` schemas in Supabase, please execute the following SQL commands manually in Supabase SQL Editor.

## Instructions

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a **New Query**
4. Copy and execute the SQL below in the correct order

---

## Migration SQL

### Step 1: Add Columns to users table

```sql
-- Add streak tracking columns
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS "streakCount" INTEGER DEFAULT 0;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP;

-- Add plan and subscription columns
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'FREE';

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS "proExpiry" TIMESTAMP;

-- Add role column for admin access
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'USER';
```

### Step 2: Create user_submissions table

```sql
CREATE TABLE IF NOT EXISTS public.user_submissions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  user_email TEXT,
  achievement_key TEXT NOT NULL,
  proof_link TEXT,
  proof_img TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  admin_note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Step 3: Create Indexes for Performance

```sql
-- Index for faster user queries
CREATE INDEX IF NOT EXISTS idx_user_submissions_user_id
ON public.user_submissions(user_id);

-- Index for achievement type queries
CREATE INDEX IF NOT EXISTS idx_user_submissions_achievement_key
ON public.user_submissions(achievement_key);

-- Index for status filtering (important for admin review)
CREATE INDEX IF NOT EXISTS idx_user_submissions_status
ON public.user_submissions(status);

-- Composite index for admin dashboard
CREATE INDEX IF NOT EXISTS idx_user_submissions_status_created
ON public.user_submissions(status, created_at DESC);
```

### Step 4: Set Admin Role (Optional)

If you want to manually set a user as ADMIN without relying on email check:

```sql
-- Replace with the actual user email or ID
UPDATE public.users
SET role = 'ADMIN'
WHERE email = 'luxtradee@gmail.com';
```

### Step 5: Verify Changes

```sql
-- Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verify user_submissions table was created
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'user_submissions' AND table_schema = 'public';

-- Verify indexes were created
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename = 'user_submissions' AND schemaname = 'public';
```

---

## Troubleshooting

### Issue: Column already exists
**Solution:** The `IF NOT EXISTS` clause should handle this, but if you see errors, check if the column already exists with:
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'users' AND table_schema = 'public';
```

### Issue: Permission denied
**Solution:** Make sure you're logged in as a user with sufficient privileges (usually the project owner or a role with admin access).

### Issue: Cross-schema reference errors
**Solution:** Ignore the affiliate_logs table references to auth.users. We're only modifying the public schema.

---

## Rollback (if needed)

```sql
-- Remove user_submissions table
DROP TABLE IF EXISTS public.user_submissions CASCADE;

-- Remove columns from users table
ALTER TABLE public.users DROP COLUMN IF EXISTS "streakCount";
ALTER TABLE public.users DROP COLUMN IF EXISTS "lastLoginAt";
ALTER TABLE public.users DROP COLUMN IF EXISTS plan;
ALTER TABLE public.users DROP COLUMN IF EXISTS "proExpiry";
ALTER TABLE public.users DROP COLUMN IF EXISTS role;
```

---

## After Migration

Once the migration is complete:

1. ✅ The Prisma schema (`prisma/schema.prisma`) is already updated
2. ✅ Regenerate Prisma client: `bun run db:generate`
3. ✅ Test the application to verify achievements work correctly
4. ✅ Check admin user can access "Verify Rewards" menu in sidebar

---

## Notes

- **AUTO achievements** (streaks, PRO plans) are handled by the application
- **MANUAL achievements** (social media posts, feedback) require admin verification via user_submissions table
- Default role for all users is 'USER'
- Email-based admin check is in the auth context: `luxtradee@gmail.com` → 'ADMIN'
- Only users with role='ADMIN' can see and access the "Verify Rewards" menu
