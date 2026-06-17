-- SQL Script: Create Supabase Storage Buckets
-- Run this in Supabase SQL Editor

-- Enable storage extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create 'screenshots' bucket for trading screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES (
  'screenshots',
  'screenshots',
  false
)
ON CONFLICT (id) DO UPDATE
SET public = false;

-- Create 'bug-reports' bucket for bug report screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES (
  'bug-reports',
  'bug-reports',
  false
)
ON CONFLICT (id) DO UPDATE
SET public = false;

-- Create 'trade-images' bucket for general trade images
INSERT INTO storage.buckets (id, name, public)
VALUES (
  'trade-images',
  'trade-images',
  false
)
ON CONFLICT (id) DO UPDATE
SET public = false;

-- Row Level Security Policies for 'screenshots' bucket

-- Users can upload their own screenshots
CREATE POLICY "Users can upload screenshots"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'screenshots' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own screenshots
CREATE POLICY "Users can view own screenshots"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'screenshots' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can view all screenshots
CREATE POLICY "Admins can view all screenshots"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'screenshots' AND
  (
    SELECT role FROM profiles
    WHERE profiles.id = auth.uid()::text
  ) = 'ADMIN'
);

-- Users can delete their own screenshots
CREATE POLICY "Users can delete own screenshots"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'screenshots' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Row Level Security Policies for 'bug-reports' bucket

-- Users can upload bug report screenshots
CREATE POLICY "Users can upload bug report screenshots"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'bug-reports' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own bug report screenshots
CREATE POLICY "Users can view own bug report screenshots"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'bug-reports' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can view all bug report screenshots
CREATE POLICY "Admins can view all bug report screenshots"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'bug-reports' AND
  (
    SELECT role FROM profiles
    WHERE profiles.id = auth.uid()::text
  ) = 'ADMIN'
);

-- Row Level Security Policies for 'trade-images' bucket

-- Users can upload trade images
CREATE POLICY "Users can upload trade images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trade-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own trade images
CREATE POLICY "Users can view own trade images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'trade-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can view all trade images
CREATE POLICY "Admins can view all trade images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'trade-images' AND
  (
    SELECT role FROM profiles
    WHERE profiles.id = auth.uid()::text
  ) = 'ADMIN'
);

COMMIT;

-- Verification
SELECT
  id,
  name,
  public
FROM storage.buckets
WHERE id IN ('screenshots', 'bug-reports', 'trade-images');