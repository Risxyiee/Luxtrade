# Auto Fix Status Pending - Panduan Debugging

## Masalah
Tombol "Auto Fix Status Pending" menampilkan "Fixed 0 account(s)" ketika diklik.

## Root Cause
Endpoint auto-fix membutuhkan `supabaseAdmin` client, yang membutuhkan `SUPABASE_SERVICE_ROLE_KEY` environment variable. Variable ini sebelumnya tidak dikonfigurasi di Vercel, menyebabkan endpoint gagal bekerja.

## Perbaikan yang Sudah Dilakukan

### 1. Update `/api/trading-accounts/auto-fix-all/route.ts`
- Menambahkan fallback untuk menggunakan regular `supabase` client jika `supabaseAdmin` tidak tersedia
- Menambahkan comprehensive logging untuk membantu debugging
- Sekarang bekerja dengan baik baik admin maupun regular database clients

### 2. Update `/dashboard/connections/page.tsx`
- Menambahkan error handling yang lebih baik dan display untuk hasil auto-fix
- Menambahkan tombol "Debug Environment" untuk mengecek environment variables dan state database
- Menampilkan informasi detail tentang akun mana yang diperbaiki atau di-skip

### 3. Membuat `/api/debug/check-env/route.ts`
- Endpoint debug baru untuk mengecek:
  - Environment variables (Supabase URL, keys, MetaApi token)
  - Ketersediaan database client
  - Trading accounts user di database
  - Nilai status dan metaapi_account_id dari setiap account

## Cara Menggunakan

### Step 1: Cek Debug Info
1. Buka `/dashboard/connections`
2. Jika ada akun dengan status PENDING, kamu akan melihat dua tombol:
   - "Auto Fix Status Pending" (warna amber/kuning)
   - "Debug Environment" (warna biru) - BARU
3. Klik "Debug Environment" untuk melihat:
   - Environment variables mana yang sudah dikonfigurasi
   - Database clients mana yang tersedia
   - Trading accounts kamu dan status saat ini
   - Apakah `metaapi_account_id` sudah terisi

### Step 2: Coba Auto Fix
1. Klik "Auto Fix Status Pending"
2. Kamu akan melihat pesan toast yang detail:
   - Jika akun berhasil diperbaiki: Menampilkan akun mana dan apa yang berubah
   - Jika tidak ada akun yang perlu diperbaiki: Menampilkan "No accounts needed fixing"
   - Jika ada error: Menampilkan pesan error yang jelas

## Environment Variables Vercel (Diperlukan)

Untuk memastikan semua fitur bekerja dengan baik di Vercel, konfigurasikan environment variables berikut:

### 1. NEXT_PUBLIC_SUPABASE_URL
```
https://klxkdrfsfcoankbaoejn.supabase.co
```

### 2. NEXT_PUBLIC_SUPABASE_ANON_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtseGtkcmZzZmNvYW5rYmFvZWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzY0MTAsImV4cCI6MjA4NTk1MjQxMH0.C7mVBuCrXjDxW1eQLP0eCqeFjJgKJ8pNQyL0wRqJ3Xk
```

### 3. SUPABASE_SERVICE_ROLE_KEY (PENTING!)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtseGtkcmZzZmNvYW5rYmFvZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM3NjQxMCwiZXhwIjoyMDg1OTUyNDEwfQ.arZi5KXS5Zu6mQNfETbbdkrBDjLgiVqZRc-Qu4ktofI
```

### 4. METAAPI_TOKEN
```
eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiJmMDNhMTk2NDljN2IyZTJlMTQ2YjE4NDMyMGU5MzY1ZiIsImFjY2Vzc1J1bGVzIjpbeyJpZCI6InRyYWRpbmctYWNjb3VudC1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsidHJhZGluZy1hY2NvdW50LW1hbmFnZW1lbnQtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVzdC1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcnBjLWFwaSIsIm1ldGhvZHMiOlsibWV0YWFwaS1hcGk6d3M6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JVNFUl9JRCQ6KiJdfSx7ImlkIjoibWV0YWFwaS1yZWFsLXRpbWUtc3RyZWFtaW5nLWFwaSIsIm1ldGhvZHMiOlsibWV0YWFwaS1hcGk6d3M6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFzdGF0cy1hcGkiLCJtZXRob2RzIjpbIm1ldGFzdGF0cy1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoicmlzay1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsicmlzay1tYW5hZ2VtZW50LWFwaTpyZXN0OnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJjb3B5ZmFjdG9yeS1hcGkiLCJtZXRob2RzIjpbImNvcHlmYWN0b3J5LWFwaTpyZXN0OnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJtdC1tYW5hZ2VyLWFwaSIsIm1ldGhvZHMiOlsibXQtbWFuYWdlci1hcGk6cmVzdDpkZWFsaW5nOio6KiIsIm10LW1hbmFnZXItYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6ImJpbGxpbmctYXBpIiwibWV0aG9kcyI6WyJiaWxsaW5nLWFwaTpyZXN0OnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19XSwiaWdub3JlUmF0ZUxpbWl0cyI6ZmFsc2UsInRva2VuSWQiOiIyMDIxMDIxMyIsImltcGVyc29uYXRlZCI6ZmFsc2UsInJlYWxVc2VySWQiOiJmMDNhMTk2NDljN2IyZTJlMTQ2YjE4NDMyMGU5MzY1ZiIsImlhdCI6MTc3OTE2MjczMiwiZXhwIjoxNzg2OTM4NzMyfQ.UHMnOFZTcSmGKfFSLSBxCZtGrTUU4ezq1Fb3H_E34COCEnODw4N-oMNCU0o4MPVtY5qjF3hfqRabckta_k-QNOhUVxCOHmB_ZY_rGjC_uup97AY9Jr3sXCrd3-ipufBS5qCNCWYG4MR7J5HwoYLS68VokpVcLhYW7WXGKkQ4TZ9W9hzcNeFOMeuAyMPpybX8nk0S1Dg5IhIc29EXQOAv2Hh1yf1dGfMKMGfoknXJjhihhtVV3aUszi_-ZUb0Kcf86VS1j0qskcTwpBhyGOdoqfwegTS9YhiPOBvjuLTpIXJiCuh6RhBSTERsuKNOJZVjw5vnRIqHMjpCuxtrR2OLFYva1F9Sti5pl20eutLzKGdPwPKYxNzIQpLsw86fYRBY3lDPtaxsoED238WN37Xv8CuHWalxYs_DIwofSWYoX0OVCY6If8cBeMA1hfP2L-5mZkIE4ZPv1oQQdWw5PhkG1BUJgM8avH0I-CCy16xgJTpEQf1QYj5MICG3oIpPJyWvLeWa15zKlerPe_9YcYiwlXtUW3mvQyeMVb4oyPI6unznFN0IIA1QC_FJNf5-hJBi68iZxQpQhKoEbew748hp5iknLVaupSS2OCTTEoeBIIC9UeH-tpnJSwIunvrQG6DM_AG6lAkpGEwOPDOi61ZrRwX9EWXXhVrjFeIp34QSIUE
```

### Cara Menambahkan Environment Variables di Vercel:

1. Buka [Vercel Dashboard](https://vercel.com/dashboard)
2. Pilih project **Luxtrade**
3. Klik **Settings** → **Environment Variables**
4. Untuk setiap variable:
   - Klik **"Add New"**
   - Masukkan **Name** (contoh: `NEXT_PUBLIC_SUPABASE_URL`)
   - Masukkan **Value** (sesuai dengan nilai di atas)
   - Pilih **Environment**: **All** (untuk Production, Preview, dan Development)
   - Klik **Save**
5. Setelah semua variable ditambahkan, **Redeploy**:
   - Klik **Deployments** tab
   - Klik titik tiga (...) di deployment terbaru
   - Pilih **Redeploy**

**Lihat file `VERCEL_ENV_SETUP.md` untuk panduan lebih lengkap!**

## Apa yang Dilakukan Auto-Fix

Logic auto-fix mengecek setiap trading account dan memperbaiki issue berikut:

1. **Memiliki `metaapi_account_id` tapi status adalah PENDING**
   - Mengubah status menjadi `CONNECTED`
   - Alasan: Account sudah terhubung ke MetaApi tapi status salah

2. **Tidak memiliki `metaapi_account_id` tapi status adalah CONNECTED**
   - Mengubah status menjadi `PENDING`
   - Alasan: Account tampak terhubung tapi sebenarnya belum terhubung ke MetaApi

## Troubleshooting

### Masalah: Masih menampilkan "Fixed 0 account(s)"

**Kemungkinan penyebab:**
1. Semua account sudah memiliki status yang benar
2. Field `metaapi_account_id` kosong untuk account PENDING

**Solusi:**
1. Klik "Debug Environment" untuk melihat state sebenarnya
2. Cek apakah `metaapi_account_id` sudah terisi
3. Jika `metaapi_account_id` kosong, perlu reconnect account ke MetaApi

### Masalah: Environment variables menunjukkan "Missing" di debug

**Solusi:**
1. Cek file `.env.local` (untuk local development)
2. Cek Vercel environment variables (untuk production)
3. Pastikan variables sudah benar-benar di-setup dan di-redeploy

### Masalah: Auto-fix mengembalikan "Not authenticated"

**Solusi:**
1. Pastikan kamu sudah login
2. Cek bahwa session masih valid
3. Coba logout dan login kembali

### Masalah: Debug Environment tidak menampilkan akun apa pun

**Solusi:**
1. Pastikan sudah login dengan user yang benar
2. Cek di Supabase bahwa account trading memang ada
3. Cek bahwa `user_id` di trading_accounts table cocok dengan user yang sedang login

## Database Schema

Tabel `trading_accounts` memiliki struktur berikut:

```sql
CREATE TABLE trading_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  account_number TEXT NOT NULL,
  broker_server TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'MT4' atau 'MT5'
  status TEXT NOT NULL, -- 'CONNECTED', 'DISCONNECTED', 'PENDING', 'ERROR'
  metaapi_account_id TEXT, -- Optional, ID dari MetaApi service
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Langkah Selanjutnya

1. ✅ Environment variables sudah di-setup di `.env.local` untuk local development
2. ⏭️ Setup environment variables di Vercel (lihat `VERCEL_ENV_SETUP.md`)
3. ⏭️ Test tombol "Debug Environment" untuk melihat state saat ini
4. ⏭️ Test tombol "Auto Fix Status Pending" untuk memperbaiki akun yang stuck
5. ⏭️ Jika masih ada masalah, share debug info untuk bantuan lebih lanjut

## Catatan Penting

- `SUPABASE_SERVICE_ROLE_KEY` memberikan full access ke database. Jangan pernah share atau commit ke public repository!
- Fallback ke regular `supabase` client sudah diimplementasikan, jadi auto-fix seharusnya bekerja meskipun admin client tidak tersedia
- RLS (Row Level Security) harus dikonfigurasi dengan benar di Supabase untuk regular client bekerja
