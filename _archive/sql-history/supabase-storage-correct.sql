-- ====================================================================
-- SUPABASE STORAGE SETUP - VERSI BENAR & TEROBAIKI
-- ====================================================================
-- Jalankan di Supabase SQL Editor
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

-- 3. Policy: User bisa upload file
-- Kita gunakan auth.uid() sebagai prefix folder, jadi policy harus mengecek folder
CREATE POLICY "Authenticated users can upload to trade-screenshots"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'trade-screenshots'
);

-- 4. Policy: User bisa lihat file mereka sendiri (berdasarkan folder userId)
CREATE POLICY "Users can view their own trade screenshots"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'trade-screenshots'
  AND auth.uid()::text = (regexp_match(name, '^([^/]+)/'))[1]
);

-- 5. Policy: User bisa update file mereka sendiri
CREATE POLICY "Users can update their own trade screenshots"
ON storage.objects
FOR UPDATE
WITH CHECK (
  bucket_id = 'trade-screenshots'
  AND auth.uid()::text = (regexp_match(name, '^([^/]+)/'))[1]
);

-- 6. Policy: User bisa delete file mereka sendiri
CREATE POLICY "Users can delete their own trade screenshots"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'trade-screenshots'
  AND auth.uid()::text = (regexp_match(name, '^([^/]+)/'))[1]
);

-- 7. Policy: Publik bisa lihat semua file (karena bucket public)
CREATE POLICY "Public can view all trade screenshots"
ON storage.objects
FOR SELECT
USING (bucket_id = 'trade-screenshots');

-- 8. Grant permissions
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO anon;
GRANT ALL ON storage.buckets TO authenticated;
GRANT SELECT ON storage.buckets TO anon;
GRANT ALL ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO anon;