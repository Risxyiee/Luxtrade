-- ====================================================================
-- SUPABASE STORAGE SETUP - VERSI TANPA OWNER PERMISSION ERROR
-- ====================================================================
-- Copy dan jalankan di Supabase SQL Editor
-- ====================================================================

-- 1. Buat Bucket untuk Trade Screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trade-screenshots',
  'trade-screenshots',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS pada storage.objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Drop policies jika sudah ada (untuk menghindari error)
DROP POLICY IF EXISTS "Authenticated users can upload trade screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view trade screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update trade screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete trade screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Public can view trade screenshots" ON storage.objects;

-- 4. Policy: Authenticated users bisa upload file
CREATE POLICY "Authenticated users can upload trade screenshots"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'trade-screenshots');

-- 5. Policy: Authenticated users bisa lihat semua file
CREATE POLICY "Authenticated users can view trade screenshots"
ON storage.objects
FOR SELECT
USING (bucket_id = 'trade-screenshots');

-- 6. Policy: Authenticated users bisa update file
CREATE POLICY "Authenticated users can update trade screenshots"
ON storage.objects
FOR UPDATE
WITH CHECK (bucket_id = 'trade-screenshots');

-- 7. Policy: Authenticated users bisa delete file
CREATE POLICY "Authenticated users can delete trade screenshots"
ON storage.objects
FOR DELETE
USING (bucket_id = 'trade-screenshots');

-- 8. Policy: Public bisa lihat semua file
CREATE POLICY "Public can view trade screenshots"
ON storage.objects
FOR SELECT
USING (bucket_id = 'trade-screenshots');

-- 9. Grant permissions
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO anon;
GRANT SELECT ON storage.buckets TO authenticated;
GRANT SELECT ON storage.buckets TO anon;
GRANT SELECT ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO anon;