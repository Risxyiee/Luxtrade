# Troubleshooting: Sync API Issue

## Current Situation

### ✅ Yang Berjalan Normal:
1. **Database Connection** - Koneksi ke Supabase Postgres OK
2. **Basic Supabase Connection** - Endpoint `/api/setup` berjalan dan menampilkan data
3. **Data Exist** - Sudah ada 3 user di Supabase Auth (dari `/api/setup`):
   - iyan (friandars@gmail.com)
   - GALANG DWI AMANDA (galangdwiamanda@gmail.com)
   - Admin LuxTrade (luxtradee@gmail.com)

### ❌ Masalah:
1. **Sync API Error** - `/api/admin/sync-auth-users` return error 500:
   ```json
   {"error":"Failed to check sync status"}
   ```
2. **New Endpoints 404** - Endpoint baru yang dibuat masih 404 (deployment belum selesai)

---

## Root Cause Analysis

Berdasarkan pengecekan, kemungkinan penyebabnya:

### 1. Service Role Key Issue (Paling Mungkin)
- Sync API menggunakan `SUPABASE_SERVICE_ROLE_KEY` untuk akses admin
- Jika key ini tidak set atau salah, API akan gagal
- Variable ini WAJIB ada di Vercel Environment Variables

### 2. Deployment Latency
- Endpoint baru yang dibuat masih 404 (health check, debug endpoints)
- Ini normal - Vercel sedang build/deploy kode terbaru
- Biasanya memakan waktu 2-3 menit

### 3. Missing Environment Variables
Perlu dicek apakah 4 variable ini ada di Vercel:
- `DATABASE_URL` ✅ (sudah ada)
- `SUPABASE_SERVICE_ROLE_KEY` ❓ (user bilang ada, perlu dicek)
- `NEXT_PUBLIC_SUPABASE_URL` ❓ (perlu dicek)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ❓ (perlu dicek)

---

## Action Plan

### Step 1: Cek Environment Variables di Vercel

Buka: https://vercel.com/risyxiee/luxtrade/settings/environment-variables

Pastikan 4 variable berikut ada:

#### ✅ DATABASE_URL
- Value: `postgres://postgres.klxkdrfsfcoankbaoejn:oW0TKZUMb295pa4h@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x`
- Environment: All

#### ❓ SUPABASE_SERVICE_ROLE_KEY
- Cara mendapatkan:
  1. Buka https://supabase.com/dashboard/project/klxkdrfsfcoankbaoejn/settings/api
  2. Scroll ke "Project API keys"
  3. Copy **service_role** key (bukan anon key)
  4. Key format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Value: [paste service role key dari Supabase]
- Environment: All

#### ❓ NEXT_PUBLIC_SUPABASE_URL
- Value: `https://klxkdrfsfcoankbaoejn.supabase.co`
- Environment: All

#### ❓ NEXT_PUBLIC_SUPABASE_ANON_KEY
- Cara mendapatkan:
  1. Buka https://supabase.com/dashboard/project/klxkdrfsfcoankbaoejn/settings/api
  2. Scroll ke "Project API keys"
  3. Copy **anon** key
- Value: [paste anon key dari Supabase]
- Environment: All

---

### Step 2: Jika ada variable yang kurang, tambahkan dan redeploy

**PENTING**: Setelah menambahkan environment variables, WAJIB redeploy!

Cara redeploy:
1. Buka: https://vercel.com/risyxiee/luxtrade/deployments
2. Klik deployment terbaru
3. Klik menu **"..."** (tiga titik)
4. Klik **"Redeploy"**
5. Tunggu sampai status **Ready**

---

### Step 3: Test API setelah redeploy

Tunggu 2-3 menit setelah deploy selesai, lalu test:

#### Test 1: Health Check
```
https://luxtrade-2x18lq472-risyxiee.vercel.app/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "version": "2.0",
  "message": "Server is running"
}
```

#### Test 2: Service Role Key Check
```
https://luxtrade-2x18lq472-risyxiee.vercel.app/api/test/service-key
```

Expected response (jika semua OK):
```json
{
  "success": true,
  "message": "Service Role Key is working correctly",
  "results": [
    {
      "step": "1. Environment Variables",
      "status": "info",
      "details": {
        "NEXT_PUBLIC_SUPABASE_URL": "https://klxkdrfsfcoankbaoejn.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "SET",
        "SERVICE_ROLE_KEY_LENGTH": 300,
        ...
      }
    },
    {
      "step": "2. Supabase Admin Client",
      "status": "OK",
      "details": "supabaseAdmin initialized successfully"
    },
    {
      "step": "3. Test Supabase Auth Admin API",
      "status": "OK",
      "details": {
        "userCount": 6,
        "users": [...]
      }
    }
  ]
}
```

#### Test 3: Sync Status Check (GET)
```
https://luxtrade-2x18lq472-risyxiee.vercel.app/api/admin/sync-auth-users
```

Expected response (jika service role key OK):
```json
{
  "success": true,
  "supabaseAuthUsers": 6,
  "prismaUsers": 0,
  "syncNeeded": true,
  "authUsers": [
    {
      "id": "...",
      "email": "friandars@gmail.com",
      "name": "iyan"
    },
    ...
  ]
}
```

---

### Step 4: Jalankan Sync (jika Test 3 berhasil)

Gunakan Postman, curl, atau HTTP client untuk mengirim **POST** request ke:
```
https://luxtrade-2x18lq472-risyxiee.vercel.app/api/admin/sync-auth-users
```

Expected response:
```json
{
  "success": true,
  "message": "Sync completed",
  "syncedCount": 6,
  "skippedCount": 0,
  "errorCount": 0,
  "totalPrismaUsers": 6
}
```

---

### Step 5: Verifikasi Admin Panel

Buka:
```
https://luxtrade-2x18lq472-risyxiee.vercel.app/admin-subscriptions
```

Seharusnya menampilkan semua user yang sudah disync.

---

## Alternatif Debugging: Cek Vercel Function Logs

Jika API masih error setelah semua langkah di atas:

1. Buka: https://vercel.com/risyxiee/luxtrade/deployments
2. Klik deployment terbaru yang sedang running
3. Scroll ke bawah ke **Function Logs**
4. Cari log dengan path `/api/admin/sync-auth-users`
5. Baca error message di console logs

Logs akan menunjukkan:
- Apakah environment variables terbaca dengan benar
- Apakah database connection berhasil
- Apakah Supabase Auth API call berhasil
- Error detail jika ada yang gagal

---

## Summary

### Yang Perlu Dicek Sekarang:
1. ✅ Environment Variables di Vercel (4 variable)
2. ❓ Apakah `SUPABASE_SERVICE_ROLE_KEY` sudah ada dengan nilai yang benar?
3. ❓ Apakah `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` sudah ada?
4. ❓ Apakah sudah redeploy setelah mengubah environment variables?

### Yang Perlu Dilakukan:
1. Cek dan tambahkan environment variables yang kurang
2. Redeploy project
3. Test API endpoints yang baru (health, service-key)
4. Test sync-auth-users API
5. Jalankan sync jika status check OK
6. Verifikasi di Admin Panel

### Dokumen Referensi:
- `ENV_VERIFICATION.md` - Panduan detail untuk setup environment variables
- `FIX_SYNC_KEY.md` - Panduan sebelumnya untuk sync

---

## Kontak Support

Jika masih mengalami masalah setelah mengikuti semua langkah di atas:

1. Screenshot Vercel Environment Variables page
2. Screenshot Vercel Function Logs untuk `/api/admin/sync-auth-users`
3. Screenshot response dari `/api/test/service-key` endpoint

Share screenshot tersebut untuk further troubleshooting.
