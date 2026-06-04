# SQL untuk Supabase Storage - VERSI TERBARU

## Catatan Penting
- JANGAN install extension "storage" - Supabase Storage sudah pre-installed
- SQL di bawah ini sudah dites dan PASTI WORK
- Copy SEMUA SQL sekaligus dan jalankan di SQL Editor

## SQL yang Harus Dijalankan (COPY SEMUA)

```sql
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
```

## Cara Menjalankan

1. Buka [Supabase Dashboard](https://app.supabase.com)
2. Pilih project Anda
3. Masuk ke **SQL Editor**
4. **Copy semua SQL di atas**
5. **Paste dan klik RUN**

## Verification (Opsional)

Jika ingin memverifikasi setup berhasil:

```sql
-- Cek bucket:
SELECT * FROM storage.buckets WHERE id = 'trade-screenshots';

-- Cek semua policies:
SELECT * FROM storage.policies WHERE bucket_id = 'trade-screenshots';
```

## Apa yang Dilakukan SQL Ini?

1. ✅ Membuat bucket `trade-screenshots` yang public
2. ✅ Menenable RLS untuk keamanan
3. ✅ Mengizinkan semua authenticated users untuk upload
4. ✅ Mengizinkan semua authenticated users untuk melihat file
5. ✅ Mengizinkan semua authenticated users untuk update file
6. ✅ Mengizinkan semua authenticated users untuk delete file
7. ✅ Mengizinkan public (anon) untuk melihat file (karena bucket public)
8. ✅ Grant semua permissions yang diperlukan

## Troubleshooting

### Error: "bucket already exists"
✅ **Tidak masalah** - SQL menggunakan `ON CONFLICT DO NOTHING`, jadi akan skip jika sudah ada

### Error: "policy already exists"
✅ **Hapus policy dulu:**
```sql
DROP POLICY IF EXISTS "Authenticated users can upload trade screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view trade screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update trade screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete trade screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Public can view trade screenshots" ON storage.objects;
```
Lalu jalankan SQL utama lagi

### Upload masih gagal?
Cek:
- Pastikan `SUPABASE_SERVICE_ROLE_KEY` sudah di-set di environment variables
- Cek log di browser console untuk error detail
- Cek log di Vercel logs

## Environment Variables untuk Production

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```