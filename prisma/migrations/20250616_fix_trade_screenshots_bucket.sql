-- SQL Script: Create Missing Buckets and Set RLS
-- Run this in Supabase SQL Editor

-- Create 'trade-screenshots' bucket (used by trade-upload API)
INSERT INTO storage.buckets (id, name, public)
VALUES (
  'trade-screenshots',
  'trade-screenshots',
  false
)
ON CONFLICT (id) DO UPDATE
SET public = false;

-- Update RLS Policies for trade-screenshots

-- Allow all authenticated users to upload
DROP POLICY IF EXISTS "Users can upload screenshots" ON storage.objects;
CREATE POLICY "Users can upload screenshots"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trade-screenshots' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view their own screenshots
DROP POLICY IF EXISTS "Users can view own screenshots" ON storage.objects;
CREATE POLICY "Users can view own screenshots"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'trade-screenshots' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow admins to view all
DROP POLICY IF EXISTS "Admins can view all screenshots" ON storage.objects;
CREATE POLICY "Admins can view all screenshots"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'trade-screenshots' AND
  (
    SELECT role FROM profiles
    WHERE profiles.id = auth.uid()::text
    LIMIT 1
  ) = 'ADMIN'
);

-- Allow users to delete their own
DROP POLICY IF EXISTS "Users can delete own screenshots" ON storage.objects;
CREATE POLICY "Users can delete own screenshots"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'trade-screenshots' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Verify all buckets
SELECT
  id,
  name,
  public
FROM storage.buckets
ORDER BY id;

-- Count objects in each bucket
SELECT
  bucket_id,
  COUNT(*) as object_count
FROM storage.objects
GROUP BY bucket_id
ORDER BY bucket_id;