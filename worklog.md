---
Task ID: 1
Agent: main
Task: Fix semua error dari log Vercel — code_changed_at, pro_expiry, audit semua API route

Work Log:
- Analisis 10 log Vercel: 3 error `affiliates.code_changed_at` kolom tidak ada, 1 error `/api/admin/activate` 500
- Grep seluruh codebase: `pro_expiry_date` TIDAK ditemukan (sudah diperbaiki sebelumnya), `code_changed_at` hanya di ensureSchema
- Temukan ensureSchema() hanya punya 1 ALTER TABLE untuk code_changed_at, tidak ada untuk Supabase-only columns di profiles
- Fix ensureSchema() — tambahkan 8 ALTER TABLE IF NOT EXISTS untuk semua kolom Supabase-only: subscription_status, pro_status, pro_expiry, affiliate_balance, referral_count, referral_code_changes, referral_status, subscription_until
- Fix /api/admin/activate — tambahkan `proExpiry` di Prisma update (sebelumnya hanya Supabase yang ke-update)
- Fix /api/admin/users PATCH — tambahkan sync ke Supabase profiles table saat activate/revoke
- Fix sync-auth-users & populate-profiles — import dan panggil ensureSchema() sebelum insert
- CRITICAL FIX: journal-entries/route.ts — `supabase` variabel tidak pernah didefinisikan, semua 4 handler (GET/POST/PUT/DELETE) 100% crash
- CRITICAL FIX: webhook/trading/route.ts — module-level createClient dengan ! assertion crash jika env var missing → lazy init
- CRITICAL FIX: integrations/route.ts — sama, module-level createClient → lazy init
- CRITICAL FIX: integrations/[id]/route.ts — sama → lazy init
- CRITICAL FIX: analyze-screenshot/route.ts — sama → lazy init
- CRITICAL FIX: achievements/onboarding/route.ts — sama → lazy init
- CRITICAL FIX: admin/users/[id]/route.ts — db.user.delete() tidak ada di Prisma schema → rewrite pakai Auth admin + profile delete
- HIGH FIX: admin/manual-update/route.ts — req.json() di luar try/catch → wrap
- HIGH FIX: admin/promo/activate/route.ts — request.json() di luar try/catch → wrap

Stage Summary:
- ensureSchema() sekarang menangani 16 SQL statement (8 ALTER TABLE + promo_codes)
- 3 affiliate API (/me, /referrals, /withdraw) akan berhenti 500 setelah code_changed_at kolom dibuat
- /api/admin/activate sekarang sync proExpiry ke Prisma DAN Supabase
- admin/users PATCH sekarang sync ke Supabase profiles (sebelumnya hanya Auth metadata)
- 6 module-level createClient call diconvert ke lazy init → tidak crash jika env var missing
- journal-entries 4 handler diperbaiki (sebelumnya 100% crash)
- admin/users/[id] DELETE diperbaiki (sebelumnya crash karena db.user tidak ada)
- Lint bersih, dev server jalan tanpa error
