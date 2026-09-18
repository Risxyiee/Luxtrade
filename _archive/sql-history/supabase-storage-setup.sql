-- ====================================================================
-- SUPABASE STORAGE SETUP SQL
-- ====================================================================
-- Catatan: JANGAN install extension "storage" - Supabase Storage sudah pre-installed

-- ====================================================================
-- LANGKAH 1: Buat Bucket trade-screenshots
-- ====================================================================
-- Catatan: Jika bucket sudah dibuat lewat dashboard Supabase, abaikan SQL ini

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trade-screenshots',
  'trade-screenshots',
  true, -- public bucket agar gambar bisa diakses publik
  10485760, -- 10MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- LANGKAH 2: Setup RLS Policies
-- ====================================================================

-- Enable RLS pada storage.objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy 1: Permit user upload ke folder milik mereka
-- File akan disimpan di format: userId/filename
CREATE POLICY "Users can upload files to their own folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'trade-screenshots'
  AND (split_part(name, '/', 1))::text = auth.uid()::text
);

-- Policy 2: Permit user melihat file milik mereka
CREATE POLICY "Users can view their own files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'trade-screenshots'
  AND (split_part(name, '/', 1))::text = auth.uid()::text
);

-- Policy 3: Permit user update file milik mereka
CREATE POLICY "Users can update their own files"
ON storage.objects
FOR UPDATE
WITH CHECK (
  bucket_id = 'trade-screenshots'
  AND (split_part(name, '/', 1))::text = auth.uid()::text
);

-- Policy 4: Permit user delete file milik mereka
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'trade-screenshots'
  AND (split_part(name, '/', 1))::text = auth.uid()::text
);

-- Policy 5: Permit public access untuk melihat file (karena bucket public)
-- Ini memungkinkan frontend menampilkan image tanpa auth
CREATE POLICY "Public can view trade screenshots"
ON storage.objects
FOR SELECT
USING (bucket_id = 'trade-screenshots');

-- ====================================================================
-- LANGKAH 3: Grant Permissions
-- ====================================================================

-- Grant usage pada storage schema
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO anon;

-- Grant permissions pada tables
GRANT ALL ON storage.buckets TO authenticated;
GRANT SELECT ON storage.buckets TO anon;
GRANT ALL ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO anon;

-- ====================================================================
-- LANGKAH 4: Verifikasi Setup
-- ====================================================================

-- Cek apakah bucket sudah ada
-- Jalankan query ini untuk memverifikasi:
-- SELECT * FROM storage.buckets WHERE id = 'trade-screenshots';

-- Cek policies yang sudah dibuat
-- Jalankan query ini untuk memverifikasi:
-- SELECT * FROM storage.policies WHERE bucket_id = 'trade-screenshots';

-- ====================================================================
-- SELESAI
-- ====================================================================
-- Sekarang Supabase Storage sudah siap digunakan
-- Aplikasi akan mengupload gambar ke bucket 'trade-screenshots'
-- File akan disimpan di folder berdasarkan user ID
-- ====================================================================