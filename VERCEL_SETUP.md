# 🗄️ Setup Database di Vercel

Saat ini aplikasi sudah bisa diakses tapi database belum tersambung karena SQLite tidak bisa bekerja di Vercel.

## ✅ Yang sudah dilakukan:
- Vercel Authentication sudah dimatikan
- Website bisa diakses di https://luxtrade-2x18lq472-risyxiee.vercel.app/
- Prisma schema sudah di-update dari SQLite ke PostgreSQL

## 🔧 Langkah Selanjutnya (Wajib Dilakukan):

### 1. Buat Vercel Postgres Database

1. Buka [Vercel Dashboard](https://vercel.com/dashboard)
2. Pilih project **Luxtrade**
3. Masuk ke tab **Storage** (di navigasi atas, di sebelah kanan "Deployments")
4. Klik **Create Database**
5. Pilih **Postgres** (ada di tab Store)
6. Klik **Create** (gratis untuk hobby tier)
7. Tunggu 1-2 menit sampai database selesai dibuat

### 2. Copy Database URL

Setelah database dibuat:
1. Di tab Storage, klik database yang baru dibuat
2. Klik **.env.local** (icon file) atau tombol **Connect**
3. Copy salah satu URL ini:
   - `POSTGRES_PRISMA_URL` (recommended)
   - atau `POSTGRES_URL_NON_POOLING`
   - atau `DATABASE_URL` (biasanya ini yang digunakan)

Format URL:
```
postgresql://user:password@host/database-name
```

### 3. Update Environment Variables di Vercel

1. Masuk ke project Luxtrade di Vercel
2. Klik **Settings** → **Environment Variables**
3. Tambah/Update variable:
   - **Name**: `DATABASE_URL`
   - **Value**: Paste URL yang di-copy tadi
   - **Environments**: Pilih semua (Production, Preview, Development)
4. Klik **Save**

Pastikan juga variable lain sudah ada:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### 4. Redeploy Application

1. Masuk ke tab **Deployments**
2. Cari deployment terbaru (paling atas)
3. Klik tiga titik (⋯) di sebelah kanan
4. Pilih **Redeploy**
5. Tunggu 1-2 menit

### 5. Push Database Schema (Opsional - untuk seeding)

Jika ingin mengisi database dengan data awal:

1. Setelah redeploy selesai, buka:
   ```
   https://luxtrade-2x18lq472-risyxiee.vercel.app/api/setup
   ```
2. Tunggu sampai selesai

### 6. Test Sync Users

Setelah database siap, sync users dari Supabase Auth:

1. Buka Postman atau curl:
   ```
   POST https://luxtrade-2x18lq472-risyxiee.vercel.app/api/admin/sync-auth-users
   ```
2. Response seharusnya:
   ```json
   {
     "success": true,
     "message": "Sync completed",
     "syncedCount": 6,
     "skippedCount": 0,
     "totalPrismaUsers": 6
   }
   ```

### 7. Akses Admin Panel

Setelah sync berhasil:
1. Buka: https://luxtrade-2x18lq472-risyxiee.vercel.app/dashboard/admin
2. Login dengan akun admin/user yang sudah di-sync
3. Cek apakah data user muncul

## 🔍 Troubleshooting

### Error: Unable to open the database file
- Pastikan `DATABASE_URL` sudah diset di Vercel Environment Variables
- Pastikan URL format benar: `postgresql://...`
- Cek redeploy setelah mengubah environment variables

### Error: Connection refused
- Pastikan database Vercel Postgres sudah dibuat
- Cek apakah URL yang di-copy benar
- Pastikan tidak ada spasi di URL

### Error: Relation doesn't exist
- Database perlu di-push schema-nya
- Buka endpoint `/api/setup` untuk membuat tabel-tabel

## 📝 Notes

- **Vercel Postgres**: Gratis hingga 512MB untuk hobby tier
- **SQLite tidak bisa** di Vercel karena file system ephemeral
- Setiap deployment baru akan reset file system (kalau pakai SQLite)
- Dengan PostgreSQL, data akan tersimpan di Vercel Postgres yang persisten
