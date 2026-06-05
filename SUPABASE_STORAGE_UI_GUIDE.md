# Supabase Storage Setup - Via Dashboard UI (100% Work)

## Catatan
SQL Editor di Supabase sering membutuhkan permission owner yang tidak tersedia untuk user biasa.
**CARA PALING MUDAH** adalah menggunakan Dashboard UI yang sudah disediakan Supabase.

## Langkah 1: Buat Bucket via Dashboard

1. Login ke [Supabase Dashboard](https://app.supabase.com)
2. Pilih project Anda
3. Di sidebar kiri, klik **Storage**
4. Klik tombol **New bucket**
5. Isi form:
   - **Name**: `trade-screenshots`
   - **Public bucket**: ✅ **Centang/Check** (ini penting!)
   - **File size limit**: `10485760` (ini adalah 10MB)
   - **Allowed MIME types**:
     - `image/jpeg`
     - `image/png`
     - `image/gif`
     - `image/webp`
6. Klik **Create bucket**

## Langkah 2: Setup Policies via Dashboard

1. Di halaman Storage, klik bucket `trade-screenshots`
2. Klik tab **Policies**
3. Anda akan melihat 4 tombol: **Get started**
4. Klik **New policy** untuk setiap operasi berikut:

### Policy 1: Upload (INSERT)

Klik **New policy** → Pilih **For full customization** → Pilih **Insert**

- **Policy name**: `Users can upload screenshots`
- **Using expression (check)**: Klik **Use a template** → Pilih **Allow public access**
- Atau ketik manual: `(true)`
- Klik **Save**

### Policy 2: View (SELECT)

Klik **New policy** → Pilih **For full customization** → Pilih **Select**

- **Policy name**: `Public can view screenshots`
- **Using expression (using)**: Klik **Use a template** → Pilih **Allow public access**
- Atau ketik manual: `(true)`
- Klik **Save**

### Policy 3: Update (UPDATE)

Klik **New policy** → Pilih **For full customization** → Pilih **Update**

- **Policy name**: `Users can update their screenshots`
- **Using expression (check)**: Klik **Use a template** → Pilih **Allow public access**
- Atau ketik manual: `(true)`
- Klik **Save**

### Policy 4: Delete (DELETE)

Klik **New policy** → Pilih **For full customization** → Pilih **Delete**

- **Policy name**: `Users can delete their screenshots`
- **Using expression (using)**: Klik **Use a template** → Pilih **Allow public access**
- Atau ketik manual: `(true)`
- Klik **Save**

## Langkah 3: Verifikasi Setup

1. Di tab **Files**, Anda bisa:
   - Upload file manual untuk testing
   - Download file untuk testing
   - Delete file untuk testing

2. Di tab **Policies**, pastikan ada 4 policies:
   - ✅ `Users can upload screenshots` (INSERT)
   - ✅ `Public can view screenshots` (SELECT)
   - ✅ `Users can update their screenshots` (UPDATE)
   - ✅ `Users can delete their screenshots` (DELETE)

## Langkah 4: Upload Test via Aplikasi

1. Buka aplikasi
2. Login dengan user Anda
3. Masuk ke dashboard → Trades
4. Tambah trade baru dengan upload screenshot
5. Cek apakah upload berhasil

## Troubleshooting

### "Access denied" saat upload
- Cek apakah bucket sudah di-set sebagai **Public**
- Pastikan policies sudah dibuat dengan expression `(true)`
- Refresh browser dan coba lagi

### "404 Not Found" saat melihat gambar
- Pastikan bucket di-set sebagai **Public** (centang saat create bucket)
- Cek URL gambar di browser

### Bucket tidak muncul di list
- Refresh page browser
- Logout dan login ulang ke Supabase Dashboard

## Kelebihan Cara Ini vs SQL

✅ **Tidak perlu permission owner**
✅ **UI visual yang mudah digunakan**
✅ **Template policies yang sudah tersedia**
✅ **Real-time validation**
✅ **Error message yang jelas**
✅ **Tidak ada syntax error**

## Environment Variables untuk Production

Pastikan environment variables ini di-set di Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## Summary

1. Buat bucket `trade-screenshots` (Public ✅)
2. Setup 4 policies semuanya dengan expression `(true)`
3. Test upload via aplikasi
4. Deploy ke production

**Ini adalah cara paling sederhana dan 100% work!** 🚀