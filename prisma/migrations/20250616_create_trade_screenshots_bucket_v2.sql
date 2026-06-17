-- Create trade-screenshots bucket for Auto-Journal screenshots
-- Run this in Supabase SQL Editor with proper permissions

-- Step 1: Create the bucket using storage.insert_bucket function
SELECT storage.insert_bucket(
  'trade-screenshots',
  'trade-screenshots',
  false, -- Not public, controlled by RLS
  10485760, -- 10MB max file size
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
);

-- Step 2: Create RLS policies for bucket objects
-- Note: These policies will be created on the storage.objects table

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