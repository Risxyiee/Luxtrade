# Dapatkan Supabase Anon Key yang valid

## Cara Mendapatkan Anon Key yang Benar

1. Buka Supabase Dashboard: https://supabase.com/dashboard
2. Pilih project: `klxkdrfsfcoankbaoejn` (LuxTrade)
3. Go to: **Settings** → **API**
4. Di bagian "Project API keys", cari **anon public** key
5. Copy key tersebut (akan dimulai dengan `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

## Cara Update di Cloudflare Workers

### Option 1: Via Cloudflare Dashboard
1. Buka Cloudflare Dashboard
2. Pilih Workers & Pages
3. Pilih project "luxtrade"
4. Go to **Settings** → **Environment Variables**
5. Add/Edit variable:
   - Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Value: paste anon key dari Supabase
6. Add juga:
   - Name: `SUPABASE_ANON_KEY`
   - Value: paste anon key yang sama

### Option 2: Via wrangler.toml (local)
Update file `wrangler.toml`:
```toml
[vars]
NEXT_PUBLIC_SUPABASE_URL = "https://klxkdrfsfcoankbaoejn.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY = "PASTE_ANON_KEY_DISINI"
SUPABASE_ANON_KEY = "PASTE_ANON_KEY_DISINI"
NEXT_PUBLIC_SITE_URL = "https://luxtradee.web.id"
```

Lalu commit dan push:
```bash
git add wrangler.toml
git commit -m "Update Supabase anon key"
git push
```

## Verifikasi Setelah Update

Buka browser dan test:
1. Buka https://luxtradee.web.id/api/debug/env
2. Pastikan `NEXT_PUBLIC_SUPABASE_ANON_KEY` menunjukkan `SET (length: XXX)`
3. Coba login di https://luxtradee.web.id/auth/login

## Troubleshooting

Jika masih error:
- Pastikan copy seluruh key (tidak terpotong)
- Pastikan key dari project yang benar (`klxkdrfsfcoankbaoejn`)
- Refresh deployment setelah update environment variables
- Cek Cloudflare Workers logs untuk error message