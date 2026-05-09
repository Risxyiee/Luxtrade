# Verifikasi Environment Variables di Vercel

## Problem
Sync API masih error dan tidak memberikan detail error yang jelas.

## Kemungkinan Penyebab
Environment variables yang diperlukan belum lengkap di Vercel.

## Environment Variables yang Dibutuhkan

Berikut adalah environment variables yang WAJIB di-set di Vercel:

### 1. DATABASE_URL
- **Status**: Sudah di-set (berdasarkan info user)
- **Value**: `postgres://postgres.klxkdrfsfcoankbaoejn:oW0TKZUMb295pa4h@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x`
- **Environment**: All (Production, Preview, Development)

### 2. SUPABASE_SERVICE_ROLE_KEY
- **Status**: Katanya sudah di-set oleh user
- **Value**: Service Role Key dari Supabase Dashboard
- **Environment**: All (Production, Preview, Development)

### 3. NEXT_PUBLIC_SUPABASE_URL
- **Status**: Perlu dicek
- **Value**: `https://klxkdrfsfcoankbaoejn.supabase.co`
- **Environment**: All (Production, Preview, Development)
- **PENTING**: Variable dengan prefix `NEXT_PUBLIC_` HARUS di-set di Vercel agar tersedia di production

### 4. NEXT_PUBLIC_SUPABASE_ANON_KEY
- **Status**: Perlu dicek
- **Value**: Anon Key dari Supabase Dashboard
- **Environment**: All (Production, Preview, Development)
- **PENTING**: Variable dengan prefix `NEXT_PUBLIC_` HARUS di-set di Vercel

---

## Cara Mengecek Environment Variables di Vercel

1. Buka: https://vercel.com/risyxiee/luxtrade/settings/environment-variables

2. Cek apakah 4 variable di atas sudah ada:
   - ✅ DATABASE_URL
   - ✅ SUPABASE_SERVICE_ROLE_KEY
   - ✅ NEXT_PUBLIC_SUPABASE_URL
   - ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY

3. Jika ada yang kurang, tambahkan:

### Menambahkan NEXT_PUBLIC_SUPABASE_URL
1. Klik **"Add New"**
2. Name: `NEXT_PUBLIC_SUPABASE_URL`
3. Value: `https://klxkdrfsfcoankbaoejn.supabase.co`
4. Environment: **All**
5. Klik **Save**

### Menambahkan NEXT_PUBLIC_SUPABASE_ANON_KEY
1. Klik **"Add New"**
2. Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Value: Ambil dari Supabase Dashboard:
   - Settings → API → Project API keys → anon key
   - Format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
4. Environment: **All**
5. Klik **Save**

---

## Setelah Menambahkan Environment Variables

### 1. Redeploy Project
**PENTING**: Environment variables baru tidak akan berlaku sampai kamu redeploy!

Cara redeploy:
- Buka: https://vercel.com/risyxiee/luxtrade/deployments
- Klik deployment terbaru
- Klik menu **"..."** (tiga titik)
- Klik **"Redeploy"**
- Tunggu sampai status berubah ke **Ready**

### 2. Test Sync API
Setelah redeploy selesai, cek lagi:
```
https://luxtrade-2x18lq472-risyxiee.vercel.app/api/admin/sync-auth-users
```

Sekarang seharusnya kita bisa melihat error yang lebih detail.

---

## Alternatif: Cek Vercel Function Logs

Jika masih error, cek logs:

1. Buka deployment terbaru: https://vercel.com/risyxiee/luxtrade/deployments
2. Klik deployment yang sedang running
3. Scroll ke bawah ke **Function Logs**
4. Cari log dengan `/api/admin/sync-auth-users`
5. Baca error message di sana

---

## Debug: Cek Variable yang Tersedia

Buka file ini untuk melihat environment variables yang tersedia:
```
https://luxtrade-2x18lq472-risyxiee.vercel.app/api/debug/env
```

Jika endpoint ini 404, berarti deployment baru belum selesai.

---

## Summary

**Langkah yang perlu dilakukan:**

1. ✅ Pastikan DATABASE_URL sudah ada di Vercel
2. ✅ Pastikan SUPABASE_SERVICE_ROLE_KEY sudah ada di Vercel
3. ❓ Tambahkan NEXT_PUBLIC_SUPABASE_URL jika belum ada
4. ❓ Tambahkan NEXT_PUBLIC_SUPABASE_ANON_KEY jika belum ada
5. ❓ Redeploy project setelah menambahkan environment variables
6. ❓ Test sync API lagi

**PENTING**: Jangan lupa redeploy setelah mengubah environment variables!
