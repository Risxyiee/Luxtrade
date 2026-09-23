# CEK VERCEL ENVIRONMENT VARIABLES - HARUS PERSIS INI!

## COPY-PASTE INI KE VERCEL:

```
DATABASE_URL=postgresql://postgres:Riskiakbarp123@db.klxkdrfsfcoankbaoejn.supabase.co:6543/postgres?pgbouncer=true
NEXT_PUBLIC_SUPABASE_URL=https://klxkdrfsfcoankbaoejn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<isi ANON KEY lo>
SUPABASE_SERVICE_ROLE_KEY=<isi SERVICE ROLE KEY lo>
NODE_ENV=production
```

## CARA CEK DI VERCEL:

1. Vercel Dashboard → Project luxtrade
2. Settings → Environment Variables
3. CEK SATU-SATU:
   - **DATABASE_URL** → Harus ada `:6543` dan `?pgbouncer=true`
   - **NEXT_PUBLIC_SUPABASE_URL** → Harus `https://klxkdrfsfcoankbaoejn.supabase.co`
   - **NEXT_PUBLIC_SUPABASE_ANON_KEY** → Harus isi (bukan kosong)
   - **SUPABASE_SERVICE_ROLE_KEY** → Harus isi (bukan kosong)

4. Kalo salah → Klik edit → ganti → Save
5. Deployments → Klik terbaru → Redeploy

## CARA AMBIL API KEY:

1. Supabase Dashboard → Settings → API
2. Copy ANON KEY dan SERVICE ROLE KEY
3. Paste ke Vercel
