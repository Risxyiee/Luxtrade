# Production Deployment Guide - Vercel + Supabase

## 📋 Pre-Deployment Checklist

### 1. Supabase Database Setup ✅
Sebelum deploy, pastikan Anda sudah menjalankan SQL berikut di Supabase SQL Editor:

**File: `correct-schema-supabase.sql`**
- Membuat semua tabel sesuai schema.prisma
- Membuat semua foreign key constraints
- Membuat indexes untuk performa

**File: `correct-fix-profiles.sql`** (jika ada data lama)
- Membuat profile untuk user yang belum ada
- Mengatasi error foreign key constraint

### 2. Environment Variables di Vercel ⚙️

Di Vercel Dashboard → Project → Settings → Environment Variables, set:

```
DATABASE_URL
postgresql://postgres:Riskiakbarp123@db.klxkdrfsfcoankbaoejn.supabase.co:6543/postgres?pgbouncer=true

NEXT_PUBLIC_SUPABASE_URL
https://klxkdrfsfcoankbaoejn.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY
[your_anon_key_from_supabase]

SUPABASE_SERVICE_ROLE_KEY
[your_service_role_key_from_supabase]
```

**Cara mendapatkan Supabase Keys:**
1. Buka Supabase Dashboard → Project Settings → API
2. Copy `anon public` key ke `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Copy `service_role` key ke `SUPABASE_SERVICE_ROLE_KEY`

**PENTING:**
- Gunakan port **6543** (bukan 5432) untuk connection pooling
- Tambahkan `?pgbouncer=true` di akhir DATABASE_URL
- Environment: Pilih **Production** dan **Preview** untuk semua variable

---

## 🔍 Apa yang Telah Diperbaiki

### 1. Database Connection (`src/lib/db.ts`)

✅ **Connection Pooling (Production)**
- Otomatis mengubah port dari 5432 ke 6543 untuk production
- Menambahkan parameter `?pgbouncer=true`
- Logging status connection pooling

✅ **Environment Detection**
- Membedakan development (SQLite) dan production (PostgreSQL)
- Log database type dan URL (dengan masking password)

✅ **Error Handling**
- Log error dengan detail stack trace
- Log konfigurasi database saat startup

### 2. Trading Accounts API (`src/app/api/trading-accounts/route.ts`)

✅ **Authentication**
- Validasi token dari Bearer header
- Cek token null/undefined/empty
- Log auth error detail

✅ **Type Conversion**
- `initial_balance`: parseFloat()
- `current_balance`: parseFloat()
- `leverage`: parseInt()
- `currency`: String()
- Semua field dikonversi sebelum masuk ke database

✅ **Error Handling**
- Cek Prisma Foreign Key Constraint Error
- Cek Prisma Unique Constraint Error
- Return error message yang jelas dengan detail

✅ **Validation**
- Required field check (name)
- Auto-set is_default untuk akun pertama
- Auto-create profile jika belum ada

### 3. Trades API (`src/app/api/trades/route.ts`)

✅ **Authentication**
- Validasi token dari Bearer header
- Cek token null/undefined/empty
- Log auth error detail

✅ **Authorization (PUT/DELETE)**
- Cek kepemilikan trade sebelum update/delete
- Return 403 jika trade milik user lain

✅ **Type Conversion**
- `open_price`: parseFloat()
- `close_price`: parseFloat()
- `lot_size`: parseFloat()
- `profit_loss`: parseFloat()
- `risk_reward_ratio`: parseFloat()
- `trade_duration`: parseInt()
- `open_time`: new Date()
- `close_time`: new Date()
- `symbol`: String().toUpperCase()
- `type`: String()

✅ **Validation**
- Required fields check
- Trade limit check untuk free users
- Auto-create profile jika belum ada

✅ **Error Handling**
- Cek Prisma Foreign Key Constraint Error
- Log error dengan detail stack trace
- Return error message yang jelas dengan detail

✅ **Fixed Issue**
- Hapus field `status` dari create trade (tidak ada di schema)
- Set `created_at` dan `updated_at` secara eksplisit

---

## 🚀 Deployment Steps

### Step 1: Setup Supabase Database

1. Buka Supabase Dashboard → SQL Editor
2. Jalankan `correct-schema-supabase.sql`
3. Jika ada error "foreign key constraint", jalankan `correct-fix-profiles.sql`
4. Verifikasi semua tabel terbuat di Table Editor

### Step 2: Configure Vercel

1. Buka Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add semua environment variables (lihat bagian Environment Variables di atas)
3. Pastikan pilih Environment: **Production** dan **Preview**

### Step 3: Deploy

1. Push ke GitHub (sudah done):
   ```bash
   git push origin main
   ```

2. Vercel akan otomatis deploy
3. Tunggu deployment selesai

### Step 4: Verify Deployment

1. Buka aplikasi di luxtradee.web.id
2. Login dengan akun Supabase
3. Cek Vercel Logs untuk:
   - ✅ "Connection Pooling: Enabled (pgbouncer)"
   - ✅ "Database Type: PostgreSQL"
   - ✅ Tidak ada error koneksi database

4. Test features:
   - ✅ Login berhasil
   - ✅ Add Account berhasil
   - ✅ Add Trade berhasil
   - ✅ View Trades berhasil

---

## 🐛 Troubleshooting

### Error: "Connection refused" atau "Unable to connect"

**Cause:** Port salah atau connection pooling tidak enabled

**Solution:**
- Pastikan DATABASE_URL menggunakan port 6543
- Pastikan ada `?pgbouncer=true`
- Pastikan Supabase project tidak paused

### Error: "Foreign key constraint violated"

**Cause:** Profile user belum ada di database

**Solution:**
- Jalankan `correct-fix-profiles.sql` di Supabase SQL Editor
- Logout dan login kembali di aplikasi

### Error: "Unauthorized - Please login"

**Cause:** Token invalid atau session expired

**Solution:**
- Logout dan login kembali
- Cek NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di Vercel

### Error: "Missing required fields"

**Cause:** Field required tidak terkirim dari frontend

**Solution:**
- Cek form frontend mengirim semua field required
- Cek console browser untuk request payload
- Pastikan field names match (snake_case untuk database)

### Error: Trade limit exceeded

**Cause:** Free user sudah membuat 15 trade bulan ini

**Solution:**
- Upgrade ke PRO
- Tunggu bulan berikutnya
- Atau cek trade count di database

---

## 📊 Schema Validation

Semua field names sudah 100% sinkron dengan `schema.prisma`:

### Profile (camelCase)
- `id`, `email`, `plan`, `role`, `is_pro`
- `streakCount`, `lastLoginAt`, `bestStreak`
- `createdAt`, `updatedAt`
- `achievements` (JSON)

### Trading Account (snake_case)
- `id`, `user_id`, `name`, `broker`
- `account_type`, `account_number`
- `initial_balance`, `current_balance`
- `leverage`, `currency`
- `is_default`, `is_active`
- `created_at`, `updated_at`

### Trade (snake_case)
- `id`, `user_id`, `account_id`
- `symbol`, `type`
- `open_price`, `close_price`
- `lot_size`, `profit_loss`
- `open_time`, `close_time`
- `session`, `notes`
- `image_url`, `screenshot_url`
- `emotion`, `setup_type`, `tags`
- `risk_reward_ratio`, `trade_duration`
- `linked_journal_id`
- `created_at`, `updated_at`

---

## ✅ Verification Checklist

Setelah deployment, pastikan:

- [ ] Vercel logs menampilkan "Connection Pooling: Enabled (pgbouncer)"
- [ ] Vercel logs menampilkan "Database Type: PostgreSQL"
- [ ] Tidak ada error koneksi database di logs
- [ ] User bisa login
- [ ] User bisa create trading account
- [ ] User bisa create trade
- [ ] User bisa view trades
- [ ] Semua numeric fields tersimpan dengan benar
- [ ] Semua datetime fields tersimpan dengan benar
- [ ] Foreign key constraints tidak error

---

## 📝 Notes

- **Development** menggunakan SQLite (file:./db/custom.db)
- **Production** menggunakan PostgreSQL Supabase (port 6543 dengan pgbouncer)
- Semua type conversion dilakukan di API route (bukan di frontend)
- Error logging detail untuk debugging production
- Auto-create profile untuk user baru

---

**Status:** ✅ Ready for Production Deployment
**Last Updated:** 2026-05-22
