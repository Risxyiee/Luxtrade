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
REDACTED-DEAD-KEY
```

### 3. SUPABASE_SERVICE_ROLE_KEY (PENTING!)
```
REDACTED-DEAD-KEY
```

### 4. METAAPI_TOKEN
```
REDACTED-DEAD-KEY
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
