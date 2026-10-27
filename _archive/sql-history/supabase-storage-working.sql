-- ====================================================================
-- SUPABASE STORAGE SETUP - VERSI PALING SEDERHANA
-- ====================================================================
-- Copy SEMUA SQL ini dan jalankan di Supabase SQL Editor sekaligus
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

-- 3. Policy: Authenticated users bisa upload file ke bucket ini
CREATE POLICY "Authenticated users can upload trade screenshots"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'trade-screenshots');

-- 4. Policy: Authenticated users bisa lihat semua file di bucket ini
CREATE POLICY "Authenticated users can view trade screenshots"
ON storage.objects
FOR SELECT
USING (bucket_id = 'trade-screenshots');

-- 5. Policy: Authenticated users bisa update file di bucket ini
CREATE POLICY "Authenticated users can update trade screenshots"
ON storage.objects
FOR UPDATE
WITH CHECK (bucket_id = 'trade-screenshots');

-- 6. Policy: Authenticated users bisa delete file di bucket ini
CREATE POLICY "Authenticated users can delete trade screenshots"
ON storage.objects
FOR DELETE
USING (bucket_id = 'trade-screenshots');

-- 7. Policy: Publik (anon) bisa lihat semua file (karena bucket public)
CREATE POLICY "Public can view trade screenshots"
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
-- VERIFICATION (Jalankan terpisah jika ingin cek)
-- ====================================================================
--
-- Cek bucket:
-- SELECT * FROM storage.buckets WHERE id = 'trade-screenshots';
--
-- Cek semua policies:
-- SELECT * FROM storage.policies WHERE bucket_id = 'trade-screenshots';
--
-- ====================================================================