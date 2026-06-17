-- Create trade-screenshots bucket for Auto-Journal screenshots
-- Run this in Supabase SQL Editor
-- IMPORTANT: Make sure you're logged in as project owner/admin

-- Step 1: Create the bucket
-- Using INSERT directly to storage.buckets table
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trade-screenshots',
  'trade-screenshots',
  false, -- Not public, controlled by RLS
  10485760, -- 10MB max file size
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- Step 2: Ensure RLS is enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can upload trade screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own trade screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own trade screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all trade screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete trade screenshots" ON storage.objects;

-- Step 4: Create RLS policies for trade-screenshots bucket

-- Policy: Users can upload their own screenshots
CREATE POLICY "Users can upload trade screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trade-screenshots' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can view their own screenshots
CREATE POLICY "Users can view their own trade screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'trade-screenshots' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own screenshots
CREATE POLICY "Users can update their own trade screenshots"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'trade-screenshots' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Admins can view all trade screenshots
CREATE POLICY "Admins can view all trade screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'trade-screenshots' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
  )
);

-- Policy: Admins can delete any trade screenshot
CREATE POLICY "Admins can delete trade screenshots"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'trade-screenshots' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
  )
);

-- Step 5: Grant necessary permissions (if not already granted)
DO $$
BEGIN
  -- Grant usage on storage schema
  IF NOT EXISTS (
    SELECT 1 FROM pg_grant
    WHERE grantee = 'authenticated' AND grantor = current_user
  ) THEN
    GRANT USAGE ON SCHEMA storage TO authenticated;
  END IF;

  -- Grant all on storage tables
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_privileges
    WHERE table_schema = 'storage' AND table_name = 'objects' AND grantee = 'authenticated'
  ) THEN
    GRANT ALL ON storage.objects TO authenticated;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_privileges
    WHERE table_schema = 'storage' AND table_name = 'buckets' AND grantee = 'authenticated'
  ) THEN
    GRANT SELECT ON storage.buckets TO authenticated;
  END IF;
END $$;

-- Success message
SELECT '✅ trade-screenshots bucket created successfully!' AS result;