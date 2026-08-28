# 📘 LuxTrade — Handoff Document

> Dokumen panduan maintenance untuk developer baru. Ditulis bahasa Indonesia yang gampang dipahami.
> Terakhir diperbarui: Agustus 2025

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
│   │   │   └── utils/           # Types & helper functions
│   │   └── api/                 # ~120+ API routes
│   │       ├── auth/            # Auth routes (signup, login, verify, dll)
│   │       ├── ai/              # AI routes (analisis, chat, vision)
│   │       ├── trades/          # CRUD trades
│   │       ├── payment/         # Pembayaran (SakuraPay, Midtrans)
│   │       ├── midtrans/        # Midtrans gateway
│   │       ├── promo/           # Promo codes
│   │       ├── admin/           # Admin panel routes (~25 routes)
│   │       ├── cron/            # Scheduled jobs (reminder, summary)
│   │       └── ...              # Lainnya (journal, watchlist, goals, dll)
│   ├── components/              # Komponen reusable
│   │   ├── ui/                  # shadcn/ui components (JANGAN di-edit manual)
│   │   ├── landing/             # Komponen landing page (~30 file)
│   │   ├── effects/             # Animasi background
│   │   └── ...                  # Lainnya (payment, achievement, trading)
│   ├── lib/                     # Utility & helper functions
│   │   ├── api-auth.ts          # ⭐ Auth helper (requireAuth)
│   │   ├── pro-check.ts         # ⭐ Cek PRO status
│   │   ├── zai.ts               # ⭐ ZAI SDK wrapper (AI)
│   │   ├── db.ts                # Prisma client
│   │   ├── auth-context.tsx     # AuthProvider (client-side)
│   │   ├── supabase/            # Supabase clients (browser, server, admin)
│   │   ├── payment/             # Payment gateway helpers
│   │   ├── rate-limit.ts        # Rate limiting
│   │   ├── email.ts             # Resend email helper
│   │   └── ...                  # Lainnya
│   ├── store/                   # Zustand stores
│   │   ├── useUserStore.ts      # User state
│   │   ├── useLayoutStore.ts    # Layout state (tab aktif, bahasa, tema)
│   │   └── useTradeStore.ts     # Trade cache & filter
│   ├── contexts/                # React contexts
│   │   └── LanguageContext.tsx   # i18n (Indonesia/English)
│   └── types/                   # TypeScript type definitions
├── prisma/
│   ├── schema.prisma            # ⭐ Database schema (PostgreSQL)
│   └── migrations/              # Migration files
├── mini-services/               # Service terpisah (port berbeda)
│   ├── ollama-service/          # Port 3031 — Ollama Vision API
│   ├── zai-vision-service/      # Port 3010 — ZAI Vision handler
│   └── affiliate-ws/            # Port 3004 — WebSocket affiliate
├── public/                      # Static assets
├── next.config.ts               # Next.js config
├── Caddyfile                    # Reverse proxy config
└── package.json                 # Dependencies
```

### 1.2 File Paling Penting

| File | Fungsi | Frekuensi Diubah |
|------|--------|------------------|
| `src/app/dashboard/LuxTradeDashboard.tsx` | Otomatisasi utama dashboard, handler AI, state management | Tinggi |
| `src/app/api/ai/route.ts` | Semua fitur AI (5 tipe: tips, insight, analisis, chart, chat) | Tinggi |
| `src/proxy.ts` | Auth guard & admin check (pengganti middleware) | Rendah |
| `src/lib/api-auth.ts` | requireAuth() — dipakai hampir semua API route | Rendah |
| `src/lib/pro-check.ts` | isUserPro() — cek status PRO | Rendah |
| `src/lib/zai.ts` | ZAI SDK wrapper | Rendah |
| `src/lib/auth-context.tsx` | Client auth state, streak, auto-expiry | Sedang |
| `prisma/schema.prisma` | Database schema | Rendah |
| `src/store/useLayoutStore.ts` | Tab aktif, bahasa, tema | Sedang |
| `src/store/useTradeStore.ts` | Trade cache & filter di client | Sedang |

### 1.3 File untuk Setiap Fitur

#### Landing Page
| File | Fungsi |
|------|--------|
| `src/app/page.tsx` | Render landing page |
| `src/components/landing/HeroSection.tsx` | Hero banner utama |
| `src/components/landing/LandingNavbar.tsx` | Navigasi atas |
| `src/components/landing/FeaturesSection.tsx` | Fitur-fitur app |
| `src/components/landing/PricingSection.tsx` | Harga & paket |
| `src/components/landing/FAQSection.tsx` | FAQ |
| `src/components/landing/TestimonialSection.tsx` | Testimoni pengguna |

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
| `src/lib/payment/sakura.ts` | ⭐ SakuraPay gateway (primary) |
| `src/lib/payment/midtrans.ts` | Midtrans gateway (secondary) |
| `src/lib/payment/doku.ts` | DOKU gateway (tertiary) |
| `src/lib/pricing.ts` | Konstanta harga (PRO_30_DAYS=39K, dll) |
| `src/app/api/payment/create-order/route.ts` | Buat order pembayaran |
| `src/app/api/payment/callback/route.ts` | Callback pembayaran |

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
    │                                                ├── db.trade.findMany() ──► PostgreSQL via Prisma
    │                                                │
    │                                                └── createZAI() ────────► ZAI AI Service
    │
    ◄────────── JSON Response ─────────────────────┘
```

### 2.2 Alur Tambah Trade

```
1. User isi form di TradeForm.tsx
2. LuxTradeDashboard.tsx → handleAddTrade()
3. POST /api/trades → requireAuth() → db.trade.create()
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
   e. askZAI(systemPrompt, userPrompt) → panggil ZAI glm-4.6
   f. Kalo ZAI gagal → buildSmartPerformanceFallback(data, lang) → respons data-driven
7. Response ke AITab.tsx → tampilkan di UI
```

**File terkait:**
- `src/app/dashboard/tabs/AITab.tsx` — UI AI tab
- `src/app/dashboard/LuxTradeDashboard.tsx` — Handler (handleGetTips, handleGetMarket, dll)
- `src/app/api/ai/route.ts` — ⭐ Endpoint utama AI
- `src/lib/zai.ts` — ZAI SDK wrapper
- `src/lib/pro-check.ts` — Cek PRO
- `src/lib/rate-limit.ts` — Rate limiting

### 2.4 Alur Pembayaran

```
1. User pilih paket di UpgradeFormClient.tsx
2. POST /api/payment/create-order { plan, durationMonths, paymentMethod }
3. API:
   a. requireAuth()
   b. Buat PaymentOrder di database
   c. Panggil SakuraPay API → dapat payment URL
   d. Return payment URL ke user
5. User bayar di payment gateway
6. Gateway callback → POST /api/payment/callback
7. Callback verifikasi signature → update PaymentOrder status → activate PRO
8. Cron job harian cek subscription yang expired → downgrade
```

**File terkait:**
- `src/app/upgrade/page.tsx` + `UpgradeFormClient.tsx` — UI upgrade
- `src/app/api/payment/create-order/route.ts` — Buat order
- `src/app/api/payment/callback/route.ts` — Callback
- `src/lib/payment/sakura.ts` — SakuraPay integration
- `src/lib/pricing.ts` — Harga paket
- `src/app/api/cron/downgrade-expired-pro/route.ts` — Cron downgrade

### 2.5 Alur Auth (Client-side)

```
1. User login di /auth/login
2. supabase.auth.signInWithPassword() (dari auth-context.tsx)
3. AuthProvider update state: user, profile, isPro
4. Cek login streak → update streak
5. Cek achievement → tampilkan notifikasi
6. Redirect ke /dashboard
```

**File terkait:**
- `src/lib/auth-context.tsx` — AuthProvider
- `src/app/auth/login/page.tsx` — Login page
- `src/app/auth/signup/page.tsx` — Signup page
- `src/app/api/auth/signup/route.ts` — Signup API
- `src/lib/supabase/client.ts` — Browser Supabase client

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
3. Raw SQL → INSERT INTO profiles (id, email, full_name, ...) 
   ⚠️ Pakai raw SQL, BUKAN Prisma (biar @updatedAt tidak di-set manual)
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
2. Bearer token (fallback Vercel) — kalo cookie gagal

### 3.3 File Auth — Ringkasan

| File | Fungsi | Risiko | Cara Aman Mengubah |
|------|--------|--------|-------------------|
| `src/proxy.ts` | Guard halaman, admin check | Salah config → semua user bisa akses / admin tidak bisa masuk | Tambah path baru di `PUBLIC_PATHS` atau `protectedPaths`. Jangan hapus admin email. |
| `src/lib/api-auth.ts` | `requireAuth()` untuk API | Ubah logic → semua API bisa bocor | Tambah validasi baru setelah `requireAuth()`, jangan ubah `getAuthUser()` |
| `src/lib/auth-context.tsx` | AuthProvider client | Bug → user tidak terdeteksi login | Hanya tambah state baru, jangan ubah `SIGNED_IN`/`SIGNED_OUT` handler |
| `src/lib/supabase/admin.ts` | Supabase admin client | Bocor → akses penuh ke database | Jangan expose ke client, hanya server-side |
| `src/lib/supabase-admin-alt.ts` | Admin client untuk `isUserPro()` | Sama seperti atas | Jangan diubah kecuali ganti cara cek PRO |
| `src/app/api/auth/signup/route.ts` | Registrasi | Bug → user tidak bisa daftar | Test signup setelah perubahan |

### 3.4 Admin Detection

Admin **TIDAK** ada di database. Dihardcode:

```typescript
// Di proxy.ts:
const ADMIN_EMAILS = ['luxtradee@gmail.com', 'riskiakbarp123@gmail.com']

// Di auth-context.tsx:
const ADMIN_IDS = ['8f7fe295-...']  // truncated
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
                             │  ~911 baris              │
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
                             │  5. askZAI() → fallback  │
                             └────────┬────────────────┘
                                      │
                          ┌───────────┴───────────┐
                          │                       │
                    askZAI()              askZAIVision()
                    (text only)            (gambar + text)
                          │                       │
                    ┌─────┴─────┐               │
                    │  ZAI SDK  │               │
                    │  glm-4.6  │               │
                    └─────┬─────┘               │
                          │                       │
                    Kalo gagal → Smart Fallback (data-driven, bukan template)
```

### 4.2 File AI — Detail

#### `src/lib/zai.ts` — ZAI SDK Wrapper

**Fungsi:** Inisialisasi client ZAI untuk panggil AI.

```typescript
import { createZAI } from '@/lib/zai'
const zai = await createZAI()
// zai.chat.completions.create()    → text generation
// zai.chat.completions.createVision() → image analysis
```

**Konfigurasi dari env:**
- `ZAI_BASE_URL`
- `ZAI_API_KEY`
- `ZAI_CHAT_ID`
- `ZAI_TOKEN`
- `ZAI_USER_ID`

**Atau dari file:** `.z-ai-config` (fallback kalau env kosong)

**⚠️ Penting:**
- Role system prompt harus `'assistant'` (BUKAN `'system'` — ini khusus ZAI SDK)
- Wajib `thinking: { type: 'disabled' }` di setiap request
- Vision timeout dipatch ke 120 detik

#### `src/app/api/ai/route.ts` — Endpoint Utama AI

**5 tipe request:**

| Type | Fungsi | Butuh Data | Butuh Vision |
|------|--------|-----------|-------------|
| `performance_tips` | Tips performa trading | trades, analytics (winRate, sessionPerformance, dll) | ❌ |
| `market_insight` | Insight pasar berdasarkan sesi | trades (untuk konteks), sesi saat ini | ❌ |
| `trade_analysis` | Analisis mendalam 1 trade | selectedTrade, recentTrades | ❌ |
| `chart_analysis` | Analisis chart dari gambar | imageBase64 | ✅ |
| `chat` | Chat bebas dengan konteks trading | message, trades, analytics | ❌ |

**Rate limit:** 20 request per user per menit (in-memory, reset otomatis)

**Smart Fallback:** Kalo ZAI gagal (timeout, error, dll), system **TIDAK** return error. Malah generate respons data-driven dari statistik user:
- `buildSmartPerformanceFallback()` — analisis win rate, risk-reward, EV, streak
- `buildSmartMarketFallback()` — insight berdasarkan sesi trading
- `buildSmartTradeFallback()` — analisis trade spesifik
- `buildSmartChatFallback()` — jawaban chat dengan konteks data

**Prompt bilingual:** Semua system prompt ada versi Indonesia (`lang: 'id'`) dan English (`lang: 'en'`). Default: Indonesia.

#### `src/app/dashboard/tabs/AITab.tsx` — UI AI

**Fitur:**
- 4 tombol utama: Performance Tips, Market Insights, Analyze Trade, Analyze Chart
- Chat interface dengan message bubbles
- Upload gambar chart untuk analisis
- Paywall untuk user gratis (tombol ke halaman upgrade)
- Minimum 5 trade untuk Performance Tips

#### File AI Lainnya (TIDAK dipakai dashboard)

| File | Fungsi | Status |
|------|--------|--------|
| `src/app/api/ai/chat/route.ts` | Chat standalone | ⚠️ Tidak dipakai dashboard |
| `src/app/api/ai/analyze-trade/route.ts` | Analisis trade standalone | ⚠️ Tidak dipakai dashboard |
| `src/app/api/ai/search/route.ts` | AI journal search | Fitur terpisah |
| `src/app/api/ai/generate-image/route.ts` | Generate gambar AI | Fitur terpisah |
| `src/app/api/ai/tts/route.ts` | Text-to-speech | Fitur terpisah |
| `src/app/api/ai/vlm/route.ts` | Vision Language Model | Fitur terpisah |
| `src/app/analyze-screenshot/route.ts` | Analisis screenshot | Fitur terpisah |

### 4.3 Cara Mengubah AI

#### Menambah Tipe AI Baru

1. Buka `src/app/api/ai/route.ts`
2. Tambah case di switch `type`:
```typescript
case 'nama_baru': {
  // 1. Validasi data
  // 2. Bangun prompt
  // 3. Panggil askZAI()
  // 4. Fallback kalau gagal
  break
}
```
3. Tambah handler di `LuxTradeDashboard.tsx`
4. Tambah tombol di `AITab.tsx`

#### Mengubah Model AI

1. Buka `src/app/api/ai/route.ts`
2. Cari `model: 'glm-4.6'`
3. Ganti dengan model lain yang didukung ZAI
4. Test: pastikan respons sesuai format yang diharapkan

#### Mengubah System Prompt

1. Setiap tipe punya prompt builder sendiri (misal `buildPerformancePrompt()`)
2. Prompt ada 2 versi: Indonesia dan English
3. Ubah di fungsi builder-nya, JANGAN di `askZAI()`

#### Menambah Fallback

1. Buat fungsi `buildSmartXxxFallback(data, lang)`
2. Return string yang informatif berdasarkan data user
3. Panggil di catch/when ZAI returns null

### 4.4 Risiko AI & Cara Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| ZAI down/error | AI tidak bisa dipanggil | Smart fallback sudah handle → user tetap dapat respons |
| Rate limit terlalu ketat | User PRO tidak bisa pakai AI | Naikkan `AI_RATE_LIMIT` (baris 8) |
| Prompt bocor/jelek | AI kasih respons tidak relevan | Test prompt di z-ai-web-dev-sdk CLI dulu |
| File route.ts hilang/corrupt | SEMUA fitur AI mati | Selalu backup sebelum edit. Jangan rename ke `.bak` tanpa pengganti. |
| Vision timeout | Chart analysis gagal | Timeout sudah 120s. Kalo masih sering gagal, kompres gambar dulu. |
| Role salah ('system' vs 'assistant') | ZAI error | WAJIB pakai `role: 'assistant'` untuk system prompt |
| Nested template literal error | Build gagal | Jangan nested backticks. Extract ke variabel dulu. |

### 4.5 Env Variables untuk AI

```env
# ZAI (WAJIB untuk fitur AI)
ZAI_BASE_URL=https://...
ZAI_API_KEY=...
ZAI_CHAT_ID=...
ZAI_TOKEN=...
ZAI_USER_ID=...

# Vision AI opsional (untuk screenshot analysis)
OPENAI_API_KEY=...          # OpenAI vision
HUGGING_FACE_API_TOKEN=...  # HuggingFace (gratis)
```

---

## 5. Risk Map

### 5.1 Risiko Kritis 🔴

| # | Risiko | File Terkait | Dampak | Mitigasi |
|---|--------|-------------|--------|----------|
| 1 | `proxy.ts` dihapus/diubah salah | `src/proxy.ts` | Dashboard bisa diakses tanpa login, admin bisa diakses siapa saja | Selalu test akses /dashboard dan /dashboard/admin setelah edit |
| 2 | `/api/ai/route.ts` hilang/corrupt | `src/app/api/ai/route.ts` | SEMUA 5 fitur AI mati tanpa error yang jelas | Jangan rename ke `.bak` tanpa pengganti. Commit sering. |
| 3 | Supabase service role key bocor | `.env`, `src/lib/supabase/admin.ts` | Akses penuh ke database, bisa delete semua data | Jangan commit .env. Key hanya di server. |
| 4 | Payment callback tidak verifikasi signature | `src/app/api/payment/callback/route.ts` | Orang bisa activate PRO gratis | Selalu verifikasi signature dari gateway |
| 5 | Admin email hardcoded | `proxy.ts`, `auth-context.tsx` | Tambah admin harus edit 2 tempat | Pertimbangkan pindah ke database `

### 5.2 Risiko Tinggi 🟠

| # | Risiko | File Terkait | Dampak | Mitigasi |
|---|--------|-------------|--------|----------|
| 6 | `requireAuth()` bypass | `src/lib/api-auth.ts` | API bisa diakses tanpa login | Jangan ubah logic `getAuthUser()` |
| 7 | `isUserPro()` salah return | `src/lib/pro-check.ts` | User gratis akses fitur PRO, atau user PRO diblokir | Cek `profiles.is_pro` + `subscription_until` di database |
| 8 | ZAI SDK update breaking change | `z-ai-web-dev-sdk`, `src/lib/zai.ts` | Semua AI mati | Lock version di package.json, test sebelum update |
| 9 | Prisma schema migration gagal | `prisma/schema.prisma` | Database tidak sinkron, app crash | Selalu backup DB sebelum migration, test di dev dulu |
| 10 | Rate limit tidak ada di API publik | Semua `/api/` routes | DDoS, brute force | Tambah `rate-limit.ts` ke route yang rawan |

### 5.3 Risiko Sedang 🟡

| # | Risiko | File Terkait | Dampak | Mitigasi |
|---|--------|-------------|--------|----------|
| 11 | Trade cache di Zustand tidak sync | `useTradeStore.ts` | Data stale di UI | Invalidate cache setelah CRUD |
| 12 | Language context tidak lengkap | `LanguageContext.tsx`, semua komponen | Teks campur Indonesia/English | Selalu tambah kedua bahasa |
| 13 | Mini-service (port 3031/3010/3004) mati | `mini-services/` | Vision/affiliate tidak kerja | Monitoring + auto-restart |
| 14 | Cron job gagal | `src/app/api/cron/` | Reminder tidak kirim, expired PRO tidak downgrade | Cek Vercel cron log |
| 15 | Sentry error tracking tidak konfigurasi | `sentry.*.config.ts` | Tidak tahu error di production | Pastikan SENTRY_DSN terisi |

### 5.4 Risiko Rendah 🟢

| # | Risiko | File Terkait | Dampak | Mitigasi |
|---|--------|-------------|--------|----------|
| 16 | Landing page responsif kurang | `src/components/landing/` | UX jelek di mobile | Test di multiple viewport |
| 17 | Tema dark/light inkonsisten | Tailwind classes | Tampilan aneh | Pakai `bg-primary`, `text-primary-foreground` |
| 18 | Shadcn component di-edit manual | `src/components/ui/` | Hilang saat update shadcn | Selalu gunakan CLI: `npx shadcn@latest add ...` |

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

**Risiko:** Lupa tambah ke proxy → halaman tidak bisa diakses atau sebaliknya.

#### B. Menambah API Route Baru

```
1. Buat src/app/api/nama-route/route.ts
2. Export GET/POST/PUT/DELETE sesuai kebutuhan
3. Tambah requireAuth() di awal handler kalo butuh auth
4. Tambah isUserPro() kalo fitur PRO only
5. Return NextResponse.json({ ... })
```

```typescript
// Contoh:
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

**Risiko:** Lupa requireAuth → API bisa diakses publik.

#### C. Mengubah Database Schema

```
1. Edit prisma/schema.prisma
2. Jalankan: bun run db:push   (untuk dev)
   ATAU: bun run db:migrate  (untuk production)
3. Update TypeScript types di src/types/ kalau perlu
4. Test CRUD operations
```

**Risiko:** Migration gagal → database stuck. Selalu backup dulu.

#### D. Mengubah Tampilan Dashboard

```
1. Kalo ubah tab yang sudah ada → edit file di tabs/
2. Kalo tambah tab baru:
   a. Buat src/app/dashboard/tabs/NamaTab.tsx
   b. Tambah di menuItems di LuxTradeDashboard.tsx
   c. Tambah lazy import di TabContent.tsx (kalau pakai dynamic import)
3. Gunakan shadcn/ui components dari src/components/ui/
4. Responsif: selalu test di mobile (sm:), tablet (md:), desktop (lg:)
```

**Risiko:** Tab tidak muncul → cek menuItems array. Import salah → tab kosong.

#### E. Mengubah Fitur AI

```
1. Baca section 4 (Ngoprek AI) di dokumen ini
2. Utamakan edit di src/app/api/ai/route.ts
3. Test prompt: jalankan di dev, cek log di dev.log
4. Pastikan fallback tetap kerja: coba matikan ZAI, pastikan respons fallback muncul
5. Jangan ubah role dari 'assistant' ke 'system'
6. Jangan nested template literal (backtick dalam backtick)
```

**Risiko:** Salah edit → semua AI mati. Selalu test semua 5 tipe.

#### F. Mengubah Sistem Pembayaran

```
1. Harga: edit src/lib/pricing.ts
2. Gateway logic: edit src/lib/payment/sakura.ts atau midtrans.ts
3. Callback: edit src/app/api/payment/callback/route.ts
4. ⚠️ SELALU verifikasi signature di callback
5. Test dengan payment gateway sandbox dulu
```

**Risiko:** Salah verifikasi → orang bisa bayar palsu. Sangat berbahaya.

#### G. Mengubah Auth System

```
1. Jangan ubah src/lib/api-auth.ts kecuali benar-benar perlu
2. Tambah admin: edit ADMIN_EMAILS di proxy.ts DAN auth-context.tsx
3. Ubah halaman auth: edit file di src/app/auth/
4. Signup flow: hati-hati dengan raw SQL di signup route
```

**Risiko:** Salah ubah → tidak ada yang bisa login/signup.

#### H. Deploy ke Vercel

```
1. Push ke main branch → auto deploy
2. Cek Vercel build log
3. Pastikan env variables terisi di Vercel dashboard
4. Kalo error ERESOLVE: pastikan tidak ada package-lock.json (kita pakai bun)
5. Kalo error middleware.js.nft.json: ini bug Next.js 16, coba re-deploy
```

### 6.3 Checklist Sebelum Deploy

- [ ] `bun run lint` pass tanpa error
- [ ] Semua env variables ada di Vercel
- [ ] Tidak ada `console.log` yang sisa (boleh `console.warn`/`console.error`)
- [ ] File `.env` tidak ter-commit
- [ ] `package-lock.json` tidak ada (kita pakai bun.lock)
- [ ] Test fitur utama: login, tambah trade, AI, pembayaran
- [ ] Cek proxy.ts: path baru sudah terdaftar

### 6.4 Komando yang Sering Dipakai

```bash
# Development
bun run dev              # Jalankan dev server (port 3000)
bun run lint             # Cek code quality

# Database
bun run db:push         # Push schema ke database (dev)
bun run db:migrate      # Migration dengan file (production)
bun run db:generate     # Generate Prisma client

# Build & Deploy
git add . && git commit -m "pesan" && git push  # Push ke GitHub → auto deploy Vercel

# Mini Services
bun run dev             # Di folder mini-service masing-masing
```

### 6.5 File JANGAN Pernah Dihapus

| File | Alasan |
|------|--------|
| `src/proxy.ts` | Middleware utama, tanpa ini semua halaman tidak protected |
| `src/app/api/ai/route.ts` | Semua fitur AI bergantung di sini |
| `src/lib/api-auth.ts` | Semua API route bergantung di sini |
| `src/lib/zai.ts` | AI SDK wrapper |
| `src/lib/pro-check.ts` | PRO check untuk semua fitur premium |
| `src/lib/auth-context.tsx` | Auth state management |
| `prisma/schema.prisma` | Database schema |
| `src/lib/supabase/admin.ts` | Admin DB access |
| `.npmrc` | Prevent Vercel build ERESOLVE |

---

## Appendix A: Env Variables Lengkap

```env
# === WAJIB ===
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://...
RESEND_API_KEY=re_...
RESEND_TEMPLATE_CONFIRM=template_xxx
RESEND_TEMPLATE_RESET=template_xxx

# === AI (untuk fitur AI) ===
ZAI_BASE_URL=https://...
ZAI_API_KEY=...
ZAI_CHAT_ID=...
ZAI_TOKEN=...
ZAI_USER_ID=...

# === Vision AI (opsional) ===
OPENAI_API_KEY=sk-...
HUGGING_FACE_API_TOKEN=hf_...

# === Payment (opsional, tergantung gateway) ===
MIDTRANS_SERVER_KEY=SB-Mid-server-...
MIDTRANS_CLIENT_KEY=SB-Mid-client-...
SAKURA_API_ID=...
SAKURA_API_KEY=...
DOKU_CLIENT_ID=...
DOKU_SECRET_KEY=...

# === Lainnya ===
NEXT_PUBLIC_APP_URL=https://luxtrade.vercel.app
NEXT_PUBLIC_SITE_URL=https://luxtrade.vercel.app
SENTRY_DSN=https://...
METAAPI_TOKEN=...
```

## Appendix B: Database Models

| Model | Tabel | Fungsi |
|-------|-------|--------|
| Profile | profiles | Data user (plan, PRO status, streak, referral) |
| User | users | Auth user (dari Supabase) |
| UserSubscription | user_subscriptions | Riwayat subscription |
| Trade | trades | Data trading (pair, P/L, waktu, dll) |
| JournalEntry | journal_entries | Journal harian |
| TradingAccount | trading_accounts | Akun broker |
| Tag | tags | Tag untuk trade/journal |
| WeeklyGoal | weekly_goals | Target mingguan |
| WatchlistItem | watchlist_items | Pair yang di-watch |
| SocialLink | social_links | Link sosial media user |
| PromoCode | promo_codes | Kode promo |
| PaymentOrder | payment_orders | Riwayat pembayaran |
| BugReport | bug_reports | Laporan bug |
| Affiliate | affiliates | Data affiliate |
| AffiliateReferral | affiliate_referrals | Referral tracking |
| AffiliateWithdrawal | affiliate_withdrawals | Tarikan komisi |

## Appendix C: Warna & Tema

| Elemen | Warna | Tailwind Class |
|--------|-------|---------------|
| Primary | #2563eb (blue) | `bg-primary`, `text-primary` |
| Primary Light | #3b82f6 (blue-500) | `bg-blue-500` |
| Accent | #06b6d4 (cyan) | `bg-cyan-500` |
| Success | #10b981 (emerald) | `bg-emerald-500` |
| Danger | #ef4444 (red) | `bg-red-500` |
| Warning | #f59e0b (amber) | `bg-amber-500` |
| Background | White (light) / Dark (dark) | `bg-background` |

> ⚠️ **Jangan pakai indigo atau ungu** kecuali user minta.

## Appendix D: Stack Teknologi

| Teknologi | Versi | Fungsi |
|-----------|--------|--------|
| Next.js | 16 | Framework utama (App Router) |
| React | 19 | UI library |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4 | Styling |
| shadcn/ui | New York | Component library |
| Prisma | 6 | ORM |
| Supabase | Latest | Auth + Database hosting |
| Zustand | 5 | Client state management |
| TanStack Query | 5 | Server state |
| z-ai-web-dev-sdk | 0.0.17 | AI (ZAI) |
| Framer Motion | 12 | Animasi |
| Recharts | 2 | Charts |
| Resend | Latest | Email |
| SakuraPay | - | Payment gateway (primary) |
| Midtrans | - | Payment gateway (secondary) |
| Sentry | 10 | Error monitoring |
| Lucide React | Latest | Icons |

---

> 📝 **Catatan:** Dokumen ini bersifat living document. Update setiap kali ada perubahan arsitektur yang signifikan.
