# Cara Setup Database Supabase Manual

## Masalah
Error P3019 dari Prisma migrate deploy dan error P2021 (tabel tidak ditemukan) terjadi karena ketidaksesuaian migrasi lokal dengan database Supabase.

## Solusi
Jalankan script SQL secara manual di Supabase SQL Editor untuk membuat semua tabel yang diperlukan.

## Langkah-langkah

### 1. Buka Supabase Dashboard
- Login ke [supabase.com](https://supabase.com)
- Pilih project Anda
- Masuk ke menu **SQL Editor** (ikon SQL di sidebar kiri)

### 2. Jalankan Script
- Buka file `docs/SUPABASE_SQL_SETUP.sql` dari project ini
- Copy seluruh isi script
- Paste ke Supabase SQL Editor
- Klik **Run** (atau tekan `Ctrl+Enter` / `Cmd+Enter`)

### 3. Verifikasi Setup
Setelah script selesai dijalankan, seharusnya Anda melihat pesan:
```
LuxTrade database setup completed successfully!
```

### 4. Cek Tabel
- Masuk ke menu **Table Editor** di Supabase Dashboard
- Anda seharusnya melihat tabel-tabel berikut:
  - `Profile`
  - `User`
  - `UserSubscription`
  - `Withdrawal`
  - `Trade`
  - `JournalEntry`
  - `TradingAccount`
  - `Tag`
  - `WeeklyGoal`
  - `UserSubmission`
  - `MissionProgress`
  - `SocialLink`

### 5. Update Environment Variables (Opsional)
Pastikan `DATABASE_URL` di Vercel environment variables sudah benar:

```
postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:6543/postgres
```

Catatan:
- Gunakan port `6543` (bukan 5432)
- `[PASSWORD]` adalah password dari Supabase Dashboard → Settings → Database
- `[PROJECT_ID]` adalah ID project Anda di Supabase

### 6. Redeploy di Vercel
Setelah database setup:
- Push code ke GitHub
- Vercel akan auto-redeploy
- Error P3019 dan P2021 seharusnya sudah hilang

## Apa yang Dibuat oleh Script Ini?

Script ini membuat:
- ✅ Semua tabel yang didefinisikan di `prisma/schema.prisma`
- ✅ Foreign key relations antar tabel
- ✅ Indexes untuk query performance
- ✅ Auto-update triggers untuk `updatedAt` column
- ✅ UUID extension untuk auto-generate UUID
- ✅ Default values sesuai schema Prisma

## Catatan Penting

### Tentang Environment Variables
- **DATABASE_URL**: Variable yang digunakan oleh aplikasi (bisa diubah)
- **DB_DATABASE_URL**: Variable yang di-manage otomatis oleh integrasi Vercel-Supabase (tidak bisa dihapus)

### Tentang Migrasi
Setelah menjalankan script ini secara manual:
1. Hapus folder `prisma/migrations` lokal jika ada
2. Jangan jalankan `prisma migrate deploy` lagi
3. Gunakan `prisma generate` saja di postinstall script

Update postinstall script di `package.json`:
```json
"postinstall": "prisma generate"
```

### Tentang Error P3019
Error ini terjadi karena:
- Migrasi lokal tidak sinkron dengan database production
- Prisma mendeteksi adanya perbedaan schema

Solusi manual dengan SQL script ini menghindari issue migrasi dan langsung membuat tabel yang sesuai.

## Troubleshooting

### Error saat menjalankan script
Jika ada error saat menjalankan SQL script:
1. Pastikan Anda menjalankan di project Supabase yang benar
2. Cek apakah ada tabel yang sudah ada - script menggunakan `IF NOT EXISTS`
3. Pastikan Anda memiliki permission untuk membuat tabel

### Prisma masih error setelah setup
1. Cek `DATABASE_URL` environment variable di Vercel
2. Restart aplikasi di Vercel
3. Cek logs di Vercel untuk error spesifik

### Tidak bisa akses database
1. Pastikan password database benar
2. Pastikan port 6543 digunakan (bukan 5432)
3. Cek koneksi internet dan firewall settings

## Kontak
Jika ada masalah, cek:
- Supabase Dashboard logs
- Vercel deployment logs
- Prisma documentation: https://www.prisma.io/docs