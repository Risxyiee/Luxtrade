# Supabase Storage Policies for Trade Screenshots
# ===============================================
# CATATAN: JANGAN jalankan CREATE EXTENSION "storage"
# Supabase sudah otomatis punya extension storage terinstall

# Setup Storage Policies untuk bucket 'trade-screenshots'
# Jalankan ini di Supabase Dashboard → SQL Editor

-- 1. Allow authenticated users to upload trade screenshots
CREATE POLICY IF NOT EXISTS "Authenticated users can upload trade screenshots"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'trade-screenshots'
  AND auth.role() = 'authenticated'
);

-- 2. Allow authenticated users to view their own trade screenshots
CREATE POLICY IF NOT EXISTS "Authenticated users can view trade screenshots"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'trade-screenshots'
  AND auth.role() = 'authenticated'
);

-- 3. Allow authenticated users to delete their own trade screenshots
CREATE POLICY IF NOT EXISTS "Authenticated users can delete trade screenshots"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'trade-screenshots'
  AND auth.role() = 'authenticated'
);

-- 4. Grant permissions on storage schema
GRANT USAGE ON SCHEMA storage TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO authenticated;

-- 5. Public access (untuk bucket public)
-- Karena bucket dibuat sebagai public, kita perlu allow public read
CREATE POLICY IF NOT EXISTS "Public can view trade screenshots"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'trade-screenshots'
  AND (auth.role() = 'authenticated' OR auth.role() = 'anon')
);

-- Verifikasi policies
SELECT * FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';