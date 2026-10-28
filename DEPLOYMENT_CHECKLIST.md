# DEPLOYMENT CHECKLIST - LuxTrade

## ✅ Selesai:
- [x] Local Storage → Supabase Storage migration
- [x] Delete account button visible and working
- [x] Fix Next.js 16 cookie compatibility issues
- [x] Supabase Storage bucket created
- [x] Upload gambar berfungsi

## Langkah Selanjutnya untuk Deployment

### 1. ⚠️ OpenAI API Quota Issue

**Status:** VLM OCR tidak berfungsi karena quota exceeded

**Solusi:** Ada 3 opsi:

**Opsi A: Tambah OpenAI Credits (Rekomendasi untuk production)**
1. Buka [OpenAI Platform](https://platform.openai.com/account/billing)
2. Cek usage dan add credits
3. Atur usage limits sesuai budget

**Opsi B: Disable VLM OCR Sementara**
- User tetap bisa upload gambar
- Data diisi manual
- Tidak ada error yang mengganggu

**Opsi C: Gunakan OCR Gratis**
- Implement Tesseract.js (client-side, free)
- Tidak perlu API key
- Lebih lambat tapi gratis

### 2. 🚀 Deploy ke Vercel

#### 2.1. Push ke GitHub (Sudah done)
```bash
# Terakhir push: 09fda01
git status
```

#### 2.2. Setup Environment Variables di Vercel

Login ke [Vercel Dashboard](https://vercel.com/dashboard) dan tambahkan environment variables:

**Required Environment Variables:**
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**Optional (untuk MetaApi integration):**
```env
METAAPI_TOKEN=your_metaapi_token
```

**Untuk mendapatkan nilai-nilai ini:**

1. **SUPABASE_URL & SUPABASE_ANON_KEY:**
   - Buka Supabase Dashboard → Project Settings → API
   - Copy:
     - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
     - anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. **SUPABASE_SERVICE_ROLE_KEY:**
   - Di halaman yang sama (Project Settings → API)
   - Copy service_role key
   - ⚠️ **HATI-HATI:** Jangan share key ini! Ini punya full access

#### 2.3. Connect Repository ke Vercel

1. Buka [Vercel Dashboard](https://vercel.com/dashboard)
2. Klik **Add New...** → **Project**
3. Import dari GitHub:
   - Select repository: `Risxyiee/Luxtrade`
   - Framework preset: `Next.js`
   - Root directory: `./` (default)

4. **Configure Project:**
   - **Build Command:** `bun run build` (atau biarkan default)
   - **Output Directory:** `.next`
   - **Install Command:** `bun install`

5. **Add Environment Variables:**
   - Klik **Environment Variables**
   - Add semua environment variables dari section 2.2

6. **Deploy:**
   - Klik **Deploy**
   - Tunggu build dan deployment selesai

### 3. 🧪 Testing di Production

Setelah deploy selesai:

#### 3.1. Test Auth Flow
- [ ] Buka production URL
- [ ] Login dengan akun test
- [ ] Logout dan login lagi

#### 3.2. Test Upload Gambar
- [ ] Buat trade baru
- [ ] Upload screenshot
- [ ] Pastikan URL benar (Supabase Storage)
- [ ] Cek gambar muncul di trade list

#### 3.3. Test Trading Accounts
- [ ] Buat trading account baru
- [ ] Delete trading account
- [ ] Pastikan auto-promote default account works

#### 3.4. Test MetaApi (jika diperlukan)
- [ ] Connect MetaApi account
- [ ] Sync data
- [ ] Cek real-time updates

### 4. 🔒 Security Checklist

#### 4.1. Environment Variables
- [ ] `SUPABASE_SERVICE_ROLE_KEY` hanya ada di server-side (tidak di client)
- [ ] `METAAPI_TOKEN` hanya ada di server-side
- [ ] Tidak ada sensitive data di `.env` yang di-commit ke GitHub

#### 4.2. Database Security
- [ ] RLS policies enabled di Supabase
- [ ] Users hanya bisa akses data mereka sendiri
- [ ] Service role key hanya digunakan di backend

#### 4.3. Rate Limiting
- [ ] Vercel rate limit sudah di-set (default sudah cukup)
- [ ] Supabase rate limit sudah di-check

### 5. 📊 Monitoring

Setup monitoring setelah production:

#### 5.1. Vercel Analytics
- [ ] Enable Vercel Analytics
- [ ] Setup custom domains

#### 5.2. Error Tracking
- [ ] Setup Sentry (opsional, untuk error tracking)
- [ ] Monitor Vercel logs
- [ ] Monitor Supabase logs

#### 5.3. Supabase Monitoring
- [ ] Check storage usage
- [ ] Check database connections
- [ ] Check API requests

### 6. 🎯 Post-Deployment Tasks

#### 6.1. Custom Domain (Opsional)
- [ ] Buy domain (misal: luxtrade.app)
- [ ] Configure DNS di Vercel
- [ ] Setup SSL certificate

#### 6.2. Email Templates (jika menggunakan Supabase Auth)
- [ ] Custom email templates
- [ ] Branding logo
- [ ] Branding colors

#### 6.3. Backup Strategy
- [ ] Setup daily backups (Supabase sudah otomatis)
- [ ] Test restore process
- [ ] Document backup locations

#### 6.4. Documentation
- [ ] Update README with production URL
- [ ] Document API endpoints
- [ ] Document environment variables

## Common Deployment Issues & Solutions

### Issue 1: Build Error "NEXT_PUBLIC_SUPABASE_URL is not defined"
**Solusi:** Add environment variable di Vercel → Environment Variables

### Issue 2: Upload fails with "Permission denied"
**Solusi:** Check `SUPABASE_SERVICE_ROLE_KEY` is set correctly in Vercel

### Issue 3: Auth fails in production
**Solusi:**
- Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct
- Check Supabase Auth settings
- Check CORS settings in Supabase

### Issue 4: Images not loading after upload
**Solusi:**
- Check Supabase Storage bucket is public
- Check RLS policies allow SELECT for anon/authenticated
- Check public URL format

### Issue 5: "Page not found" errors
**Solusi:**
- Check Vercel build output directory
- Check Next.js routing
- Check if all routes are properly exported

## Rollback Plan

Jika ada masalah di production:

```bash
# 1. Revert ke commit terakhir yang stabil
git revert HEAD

# 2. Push ke GitHub
git push

# 3. Vercel otomatis redeploy dengan versi stabil
```

## Contact & Support

- **Vercel Support:** https://vercel.com/support
- **Supabase Support:** https://supabase.com/support
- **OpenAI Support:** https://platform.openai.com/support

## Quick Commands

```bash
# Check current status
git status

# View deployment logs
vercel logs

# Rebuild deployment
vercel deploy --force

# Clear cache
vercel rm --yes
vercel
```