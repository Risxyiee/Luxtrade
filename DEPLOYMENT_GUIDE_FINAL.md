# Deployment Guide - LUXTRADE (UPDATED)

## ✅ Selesai:
- [x] Local Storage → Supabase Storage migration
- [x] Delete account button visible and working
- [x] Fix Next.js 16 cookie compatibility issues
- [x] Supabase Storage bucket created
- [x] Upload gambar berfungsi
- [x] **Tesseract.js OCR Integration (FREE)** ⭐ NEW!
- [x] Hapus ketergantungan OpenAI Vision quota

## Apa yang Baru?

### 🎉 Tesseract.js - OCR GRATIS!
- Tidak perlu OpenAI API key lagi
- Tidak perlu bayar OpenAI quota
- 100% GRATIS dan open source
- Support 100+ bahasa

### Dua Fitur Auto-Journal:

1. **Import Screenshot** (`/api/import/screenshot`)
   - Extract multiple trades dari MT5/MT4 screenshot
   - Sekarang pakai **Tesseract.js (GRATIS)**

2. **Screenshot Journal** (`/api/screenshot-journal`)
   - Auto journal + AI analysis
   - Fallback chain:
     1. Hugging Face (FREE dengan API token)
     2. Ollama (FREE, lokal)
     3. Z.ai Vision (build-required)
     4. **Tesseract.js (FREE, client-side)** ⭐
     5. OpenAI Vision (berbayar, fallback terakhir)

## Deployment ke Vercel

### Step 1: Setup Environment Variables di Vercel

Login ke [Vercel Dashboard](https://vercel.com/dashboard) dan tambahkan:

**Required (Minimal):**
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**Optional (untuk fitur AI yang lebih baik):**
```env
# Hugging Face Vision (FREE, lebih akurat dari Tesseract)
HUGGING_FACE_API_TOKEN=hf_xxxxxxxxxxxxx

# Jika mau pakai OpenAI sebagai fallback terakhir
OPENAI_API_KEY=sk-xxxxxxxxxxxxx

# MetaApi (untuk real-time data sync)
METAAPI_TOKEN=your_metaapi_token
```

### Step 2: Deploy ke Vercel

1. Buka [Vercel](https://vercel.com/dashboard)
2. **Add New...** → **Project**
3. Import: `Risxyiee/Luxtrade`
4. Add environment variables dari Step 1
5. **Deploy**

### Step 3: Testing di Production

Setelah deploy selesai:

#### Test OCR Fitur (Baru!)
- [ ] Import trades dari screenshot MT5/MT4
- [ ] Cek Tesseract OCR berhasil extract data
- [ ] Test screenshot journal auto-generate

#### Test Upload Gambar
- [ ] Upload screenshot ke trade
- [ ] Pastikan URL Supabase Storage works

#### Test Trading Accounts
- [ ] Create trading account
- [ ] Delete trading account
- [ ] Cek auto-promote default account

## Environment Variables Summary

### Required (Wajib):
| Variable | Dari mana? |
|----------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role key |

### Optional (Recommended untuk production):

**Untuk OCR yang lebih akurat:**
```env
HUGGING_FACE_API_TOKEN=hf_xxxxxxxxxxxxx
```
- Gratis di [Hugging Face](https://huggingface.co/settings/tokens)
- Lebih akurat dari Tesseract
- Tanpa Hugging Face, system akan pakai Tesseract (tetap GRATIS)

**Untuk AI chatbot:**
```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
```
- Tanpa ini, hanya fitur OCR yang work
- Chatbot fitur akan non-aktif

**Untuk MetaApi integration:**
```env
METAAPI_TOKEN=your_metaapi_token
```
- Untuk sync real-time data dari broker

## Common Deployment Issues

### Build Error: "Module not found: tesseract.js"
**Solusi:** Dependencies sudah ter-updated di package.json. Vercel akan auto-install.

### Runtime Error: "Tesseract worker failed"
**Solusi:** Tesseract jalan di client-side. Pastikan browser support ES6+.

### OCR Tidak Mendeteksi Trade
**Solusi:**
- Pastikan screenshot jelas dan tidak blur
- Gunakan font standar MT5/MT4
- Tesseract pattern-dependent, mungkin perlu adjustment

### Upload Gambar Gagal
**Solusi:**
- Pastikan `SUPABASE_SERVICE_ROLE_KEY` benar
- Cek Supabase Storage bucket sudah dibuat
- Cek RLS policies

## Fitur yang Tersedia Tanpa OpenAI

✅ **100% Functional:**
- User authentication (Supabase)
- Trading account management
- Create/edit/delete trades
- Upload screenshots (Supabase Storage)
- **Import dari screenshot (Tesseract.js OCR)** ⭐
- **Screenshot journal auto-generate (Tesseract.js)** ⭐
- Journal entries
- Calendar view
- Watchlist
- Market news
- Economic calendar
- Achievements
- All free user features
- All Pro features

❌ **Requires OpenAI API Key (Optional):**
- AI Chatbot (LLM)
- High-accuracy OCR (Hugging Face/OpenAI Vision better than Tesseract)

## After Deployment

### Monitoring
- [ ] Enable Vercel Analytics
- [ ] Monitor error rates (Vercel logs)
- [ ] Monitor Supabase usage

### Backup
- [ ] Supabase auto-backup enabled
- [ ] Database export regular (opsional)

### User Onboarding
- [ ] Add user guide
- [ ] Document OCR features
- [ ] Create troubleshooting FAQ

## Quick Start untuk User Baru

1. **Login** dengan akun
2. **Setup Trading Account** (minimal 1)
3. **Tambah Trade**:
   - Manual: "+ Add Trade"
   - Dari screenshot: "Import" → "Screenshot" (GRATIS dengan Tesseract!)
   - Dari file: "Import" → "Upload File" (CSV/HTML)
4. **Lihat Journal** otomatis dari screenshot
5. **Analisis** dengan dashboard & charts

## Performance Tips

- Tesseract OCR butuh 5-10 detik per gambar (lebih lambat dari OpenAI)
- Untuk OCR lebih cepat & akurat, setup Hugging Face token
- Hapus trades lama untuk menjaga database kecil
- Compress screenshots sebelum upload

## Support

- **Tesseract.js:** https://github.com/naptha/tesseract.js
- **Vercel:** https://vercel.com/support
- **Supabase:** https://supabase.com/support
- **Hugging Face:** https://huggingface.co/docs/inference/index