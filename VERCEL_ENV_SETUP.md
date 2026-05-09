# Vercel Environment Variables Setup - Panduan LENGKAP

## Masalah

Error build:
```
Error: Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.
```

Ini terjadi karena environment variables tidak di-set dengan benar di Vercel.

---

## Solusi

### Step 1: Buka Supabase Dashboard untuk ambil credentials

1. Buka: https://supabase.com/dashboard/project/klxkdrfsfcoankbaoejn
2. Klik menu **Settings** (kiri) → **API**
3. Scroll ke section **Project API keys**

Anda akan melihat 2 key penting:

#### ✅ anon key
- Copy key di sebelah **anon**
- Format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Akan digunakan untuk: `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### ✅ service_role key
- Copy key di sebelah **service_role** (IMPORTANT: ini bukan anon key!)
- Format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Akan digunakan untuk: `SUPABASE_SERVICE_ROLE_KEY`

---

### Step 2: Buka Vercel Environment Variables

1. Buka: https://vercel.com/risyxiee/luxtrade/settings/environment-variables
2. Anda akan melihat halaman environment variables

---

### Step 3: Tambahkan Environment Variables ( satu per satu)

#### Variable 1: NEXT_PUBLIC_SUPABASE_URL

1. Klik tombol **"Add New"**
2. Isi form:
   - **Name**: `NEXT_PUBLIC_SUPABASE_URL` (CAPITAL, dengan NEXT_PUBLIC_ prefix!)
   - **Value**: `https://klxkdrfsfcoankbaoejn.supabase.co`
   - **Environment**: Pilih **All** (check semua: Production, Preview, Development)
3. Klik **Save**

**PENTING**: 
- Nama HARUS tepat: `NEXT_PUBLIC_SUPABASE_URL`
- Ada prefix `NEXT_PUBLIC_` (ini penting untuk ketersediaan di browser)
- Value harus valid URL: `https://klxkdrfsfcoankbaoejn.supabase.co`
- Environment: **All**

---

#### Variable 2: NEXT_PUBLIC_SUPABASE_ANON_KEY

1. Klik tombol **"Add New"**
2. Isi form:
   - **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (CAPITAL, dengan NEXT_PUBLIC_ prefix!)
   - **Value**: [Paste anon key dari Step 1]
   - **Environment**: Pilih **All**
3. Klik **Save**

**PENTING**: 
- Nama HARUS tepat: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Ada prefix `NEXT_PUBLIC_`
- Value adalah **anon key** dari Supabase (bukan service_role!)
- Environment: **All**

---

#### Variable 3: SUPABASE_SERVICE_ROLE_KEY

1. Klik tombol **"Add New"**
2. Isi form:
   - **Name**: `SUPABASE_SERVICE_ROLE_KEY` (CAPITAL, TANPA NEXT_PUBLIC_ prefix!)
   - **Value**: [Paste service_role key dari Step 1]
   - **Environment**: Pilih **All**
3. Klik **Save**

**PENTING**: 
- Nama HARUS tepat: `SUPABASE_SERVICE_ROLE_KEY`
- **TIDAK** ada prefix `NEXT_PUBLIC_` (ini rahasia, hanya untuk server-side!)
- Value adalah **service_role key** dari Supabase (bukan anon!)
- Environment: **All**

---

#### Variable 4: DATABASE_URL

Jika belum ada, tambahkan:

1. Klik tombol **"Add New"**
2. Isi form:
   - **Name**: `DATABASE_URL` (CAPITAL, tanpa prefix apapun!)
   - **Value**: `postgres://postgres.klxkdrfsfcoankbaoejn:oW0TKZUMb295pa4h@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x`
   - **Environment**: Pilih **All**
3. Klik **Save**

---

### Step 4: Verifikasi Semua Variable

Setelah menambahkan, pastikan di halaman Environment Variables terlihat:

| Variable Name | Environment | Status |
|--------------|-------------|--------|
| `DATABASE_URL` | All (Prod, Prev, Dev) | ✅ Ada |
| `SUPABASE_SERVICE_ROLE_KEY` | All (Prod, Prev, Dev) | ✅ Ada |
| `NEXT_PUBLIC_SUPABASE_URL` | All (Prod, Prev, Dev) | ✅ Ada |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All (Prod, Prev, Dev) | ✅ Ada |

**PENTING**: Semua harus punya Environment: **All**

---

### Step 5: Redeploy Project (WAJIB!)

Setelah environment variables di-set, WAJIB redeploy!

1. Buka: https://vercel.com/risyxiee/luxtrade/deployments
2. Cari deployment terbaru (paling atas)
3. Klik menu **"..."** (tiga titik) di sebelah deployment
4. Klik **Redeploy**
5. Confirm: klik **Redeploy**
6. Tunggu sampai status berubah ke **Ready**
   - Biasanya 2-5 menit

---

### Step 6: Tunggu Deployment Selesai + 2-3 Menit

Setelah deployment selesai:
- Tunggu tambahan 2-3 menit untuk server initialization
- Build akan berjalan dan environment variables akan terbaca

---

### Step 7: Test Build

Setelah deployment selesai + 3 menit, test:

#### Test 1: Health Check
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

#### Test 2: Admin Panel
```
https://luxtrade-2x18lq472-risyxiee.vercel.app/admin-subscriptions
```

Expected:
- Halaman terbuka tanpa error
- Stats dashboard muncul

---

## Troubleshooting

### Error 1: Build masih gagal dengan "Invalid supabaseUrl"

**Cause**: `NEXT_PUBLIC_SUPABASE_URL` tidak di-set dengan benar

**Solusi**:
1. Cek di Vercel: Settings → Environment Variables
2. Cari variable: `NEXT_PUBLIC_SUPABASE_URL`
3. Pastikan:
   - Nama tepat: `NEXT_PUBLIC_SUPABASE_URL` (all caps, dengan NEXT_PUBLIC_)
   - Value: `https://klxkdrfsfcoankbaoejn.supabase.co`
   - Environment: **All**
4. Redeploy lagi

---

### Error 2: "Failed to fetch users"

**Cause**: `SUPABASE_SERVICE_ROLE_KEY` tidak di-set atau salah

**Solusi**:
1. Cek di Vercel: Settings → Environment Variables
2. Cari variable: `SUPABASE_SERVICE_ROLE_KEY`
3. Pastikan:
   - Nama tepat: `SUPABASE_SERVICE_ROLE_KEY` (all caps, TANPA NEXT_PUBLIC_)
   - Value adalah **service_role key** dari Supabase (bukan anon key!)
   - Environment: **All**
4. Redeploy lagi

---

### Error 3: Variable tidak terbaca

**Cause**: Lupa redeploy setelah menambahkan environment variables

**Solusi**:
1. Buka: https://vercel.com/risyxiee/luxtrade/deployments
2. Redeploy
3. Tunggu deployment selesai

---

## Summary Checklist

Sebelum build berhasil:

- [ ] Buka Supabase Dashboard → Settings → API
- [ ] Copy **anon key**
- [ ] Copy **service_role key**
- [ ] Buka Vercel Environment Variables
- [ ] Tambah `NEXT_PUBLIC_SUPABASE_URL` dengan value: `https://klxkdrfsfcoankbaoejn.supabase.co` (Environment: All)
- [ ] Tambah `NEXT_PUBLIC_SUPABASE_ANON_KEY` dengan value: anon key (Environment: All)
- [ ] Tambah `SUPABASE_SERVICE_ROLE_KEY` dengan value: service_role key (Environment: All)
- [ ] Tambah `DATABASE_URL` dengan value: connection string (Environment: All)
- [ ] Redeploy project di Vercel
- [ ] Tunggu deployment selesai + 3 menit
- [ ] Test health check endpoint
- [ ] Test admin panel

---

## Quick Reference

### Supabase Dashboard:
- Dashboard: https://supabase.com/dashboard/project/klxkdrfsfcoankbaoejn
- API Keys: https://supabase.com/dashboard/project/klxkdrfsfcoankbaoejn/settings/api

### Vercel:
- Environment Variables: https://vercel.com/risyxiee/luxtrade/settings/environment-variables
- Deployments: https://vercel.com/risyxiee/luxtrade/deployments

### Application URLs:
- Health Check: https://luxtrade-2x18lq472-risyxiee.vercel.app/api/health
- Admin Panel: https://luxtrade-2x18lq472-risyxiee.vercel.app/admin-subscriptions
- Root: https://luxtrade-2x18lq472-risyxiee.vercel.app/

---

## Common Mistakes

### ❌ Mistake 1: Salah nama variable

**Salah**:
- `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` (ada NEXT_PUBLIC_ prefix)
- `supabaseUrl` (lowercase)
- `NEXT_PUBLIC_SUPABASE_URLS` (plural)

**Benar**:
- `NEXT_PUBLIC_SUPABASE_URL` (singular, dengan NEXT_PUBLIC_)
- `SUPABASE_SERVICE_ROLE_KEY` (TANPA NEXT_PUBLIC_ prefix!)

---

### ❌ Mistake 2: Salah key untuk variable

**Salah**:
- `SUPABASE_SERVICE_ROLE_KEY` menggunakan anon key
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` menggunakan service_role key

**Benar**:
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key
- `SUPABASE_SERVICE_ROLE_KEY` = service_role key

---

### ❌ Mistake 3: Environment tidak dipilih

**Salah**:
- Hanya Production
- Hanya Preview

**Benar**:
- **All** (Production, Preview, Development semua dicheck)

---

### ❌ Mistake 4: Lupa redeploy

**Salah**:
- Menambahkan environment variables tapi tidak redeploy

**Benar**:
- Setiap kali menambah/ubah environment variables → WAJIB redeploy!

---

## Debugging Jika Masih Error

Jika build masih gagal setelah semua langkah di atas:

1. Buka deployment terbaru di Vercel
2. Scroll ke **Build Logs**
3. Cari error message
4. Screenshot build logs
5. Share untuk further analysis

---

## Setelah Build Berhasil

Setelah build berhasil, lanjutkan ke:
1. Test sync API
2. Sync users dari Supabase Auth
3. Verifikasi admin panel
4. Test aktivasi Lifetime Ultra subscription

Lihat file `NEXT_STEPS.md` untuk panduan lengkapnya.
