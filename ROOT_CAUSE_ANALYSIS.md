# ROOT CAUSE ANALYSIS

## Masalah Utama Ditemukan

### 1. Prisma User Model Issue ⚠️

**Problem:**
```prisma
model User {
  id        String   @id @default(cuid())  // ← Masalah di sini!
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Isu:**
- `User.id` menggunakan `@default(cuid())` - Prisma generates CUID
- Tapi Supabase Auth menggunakan UUID (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
- Sync API mencoba menggunakan UUID dari Supabase Auth sebagai User.id
- **CONFLICT!** CUID vs UUID format

**Kenapa ini penting:**
- Sync API: `/api/admin/sync-auth-users` line 99-100:
  ```typescript
  const newUser = await db.user.create({
    data: {
      id: authUser.id, // ← Ini UUID dari Supabase Auth!
      email: authUser.email!,
      name: displayName
    }
  })
  ```
- Karena Prisma User.id punya constraint `@default(cuid())`, ID manual tidak akan bekerja dengan benar

---

## Solusi

### Opsi 1: Ubah Prisma User.id untuk menerima UUID (RECOMMENDED)

Ini memungkinkan sync langsung dengan UUID dari Supabase Auth.

```prisma
model User {
  id        String   @id @default(uuid())  // ← Ganti ke uuid()
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Kelebihan:**
- Sync bisa langsung pakai UUID dari Supabase Auth
- ID konsisten antara Supabase Auth dan Prisma
- Tidak perlu sync manual setiap kali

**Kekurangan:**
- Perlu migration: `bun run db:push` atau `bun run prisma migrate`

---

### Opsi 2: Ganti Prisma User.id ke String tanpa @default

```prisma
model User {
  id        String   @id  // ← Hapus @default()
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Kelebihan:**
- Flexibel - bisa pakai UUID dari Supabase Auth atau generate manual
- Tidak perlu default constraint

**Kekurangan:**
- Harus selalu provide ID saat create user
- Tidak ada auto-generation untuk non-Supabase users

---

### Opsi 3: Simpan UUID di field terpisah

```prisma
model User {
  id            String   @id @default(cuid())
  supabaseId    String?  @unique  // ← UUID dari Supabase Auth
  email         String   @unique
  name          String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

**Kelebihan:**
- Tidak perlu ubah ID primary
- Bisa hubungkan ke Supabase Auth via supabaseId

**Kekurangan:**
- Perlu query join untuk relate ke Supabase Auth
- Lebih kompleks

---

## Rekomendasi

**Gunakan Opsi 1** - Ubah Prisma User.id ke `@default(uuid())`

**Alasan:**
1. Supabase Auth sudah pakai UUID
2. Sync akan lebih sederhana dan langsung
3. ID konsisten di seluruh sistem
4. Industry standard untuk auth-based applications

---

## Langkah Implementasi

### Step 1: Update Prisma Schema

Edit `/prisma/schema.prisma`:
```prisma
model User {
  id        String   @id @default(uuid())  // ← Ganti ke uuid()
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Step 2: Push Schema ke Database

```bash
bun run db:push
```

### Step 3: Regenerate Prisma Client

```bash
bun run prisma generate
```

### Step 4: Test Sync

```bash
curl -X POST https://luxtrade-2x18lq472-risyxiee.vercel.app/api/admin/sync-auth-users
```

---

## Catatan Penting

**Setelah mengubah schema:**
- Jika ada data User yang sudah ada, harus migrasi ID-nya
- Atau bisa truncate table User dan sync ulang dari Supabase Auth
- Perlu deploy ulang ke Vercel

---

## Masalah Tambahan: Environment Variables

Selain masalah schema di atas, masih ada issue dengan environment variables di Vercel:

### Required Environment Variables:

1. **DATABASE_URL** ✅ (Sudah ada)
2. **SUPABASE_SERVICE_ROLE_KEY** ❓ (User bilang ada, perlu dicek nilainya)
3. **NEXT_PUBLIC_SUPABASE_URL** ❓ (Perlu dicek)
4. **NEXT_PUBLIC_SUPABASE_ANON_KEY** ❓ (Perlu dicek)

### Cara Cek:

Buka: https://vercel.com/risyxiee/luxtrade/settings/environment-variables

Pastikan:
- Ke-4 variable ada dengan nama yang TEPAT
- Value-nya benar:
  - `SUPABASE_SERVICE_ROLE_KEY` = service_role key dari Supabase (bukan anon!)
  - `NEXT_PUBLIC_SUPABASE_URL` = `https://klxkdrfsfcoankbaoejn.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key dari Supabase
- Environment dipilih: **All** (Production, Preview, Development)

---

## Summary Checklist

Sebelum sync berhasil, perlu:

- [ ] **FIX PRIORITY 1**: Ubah Prisma User.id ke `@default(uuid())`
- [ ] **FIX PRIORITY 1**: Run `bun run db:push`
- [ ] **FIX PRIORITY 1**: Run `bun run prisma generate`
- [ ] **FIX PRIORITY 2**: Cek 4 environment variables di Vercel
- [ ] **FIX PRIORITY 2**: Redeploy project di Vercel
- [ ] Test sync API
- [ ] Verifikasi Admin Panel

---

## Quick Fix (Untuk User)

Jika ingin quick fix tanpa pusing:

**Saya siap membantu memperbaiki schema Prisma dan men-push ke database.**

Cukup jawab: "Fix the Prisma schema" dan saya akan:
1. Update Prisma schema ke UUID
2. Push schema ke database
3. Generate Prisma client baru
4. Commit dan push ke GitHub
5. Berikan instruksi untuk redeploy Vercel

Kamu hanya perlu:
1. Cek environment variables di Vercel (sesuai panduan di `CRITICAL_CHECK.md`)
2. Redeploy setelah saya push perubahan
3. Test sync API
