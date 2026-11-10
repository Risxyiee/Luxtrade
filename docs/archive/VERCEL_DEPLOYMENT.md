# Vercel Deployment Guide

## 🚨 CRITICAL: Environment Variables Setup

Ini adalah panduan **WAJIB** untuk setup environment variables di Vercel. Tanpa setup ini, aplikasi **TIDAK AKAN BERFUNGSI** di production!

---

## 📋 Required Environment Variables

Berikut environment variables yang **HARUS** di-set di Vercel Dashboard:

### 1. DATABASE_URL (MANDATORY - PENTING!)

**Masalah yang Dihadapi:**
- Error: `PrismaClientInitializationError: Invalid prisma.profile.findUnique() invocation: error: Error validating datasource db: the URL must start with the protocol file:.`
- Semua API routes return 500 error
- User tidak bisa create account atau trade

**Solusi:**
Di Vercel Dashboard → Settings → Environment Variables, tambahkan:

```
DATABASE_URL=postgresql://postgres:RISKI_PASSWORD@db.PROJECT_REF.supabase.co:6543/postgres?pgbouncer=true&connection_limit=10
```

**PENTING:**
- Ganti `RISKI_PASSWORD` dengan password Supabase database Anda
- Ganti `PROJECT_REF` dengan project reference Supabase Anda
- **GUNAKAN PORT 6543** (bukan 5432) untuk pgbouncer connection pooling
- Tambahkan `?pgbouncer=true&connection_limit=10` untuk connection pooling yang optimal

**Contoh untuk project ini:**
```
DATABASE_URL=postgresql://postgres:Riskiakbarp123@db.klxkdrfsfcoankbaoejn.supabase.co:6543/postgres?pgbouncer=true&connection_limit=10
```

### 2. NEXT_PUBLIC_SUPABASE_URL (MANDATORY)

```
NEXT_PUBLIC_SUPABASE_URL=https://klxkdrfsfcoankbaoejn.supabase.co
```

Ganti dengan Supabase project URL Anda.

### 3. NEXT_PUBLIC_SUPABASE_ANON_KEY (MANDATORY)

Dapatkan dari:
Supabase Dashboard → Settings → API → anon/public key

```
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. SUPABASE_SERVICE_ROLE_KEY (MANDATORY untuk admin operations)

Dapatkan dari:
Supabase Dashboard → Settings → API → service_role key

⚠️ **WARNING:** JANGAN pernah expose service_role key di client-side!

```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🔧 Cara Setup Environment Variables di Vercel

### Step 1: Buka Vercel Dashboard
1. Login ke [Vercel Dashboard](https://vercel.com/dashboard)
2. Pilih project Anda

### Step 2: Buka Environment Variables
1. Go to **Settings** → **Environment Variables**
2. Klik **Add New** untuk setiap variable

### Step 3: Tambahkan Environment Variables

Tambahkan variable berikut satu per satu:

| Name | Value | Environment |
|------|-------|-------------|
| `DATABASE_URL` | `postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:6543/postgres?pgbouncer=true&connection_limit=10` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR_PROJECT.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Production, Preview, Development |

⚠️ **PENTING:** Set environment variables untuk **ALL** environments (Production, Preview, Development)

### Step 4: Redeploy Application

Setelah menambahkan environment variables:

1. Go ke **Deployments** tab
2. Klik **...** (tiga titik) di deployment terbaru
3. Pilih **Redeploy**
4. Pastikan checkbox **"Redeploy without building cache"** TIDAK dicentang

---

## 🗄️ Database Setup

### Prisma Schema Configuration

Project ini menggunakan **PostgreSQL** (Supabase), bukan SQLite.

**Prisma Schema** (`prisma/schema.prisma`):
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Push Schema ke Database

Jika database Supabase masih kosong atau perlu update schema:

```bash
# Di local machine dengan DATABASE_URL yang benar
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:6543/postgres?pgbouncer=true&connection_limit=10" bun run db:push
```

---

## ✅ Cek Deployment Setelah Setup

Setelah environment variables di-set dan redeploy:

### 1. Test Health Endpoint
```
curl https://your-app.vercel.app/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-05-25T05:28:48.558Z",
  "version": "2.0",
  "message": "Server is running"
}
```

### 2. Test Profile Sync Endpoint (membutuhkan auth)
```
curl https://your-app.vercel.app/api/auth/sync-profile \
  -H "Cookie: your_session_cookie"
```

Expected response:
```json
{
  "success": true,
  "profile": {
    "id": "user-uuid",
    "email": "user@example.com",
    "plan": "FREE",
    "role": "USER"
  },
  "stats": {
    "tradeCount": 0
  }
}
```

### 3. Cek Vercel Function Logs

1. Buka Vercel Dashboard → **Deployments** → pilih deployment terbaru
2. Klik tab **Logs**
3. Cari error logs:
   - ❌ `PrismaClientInitializationError` → DATABASE_URL salah atau tidak ada
   - ❌ `Can't reach database server` → Database credentials salah atau network issue
   - ✅ `🗄️ Database Type: PostgreSQL` → Database connection berhasil

---

## 🔍 Troubleshooting

### Error: "the URL must start with the protocol `file:`"

**Problem:**
```
PrismaClientInitializationError: Invalid prisma.profile.findUnique() invocation:
error: Error validating datasource db: the URL must start with the protocol file:.
```

**Cause:**
- `DATABASE_URL` environment variable tidak ada di Vercel
- `DATABASE_URL` tidak valid (bukan format PostgreSQL)
- Schema masih menggunakan `provider = "sqlite"` tapi DATABASE_URL adalah PostgreSQL

**Solution:**
1. Pastikan `DATABASE_URL` di-set di Vercel Dashboard dengan format PostgreSQL:
   ```
   postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:6543/postgres?pgbouncer=true&connection_limit=10
   ```
2. Pastikan Prisma schema menggunakan `provider = "postgresql"`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Redeploy application

### Error: "Can't reach database server"

**Problem:**
```
P1001: Can't reach database server at `db.PROJECT.supabase.co:6543`
```

**Cause:**
- Database password salah
- Port salah (harus 6543 untuk pgbouncer, bukan 5432)
- Database project reference salah
- Network/firewall issue

**Solution:**
1. Verify database credentials di Supabase Dashboard
2. Coba gunakan port 5432 jika 6543 tidak works:
   ```
   DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres
   ```
3. Pastikan Supabase project aktif dan tidak suspended

### Error: "Unauthorized" atau "Profile not found"

**Problem:**
User login tapi tidak bisa create trade atau data hilang.

**Cause:**
- Profile tidak otomatis dibuat setelah auth
- Supabase auth keys salah

**Solution:**
1. Pastikan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` benar
2. Pastikan user memanggil `/api/auth/sync-profile` setelah login
3. Cek database apakah profile ada:
   ```sql
   SELECT * FROM "Profile" WHERE id = 'user-uuid';
   ```

### User Trade Data Hilang

**Problem:**
User melaporkan: "data trade saya hilang"

**Safeguards yang Sudah Di-implementasi:**

✅ **Profile Auto-Creation:**
- API `/api/auth/ensure-profile` otomatis membuat profile jika belum ada
- API `/api/auth/sync-profile` sync profile dengan Supabase auth

✅ **Trade Ownership Verification:**
- Setiap trade creation di-verify ownership-nya
- Explicit `user_id` pada setiap trade create
- Enhanced logging untuk debugging

✅ **Trade Query Filtering:**
- Semua trade query menggunakan filter `user_id` dari Supabase auth
- User hanya bisa akses trade miliknya sendiri

**Cara Mencegah Data Hilang:**

1. **Pastikan DATABASE_URL valid di Vercel** - ini adalah #1 cause
2. **Auto-create profile setelah signup:**
   ```typescript
   // Di client-side setelah signup berhasil
   await fetch('/api/auth/ensure-profile', {
     method: 'POST',
     body: JSON.stringify({
       userId: user.id,
       email: user.email
     })
   })
   ```

3. **Sync profile setelah login:**
   ```typescript
   // Di client-side setelah login berhasil
   await fetch('/api/auth/sync-profile')
   ```

---

## 📝 Checklist Sebelum Deploy ke Production

- [ ] `DATABASE_URL` di-set di Vercel dengan format PostgreSQL dan port 6543
- [ ] `NEXT_PUBLIC_SUPABASE_URL` di-set dengan Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` di-set dengan Supabase anon key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` di-set dengan Supabase service role key
- [ ] Prisma schema menggunakan `provider = "postgresql"`
- [ ] Schema sudah di-push ke database: `bun run db:push`
- [ ] Health endpoint returns 200: `/api/health`
- [ ] User signup dan login berfungsi
- [ ] Profile auto-creation berfungsi
- [ ] Trade creation dan retrieval berfungsi
- [ ] Test dengan user baru untuk memastikan flow lengkap

---

## 🚀 Deployment Commands

### Local Development
```bash
# Start dev server
bun run dev

# Push schema changes to database
bun run db:push

# Generate Prisma Client
bun run db:generate
```

### Production Deployment
```bash
# Build for production
bun run build

# Push schema to production database
DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:6543/postgres?pgbouncer=true&connection_limit=10" bun run db:push
```

---

## 📞 Support

Jika masih mengalami masalah setelah mengikuti panduan ini:

1. Cek Vercel Function Logs untuk error details
2. Cek Supabase Dashboard untuk database dan auth status
3. Verify semua environment variables di Vercel Dashboard
4. Pastikan database connection string valid dan database accessible

**Last Updated:** 2026-05-25
**Project Version:** 2.0
