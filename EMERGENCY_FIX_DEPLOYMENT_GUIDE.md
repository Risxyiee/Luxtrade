# EMERGENCY FIX - Deployment Guide untuk Vercel

## 1. DATABASE CONNECTION FIX - SELESAI ✅

### File yang diubah: `src/lib/db.ts`
- Auto-detect production environment
- Auto-switch port 5432 → 6543
- Auto-add `?pgbouncer=true` parameter
- Logging koneksi database

---

## 2. AUTHENTICATION/MIDDLEWARE FIX - SELESAI ✅

### File yang diubah: `middleware.ts`
- Menggunakan `createMiddlewareClient` dari `@supabase/auth-helpers-nextjs`
- Cek session dengan `getSession()`
- Redirect loop prevention:
  - Jika login & akses `/login` atau `/signup` → redirect ke `/dashboard`
  - Jika tidak login & akses protected routes → redirect ke `/login`
- Tidak mengganggu `/auth/callback`

---

## 3. CSS FIX - SELESAI ✅

### File yang diubah:

#### A. `src/app/dashboard/components/Sidebar.tsx`
- Added `shrink-0` to logo section (line 113)
- Added `min-h-0` to nav element (line 146)
- Added `shrink-0` to bottom section (line 289)
- Hasil: Sidebar bisa di-scroll di mobile

#### B. `src/app/dashboard/components/Header.tsx`
- Removed `mr-0 lg:mr-2` class (line 126)
- Removed `<span className="hidden lg:inline">New Trade</span>` (line 127)
- Hasil: Tombol Add Trade muncul di semua screen size (mobile & desktop)

---

## 4. PRISMA SCHEMA CHECK - SELESAI ✅

### `prisma/schema.prisma` sudah KONFIGURASI BENAR:
- `id String @id @default(uuid())` di SEMUA model
- `account_id String?` di model Trade (line 119)
- Foreign key ke TradingAccount menggunakan String/UUID (line 143)
- TIDAK ada konflik tipe data

### Database Supabase sudah di-setup dengan:
- Semua ID bertipe UUID
- gen_random_uuid() sebagai default
- Foreign key constraints sudah benar

---

## 5. DEPLOYMENT CHECKLIST - Wajib untuk Vercel

### A. Environment Variables yang harus di-set di Vercel:

**Copy-paste ini ke Vercel Dashboard → Settings → Environment Variables:**

```
DATABASE_URL=postgresql://postgres:Riskiakbarp123@db.klxkdrfsfcoankbaoejn.supabase.co:6543/postgres?pgbouncer=true

NEXT_PUBLIC_SUPABASE_URL=https://klxkdrfsfcoankbaoejn.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY=<isi dengan ANON KEY dari Supabase>

SUPABASE_SERVICE_ROLE_KEY=<isi dengan SERVICE ROLE KEY dari Supabase>

NODE_ENV=production
```

**PENTING:**
- DATABASE_URL menggunakan port **6543** (connection pooling)
- DATABASE_URL menggunakan parameter **?pgbouncer=true**
- API Keys dapatkan dari: Supabase Dashboard → Project Settings → API

### B. Cara Setup di Vercel:

1. Login ke Vercel Dashboard
2. Pilih project: `luxtrade` atau `Luxtrade`
3. Pergi ke **Settings** → **Environment Variables**
4. Tambahkan variable-variable di atas:
   - Klik **"Add New"**
   - Paste key dan value
   - Klik **"Save"**
   - Ulangi untuk semua variable
5. Pergi ke **Deployments**
6. Klik deployment terbaru
7. Klik **"Redeploy"**

### C. Peringatan Khusus untuk Connection Pooling:

Jika setelah redeploy masih error koneksi database, periksa:

1. **Enable Connection Pooling di Supabase:**
   - Login ke Supabase Dashboard
   - Pergi ke **Database** → **Connection Pooling**
   - Pastikan status: **"Active"** atau **"Enabled"**
   - Jika belum aktif, klik **"Enable"**

2. **Jika connection pooling tidak bisa di-enable:**
   - Ubah DATABASE_URL di Vercel ke:
   ```
   DATABASE_URL=postgresql://postgres:Riskiakbarp123@db.klxkdrfsfcoankbaoejn.supabase.co:5432/postgres
   ```
   - Port 5432 adalah port direct connection (tanpa pooling)

---

## 6. VERIFICATION CHECKLIST - Setelah Deploy

Sebelum declare "SUKSES", cek item-item ini:

- [ ] Tidak ada error di Vercel logs
- [ ] Database connection berhasil (cek logs untuk "🗄️ Connection Pooling: ✅ Enabled (pgbouncer)")
- [ ] User bisa login di www.luxtradee.web.id
- [ ] Tidak ada infinite redirect loop
- [ ] Dashboard bisa diakses setelah login
- [ ] Tombol "Add Trade" muncul di mobile dan desktop
- [ ] Sidebar bisa di-scroll di mobile
- [ ] User bisa tambah trading account
- [ ] User bisa tambah trade
- [ ] Tidak ada error "PrismaClientInitializationError"
- [ ] Tidak ada error "Foreign key constraint violated"

---

## 7. JIKA MASIH ADA ERROR

### A. Masalah Database Connection:
Error: `Can't reach database server at db.xxx.supabase.co:6543`

**Solusi 1:** Cek connection pooling di Supabase (lihat section 5C)
**Solusi 2:** Ubah port 6543 → 5432 (tanpa pgbouncer=true)

### B. Masalah Authentication Loop:
Error: Infinite redirect ke `/login`

**Solusi:**
1. Buka browser Developer Tools
2. Cek **Application** → **Cookies**
3. Hapus semua cookies untuk domain `luxtradee.web.id`
4. Clear cache browser
5. Coba login ulang

### C. Masalah Sidebar tidak bisa scroll di mobile:
Error: Menu terpotong, tidak bisa scroll

**Solusi:**
1. Pastikan `src/app/dashboard/components/Sidebar.tsx` sudah di-update
2. Refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
3. Coba buka di mobile view (F12 → Mobile device toolbar)

### D. Masalah Tombol Add Trade tidak muncul:
Error: Tombol tidak terlihat di mobile

**Solusi:**
1. Pastikan `src/app/dashboard/components/Header.tsx` sudah di-update
2. Refresh browser
3. Coba resize window dari desktop ke mobile untuk melihat responsivitas

---

## 8. SUMMARY

### Files yang diubah:
1. `src/lib/db.ts` - Auto-port switching untuk connection pooling
2. `middleware.ts` - Stable auth check dengan Supabase
3. `src/app/dashboard/components/Sidebar.tsx` - Scroll fix untuk mobile
4. `src/app/dashboard/components/Header.tsx` - Tombol Add Trade untuk semua screen size

### Files yang TIDAK perlu diubah:
- `prisma/schema.prisma` - Sudah benar dengan UUID

### Environment Variables yang wajib di-set di Vercel:
- DATABASE_URL (port 6543 dengan pgbouncer=true)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NODE_ENV=production

---

## 9. NEXT STEPS

1. Copy-paste semua environment variables ke Vercel
2. Redeploy di Vercel
3. Cek verification checklist (section 6)
4. Jika ada error, refer ke section 7

---

## 10. CONTACT

Jika masih ada error setelah mengikuti semua langkah di atas:
1. Cek Vercel logs untuk error spesifik
2. Cek browser console untuk client-side errors
3. Screenshot error dan kirim untuk further investigation

---

**Status:** ✅ Emergency Fix SELESAI, siap untuk deploy ke Vercel
