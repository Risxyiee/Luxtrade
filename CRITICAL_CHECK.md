# CRITICAL: Cek Environment Variables di Vercel

Masalah: Sync API dan Admin Panel error karena environment variables tidak terbaca dengan benar.

---

## Langkah 1: Buka Vercel Environment Variables

Buka link ini:
https://vercel.com/risyxiee/luxtrade/settings/environment-variables

---

## Langkah 2: Screenshot yang Anda Lihat

Kirim screenshot dari halaman Environment Variables tersebut.

Yang perlu terlihat di screenshot:
- List semua environment variables yang ada
- Nama variable
- Environment (Production/Preview/Development)

---

## Langkah 3: Cek Apakah 4 Variable Ini Ada

### 1. DATABASE_URL
- **Status**: Anda bilang sudah ada ✅
- **Value harus**: `postgres://postgres.klxkdrfsfcoankbaoejn:oW0TKZUMb295pa4h@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x`

### 2. SUPABASE_SERVICE_ROLE_KEY
- **Status**: Anda bilang sudah ada ❓
- **Perlu dicek**:
  1. Nama variable tepat: `SUPABASE_SERVICE_ROLE_KEY` (tanpa NEXT_PUBLIC_ prefix)
  2. Value adalah **service_role key**, BUKAN anon key
  3. Environment dipilih: **All** (Production, Preview, Development)

**Cara pasti**: Buka Supabase Dashboard → Settings → API
- Cari **Project API keys**
- Key yang dimulai dengan `service_role` (bukan `anon`)
- Copy key tersebut ke Vercel

### 3. NEXT_PUBLIC_SUPABASE_URL
- **Status**: Perlu dicek ❓
- **Nama variable harus**: `NEXT_PUBLIC_SUPABASE_URL` (ada NEXT_PUBLIC_ prefix)
- **Value**: `https://klxkdrfsfcoankbaoejn.supabase.co`
- **Environment**: **All**

### 4. NEXT_PUBLIC_SUPABASE_ANON_KEY
- **Status**: Perlu dicek ❓
- **Nama variable harus**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ada NEXT_PUBLIC_ prefix)
- **Value**: Ambil dari Supabase Dashboard → Settings → API → **anon** key
- **Environment**: **All**

---

## Perbedaan Penting: Service Role vs Anon Key

| Type | Prefix di Vercel | Fungsi | Ambil dari mana |
|------|------------------|--------|----------------|
| Service Role | **TANPA** NEXT_PUBLIC_ | Admin operations (list users) | Supabase → Settings → API → **service_role** key |
| Anon Key | **ADA** NEXT_PUBLIC_ | Client-side operations | Supabase → Settings → API → **anon** key |

---

## Masalah Umum yang Sering Terjadi

### ❌ Masalah 1: Salah menarik key
- Mengambil **anon key** untuk `SUPABASE_SERVICE_ROLE_KEY`
- Padahal harusnya **service_role key**

### ❌ Masalah 2: Salah nama variable
- Menulis `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` (ada NEXT_PUBLIC_)
- Padahal harusnya `SUPABASE_SERVICE_ROLE_KEY` (tanpa NEXT_PUBLIC_)

### ❌ Masalah 3: Environment tidak dipilih
- Hanya memilih Production
- Padahal harusnya **All** (Production, Preview, Development)

### ❌ Masalah 4: Lupa redeploy
- Menambahkan environment variables tapi tidak redeploy
- Environment variables baru tidak akan terbaca sampai redeploy

---

## Setelah Dicek dan Diperbaiki

### Langkah 4: Redeploy (WAJIB!)

1. Buka: https://vercel.com/risyxiee/luxtrade/deployments
2. Klik deployment terbaru
3. Klik menu **"..."** (tiga titik)
4. Klik **"Redeploy"**
5. Tunggu sampai status **Ready** (biasanya 2-5 menit)

### Langkah 5: Test Lagi

Setelah redeploy selesai, tunggu 2-3 menit lagi untuk server initialization.

Lalu test:
- **Test 1**: `/api/health` - Seharusnya return JSON (bukan 404)
- **Test 3**: `/api/admin/sync-auth-users` - Seharusnya tidak error
- **Test 5**: `/admin-subscriptions` - Seharusnya menampilkan data

---

## Debugging Jika Masih Error

Jika setelah semua langkah di atas masih error:

### Cek 1: Screenshot Vercel Environment Variables
- Kirim screenshot dari: https://vercel.com/risyxiee/luxtrade/settings/environment-variables
- Hide nilai value-nya, biarkan nama variable dan environment saja terlihat

### Cek 2: Cek Vercel Function Logs
1. Buka: https://vercel.com/risyxiee/luxtrade/deployments
2. Klik deployment terbaru yang sedang running
3. Scroll ke bawah ke **Function Logs**
4. Cari log untuk `/api/admin/sync-auth-users`
5. Screenshot error message di log tersebut

---

## Summary Checklist

- [ ] Buka Vercel Environment Variables page
- [ ] Kirim screenshot environment variables
- [ ] Pastikan 4 variable ada:
  - [ ] DATABASE_URL
  - [ ] SUPABASE_SERVICE_ROLE_KEY (tanpa NEXT_PUBLIC_)
  - [ ] NEXT_PUBLIC_SUPABASE_URL
  - [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] Pastikan Environment dipilih: **All**
- [ ] Redeploy project
- [ ] Tunggu deployment selesai + 2-3 menit
- [ ] Test API lagi

---

## Quick Reference

### Link Vercel:
- Environment Variables: https://vercel.com/risyxiee/luxtrade/settings/environment-variables
- Deployments: https://vercel.com/risyxiee/luxtrade/deployments

### Link Supabase:
- Dashboard: https://supabase.com/dashboard/project/klxkdrfsfcoankbaoejn
- API Keys: https://supabase.com/dashboard/project/klxkdrfsfcoankbaoejn/settings/api
