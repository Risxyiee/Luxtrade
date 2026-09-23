# Supabase Database Setup Guide

## Overview

Project ini sekarang menggunakan **Supabase** sebagai database utama menggantikan Prisma/SQLite. Semua data penting (user authentication, trades, achievements, subscriptions) sekarang disimpan di Supabase.

## 📋 Perubahan Arsitektur

### Dulu (Prisma/SQLite):
- User data: `users` table (Prisma)
- Subscriptions: `user_subscriptions` table (Prisma)
- Trades: `trades` table (Supabase) ✅
- Achievements: `profiles`, `user_submissions`, `mission_progress` (Prisma)

### Sekarang (Supabase):
- User data & Auth: `auth.users` + `user_metadata` ✅
- Subscriptions: `user_metadata` (`is_pro`, `subscription_until`, `subscription_status`) ✅
- Trades: `trades` table (Supabase) ✅
- Achievements: `profiles`, `user_submissions`, `mission_progress` (Supabase) ✅

## 🚀 Setup Instructions

### 1. Jalankan SQL Migration di Supabase Dashboard

Buka Supabase Dashboard → SQL Editor → Run SQL berikut:

File: `/home/z/my-project/supabase-migrations/001_create_achievement_tables.sql`

Ini akan membuat:
- `profiles` table
- `user_submissions` table
- `mission_progress` table
- Row Level Security (RLS) policies
- Triggers untuk auto-create profile
- Auto-update `updated_at` timestamps

### 2. Pastikan Environment Variables Terkonfigurasi

Di `.env` dan Vercel Environment Variables:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. Verifikasi Tables di Supabase

Buka Supabase Dashboard → Table Editor → Pastikan tables ini ada:

✅ `auth.users` (default Supabase)
✅ `profiles`
✅ `user_submissions`
✅ `mission_progress`
✅ `trades`

## 📊 Data Structure

### profiles Table
```sql
- id (UUID) - Reference to auth.users
- email (TEXT)
- streak_count (INTEGER)
- last_login_at (TIMESTAMP)
- best_streak (INTEGER)
- achievements (JSONB) - Array of achievement IDs
- plan (TEXT) - 'FREE' or 'PRO'
- pro_expiry (TIMESTAMP)
- role (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### user_submissions Table
```sql
- id (SERIAL)
- user_id (UUID) - Reference to profiles
- achievement_key (TEXT)
- proof_url (TEXT)
- status (TEXT) - 'PENDING', 'APPROVED', 'REJECTED'
- reviewed_by (TEXT)
- reviewed_at (TIMESTAMP)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### mission_progress Table
```sql
- id (UUID)
- user_id (UUID) - Reference to profiles
- mission_key (TEXT)
- progress (INTEGER)
- target (INTEGER)
- completed (BOOLEAN)
- claimed (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

## 🔒 Security

### Row Level Security (RLS)

Semua tables memiliki RLS policies:
- Users bisa membaca dan update data mereka sendiri
- Service role (admin) memiliki full access
- Tidak ada anonymous access

## 🔄 API Changes

### APIs yang SUDAH menggunakan Supabase:

✅ `/api/admin/users` - User management (Supabase Auth)
✅ `/api/auth/register` - User registration (Supabase Auth)
✅ `/api/auth/sync-user` - User sync (Supabase Auth)
✅ `/api/trades` - Trades management (Supabase)
✅ `/api/missions/claim` - Achievement system (Supabase)
✅ `/api/analytics` - Trades analytics (Supabase)
✅ `/api/track` - Analytics tracking (In-memory, no DB)

### APIs yang MASIH menggunakan Prisma (DEPRECATED):

⚠️ `/api/admin/subscriptions/*` - Use Supabase Auth metadata instead
⚠️ `/api/admin/withdrawals` - Not fully implemented yet
⚠️ `/api/lifetime/subscriptions` - Use Supabase Auth metadata instead
⚠️ Debug/test APIs - Not needed in production

## 🎯 How it Works

### 1. User Registration Flow
```
User registers → Supabase Auth creates user → Trigger creates profile in profiles table → User can use app
```

### 2. Subscription Management Flow (Admin Panel)
```
Admin clicks "Activate PRO" → /api/admin/users PATCH → Updates user_metadata in Supabase Auth → Frontend reads metadata → User sees PRO status
```

### 3. Achievement Claim Flow
```
User completes task → Claims achievement → /api/missions/claim POST → Validates criteria → Creates submission → Updates profile achievements → Applies reward (e.g., PRO days) → Updates user_metadata
```

### 4. Trade Logging Flow
```
User logs trade → /api/trades POST → Saves to Supabase trades table → Checks PRO status → Enforces limits if FREE user
```

## ⚠️ Important Notes

### 1. NO MORE PRISMA FOR CRITICAL DATA
- User data: Supabase Auth
- Subscriptions: Supabase Auth metadata
- Achievements: Supabase tables
- Trades: Supabase tables

### 2. OLD PRISMA TABLES ARE DEPRECATED
- `users` table (Prisma) - NOT USED
- `user_subscriptions` table (Prisma) - NOT USED
- `withdrawals` table (Prisma) - NOT FULLY IMPLEMENTED

### 3. DATA PERSISTENCE
- All data is now stored in Supabase
- Data is persistent across deployments
- No data loss on server restart

### 4. ADMIN PANEL
- Admin panel now uses Supabase Auth Admin API
- Requires `SUPABASE_SERVICE_ROLE_KEY` in environment variables
- PRO activation/deactivation updates user_metadata directly

## 🧪 Testing

### Test Achievement System
```bash
# Get user's achievements
GET /api/missions/claim?userId={user_id}

# Claim achievement
POST /api/missions/claim
{
  "userId": "{user_id}",
  "missionId": "{achievement_id}",
  "proofUrl": "https://..." (for manual achievements)
}
```

### Test Trades
```bash
# Get user's trades
GET /api/trades?userId={user_id}

# Create trade
POST /api/trades
{
  "symbol": "EURUSD",
  "type": "BUY",
  "open_price": 1.0850,
  "close_price": 1.0900,
  "lot_size": 0.1,
  "profit_loss": 50
}
```

### Test Admin Panel
```bash
# Get all users
GET /api/admin/users

# Activate PRO for user
PATCH /api/admin/users
{
  "userId": "{user_id}",
  "action": "activate",
  "days": 30
}
```

## 📝 Next Steps

1. ✅ Run SQL migration in Supabase Dashboard
2. ✅ Verify environment variables
3. ✅ Test achievement system
4. ✅ Test admin panel
5. ⏳ Implement withdrawal system in Supabase (if needed)
6. ⏳ Migrate any existing data from Prisma to Supabase (if needed)

## 🆘 Troubleshooting

### Problem: Achievement system returns "Profile not found"
**Solution**: Make sure the SQL migration has been run. The trigger should auto-create profiles when users sign up.

### Problem: Admin panel shows "SUPABASE_SERVICE_ROLE_KEY is missing"
**Solution**: Add `SUPABASE_SERVICE_ROLE_KEY` to your Vercel environment variables. You can find it in Supabase Dashboard → Settings → API.

### Problem: Trades not saving
**Solution**: Check that `trades` table exists in Supabase and user is authenticated.

### Problem: PRO activation not working
**Solution**: Verify `SUPABASE_SERVICE_ROLE_KEY` is correct and has admin permissions. Check Vercel logs for detailed errors.

## 📚 Additional Resources

- Supabase Documentation: https://supabase.com/docs
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
