# Cara Menjalankan Script SQL di Supabase

## 📋 Langkah-langkah:

### 1. Login ke Supabase Dashboard
1. Buka: https://supabase.com/dashboard
2. Login dengan akun Anda
3. Pilih project: `klxkdrfsfcoankbaoejn`

### 2. Buka SQL Editor
1. Di sidebar kiri, klik **SQL Editor**
2. Klik **New query**

### 3. Copy & Paste Script
1. Buka file: `docs/create_tables.sql`
2. Copy semua isi script
3. Paste ke SQL Editor di Supabase

### 4. Jalankan Script
1. Klik tombol **Run** (▶️) di pojok kanan bawah
2. Tunggu sampai selesai

### 5. Verify Tables Created
Di SQL Editor, jalankan query ini untuk verifikasi:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('Trade', 'TradingAccount', 'Profile', 'User', 'JournalEntry')
ORDER BY table_name;
```

**Expected Result:**
```
table_name
-----------
JournalEntry
Profile
Trade
TradingAccount
User
```

### 6. Verify Indexes Created
```sql
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

---

## ✅ Setelah Script Berhasil:

### Error yang akan hilang:
- ❌ `The table 'public.Trade' does not exist in the current database`
- ❌ `The table 'public.TradingAccount' does not exist in the current database`

### Fitur yang akan berfungsi:
- ✅ Add/Edit/Delete Trades
- ✅ Add Trading Accounts
- ✅ Trading Journal
- ✅ Watchlist
- ✅ Analytics
- ✅ Risk Calculator
- ✅ Semua fitur database

---

## 🔧 Troubleshooting:

### Issue: "table already exists"
**Solution:** Script sudah pakai `IF NOT EXISTS`, jadi aman untuk di-run ulang

### Issue: "permission denied"
**Solution:** Pastikan login sebagai owner/role yang punya akses CREATE TABLE

### Issue: "function already exists"
**Solution:** Script sudah pakai `CREATE OR REPLACE FUNCTION`, aman untuk di-run ulang

### Issue: "trigger already exists"
**Solution:** Script akan skip trigger yang sudah ada

---

## 📊 Struktur Database:

### Tabel Utama:
| Tabel | Deskripsi |
|-------|-----------|
| `User` | User auth (NextAuth) |
| `Profile` | Profil & settings user |
| `TradingAccount` | Akun trading (MT4/MT5) |
| `Trade` | Data trading (entry/exit, P/L) |
| `JournalEntry` | Jurnal trading |
| `Tag` | Tag untuk kategorisasi |
| `WeeklyGoal` | Target mingguan |

### Tabel Tambahan:
| Tabel | Deskripsi |
|-------|-----------|
| `UserSubscription` | Subscription PRO |
| `Withdrawal` | Request withdrawal |
| `SocialLink` | Link social media |
| `UserSubmission` | Submission achievement |
| `MissionProgress` | Progress mission |

---

## 🚀 Next Steps:

Setelah tabel berhasil dibuat:
1. Deploy ulang di Vercel (otomatis saat push ke GitHub)
2. Login ke aplikasi
3. Coba Add Trading Account
4. Coba Add Trade
5. Semua fitur database akan berfungsi!

---

## 💡 Tips:

- Script ini membuat semua tabel + indexes + triggers + functions
- Aman untuk di-run berulang kali (pakai `IF NOT EXISTS`)
- Tidak akan menghapus data yang sudah ada
- Otomatis update `updatedAt` timestamp pada setiap update