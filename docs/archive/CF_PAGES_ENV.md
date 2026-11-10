# 🔧 Cloudflare Pages — Environment Variables Setup Guide

## Kenapa Dashboard Ga Jalan?

**Semua fitur dashboard yang pakai database error karena `DATABASE_URL` tidak di-set di Cloudflare Pages.**
Begitu juga env vars lain yang dibutuhkan auth, email, payment, dll.

> **CARA SET:** Buka Cloudflare Dashboard → Workers & Pages → luxtrade → Settings → Environment Variables
> Klik **Add Variable**, isi Name & Value, lalu klik **Save**. Setelah selesai, **re-deploy**.

---

## ✅ ENVIRONMENT VARIABLES YANG HARUS DI-SET

### 🔴 WAJIB — Tanpa ini app tidak bisa jalan

| Variable | Contoh Value | Dipakai Oleh |
|----------|-------------|--------------|
| `DATABASE_URL` | `postgresql://postgres.klxkdrfsfcoankbaoejn:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres` | **SEMUA** fitur yang pakai database (trades, journal, analytics, admin, affiliate, dll) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://klxkdrfsfcoankbaoejn.supabase.co` | Auth (login/signup), session, profile |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Auth (login/signup), session, profile |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Admin operations, user sync, email broadcast |

### 🟡 PENTING — Untuk fitur tertentu

| Variable | Contoh Value | Dipakai Oleh |
|----------|-------------|--------------|
| `NEXT_PUBLIC_APP_URL` | `https://luxtradee.web.id` | Server-side URL generation (email links, webhooks) |
| `NEXT_PUBLIC_SITE_URL` | `https://luxtradee.web.id` | Site URL references, promo codes, public profile |
| `RESEND_API_KEY` | `re_xxxxxxxxxxxx` | Email kirim (verifikasi, reset password, broadcast) |
| `MIDTRANS_SERVER_KEY` | `SB-Mid-server-XXXXX` | Midtrans webhook signature verification |
| `MIDTRANS_CLIENT_KEY` | `SB-Mid-client-XXXXX` | Frontend Midtrans Snap.js payment popup |
| `MIDTRANS_IS_PRODUCTION` | `false` (sandbox) atau `true` (production) | Midtrans environment toggle |

### 🟢 OPTIONAL — Untuk fitur AI & tambahan

| Variable | Contoh Value | Dipakai Olej |
|----------|-------------|------------|
| `GEMINI_API_KEY` | `AIza...` | AI screenshot analysis (auto-journal) |
| `OPENROUTER_API_KEY` | `sk-or-...` | Fallback AI vision |
| `OPENAI_API_KEY` | `sk-...` | Text-to-Speech (PRO feature) |
| `ZAI_BASE_URL` | `https://internal-api.z.ai/v1` | AI Chat (PRO feature) |
| `ZAI_API_KEY` | `...` | AI Chat |
| `ZAI_CHAT_ID` | `...` | AI Chat |
| `ZAI_USER_ID` | `...` | AI Chat |
| `ZAI_TOKEN` | `...` | AI Chat |
| `RAPIDAPI_TRADING_ECONOMICS_KEY` | `...` | News feed (TradingEconomics) |
| `RESEND_TEMPLATE_CONFIRM` | `tpl_xxx` | Resend email template untuk konfirmasi |
| `RESEND_TEMPLATE_RESET` | `tpl_xxx` | Resend email template untuk reset password |
| `DATABASE_POOLER_URL` | (opsional, override DATABASE_URL) | Direct pooler URL jika auto-detect gagal |

---

## 📋 CARA GET NILAI-NILAI DI ATAS

### 1. `DATABASE_URL` (Supabase)
- Buka Supabase Dashboard → Project Settings → Database → Connection string
- Pilih **Transaction Pooler** (port 6543)
- Format: `postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres`
- **PENTING:** Gunakan connection pooler (bukan direct connection) karena Cloudflare Workers butuh WebSocket/HTTP

### 2. `NEXT_PUBLIC_SUPABASE_URL`
- Buka Supabase Dashboard → Project Settings → API
- Project URL: `https://YOUR_PROJECT.supabase.co`

### 3. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Buka Supabase Dashboard → Project Settings → API
- `anon public` key

### 4. `SUPABASE_SERVICE_ROLE_KEY`
- Buka Supabase Dashboard → Project Settings → API
- `service_role secret` key (⚠️ JANGAN BAGIKAN — ini admin key!)

### 5. `RESEND_API_KEY`
- Buka Resend Dashboard → API Keys

### 6. `MIDTRANS_SERVER_KEY` & `MIDTRANS_CLIENT_KEY`
- Buka Midtrans Dashboard → Settings → Access Keys

---

## 🧪 SETELAH SET ENV VARS — CARA TEST

1. **Re-deploy** di Cloudflare Pages (Builds → Retry deploy, atau push commit baru)
2. Buka Real-time Logs di CF Pages dashboard
3. Login ke app
4. Test fitur-fitur ini:
   - ✅ Dashboard stats muncul
   - ✅ Add trade berhasil
   - ✅ Journal entries muncul
   - ✅ Analytics data loading
   - ✅ Admin panel bisa akses (jika admin email)

---

## ⚠️ CATATAN PENTING

1. **Jangan commit .env** ke git — set semua env vars di CF Pages Dashboard saja
2. **NEXT_PUBLIC_* vars** akan di-expose ke client-side (browser), jadi hanya set public key/URL
3. **Service role key & API keys** HANYA boleh di server-side (tanpa NEXT_PUBLIC_ prefix)
4. Setelah menambah/edit env vars, **WAJIB re-deploy** agar berlaku
