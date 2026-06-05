-- ====================================================================
-- SUPABASE STORAGE SETUP - VERSI TEROBAIKI
-- ====================================================================
-- Jalankan SQL ini di Supabase SQL Editor
-- ====================================================================

-- Step 1: Buat Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trade-screenshots',
  'trade-screenshots',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 3: Create Policies

-- Policy 1: Authenticated users can upload to their folder
CREATE POLICY "Authenticated users can upload to their folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'trade-screenshots'
  AND regexp_replace(name, '/.*$', '') = auth.uid()::text
);

-- Policy 2: Authenticated users can view their own files
CREATE POLICY "Authenticated users can view their own files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'trade-screenshots'
  AND regexp_replace(name, '/.*$', '') = auth.uid()::text
);

-- Policy 3: Authenticated users can update their own files
CREATE POLICY "Authenticated users can update their own files"
ON storage.objects
FOR UPDATE
WITH CHECK (
  bucket_id = 'trade-screenshots'
  AND regexp_replace(name, '/.*$', '') = auth.uid()::text
);

-- Policy 4: Authenticated users can delete their own files
CREATE POLICY "Authenticated users can delete their own files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'trade-screenshots'
  AND regexp_replace(name, '/.*$', '') = auth.uid()::text
);

-- Policy 5: Public can view all files (since bucket is public)
CREATE POLICY "Public can view trade screenshots"
ON storage.objects
FOR SELECT
USING (bucket_id = 'trade-screenshots');

-- Step 4: Grant Permissions
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO anon;
GRANT ALL ON storage.buckets TO authenticated;
GRANT SELECT ON storage.buckets TO anon;
GRANT ALL ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO anon;

-- Verification Queries (jalankan terpisah untuk cek)
-- SELECT * FROM storage.buckets WHERE id = 'trade-screenshots';
-- SELECT * FROM storage.policies WHERE bucket_id = 'trade-screenshots';