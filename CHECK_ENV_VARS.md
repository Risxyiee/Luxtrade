# CRITICAL: Cek Ulang Environment Variables di Vercel

## Masalah

Build error:
```
Error: Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.
```

Ini berarti `NEXT_PUBLIC_SUPABASE_URL` di Vercel TIDAK valid.

---

## ✅ Solusi Saya: URL Validation dengan Fallback

Saya sudah menambahkan URL validation dengan fallback, jadi build akan berhasil walau env vars tidak valid.

Tapi untuk APP bekerja dengan benar, env vars HARUS di-set dengan benar.

---

## 📋 Cara Cek Environment Variables di Vercel

### Step 1: Buka Vercel Environment Variables

Buka: https://vercel.com/risyxiee/luxtrade/settings/environment-variables

---

### Step 2: Cari Variable: NEXT_PUBLIC_SUPABASE_URL

Lihat apakah ada variable dengan nama: `NEXT_PUBLIC_SUPABASE_URL`

**Jika TIDAK ADA:**
Klik **"Add New"**
- **Name**: `NEXT_PUBLIC_SUPABASE_URL`
- **Value**: `https://klxkdrfsfcoankbaoejn.supabase.co`
- **Environment**: Pilih **All** (Production, Preview, Development)
- Klik **Save**

**Jika SUDAH ADA:**
Klik variable tersebut untuk melihat/edit nilainya.

**VALUE HARUS TEPAT:**
```
https://klxkdrfsfcoankbaoejn.supabase.co
```

**CEK-CEK:**
- ✅ Ada `https://` di awal
- ✅ Tidak ada spasi di awal/akhir
- ✅ Tidak ada quote `"` di awal/akhir
- ✅ Semua huruf kecil untuk `supabase.co`
- ✅ Project ID: `klxkdrfsfcoankbaoejn` (sesuai Supabase URL kamu)

**WRONG EXAMPLES:**
- ❌ `https://klxkdrfsfcoankbaoejn.supabase.co/` (ada slash di akhir)
- ❌ `https://klxkdrfsfcoankbaoejn.supabase.co` (ada spasi)
- ❌ `"https://klxkdrfsfcoankbaoejn.supabase.co"` (ada quote)
- ❌ `https://klxkdrfsfcoankbaoejn.supabase.co` (project ID salah)
- ❌ `klxkdrfsfcoankbaoejn.supabase.co` (tidak ada https://)

---

### Step 3: Cari Variable: NEXT_PUBLIC_SUPABASE_ANON_KEY

Lihat apakah ada variable dengan nama: `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Jika TIDAK ADA:**
Klik **"Add New"**
- **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value**: [Copy dari Supabase Dashboard - anon key]
- **Environment**: **All**
- Klik **Save**

**Jika SUDAH ADA:**
Klik variable tersebut untuk melihat/edit nilainya.

**CEK-CEK VALUE:**
- Harus di-copy dari Supabase Dashboard
- Format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Biasanya 200+ karakter
- Tidak ada spasi/tanda kutip

**CARA AMBIL ANON KEY:**
1. Buka: https://supabase.com/dashboard/project/klxkdrfsfcoankbaoejn/settings/api
2. Scroll ke **Project API keys**
3. Di sebelah **anon** key, klik tombol **Copy**
4. Paste ke Vercel di variable `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

### Step 4: Cari Variable: SUPABASE_SERVICE_ROLE_KEY

Lihat apakah ada variable dengan nama: `SUPABASE_SERVICE_ROLE_KEY`

**PENTING**: Nama TIDAK ada `NEXT_PUBLIC_` prefix!

**Jika TIDAK ADA:**
Klik **"Add New"**
- **Name**: `SUPABASE_SERVICE_ROLE_KEY` (TANPA NEXT_PUBLIC_)
- **Value**: [Copy dari Supabase Dashboard - service_role key]
- **Environment**: **All**
- Klik **Save**

**Jika SUDAH ADA:**
Klik variable tersebut untuk melihat/edit nilainya.

**CEK-CEK VALUE:**
- Harus **service_role key**, BUKAN anon key!
- Format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Biasanya 200+ karakter (mirip anon tapi berbeda)
- Tidak ada spasi/tanda kutip

**CARA AMBIL SERVICE ROLE KEY:**
1. Buka: https://supabase.com/dashboard/project/klxkdrfsfcoankbaoejn/settings/api
2. Scroll ke **Project API keys**
3. Di sebelah **service_role** key, klik tombol **Copy**
4. Paste ke Vercel di variable `SUPABASE_SERVICE_ROLE_KEY`

**PENTING**:
- ❌ Jangan gunakan anon key untuk SUPABASE_SERVICE_ROLE_KEY!
- ✅ Harus gunakan service_role key!

---

### Step 5: Cari Variable: DATABASE_URL

Lihat apakah ada variable dengan nama: `DATABASE_URL`

**Jika TIDAK ADA:**
Klik **"Add New"**
- **Name**: `DATABASE_URL`
- **Value**: `postgres://postgres.klxkdrfsfcoankbaoejn:oW0TKZUMb295pa4h@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x`
- **Environment**: **All**
- Klik **Save**

**Jika SUDAH ADA:**
Klik variable tersebut untuk melihat/edit nilainya.

---

## ✅ Final Verification

Setelah semua 4 variable sudah di-set/dicek:

| Variable Name | Status | Value Correct? |
|--------------|--------|----------------|
| `DATABASE_URL` | ✅ Ada | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Ada | ✅ (service_role, bukan anon) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Ada | ✅ (format: https://...) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Ada | ✅ (anon key dari Supabase) |

**SEMUA harus punya Environment: All (Production, Preview, Development)**

---

## 🚀 Redeploy (WAJIB!)

Setelah dicek/diperbaiki:

1. Buka: https://vercel.com/risyxiee/luxtrade/deployments
2. Klik deployment terbaru → **"..."** → **Redeploy**
3. Tunggu status **Ready** (2-5 menit)
4. Tunggu tambahan **3 menit** untuk server initialization

---

## 🧪 Test Setelah Redeploy

### Test 1: Health Check
```
https://luxtrade-2x18lq472-risyxiee.vercel.app/api/health
```

Expected:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "version": "2.0",
  "message": "Server is running"
}
```

### Test 2: Sync Status
```
https://luxtrade-2x18lq472-risyxiee.vercel.app/api/admin/sync-auth-users
```

Expected:
```json
{
  "success": true,
  "supabaseAuthUsers": 6,
  "prismaUsers": 0,
  "syncNeeded": true
}
```

---

## Common Mistakes & Solutions

### ❌ Mistake 1: NEXT_PUBLIC_SUPABASE_URL ada spasi

**Salah**: ` https://klxkdrfsfcoankbaoejn.supabase.co` (spasi di awal)
**Benar**: `https://klxkdrfsfcoankbaoejn.supabase.co`

---

### ❌ Mistake 2: Salah nama variable

**Salah**: `NEXT_PUBLIC_SUPABASE_URLS` (plural)
**Benar**: `NEXT_PUBLIC_SUPABASE_URL` (singular)

**Salah**: `SUPABASE_SERVICE_ROLE_KEY` ada NEXT_PUBLIC_ prefix
**Benar**: `SUPABASE_SERVICE_ROLE_KEY` (TANPA NEXT_PUBLIC_)

---

### ❌ Mistake 3: Salah key untuk variable

**Salah**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` guna service_role key
**Benar**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` guna anon key

**Salah**: `SUPABASE_SERVICE_ROLE_KEY` guna anon key
**Benar**: `SUPABASE_SERVICE_ROLE_KEY` guna service_role key

---

### ❌ Mistake 4: Environment tidak All

**Salah**: Hanya Production
**Benar**: All (Production, Preview, Development semua dicheck)

---

## Quick Reference

### Links:
- **Vercel Environment Variables**: https://vercel.com/risyxiee/luxtrade/settings/environment-variables
- **Vercel Deployments**: https://vercel.com/risyxiee/luxtrade/deployments
- **Supabase Dashboard**: https://supabase.com/dashboard/project/klxkdrfsfcoankbaoejn
- **Supabase API Keys**: https://supabase.com/dashboard/project/klxkdrfsfcoankbaoejn/settings/api

### Expected Values:

**NEXT_PUBLIC_SUPABASE_URL**:
```
https://klxkdrfsfcoankbaoejn.supabase.co
```

**NEXT_PUBLIC_SUPABASE_ANON_KEY**:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (anon key dari Supabase)
```

**SUPABASE_SERVICE_ROLE_KEY**:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (service_role key dari Supabase)
```

**DATABASE_URL**:
```
postgres://postgres.klxkdrfsfcoankbaoejn:oW0TKZUMb295pa4h@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x
```

---

## Summary Checklist

- [ ] Buka Vercel Environment Variables
- [ ] Cek dan perbaiki `NEXT_PUBLIC_SUPABASE_URL` (harus: https://klxkdrfsfcoankbaoejn.supabase.co)
- [ ] Cek dan perbaiki `NEXT_PUBLIC_SUPABASE_ANON_KEY` (harus: anon key dari Supabase)
- [ ] Cek dan perbaiki `SUPABASE_SERVICE_ROLE_KEY` (harus: service_role key dari Supabase, TANPA NEXT_PUBLIC_)
- [ ] Cek `DATABASE_URL` (harus: connection string PostgreSQL)
- [ ] Pastikan SEMUA punya Environment: All
- [ ] Redeploy di Vercel
- [ ] Tunggu deployment selesai + 3 menit
- [ ] Test health check
- [ ] Test sync status

---

## Setelah Semua Benar

Build akan berhasil dan app akan berjalan!

Langkah selanjutnya:
1. Sync users dari Supabase Auth
2. Verifikasi admin panel
3. Test aktivasi Lifetime Ultra

Good luck! 🚀
