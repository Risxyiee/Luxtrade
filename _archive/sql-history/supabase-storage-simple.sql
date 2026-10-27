-- ====================================================================
-- SUPABASE STORAGE SETUP - SIMPLE & WORKING VERSION
-- ====================================================================
-- Copy dan jalankan SEMUA SQL ini di Supabase SQL Editor sekaligus
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

-- 3. Policy: User bisa upload file ke folder mereka sendiri
-- Format nama file: userId/timestamp-randomsuffix.ext
CREATE POLICY "Users can upload to their own folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'trade-screenshots'
  AND auth.uid()::text = name
);

-- 4. Policy: User bisa lihat file mereka sendiri
CREATE POLICY "Users can view their own files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'trade-screenshots'
  AND auth.uid()::text = name
);

-- 5. Policy: User bisa update file mereka sendiri
CREATE POLICY "Users can update their own files"
ON storage.objects
FOR UPDATE
WITH CHECK (
  bucket_id = 'trade-screenshots'
  AND auth.uid()::text = name
);

-- 6. Policy: User bisa delete file mereka sendiri
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'trade-screenshots'
  AND auth.uid()::text = name
);

-- 7. Policy: Publik bisa lihat semua file di bucket ini (karena bucket public)
CREATE POLICY "Public can view all trade screenshots"
ON storage.objects
FOR SELECT
USING (bucket_id = 'trade-screenshots');

-- 8. Grant permissions ke authenticated dan anon users
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO anon;
GRANT ALL ON storage.buckets TO authenticated;
GRANT SELECT ON storage.buckets TO anon;
GRANT ALL ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO anon;

-- ====================================================================
-- SELESAI
-- ====================================================================
--
-- Untuk verifikasi, jalankan query ini terpisah:
--
-- Cek bucket:
-- SELECT * FROM storage.buckets WHERE id = 'trade-screenshots';
--
-- Cek policies:
-- SELECT * FROM storage.policies WHERE bucket_id = 'trade-screenshots';
--
-- ====================================================================