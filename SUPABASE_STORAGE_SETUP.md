# SQL untuk Supabase Storage

## Catatan Penting
Jangan menjalankan SQL yang meng-install extension "storage" karena Supabase Storage sudah pre-installed. Cukup setup bucket dan RLS policies saja.

## SQL yang Perlu Dijalankan

### 1. Buat Bucket untuk Screenshot Trading

```sql
-- Buat bucket trade-screenshots jika belum ada
-- Catatan: Jika bucket sudah dibuat lewat dashboard Supabase, abaikan SQL ini

-- Untuk membuat bucket lewat SQL (opsional):
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trade-screenshots',
  'trade-screenshots',
  true, -- public agar bisa diakses
  10485760, -- 10MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;
```

### 2. Setup RLS Policies untuk Bucket

```sql
-- Enable RLS pada storage.objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy 1: Permite user upload ke folder milik mereka (menggunakan auth.uid())
CREATE POLICY "Users can upload files to their own folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'trade-screenshots'
  AND storage.foldername(name)[1] = auth.uid()::text
);

-- Policy 2: Permit user melihat file milik mereka
CREATE POLICY "Users can view their own files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'trade-screenshots'
  AND storage.foldername(name)[1] = auth.uid()::text
);

-- Policy 3: Permit user update file milik mereka
CREATE POLICY "Users can update their own files"
ON storage.objects
FOR UPDATE
WITH CHECK (
  bucket_id = 'trade-screenshots'
  AND storage.foldername(name)[1] = auth.uid()::text
);

-- Policy 4: Permit user delete file milik mereka
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'trade-screenshots'
  AND storage.foldername(name)[1] = auth.uid()::text
);

-- Policy 5: Permit public access untuk melihat file (karena bucket public)
-- Ini memungkinkan frontend menampilkan image tanpa auth
CREATE POLICY "Public can view trade screenshots"
ON storage.objects
FOR SELECT
USING (bucket_id = 'trade-screenshots');
```

### 3. Grant Permissions

```sql
-- Grant usage pada storage schema
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO anon;

-- Grant permissions pada tables
GRANT ALL ON storage.buckets TO authenticated;
GRANT SELECT ON storage.buckets TO anon;
GRANT ALL ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO anon;
```

### 4. Verifikasi Setup

```sql
-- Cek apakah bucket sudah ada
SELECT * FROM storage.buckets WHERE id = 'trade-screenshots';

-- Cek policies yang sudah dibuat
SELECT * FROM storage.policies WHERE bucket_id = 'trade-screenshots';
```

## Cara Menjalankan di Supabase Dashboard

1. Buka [Supabase Dashboard](https://app.supabase.com)
2. Pilih project Anda
3. Masuk ke **SQL Editor**
4. Copy dan jalankan SQL di atas satu per satu:
   - Pertama: Buat bucket (jika belum ada lewat dashboard)
   - Kedua: Setup RLS policies (semua policy dalam satu run)
   - Ketiga: Grant permissions

## Alternatif: Setup via Supabase Dashboard UI

Jika SQL di atas bermasalah, Anda bisa setup via dashboard:

1. **Buat Bucket:**
   - Masuk ke **Storage** → **Create a new bucket**
   - Name: `trade-screenshots`
   - Public bucket: ✅ Centang
   - File size limit: `10485760` (10MB)
   - Allowed MIME types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`

2. **Setup Policies:**
   - Klik bucket `trade-screenshots`
   - Masuk ke **Policies** tab
   - Create policies berikut:
     - **Policy Name:** "Users can upload files"
       - Allowed operation: INSERT
       - Target roles: authenticated
       - USING expression (tulis di box):
         ```sql
         storage.foldername(name)[1] = auth.uid()::text
         ```

     - **Policy Name:** "Users can view own files"
       - Allowed operation: SELECT
       - Target roles: authenticated
       - USING expression:
         ```sql
         storage.foldername(name)[1] = auth.uid()::text
         ```

     - **Policy Name:** "Public can view files"
       - Allowed operation: SELECT
       - Target roles: anon, authenticated
       - USING expression: `(true)`

3. **Testing:**
   - Upload image lewat aplikasi
   - Cek di Supabase Dashboard → Storage → trade-screenshots
   - File harus masuk ke folder dengan ID user (contoh: `user_abc123/screenshot.jpg`)

## Troubleshooting

### Error: "extension storage is not available"
✅ **SOLUSI:** Jangan install extension "storage". Supabase Storage sudah pre-installed. Langsung buat bucket dan policies saja.

### Error: "relation storage.objects does not exist"
✅ **SOLUSI:** Pastikan Supabase Storage sudah di-enable di project settings.

### File tidak muncul setelah upload
✅ **Cek:**
- Apakah bucket `trade-screenshots` sudah ada?
- Apakah policies sudah dibuat?
- Cek log di browser console untuk error dari upload API

### Permission denied saat upload
✅ **Cek:**
- Apakah user sudah login?
- Apakah `SUPABASE_SERVICE_ROLE_KEY` sudah di-set di environment variables?
- Cek policies untuk INSERT operation

## Environment Variables untuk Production

Pastikan environment variables ini sudah di-set di Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

⚠️ **IMPORTANT:** `SUPABASE_SERVICE_ROLE_KEY` diperlukan untuk upload file dengan admin privileges di backend API.

## Flow Upload Gambar

1. User upload screenshot lewat frontend form
2. Frontend mengirim ke `/api/trade-upload`
3. API menggunakan `supabaseAdmin` (dengan service role key)
4. File di-upload ke bucket `trade-screenshots` → folder `userId/`
5. API mengembalikan public URL
6. Frontend menyimpan URL ke database untuk menampilkan image