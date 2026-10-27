# Panduan Sinkronisasi Database Prisma dan Supabase

## Ringkasan Masalah

**Error yang dialami:**
- `P2021`: Tabel tidak ditemukan di database
- `P2003`: Foreign key constraint gagal

**Akar masalah:**
- Skema Prisma TIDAK menggunakan `@@map` untuk mapping tabel
- Nama model di Prisma menggunakan PascalCase (Profile, User, Trade, dll)
- Tabel di PostgreSQL menggunakan lowercase (profiles, users, trades, dll)
- Terjadi mismatch antara Prisma dan PostgreSQL

---

## Langkah 1: ANALISIS SKEMA PRISMA ✅ (SELESAI)

Skema Prisma telah diperbarui dengan `@@map` untuk konsistensi:

| Model Prisma | Tabel PostgreSQL (@@map) |
|--------------|--------------------------|
| Profile | profiles |
| User | users |
| UserSubscription | user_subscriptions |
| Withdrawal | withdrawals |
| Trade | trades |
| JournalEntry | journal_entries |
| Tag | tags |
| WeeklyGoal | weekly_goals |
| TradingAccount | trading_accounts |
| UserSubmission | user_submissions |
| MissionProgress | mission_progress |
| SocialLink | social_links |

**Status:** ✅ File `prisma/schema.prisma` telah diperbarui dengan `@@map` untuk semua model.

---

## Langkah 2: SCRIPT SQL UNTUK SUPABASE SQL EDITOR

Jalankan script berikut di **Supabase SQL Editor**:

### 2.1. Jalankan SQL Script

1. Buka [Supabase Dashboard](https://supabase.com)
2. Pilih project Anda
3. Masuk ke menu **SQL Editor** (ikon SQL di sidebar kiri)
4. Buka file: `docs/SUPABASE_SQL_LOWERCASE.sql`
5. Copy seluruh isi script
6. Paste ke Supabase SQL Editor
7. Klik **Run** (atau tekan `Ctrl+Enter` / `Cmd+Enter`)

### 2.2. Verifikasi Tabel

Setelah script berhasil dijalankan:

1. Masuk ke menu **Table Editor** di Supabase Dashboard
2. Pastikan semua tabel berikut ada:
   - ✅ `profiles`
   - ✅ `users`
   - ✅ `user_subscriptions`
   - ✅ `withdrawals`
   - ✅ `trades`
   - ✅ `journal_entries`
   - ✅ `tags`
   - ✅ `weekly_goals`
   - ✅ `trading_accounts`
   - ✅ `user_submissions`
   - ✅ `mission_progress`
   - ✅ `social_links`

### 2.3. Cek Foreign Keys

Jalankan query ini untuk memverifikasi foreign keys:

```sql
SELECT
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
ORDER BY tc.table_name;
```

---

## Langkah 3: INSTRUKSI TERMINAL

### 3.1. Generate Prisma Client

Setelah database Supabase siap, generate Prisma Client:

```bash
npx prisma generate
```

**Penjelasan:**
- Perintah ini meng-generate Prisma Client berdasarkan skema di `prisma/schema.prisma`
- Prisma Client akan membaca `@@map` dan mengenali tabel dengan nama yang benar
- Output akan berada di `node_modules/@prisma/client`

### 3.2. Reset Migrasi Lokal (Jika ada)

Jika ada folder `prisma/migrations` lokal yang bermasalah:

```bash
# Backup migrasi yang ada (opsional)
mv prisma/migrations prisma/migrations.backup

# Buat folder baru untuk migrasi
mkdir -p prisma/migrations
```

### 3.3. Sinkronisasi Skema ke Database (Opsional)

**PERHATIAN:** Ini hanya untuk development, jangan jalankan di production!

```bash
# Hanya untuk development - sinkronisasi skema ke database lokal
npx prisma db push

# Atau buat migrasi baru (jika perlu)
npx prisma migrate dev --name add_lowercase_table_mapping
```

**Catatan Penting:**
- Jangan gunakan `prisma migrate deploy` di postinstall script untuk saat ini
- Kita sudah membuat tabel secara manual di Supabase SQL Editor
- `prisma generate` sudah cukup untuk production

### 3.4. Verifikasi Koneksi Database

Cek apakah Prisma bisa terhubung ke database:

```bash
npx prisma db execute --stdin <<< "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
```

Atau jalankan script test:

```bash
npx prisma studio
```

Prisma Studio akan membuka di browser. Cek apakah semua tabel terlihat dengan nama lowercase.

---

## Langkah 4: BEST PRACTICES VERCEL

### 4.1. Cek Environment Variables di Vercel

1. Buka [Vercel Dashboard](https://vercel.com)
2. Pilih project LuxTrade
3. Masuk ke **Settings** → **Environment Variables**
4. Pastikan variabel berikut ada:

| Variable | Environment | Value |
|----------|-------------|-------|
| `DATABASE_URL` | Production | `postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:6543/postgres` |
| `DB_DATABASE_URL` | Production | Dikelola otomatis oleh integrasi Supabase (tidak perlu diubah) |

**Format DATABASE_URL yang benar:**
```
postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:6543/postgres
```

**Catatan:**
- Gunakan port `6543` (bukan 5432)
- `[PASSWORD]` adalah password dari Supabase Dashboard → Settings → Database
- `[PROJECT_ID]` adalah ID project Anda di Supabase

### 4.2. Update postinstall Script

File `package.json` sudah diperbarui:

```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

**Penjelasan:**
- `prisma generate` akan dijalankan otomatis setiap kali `npm install` di Vercel
- `prisma migrate deploy` dihapus untuk menghindari error P3019
- Tabel sudah dibuat secara manual di Supabase SQL Editor

### 4.3. Pembersihan Cache di Vercel

Sebelum redeploy, bersihkan cache:

#### 4.3.1. Lewat Vercel Dashboard

1. Buka [Vercel Dashboard](https://vercel.com)
2. Pilih project LuxTrade
3. Masuk ke **Settings** → **Git**
4. Scroll ke bagian **Ignored Build Step**
5. Tambahkan ini (jika belum ada):
   ```
   prisma
   node_modules/.prisma
   ```

#### 4.3.2. Lewat Terminal (Opsional)

Jika Anda menggunakan Vercel CLI:

```bash
# Hapus cache build lokal
rm -rf .next
rm -rf node_modules/.prisma

# Reinstall dependencies
npm install
```

### 4.4. Redeploy ke Vercel

#### 4.4.1. Redeploy Otomatis via GitHub Push

```bash
# Commit perubahan
git add prisma/schema.prisma
git add docs/SUPABASE_SQL_LOWERCASE.sql
git add package.json
git commit -m "fix: add @@map for lowercase table names in Prisma schema"

# Push ke GitHub
git push origin main
```

Vercel akan otomatis mendeteksi perubahan dan melakukan redeploy.

#### 4.4.2. Redeploy Manual via Vercel Dashboard

1. Buka [Vercel Dashboard](https://vercel.com)
2. Pilih project LuxTrade
3. Masuk ke **Deployments**
4. Klik tiga titik (...) di deployment terbaru
5. Pilih **Redeploy**
6. Pastikan **Build Cache** diaktifkan
7. Klik **Redeploy**

#### 4.4.3. Redeploy via Vercel CLI

```bash
# Install Vercel CLI (jika belum)
npm i -g vercel

# Login ke Vercel
vercel login

# Redeploy
vercel --prod
```

### 4.5. Verifikasi Deployment

Setelah redeploy berhasil:

1. Buka website aplikasi Anda
2. Cek Vercel Dashboard → **Logs**
3. Pastikan TIDAK ada error berikut:
   - ❌ `P2021: The table ... does not exist`
   - ❌ `P2003: Foreign key constraint failed`
   - ❌ `P3019: migrate failed`
4. Jika ada error, cek logs untuk detail dan sesuaikan solusinya

---

## Langkah 5: TROUBLESHOOTING

### 5.1. Error: Table does not exist (P2021)

**Masalah:** Prisma tidak bisa menemukan tabel di database.

**Solusi:**
1. Pastikan script SQL sudah dijalankan di Supabase SQL Editor
2. Cek apakah tabel ada dengan query:
   ```sql
   SELECT tablename FROM pg_tables WHERE schemaname = 'public';
   ```
3. Pastikan nama tabel menggunakan lowercase (misal: `profiles`, bukan `Profile`)
4. Run `npx prisma generate` untuk regenerate Prisma Client

### 5.2. Error: Foreign key constraint failed (P2003)

**Masalah:** Foreign key tidak terhubung dengan benar.

**Solusi:**
1. Cek foreign keys dengan query:
   ```sql
   SELECT * FROM information_schema.table_constraints
   WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';
   ```
2. Pastikan parent table sudah ada sebelum child table
3. Run script SQL lagi untuk memastikan semua foreign keys terbuat

### 5.3. Error: migrate failed (P3019)

**Masalah:** Migrasi Prisma tidak sinkron dengan database production.

**Solusi:**
1. Jangan gunakan `prisma migrate deploy` di postinstall script
2. Gunakan `prisma generate` saja
3. Buat tabel secara manual di Supabase SQL Editor (seperti panduan ini)
4. Hapus folder `prisma/migrations` lokal jika bermasalah

### 5.4. Error: Database connection failed

**Masalah:** Koneksi ke database gagal.

**Solusi:**
1. Cek `DATABASE_URL` di Vercel environment variables
2. Pastikan port menggunakan `6543` (bukan 5432)
3. Pastikan password database benar
4. Test koneksi lokal dengan:
   ```bash
   npx prisma db execute --stdin <<< "SELECT NOW();"
   ```

---

## Langkah 6: SUMMARY CHECKLIST

Sebelum production, pastikan:

- [x] File `prisma/schema.prisma` sudah ada `@@map` untuk semua model
- [x] Script SQL sudah dijalankan di Supabase SQL Editor
- [x] Semua tabel ada di Supabase dengan nama lowercase
- [x] Semua foreign keys sudah terbuat
- [x] `npx prisma generate` berhasil dijalankan
- [x] `DATABASE_URL` di Vercel sudah benar (port 6543)
- [x] `package.json` postinstall script hanya menjalankan `prisma generate`
- [x] Code sudah di-commit dan push ke GitHub
- [x] Redeploy sudah dilakukan di Vercel
- [x] Tidak ada error P2021 atau P2003 di logs

---

## Referensi

- [Prisma Schema Reference - @@map](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#map)
- [Supabase SQL Editor](https://supabase.com/docs/guides/database/sql-editor)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)

---

## Dukungan

Jika masih mengalami masalah:

1. Cek Vercel logs untuk error detail
2. Cek Supabase logs di dashboard
3. Jalankan `npx prisma studio` untuk memverifikasi skema
4. Kontak dukungan Prisma atau Supabase jika perlu