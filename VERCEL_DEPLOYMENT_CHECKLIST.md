# VERCEL DEPLOYMENT CHECKLIST - EMERGENCY FIX

## COPY-PASTE INI KE VERCEL ENVIRONMENT VARIABLES

```
DATABASE_URL=postgresql://postgres:Riskiakbarp123@db.klxkdrfsfcoankbaoejn.supabase.co:6543/postgres?pgbouncer=true

NEXT_PUBLIC_SUPABASE_URL=https://klxkdrfsfcoankbaoejn.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY=<isi dengan ANON KEY dari Supabase>

SUPABASE_SERVICE_ROLE_KEY=<isi dengan SERVICE ROLE KEY dari Supabase>

NODE_ENV=production
```

---

## CARA SET DI VERCEL:

1. Buka Vercel Dashboard
2. Pilih project luxtrade
3. Klik **Settings** → **Environment Variables**
4. Tambahkan satu-satu:
   - Klik **Add New**
   - Key: `DATABASE_URL`
   - Value: `postgresql://postgres:Riskiakbarp123@db.klxkdrfsfcoankbaoejn.supabase.co:6543/postgres?pgbouncer=true`
   - Klik **Save**
5. Ulangi untuk semua variable di atas
6. Pergi ke **Deployments** → Klik deployment terbaru → **Redeploy**

---

## AMBIL API KEY DARI SUPABASE:

1. Login ke Supabase Dashboard
2. Pilih project
3. Klik **Settings** → **API**
4. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role secret → `SUPABASE_SERVICE_ROLE_KEY`

---

## FIXES YANG SUDAH DILAKUKAN:

✅ **Database Connection** - lib/db.ts auto-switch ke port 6543
✅ **Middleware Auth** - @supabase/ssr dengan cookie handling
✅ **Sidebar Scroll** - Added shrink-0 dan min-h-0
✅ **Add Trade Button** - Muncul di semua screen size
✅ **Prisma Schema** - UUID sudah benar

---

## VERIFICATION SETELAH DEPLOY:

- [ ] Tidak ada error di Vercel logs
- [ ] User bisa login
- [ ] Tidak ada login loop
- [ ] Sidebar bisa scroll di mobile
- [ ] Tombol Add Trade muncul
- [ ] Bisa tambah trade
- [ ] Bisa tambah account

---

**SEGERA SET ENV VARIABLES DI VERCEL DAN REDEPLOY!**
