# 📋 Catatan Fix Verifikasi Email & Signup - LUXTRADE
# Tanggal: 21 Juni 2025
# Status: ✅ SUDAH DIVERIFIKASI BERHASIL DI PRODUCTION

---

## ❌ MASALAH YANG PERNAH TERJADI

### 1. `$executeRawUnsafe` untuk SELECT mengembalikan Result object, bukan rows[]
- **Gejala:** Token verifikasi selalu "tidak ditemukan", padahal ada di DB
- **Penyebab:** `db.$executeRawUnsafe()` untuk query SELECT di PostgreSQL mengembalikan `{ rowCount, rows }`, bukan `rows[]`. Jadi `rows?.[0]` selalu `undefined`.
- **Fix:** Gunakan `db.$queryRawUnsafe()` untuk semua query SELECT.
- **File:** `src/app/api/auth/verify-email/route.ts`, `src/app/api/auth/signup/route.ts`

### 2. Duplicate kolom camelCase dari Prisma migrasi lama
- **Gejala:** Error `23502 NOT NULL violation`, `column "streakCount" does not exist`
- **Penyebab:** Migrasi Prisma lama bikin kolom camelCase (`streakCount`, `createdAt`, dll) BARENG dengan snake_case (`streak_count`, `created_at`). Kolom camelCase punya NOT NULL tanpa default.
- **Fix:** Auto-migrate di setiap request: `DROP COLUMN IF EXISTS "streakCount"` dll.

### 3. Tipe `achievements` = jsonb di Supabase, bukan text
- **Gejala:** Error `42804: column achievements is jsonb but expression is of type text`
- **Fix:** Raw SQL INSERT pakai cast `$16::jsonb`, Prisma schema pakai `Json` bukan `String`.

### 4. Profil tersisa di DB setelah user dihapus dari Supabase Auth
- **Gejala:** Email ditolak "sudah terdaftar" padahal user sudah dihapus di Supabase dashboard
- **Penyebab:** Hapus user di Supabase cuma hapus dari `auth.users`, TIDAK dari tabel `profiles`
- **Fix:** Signup sekarang cek: profil ada di DB + user tidak ada di Auth → hapus profil lama, lanjut signup.

### 5. Prerender error `/auth/reset-password` karena `useSearchParams()`
- **Fix:** Wrap komponen yang pakai `useSearchParams()` dengan `<Suspense>`.

### 6. "Auth session missing" di forgot password
- **Fix:** Multi-strategy session detection + admin API fallback (`/api/auth/reset-password-admin`).

---

## ✅ ATURAN PENTING BIAR NGGAK ERROR LAGI

### Aturan #1: JANGAN pernah pakai `$executeRawUnsafe` untuk SELECT
```ts
// ❌ SALAH - mengembalikan Result object
const rows = await db.$executeRawUnsafe(`SELECT * FROM profiles WHERE email = $1`, email)

// ✅ BENAR - mengembalikan rows[]
const rows = await db.$queryRawUnsafe(`SELECT * FROM profiles WHERE email = $1`, email)
```

### Aturan #2: Gunakan `$executeRawUnsafe` hanya untuk INSERT/UPDATE/DELETE/ALTER/DROP
```ts
// ✅ Ini benar
await db.$executeRawUnsafe(`DELETE FROM profiles WHERE id = $1`, id)
await db.$executeRawUnsafe(`UPDATE profiles SET email_verified = true WHERE id = $1`, id)
```

### Aturan #3: Kolom achievements pakai `::jsonb` cast di raw SQL
```ts
// ✅ Benar
INSERT INTO profiles (..., achievements) VALUES (..., $16::jsonb)
```

### Aturan #4: Semua field Prisma pakai `@map()` untuk snake_case
```prisma
streakCount Int @default(0) @map("streak_count")  // ✅
```

### Aturan #5: Jangan pernah `git checkout origin/main` tanpa cek dulu
- Bisa revert semua fix yang udah dikerjain
- Kalau harus restore file tertentu, pakai `git checkout origin/main -- <file spesifik>`

---

## 📁 FILE KRITIS YANG JANGAN DIOTAK-ATIK SEMBARANGAN

| File | Fungsi |
|---|---|
| `src/app/api/auth/signup/route.ts` | Registrasi user baru, auto-migrate DB |
| `src/app/api/auth/verify-email/route.ts` | Verifikasi email (3-tier token lookup) |
| `src/app/api/auth/send-reset-password/route.ts` | Kirim link reset password |
| `src/app/api/auth/reset-password-admin/route.ts` | Reset password via admin API (tanpa session) |
| `src/app/auth/reset-password/page.tsx` | Halaman reset password (Suspense wrapper) |
| `src/app/auth/verify/page.tsx` | Halaman verifikasi email |
| `prisma/schema.prisma` | Schema database (postgres, achievements: Json) |
| `src/lib/db.ts` | Koneksi database |
| `src/lib/supabase.ts` | Koneksi Supabase (client + admin) |

---

## 🔄 ALUR KERJA YANG SUDAH DIVERIFIKASI

1. User signup → auto-migrate DB → buat user di Auth → INSERT profil via raw SQL → simpan token di 3 tempat (DB profiles, Supabase profiles table, user metadata) → kirim email verifikasi
2. User klik link verifikasi → 3-tier lookup (Prisma $queryRaw → Supabase profiles → admin listUsers) → tandai verified → confirm di Auth
3. User login → session via Supabase Auth
4. Lupa password → kirim link reset → halaman reset password pakai admin API fallback
