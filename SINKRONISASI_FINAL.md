# 🔄 Sinkronisasi Terakhir - Panduan Lengkap

## ✅ Status Saat Ini:

1. ✅ Vercel Authentication: Sudah dimatikan
2. ✅ Website: Live di https://luxtrade-2x18lq472-risyxiee.vercel.app/
3. ✅ Prisma Schema: PostgreSQL provider
4. ✅ Supabase Connection String: Siap

## 🔧 Langkah Sinkronisasi (Ikuti Berurutan):

---

### STEP 1: Set DATABASE_URL di Vercel

1. Buka [Vercel Dashboard](https://vercel.com/dashboard)
2. Pilih project **Luxtrade**
3. Masuk ke **Settings** → **Environment Variables**
4. Cari variable `DATABASE_URL` atau buat baru
5. Paste connection string ini:
   ```
   postgres://postgres.klxkdrfsfcoankbaoejn:oW0TKZUMb295pa4h@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x
   ```
6. Pilih SEMUA environments: Production, Preview, Development
7. Klik **Save**

> **PENTING**: Pastikan di-set di semua environment!

---

### STEP 2: Redeploy

Vercel akan redeploy otomatis. Tunggu 1-2 menit.

Atau manual:
1. Tab **Deployments**
2. Klik deployment terbaru
3. Klik (⋯) → **Redeploy**

---

### STEP 3: Push Database Schema

Buka di browser:
```
https://luxtrade-2x18lq472-risyxiee.vercel.app/api/setup
```

Ini akan membuat tabel-tabel:
- User, Post, AffiliateProfile, PageVisit, Withdrawal
- SubscriptionPlan, UserSubscription, SlotTracking

---

### STEP 4: Sync 6 User

Jalankan:
```bash
POST https://luxtrade-2x18lq472-risyxiee.vercel.app/api/admin/sync-auth-users
```

Response:
```json
{
  "success": true,
  "syncedCount": 6,
  "totalPrismaUsers": 6
}
```

---

### STEP 5: Konfirmasi Admin Panel

Buka:
```
https://luxtrade-2x18lq472-risyxiee.vercel.app/admin-subscriptions
```

Harus menampilkan 6 user: iyan, Galang, dll.

---

## ✅ Checklist:

- [ ] DATABASE_URL di Vercel (all envs)
- [ ] Redeploy selesai
- [ ] /api/setup berhasil
- [ ] /api/admin/sync-auth-users berhasil (6 user)
- [ ] Admin panel menampilkan 6 user

**Mulai STEP 1!** 🚀
