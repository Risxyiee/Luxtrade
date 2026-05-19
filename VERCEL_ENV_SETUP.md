# Vercel Environment Variables Setup

## Required Environment Variables

Berikut adalah environment variables yang perlu di-setup di Vercel untuk aplikasi Luxtrade:

### 1. NEXT_PUBLIC_SUPABASE_URL
```
https://klxkdrfsfcoankbaoejn.supabase.co
```

### 2. NEXT_PUBLIC_SUPABASE_ANON_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtseGtkcmZzZmNvYW5rYmFvZWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzY0MTAsImV4cCI6MjA4NTk1MjQxMH0.4Yv9JesMXWEy4phu2D-Yw9rkbq0l8z9kz-sRwFZerQ0
```

### 3. SUPABASE_SERVICE_ROLE_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtseGtkcmZzZmNvYW5rYmFvZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM3NjQxMCwiZXhwIjoyMDg1OTUyNDEwfQ.arZi5KXS5Zu6mQNfETbbdkrBDjLgiVqZRc-Qu4ktofI
```

### 4. METAAPI_TOKEN
```
eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiJmMDNhMTk2NDljN2IyZTJlMTQ2YjE4NDMyMGU5MzY1ZiIsImFjY2Vzc1J1bGVzIjpbeyJpZCI6InRyYWRpbmctYWNjb3VudC1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsidHJhZGluZy1hY2NvdW50LW1hbmFnZW1lbnQtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVzdC1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcnBjLWFwaSIsIm1ldGhvZHMiOlsibWV0YWFwaS1hcGk6d3M6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JVNFUl9JRCQ6KiJdfSx7ImlkIjoibWV0YWFwaS1yZWFsLXRpbWUtc3RyZWFtaW5nLWFwaSIsIm1ldGhvZHMiOlsibWV0YWFwaS1hcGk6d3M6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFzdGF0cy1hcGkiLCJtZXRob2RzIjpbIm1ldGFzdGF0cy1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoicmlzay1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsicmlzay1tYW5hZ2VtZW50LWFwaTpyZXN0OnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJjb3B5ZmFjdG9yeS1hcGkiLCJtZXRob2RzIjpbImNvcHlmYWN0b3J5LWFwaTpyZXN0OnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJtdC1tYW5hZ2VyLWFwaSIsIm1ldGhvZHMiOlsibXQtbWFuYWdlci1hcGk6cmVzdDpkZWFsaW5nOio6KiIsIm10LW1hbmFnZXItYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6ImJpbGxpbmctYXBpIiwibWV0aG9kcyI6WyJiaWxsaW5nLWFwaTpyZXN0OnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19XSwiaWdub3JlUmF0ZUxpbWl0cyI6ZmFsc2UsInRva2VuSWQiOiIyMDIxMDIxMyIsImltcGVyc29uYXRlZCI6ZmFsc2UsInJlYWxVc2VySWQiOiJmMDNhMTk2NDljN2IyZTJlMTQ2YjE4NDMyMGU5MzY1ZiIsImlhdCI6MTc3OTE2MjczMiwiZXhwIjoxNzg2OTM4NzMyfQ.UHMnOFZTcSmGKfFSLSBxCZtGrTUU4ezq1Fb3H_E34COCEnODw4N-oMNCU0o4MPVtY5qjF3hfqRabckta_k-QNOhUVxCOHmB_ZY_rGjC_uup97AY9Jr3sXCrd3-ipufBS5qCNCWYG4MR7J5HwoYLS68VokpVcLhYW7WXGKkQ4TZ9W9hzcNeFOMeuAyMPpybX8nk0S1Dg5IhIc29EXQOAv2Hh1yf1dGfMKMGfoknXJjhihhtVV3aUszi_-ZUb0Kcf86VS1j0qskcTwpBhyGOdoqfwegTS9YhiPOBvjuLTpIXJiCuh6RhBSTERsuKNOJZVjw5vnRIqHMjpCuxtrR2OLFYva1F9Sti5pl20eutLzKGdPwPKYxNzIQpLsw86fYRBY3lDPtaxsoED238WN37Xv8CuHWalxYs_DIwofSWYoX0OVCY6If8cBeMA1hfP2L-5mZkIE4ZPv1oQQdWw5PhkG1BUJgM8avH0I-CCy16xgJTpEQf1QYj5MICG3oIpPJyWvLeWa15zKlerPe_9YcYiwlXtUW3mvQyeMVb4oyPI6unznFN0IIA1QC_FJNf5-hJBi68iZxQpQhKoEbew748hp5iknLVaupSS2OCTTEoeBIIC9UeH-tpnJSwIunvrQG6DM_AG6lAkpGEwOPDOi61ZrRwX9EWXXhVrjFeIp34QSIUE
```

## Cara Menambahkan di Vercel

### Opsi 1: Melalui Vercel Dashboard (Web)

1. Buka [Vercel Dashboard](https://vercel.com/dashboard)
2. Pilih project **Luxtrade**
3. Klik **Settings** tab
4. Pilih **Environment Variables** di menu sebelah kiri
5. Untuk setiap variable:
   - Klik **"Add New"**
   - Masukkan **Name** (contoh: `NEXT_PUBLIC_SUPABASE_URL`)
   - Masukkan **Value** (contoh: `https://klxkdrfsfcoankbaoejn.supabase.co`)
   - Pilih **Environment**:
     - Pilih **All** untuk apply ke semua environment (Production, Preview, Development)
     - Atau pilih environment spesifik jika perlu
   - Klik **Save**
6. Setelah semua variable ditambahkan, **Redeploy** aplikasi:
   - Klik **Deployments** tab
   - Klik titik tiga (...) di deployment terbaru
   - Pilih **Redeploy**

### Opsi 2: Menggunakan Vercel CLI

Jika kamu sudah install Vercel CLI:

```bash
# Login ke Vercel
vercel login

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
# Pilih "All" lalu paste: https://klxkdrfsfcoankbaoejn.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# Pilih "All" lalu paste: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtseGtkcmZzZmNvYW5rYmFvZWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzY0MTAsImV4cCI6MjA4NTk1MjQxMH0.4Yv9JesMXWEy4phu2D-Yw9rkbq0l8z9kz-sRwFZerQ0

vercel env add SUPABASE_SERVICE_ROLE_KEY
# Pilih "All" lalu paste the SERVICE_ROLE_KEY

vercel env add METAAPI_TOKEN
# Pilih "All" lalu paste the METAAPI_TOKEN

# Redeploy untuk apply changes
vercel --prod
```

## Verifikasi Setup

Setelah environment variables di-setup dan redeploy:

1. Buka aplikasi di Production
2. Login dengan email dan password
3. Pastikan tidak ada error "Invalid API key"
4. Pergi ke **Dashboard → Connections**
5. Jika ada akun dengan status PENDING, klik tombol **"Debug Environment"**
6. Pastikan semua environment variables menunjukkan status:
   - ✅ Configured (bukan ❌ Missing)
7. Coba tombol **"Auto Fix Status Pending"** - seharusnya bekerja dengan baik

## Penting: Service Role Key

**SUPABASE_SERVICE_ROLE_KEY** sangat penting untuk:
- Auto-fix akun yang stuck di PENDING status
- Admin operations yang bypass RLS (Row Level Security)
- Operasi database yang membutuhkan full access

**PERINGATAN**: Service role key memberikan full access ke database Supabase. Jangan pernah share atau commit ke public repository!

## Local Development

Untuk local development, environment variables sudah di-setup di `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://klxkdrfsfcoankbaoejn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtseGtkcmZzZmNvYW5rYmFvZWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzY0MTAsImV4cCI6MjA4NTk1MjQxMH0.4Yv9JesMXWEy4phu2D-Yw9rkbq0l8z9kz-sRwFZerQ0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtseGtkcmZzZmNvYW5rYmFvZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM3NjQxMCwiZXhwIjoyMDg1OTUyNDEwfQ.arZi5KXS5Zu6mQNfETbbdkrBDjLgiVqZRc-Qu4ktofI
```

File ini TIDAK di-track oleh git (ada di `.gitignore`), jadi aman untuk development.

## Troubleshooting

### Masalah: Environment variables masih terdeteksi "Missing" di Debug Environment

**Solusi:**
1. Pastikan nama variable persis sama (case-sensitive)
2. Pastikan sudah redeploy setelah menambahkan variable
3. Cek di Vercel Dashboard bahwa variable benar-benar tersimpan

### Masalah: Masih ada error "Invalid API key" saat login

**Solusi:**
1. Pastikan ANON_KEY yang digunakan benar (dimulai dengan eyJhbGciOiJIUzI1NiIs...)
2. Pastikan tidak ada spasi atau newline di environment variable value
3. Redeploy aplikasi setelah update
4. Clear browser cache dan cookies, lalu coba login lagi

### Masalah: Auto Fix masih tidak bekerja

**Solusi:**
1. Cek Debug Environment untuk memastikan semua variable ✅ Configured
2. Cek apakah account memiliki `metaapi_account_id` yang terisi
3. Jika `metaapi_account_id` kosong, perlu reconnect account ke MetaApi

### Masalah: Error "Admin client not configured"

**Solusi:**
1. Pastikan `SUPABASE_SERVICE_ROLE_KEY` sudah di-setup di Vercel
2. Restart/Redeploy aplikasi
3. Cek Debug Environment untuk verifikasi

## Ringkasan Environment Variables

| Variable | Purpose | Required | Scope |
|----------|---------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ Yes | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | ✅ Yes | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key | ✅ Yes | Private |
| `METAAPI_TOKEN` | MetaApi JWT token | ✅ Yes | Private |
| `NEXT_PUBLIC_APP_URL` | App base URL | ⚪ Optional | Public |

**Catatan:** Variable dengan prefix `NEXT_PUBLIC_` akan tersedia di client-side (browser), sedangkan variable tanpa prefix hanya tersedia di server-side.
