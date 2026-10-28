# Admin Panel Setup Guide

## Masalah: "Failed activate PRO" di Admin Panel

Jika Anda mengalami error "Failed activate PRO" saat mencoba mengaktifkan fitur PRO untuk user di Admin Panel, kemungkinan besar **`SUPABASE_SERVICE_ROLE_KEY` belum diset di environment variables**.

## Apa itu SUPABASE_SERVICE_ROLE_KEY?

`SUPABASE_SERVICE_ROLE_KEY` adalah kunci khusus dari Supabase yang memberikan akses penuh (admin privileges) untuk operasi backend seperti:
- List semua user di Supabase Auth
- Update user metadata
- Activate/deactivate PRO subscription
- Admin operations lainnya

## Cara Mendapatkan SUPABASE_SERVICE_ROLE_KEY

1. Login ke dashboard Supabase: https://supabase.com/dashboard
2. Pilih project Anda (klxkdrfsfcoankbaoejn)
3. Masuk ke **Settings** > **API**
4. Scroll ke bagian **Project API keys**
5. Copy **service_role** key (BUKAN anon key!)
6. ⚠️ **PENTING**: JANGAN bagikan key ini ke siapapun karena ini adalah key dengan akses penuh!

## Cara Menambahkan ke Vercel

### Method 1: Melalui Vercel Dashboard (Recommended)

1. Login ke Vercel: https://vercel.com/dashboard
2. Buka project Anda: `luxtrade-jade`
3. Masuk ke **Settings** > **Environment Variables**
4. Klik **"Add New"**
5. Isi:
   - **Key**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: Paste service_role key dari Supabase
   - **Environment**: Pilih **Production** (dan Development jika perlu)
6. Klik **"Save"**
7. **Redeploy** project Anda

### Method 2: Melalui Vercel CLI

```bash
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Paste the service_role key when prompted
vercel env pull .env.local
```

### Method 3: Melalui Project Settings (Git Integration)

Jika project Anda terhubung ke Git, Anda bisa juga menambahkannya di:
1. Vercel Dashboard > Project > Settings > Environment Variables
2. Tambahkan variable seperti di Method 1
3. Vercel akan otomatis menggunakan variable ini saat deploy dari Git

## Cara Cek Apakah Sudah Berhasil

Setelah setup, Anda bisa cek dengan cara:

### 1. Di Vercel Dashboard
- Masuk ke **Settings** > **Environment Variables**
- Pastikan `SUPABASE_SERVICE_ROLE_KEY` terdaftar di Production

### 2. Di Admin Panel
- Buka Admin Panel: `/dashboard/admin`
- Coba activate PRO untuk user
- Jika berhasil, akan muncul toast "PRO activated for 30 days!"
- Jika masih gagal, toast akan menampilkan error dengan detail solusi

### 3. Check Vercel Logs
1. Buka Vercel Dashboard
2. Buka project `luxtrade-jade`
3. Masuk ke **Deployments**
4. Klik deployment terbaru
5. Klik **"View Function Logs"**
6. Cari log dengan prefix `🔧 [ADMIN API]`
7. Jika melihat `❌ [ADMIN API] supabaseAdmin is not configured`, berarti belum setup

## Environment Variables yang Dibutuhkan

Berikut daftar environment variables yang dibutuhkan untuk project ini:

| Variable | Required | Description | Source |
|----------|----------|-------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | Supabase project URL | Supabase Dashboard > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes | Supabase anon public key | Supabase Dashboard > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | Supabase service role key (admin) | Supabase Dashboard > Settings > API |
| `DATABASE_URL` | ✅ Yes | Database connection URL | Prisma / SQLite file path |

## Troubleshooting

### Error: "Admin configuration error. SUPABASE_SERVICE_ROLE_KEY is missing."

**Solusi**: Tambahkan `SUPABASE_SERVICE_ROLE_KEY` ke Vercel environment variables seperti di atas.

### Error: "Failed to fetch users from Supabase"

**Solusi**: Pastikan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` sudah benar.

### Error: "User not found"

**Solusi**: User ID yang dikirim ke API mungkin salah. Coba refresh Admin Panel untuk mendapatkan data user terbaru.

### Error: "supabaseAdmin is not configured" di local development

**Solusi**: Jika Anda ingin test di local, tambahkan ini ke file `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://klxkdrfsfcoankbaoejn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
DATABASE_URL=file:/home/z/my-project/db/custom.db
```

**CATATAN**: JANGAN commit `.env.local` ke Git! File ini sudah ada di `.gitignore`.

## Security Best Practices

1. ⚠️ **JANGAN** commit `SUPABASE_SERVICE_ROLE_KEY` ke repository Git
2. ⚠️ **JANGAN** share `SUPABASE_SERVICE_ROLE_KEY` ke public forum/chat
3. ✅ **SELALU** gunakan environment variables untuk sensitive data
4. ✅ **ROTATE** service role key jika terkena leak/ter-expose
5. ✅ **LIMIT** akses ke environment variables hanya untuk team yang terpercaya

## Roll service role key jika terkena leak

Jika `SUPABASE_SERVICE_ROLE_KEY` terkena leak:

1. Login ke Supabase Dashboard
2. Masuk ke **Settings** > **API**
3. Scroll ke **Project API keys**
4. Klik **"Rotate service_role key"**
5. Copy key baru
6. Update di Vercel Environment Variables
7. Redeploy project

## Kontak

Jika Anda masih mengalami masalah setelah mengikuti panduan ini, silakan:
1. Check Vercel Function Logs untuk error detail
2. Check Supabase Dashboard untuk memastikan user ada
3. Contact developer support
