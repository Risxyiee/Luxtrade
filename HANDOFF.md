# 📘 LuxTrade — Handoff Document

> Dokumen panduan maintenance untuk developer baru. Ditulis bahasa Indonesia yang gampang dipahami.
> Terakhir diperbarui: September 2026

---

## Daftar Isi

1. [File Map](#1-file-map)
2. [Data Flow](#2-data-flow)
3. [Auth Flow](#3-auth-flow)
4. [Ngoprek AI](#4-ngoprek-ai)
5. [Risk Map](#5-risk-map)
6. [Change Guide](#6-change-guide)

---

## 1. File Map

### 1.1 Struktur Folder Utama

```
my-project/
├── src/
│   ├── app/                    # Semua halaman & API routes
│   │   ├── page.tsx             # Landing page (halaman utama)
│   │   ├── layout.tsx           # Root layout (AuthProvider, LanguageProvider, Sentry)
│   │   ├── proxy.ts             # ⚠️ BUKAN middleware.ts! Ini pengganti middleware
│   │   ├── auth/                # Halaman login, signup, verify, dll
│   │   ├── dashboard/           # Dashboard utama
│   │   │   ├── page.tsx         # Entry point dashboard
│   │   │   ├── layout.tsx       # Dashboard layout
│   │   │   ├── LuxTradeDashboard.tsx  # ⭐ Komponen utama dashboard (~900 baris)
│   │   │   ├── tabs/            # 16 tab dashboard
│   │   │   ├── components/      # Komponen pendukung dashboard
│   │   │   ├── handlers/        # Handler logic terpisah (trade, journal, dll)
│   │   │   ├── admin/           # Admin panel pages
│   │   │   └── utils/           # Types & helper functions
│   │   └── api/                 # 100+ API routes
│   │       ├── auth/            # Auth routes (signup, login, verify, dll)
│   │       ├── ai/              # AI routes (chat, vision, auto-journal)
│   │       ├── trades/          # CRUD trades
│   │       ├── journal/         # Journal CRUD
│   │       ├── midtrans/        # Midtrans payment gateway
│   │       ├── promo/           # Promo codes
│   │       ├── affiliate/       # Affiliate system
│   │       ├── admin/           # Admin panel routes (~25 routes)
│   │       ├── news/            # Market news
│   │       └── ...              # Lainnya (watchlist, goals, dll)
│   ├── components/              # Komponen reusable
│   │   ├── ui/                  # shadcn/ui components (JANGAN di-edit manual)
│   │   ├── landing/             # Komponen landing page
│   │   └── effects/             # Animasi background
│   ├── lib/                     # Utility & helper functions
│   │   ├── api-auth.ts          # ⭐ Auth helper (requireAuth)
│   │   ├── pro-check.ts         # ⭐ Cek PRO status
│   │   ├── gemini.ts            # ⭐ Gemini AI wrapper
│   │   ├── aiml-vision.ts       # ⭐ Vision AI (Gemini + OpenRouter fallback)
│   │   ├── supabase-admin-alt.ts # ⭐ Supabase admin client
│   │   ├── auth-context.tsx     # AuthProvider (client-side)
│   │   ├── supabase/server.ts   # Supabase SSR client
│   │   ├── payment/             # Payment gateway helpers
│   │   ├── rate-limit.ts        # Rate limiting
│   │   ├── email.ts             # Resend email helper
│   │   ├── pricing.ts           # Pricing plans
│   │   └── ...                  # Lainnya
│   ├── store/                   # Zustand stores
│   │   ├── useUserStore.ts      # User state
│   │   ├── useLayoutStore.ts    # Layout state (tab aktif, bahasa, tema)
│   │   └── useTradeStore.ts     # Trade cache & filter
│   ├── contexts/                # React contexts
│   │   └── LanguageContext.tsx   # i18n (Indonesia/English)
│   └── types/                   # TypeScript type definitions
├── mini-services/               # Service terpisah (port berbeda)
│   └── affiliate-ws/            # Port 3004 — WebSocket affiliate real-time
├── resend-templates/            # Email HTML templates
├── public/                      # Static assets
├── next.config.ts               # Next.js config
└── package.json                 # Dependencies
```

### 1.2 File Paling Penting

| File | Fungsi | Frekuensi Diubah |
|------|--------|------------------|
| `src/app/dashboard/LuxTradeDashboard.tsx` | Otomatisasi utama dashboard, handler AI, state management | Tinggi |
| `src/app/api/ai/route.ts` | Semua fitur AI (tips, insight, analisis, chart, chat) | Tinggi |
| `src/proxy.ts` | Auth guard & admin check (pengganti middleware) | Rendah |
| `src/lib/api-auth.ts` | requireAuth() — dipakai hampir semua API route | Rendah |
| `src/lib/pro-check.ts` | isUserPro() — cek status PRO | Rendah |
| `src/lib/gemini.ts` | Gemini AI wrapper | Rendah |
| `src/lib/auth-context.tsx` | Client auth state, streak, auto-expiry | Sedang |
| `src/store/useLayoutStore.ts` | Tab aktif, bahasa, tema | Sedang |
| `src/store/useTradeStore.ts` | Trade cache & filter di client | Sedang |

### 1.3 File untuk Setiap Fitur

#### Landing Page
| File | Fungsi |
|------|--------|
| `src/app/page.tsx` | Render landing page |
| `src/app/LuxTradeLanding.tsx` | Komponen utama landing |
| `src/components/landing/*` | Semua komponen section landing |

#### Dashboard Tabs (16 tab)
| File | Fungsi |
|------|--------|
| `tabs/DashboardTab.tsx` | Overview — statistik, equity curve, activity |
| `tabs/TradesTab.tsx` | Daftar trade + filter |
| `tabs/JournalTab.tsx` | Journal entri |
| `tabs/CalendarTab.tsx` | Kalender trade |
| `tabs/WatchlistTab.tsx` | Watchlist pair |
| `tabs/AITab.tsx` | ⭐ AI assistant (PRO only) |
| `tabs/AnalyticsTab.tsx` | Analisis lanjutan |
| `tabs/AccountsTab.tsx` | Akun trading |
| `tabs/TargetsTab.tsx` | Target mingguan |
| `tabs/RiskCalculatorTab.tsx` | Kalkulator risiko |
| `tabs/HeatmapTab.tsx` | Heatmap pasar |
| `tabs/MarketNewsTab.tsx` | Berita pasar |
| `tabs/EconomicCalendarTab.tsx` | Kalender ekonomi |
| `tabs/PsychologyTab.tsx` | Tracking psikologi |
| `tabs/UserGuideTab.tsx` | Panduan onboarding |

#### Payment
| File | Fungsi |
|------|--------|
| `src/lib/payment/midtrans.ts` | ⭐ Midtrans gateway |
| `src/lib/pricing.ts` | Konstanta harga (PRO_30_DAYS=39K, dll) |
| `src/app/api/midtrans/create-transaction/route.ts` | Buat transaksi |
| `src/app/api/midtrans/notification/route.ts` | Webhook callback |
| `src/app/dashboard/components/PaywallModal.tsx` | Modal upgrade |

---

## 2. Data Flow

### 2.1 Alur Data Umum

```
Browser (React)
    │
    ├── fetch('/api/...') ──────────────────────► API Route (src/app/api/...)
    │                                                │
    │                                                ├── requireAuth(request) ──► Supabase Auth
    │                                                │
    │                                                ├── isUserPro(userId) ───► Supabase Admin (profiles table)
    │                                                │
    │                                                ├── admin.from('trades').select() ──► Supabase PostgreSQL
    │                                                │
    │                                                └── callGemini() ────────► Gemini AI
    │
    ◄────────── JSON Response ─────────────────────┘
```

### 2.2 Alur Tambah Trade

```
1. User isi form di TradeForm.tsx
2. LuxTradeDashboard.tsx → handleAddTrade()
3. POST /api/trades → requireAuth() → supabase.from('trades').insert()
4. Response → update useTradeStore (client cache)
5. DashboardTab.tsx re-render dengan data baru
```

**File terkait:**
- `src/app/dashboard/components/TradeForm.tsx` — Form input
- `src/app/dashboard/LuxTradeDashboard.tsx` — Handler `handleAddTrade`
- `src/app/dashboard/handlers/tradeHandlers.ts` — Logic terpisah
- `src/app/api/trades/route.ts` — API endpoint
- `src/store/useTradeStore.ts` — Client cache
- `src/store/useUserStore.ts` — Update trade count

### 2.3 Alur AI Analysis

```
1. User klik tombol di AITab.tsx (misal "Analisis Performa")
2. LuxTradeDashboard.tsx → handleGetTips()
3. Fetch trades user dari /api/trades
4. Hitung analytics (win rate, P/L, session performance, dll)
5. POST /api/ai { type: 'performance_tips', data: {...}, language: 'id' }
6. API route:
   a. requireAuth() → cek login
   b. isUserPro() → cek PRO (kalo bukan PRO, return 403)
   c. checkAIRateLimit() → cek rate limit (20 req/menit)
   d. buildPerformancePrompt(data, lang) → susun prompt
   e. callGemini() → panggil Gemini 2.5 Flash
   f. Kalo Gemini gagal → buildSmartPerformanceFallback(data, lang) → respons data-driven
7. Response ke AITab.tsx → tampilkan di UI
```

**File terkait:**
- `src/app/dashboard/tabs/AITab.tsx` — UI AI tab
- `src/app/dashboard/LuxTradeDashboard.tsx` — Handler (handleGetTips, handleGetMarket, dll)
- `src/app/api/ai/route.ts` — ⭐ Endpoint utama AI
- `src/lib/gemini.ts` — Gemini AI wrapper
- `src/lib/pro-check.ts` — Cek PRO
- `src/lib/rate-limit.ts` — Rate limiting

### 2.4 Alur Pembayaran (Midtrans)

```
1. User pilih paket di PaywallModal/PlanSelectionModal
2. POST /api/midtrans/create-transaction { plan, durationMonths }
3. API:
   a. requireAuth()
   b. Buat order di Midtrans
   c. Panggil Midtrans Snap API → dapat snap_token
   d. Return snap_token ke user
4. Midtrans Snap.js popup muncul, user bayar
5. Midtrans notification webhook → POST /api/midtrans/notification
6. Verifikasi signature → update profiles.is_pro → activate PRO
7. Admin bisa manual activate via /dashboard/admin
```

### 2.5 Alur Auth (Client-side)

```
1. User login di /auth/login
2. supabase.auth.signInWithPassword() (dari auth-context.tsx)
3. AuthProvider update state: user, profile, isPro
4. Cek login streak → update streak
5. Redirect ke /dashboard
```

**File terkait:**
- `src/lib/auth-context.tsx` — AuthProvider
- `src/app/auth/login/page.tsx` — Login page
- `src/app/auth/signup/page.tsx` — Signup page
- `src/app/api/auth/signup/route.ts` — Signup API
- `src/lib/supabase/server.ts` — Browser Supabase client

---

## 3. Auth Flow

### 3.1 Gambaran Besar

LuxTrade **TIDAK pakai NextAuth**. Pakai **Supabase Auth** langsung.

Ada **2 lapis** proteksi:
1. **proxy.ts** — Proteksi halaman (client-side routing)
2. **requireAuth()** — Proteksi API route (server-side)

### 3.2 Flow Detail

#### Login
```
Browser                    Supabase Auth         Database
  │                            │                    │
  ├── signInWithPassword() ──► │                    │
  │                            ├── cek email/pw ────►│
  ◄── session token ────────── │                    │
  │                                                 │
  ├── AuthProvider fetch profile ───────────────────►│
  ◄── profile data ───────────────────────────────── │
  │                                                 │
  └── Update state (user, isPro, isAdmin)           │
```

#### Signup
```
1. POST /api/auth/signup
2. Supabase Admin API → createUser() → user terbuat di auth.users
3. Supabase admin.from('profiles').upsert() → INSERT INTO profiles
4. Resend → kirim email verifikasi dengan token
5. User klik link → /auth/verify?token=XXX
6. Lookup profiles.email_verify_token → update email_verified = true
```

#### Proteksi Halaman (proxy.ts)

```
User buka /dashboard
  │
  ├── proxy.ts jalan
  ├── cek: apakah path di PUBLIC_PATHS? → Tidak
  ├── cek: apakah path di adminPaths? → Tidak
  ├── cek: apakah path di protectedPaths? → Ya (/dashboard)
  ├── Supabase auth.getUser() dari cookie
  ├── Kalo belum login → redirect ke /auth/login?redirect=/dashboard
  └── Kalo sudah login → lanjut ke halaman
```

#### Proteksi API (requireAuth)

```typescript
// Di setiap API route yang butuh auth:
const { error, user } = await requireAuth(request)
if (error) return error  // → 401 Unauthorized
// user.id dan user.email tersedia
```

**2 strategi yang dipakai:**
1. Cookie-based (standar SSR) — coba dulu
2. Bearer token (fallback) — kalo cookie gagal

### 3.3 File Auth — Ringkasan

| File | Fungsi | Risiko | Cara Aman Mengubah |
|------|--------|--------|-------------------|
| `src/proxy.ts` | Guard halaman, admin check | Salah config → semua user bisa akses / admin tidak bisa masuk | Tambah path baru di `PUBLIC_PATHS` atau `protectedPaths`. Jangan hapus admin email. |
| `src/lib/api-auth.ts` | `requireAuth()` untuk API | Ubah logic → semua API bisa bocor | Tambah validasi baru setelah `requireAuth()`, jangan ubah `getAuthUser()` |
| `src/lib/auth-context.tsx` | AuthProvider client | Bug → user tidak terdeteksi login | Hanya tambah state baru, jangan ubah `SIGNED_IN`/`SIGNED_OUT` handler |
| `src/lib/supabase-admin-alt.ts` | Supabase admin client | Bocor → akses penuh ke database | Jangan expose ke client, hanya server-side |
| `src/app/api/auth/signup/route.ts` | Registrasi | Bug → user tidak bisa daftar | Test signup setelah perubahan |

### 3.4 Admin Detection

Admin **TIDAK** ada di database. Dihardcode:

```typescript
// Di proxy.ts:
const ADMIN_EMAILS = ['luxtradee@gmail.com', 'riskiakbarp123@gmail.com']

// Di auth-context.tsx:
const ADMIN_EMAILS = ['luxtradee@gmail.com']
```

> ⚠️ **Risiko:** Kalau mau tambah admin, harus update di **2 tempat** (proxy.ts + auth-context.tsx)

---

## 4. Ngoprek AI

### 4.1 Arsitektur AI

```
AITab.tsx (UI)
    │
    ├── handleGetTips()        ──► POST /api/ai { type: 'performance_tips' }
    ├── handleGetMarket()      ──► POST /api/ai { type: 'market_insight' }
    ├── handleAnalyzeTrade()   ──► POST /api/ai { type: 'trade_analysis' }
    ├── handleAnalyzeChart()   ──► POST /api/ai { type: 'chart_analysis' }
    └── handleSendChat()       ──► POST /api/ai { type: 'chat' }

                             ┌─────────────────────────┐
                             │  /api/ai/route.ts       │
                             │                          │
                             │  1. requireAuth()        │
                             │  2. isUserPro()          │
                             │  3. checkAIRateLimit()   │
                             │  4. Switch by type:      │
                             │     - performance_tips  │
                             │     - market_insight     │
                             │     - trade_analysis     │
                             │     - chart_analysis     │
                             │     - chat               │
                             │  5. callGemini() → fallback  │
                             └────────┬────────────────┘
                                      │
                          ┌───────────┴───────────┐
                          │                       │
                    callGemini()          analyzeImageWithAiml()
                    (text only)            (gambar + text)
                          │                       │
                    ┌─────┴─────┐               │
                    │  Gemini   │               │
                    │ 2.5 Flash │               │
                    └─────┬─────┘               │
                          │                       │
                    Kalo gagal → Smart Fallback (data-driven, bukan template)
```

### 4.2 File AI — Detail

#### `src/lib/gemini.ts` — Gemini AI Wrapper

**Fungsi:** Wrapper untuk Google Gemini 2.5 Flash API.

**Konfigurasi dari env:**
- `GEMINI_API_KEY` (atau `GOOGLE_GEMINI_API_KEY`)

**Vision AI fallback** (`src/lib/aiml-vision.ts`):
- Primary: Gemini 2.5 Flash
- Fallback: OpenRouter (meta-llama/llama-4-scout:free)

#### `src/app/api/ai/route.ts` — Endpoint Utama AI

**Tipe request:**

| Type | Fungsi | Butuh Data | Butuh Vision |
|------|--------|-----------|-------------|
| `performance_tips` | Tips performa trading | trades, analytics | ❌ |
| `market_insight` | Insight pasar berdasarkan sesi | trades, sesi saat ini | ❌ |
| `trade_analysis` | Analisis mendalam 1 trade | selectedTrade, recentTrades | ❌ |
| `chart_analysis` | Analisis chart dari gambar | imageBase64 | ✅ |
| `chat` | Chat bebas dengan konteks trading | message, trades, analytics | ❌ |

**Rate limit:** 20 request per user per menit (in-memory, reset otomatis)

**Smart Fallback:** Kalo Gemini gagal (timeout, error, dll), system **TIDAK** return error. Malah generate respons data-driven dari statistik user.

### 4.3 Cara Mengubah AI

#### Menambah Tipe AI Baru

1. Buka `src/app/api/ai/route.ts`
2. Tambah case di switch `type`
3. Tambah handler di `LuxTradeDashboard.tsx`
4. Tambah tombol di `AITab.tsx`

#### Mengubah Model AI

1. Buka `src/lib/gemini.ts`
2. Ganti model di `GEMINI_API_URL`
3. Test: pastikan respons sesuai format

### 4.4 Risiko AI & Cara Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Gemini down/error | AI tidak bisa dipanggil | Smart fallback sudah handle → user tetap dapat respons |
| Rate limit terlalu ketat | User PRO tidak bisa pakai AI | Naikkan `AI_RATE_LIMIT` |
| Vision timeout | Chart analysis gagal | Timeout sudah 90s. Kalo masih gagal, kompres gambar. |

---

## 5. Risk Map

### 5.1 Risiko Kritis 🔴

| # | Risiko | File Terkait | Dampak | Mitigasi |
|---|--------|-------------|--------|----------|
| 1 | `proxy.ts` dihapus/diubah salah | `src/proxy.ts` | Dashboard bisa diakses tanpa login | Selalu test akses /dashboard dan /dashboard/admin setelah edit |
| 2 | `/api/ai/route.ts` hilang/corrupt | `src/app/api/ai/route.ts` | SEMUA fitur AI mati | Jangan rename ke `.bak` tanpa pengganti. Commit sering. |
| 3 | Supabase service role key bocor | `.env`, `src/lib/supabase-admin-alt.ts` | Akses penuh ke database | Jangan commit .env. Key hanya di server. |
| 4 | Payment callback tidak verifikasi signature | `src/app/api/midtrans/notification/route.ts` | Orang bisa activate PRO gratis | Selalu verifikasi signature dari Midtrans |
| 5 | Admin email hardcoded | `proxy.ts`, `auth-context.tsx` | Tambah admin harus edit 2 tempat | Pertimbangkan pindah ke database |

### 5.2 Risiko Tinggi 🟠

| # | Risiko | File Terkait | Dampak | Mitigasi |
|---|--------|-------------|--------|----------|
| 6 | `requireAuth()` bypass | `src/lib/api-auth.ts` | API bisa diakses tanpa login | Jangan ubah logic `getAuthUser()` |
| 7 | `isUserPro()` salah return | `src/lib/pro-check.ts` | User gratis akses fitur PRO | Cek `profiles.is_pro` + `subscription_until` |
| 8 | Gemini API key invalid/quotas | `src/lib/gemini.ts` | Semua AI mati | Cek quota di Google AI Studio |
| 9 | Supabase table schema berubah | Supabase dashboard | Database tidak sinkron | Selalu backup DB sebelum perubahan |
| 10 | Rate limit tidak ada di API publik | Semua `/api/` routes | DDoS, brute force | Tambah `rate-limit.ts` ke route yang rawan |

### 5.3 Risiko Sedang 🟡

| # | Risiko | File Terkait | Dampak | Mitigasi |
|---|--------|-------------|--------|----------|
| 11 | Trade cache di Zustand tidak sync | `useTradeStore.ts` | Data stale di UI | Invalidate cache setelah CRUD |
| 12 | Language context tidak lengkap | `LanguageContext.tsx` | Teks campur Indonesia/English | Selalu tambah kedua bahasa |
| 13 | Affiliate WS (port 3004) mati | `mini-services/affiliate-ws/` | Affiliate real-time tidak kerja | Monitoring + auto-restart |
| 14 | Cron job gagal | `src/app/api/cron/` | Expired PRO tidak downgrade | Cek cron log |

---

## 6. Change Guide

### 6.1 Aturan Emas

1. **Selalu baca file yang mau diubah dulu** — jangan langsung edit tanpa paham konteks
2. **Commit sering** — setiap perubahan kecil, jangan tunggu besar
3. **Test di lokal dulu** — `bun run lint` untuk cek error, jangan langsung push
4. **Jangan edit file `src/components/ui/`** — itu shadcn, pakai CLI untuk update
5. **Env variables** — jangan commit `.env`, pakai `.env.example` untuk dokumentasi
6. **Jangan hapus `proxy.ts`** — itu middleware utama, bukan file sampah

### 6.2 Cara Aman Mengubah Setiap Bagian

#### A. Menambah Halaman Baru

```
1. Buat src/app/nama-halaman/page.tsx
2. Kalo halaman protected (butuh login):
   - Tidak perlu ubah proxy.ts (otomatis ke-protect kalo path di /dashboard/*)
   - Kalo path custom, tambah ke protectedPaths di proxy.ts
3. Kalo halaman publik:
   - Tambah path ke PUBLIC_PATHS di proxy.ts
```

#### B. Menambah API Route Baru

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isUserPro } from '@/lib/pro-check'

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth(request)
  if (error) return error

  const pro = await isUserPro(user.id)
  if (!pro) {
    return NextResponse.json({ error: 'PRO_REQUIRED' }, { status: 403 })
  }
  // ... logic ...
  return NextResponse.json({ success: true })
}
```

#### C. Mengubah Database Schema

```
1. Buka Supabase Dashboard → SQL Editor
2. Jalankan ALTER TABLE / CREATE TABLE
3. Update TypeScript types di src/types/ kalau perlu
4. Test CRUD operations
```

#### D. Mengubah Tampilan Dashboard

```
1. Kalo ubah tab yang sudah ada → edit file di tabs/
2. Kalo tambah tab baru:
   a. Buat src/app/dashboard/tabs/NamaTab.tsx
   b. Tambah di menuItems di LuxTradeDashboard.tsx
3. Gunakan shadcn/ui components dari src/components/ui/
4. Responsif: selalu test di mobile (sm:), tablet (md:), desktop (lg:)
```

#### E. Mengubah Fitur AI

```
1. Utamakan edit di src/app/api/ai/route.ts
2. Test: jalankan di dev, cek log di dev.log
3. Pastikan fallback tetap kerja: coba matikan Gemini, pastikan respons fallback muncul
4. Jangan nested template literal (backtick dalam backtick)
```

#### F. Mengubah Sistem Pembayaran

```
1. Harga: edit src/lib/pricing.ts
2. Gateway logic: edit src/lib/payment/midtrans.ts
3. Webhook: edit src/app/api/midtrans/notification/route.ts
4. ⚠️ SELALU verifikasi signature di notification handler
5. Test dengan Midtrans sandbox dulu
```

#### G. Mengubah Auth System

```
1. Jangan ubah src/lib/api-auth.ts kecuali benar-benar perlu
2. Tambah admin: edit ADMIN_EMAILS di proxy.ts DAN auth-context.tsx
3. Ubah halaman auth: edit file di src/app/auth/
```

### 6.3 File JANGAN Pernah Dihapus

| File | Alasan |
|------|--------|
| `src/proxy.ts` | Middleware utama, tanpa ini semua halaman tidak protected |
| `src/app/api/ai/route.ts` | Semua fitur AI bergantung di sini |
| `src/lib/api-auth.ts` | Semua API route bergantung di sini |
| `src/lib/gemini.ts` | Gemini AI wrapper |
| `src/lib/pro-check.ts` | PRO check untuk semua fitur premium |
| `src/lib/auth-context.tsx` | Auth state management |
| `src/lib/supabase-admin-alt.ts` | Admin DB access |
| `.npmrc` | Prevent build ERESOLVE |

### 6.4 Komando yang Sering Dipakai

```bash
# Development
bun run dev              # Jalankan dev server (port 3000)
bun run lint             # Cek code quality

# Build & Deploy
git add . && git commit -m "pesan" && git push

# Mini Services
cd mini-services/affiliate-ws && bun run dev
```

---

## Appendix A: Env Variables

```env
# === WAJIB ===
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
RESEND_API_KEY=re_...

# === AI (untuk fitur AI) ===
GEMINI_API_KEY=...
OPENROUTER_API_KEY=...    # Fallback

# === Payment (Midtrans) ===
MIDTRANS_SERVER_KEY=SB-Mid-server-...
MIDTRANS_CLIENT_KEY=SB-Mid-client-...
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-...

# === Lainnya ===
NEXT_PUBLIC_APP_URL=https://luxtrade.id
NEXT_PUBLIC_SITE_URL=https://luxtrade.id
SENTRY_DSN=https://...
ADMIN_EMAILS=...
```

## Appendix B: Database Tables (Supabase)

| Tabel | Fungsi |
|-------|--------|
| profiles | Data user (plan, PRO status, streak, referral) |
| trades | Data trading (pair, P/L, waktu, dll) |
| journal_entries | Journal harian |
| trading_accounts | Akun broker |
| tags | Tag untuk trade/journal |
| weekly_goals | Target mingguan |
| watchlist_items | Pair yang di-watch |
| social_links | Link sosial media user |
| promo_codes | Kode promo |
| user_subscriptions | Riwayat subscription |
| affiliates | Data affiliate |
| affiliate_referrals | Referral tracking |
| affiliate_withdrawals | Tarikan komisi |
| withdrawals | Tarikan saldo |
| missions | Misi harian |
| bug_reports | Laporan bug |
| community_posts | Post komunitas |
| achievements / user_achievements | Sistem achievement |

## Appendix C: Stack Teknologi

| Teknologi | Versi | Fungsi |
|-----------|--------|--------|
| Next.js | 15 | Framework utama (App Router) |
| React | 19 | UI library |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4 | Styling |
| shadcn/ui | New York | Component library |
| Supabase | Latest | Auth + PostgreSQL + Storage |
| Zustand | 5 | Client state management |
| Gemini 2.5 Flash | - | AI (text + vision) |
| OpenRouter | - | AI fallback |
| Framer Motion | 12 | Animasi |
| Recharts | 2 | Charts |
| Resend | Latest | Email |
| Midtrans | - | Payment gateway |
| Socket.IO | - | Real-time affiliate |
| Sentry | 10 | Error monitoring |
| Lucide React | Latest | Icons |

---

> 📝 **Catatan:** Dokumen ini bersifat living document. Update setiap kali ada perubahan arsitektur yang signifikan.
