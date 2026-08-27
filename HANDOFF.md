# LuxTrade — Handoff Document

## 1. Gambaran Besar Aplikasi

**LuxTrade** adalah platform jurnal trading forex khusus untuk trader Indonesia. Dengan LuxTrade, user bisa mencatat setiap trade mereka, lalu AI akan menganalisis performa trading secara otomatis.

### Tech Stack

| Teknologi | Fungsi |
|-----------|--------|
| Next.js 16 | Framework utama (App Router) |
| React 19 | UI library |
| TypeScript | Bahasa pemrograman |
| Tailwind CSS 4 | Styling |
| shadcn/ui | Komponen UI (New York style) |
| Prisma 6 | ORM untuk database |
| Supabase | Auth (email/password) + PostgreSQL |
| Zustand | State management client-side |
| z-ai-web-dev-sdk | AI/LLM integration |
| Resend | Email service |

### Arsitektur Aplikasi

```
Landing Page (/) 
  → Auth (signup/login via Supabase)
    → Dashboard SPA (/dashboard) dengan 13+ tab lazy-loaded
      → Tabs: Dashboard, Trades, Calendar, Journal, Watchlist, News,
         Economic Calendar, Achievements, Risk Calculator, Market Heatmap,
         Analytics, Targets, AI Insights, Trading Score, Weekly Report,
         Streaks, Psychology Tracking, User Guide
```

### Payment Gateway

- **SakuraPay** — gateway utama (QRIS, Virtual Account, E-Wallet)
- **Midtrans** — gateway cadangan
- **DOKU** — gateway legacy
- **Transfer Bank Manual** — opsi manual

### Pricing

| Plan | Harga | Batasan |
|------|-------|---------|
| FREE | Rp0 | Maks 50 trade, fitur dasar |
| PRO 30 hari | Rp39.000 | Semua fitur, 30 hari |
| Annual | Rp390.000 | Semua fitur, 1 tahun |
| Lifetime | Rp299.000 | Semua fitur, selamanya |

---

## 2. File Map

### 2.1 Struktur Folder

```
src/
├── app/
│   ├── page.tsx                    # Landing page (publik)
│   ├── layout.tsx                  # Root layout (font, metadata, providers)
│   ├── globals.css                 # CSS variables, tema warna, custom styles
│   ├── dashboard/
│   │   ├── page.tsx                # Wrapper halaman dashboard
│   │   ├── LuxTradeDashboard.tsx   # ★ KOMPOLEN UTAMA dashboard (~900 baris)
│   │   ├── tabs/                   # Semua tab dashboard (lazy-loaded)
│   │   │   ├── DashboardTab.tsx
│   │   │   ├── TradesTab.tsx
│   │   │   ├── CalendarTab.tsx
│   │   │   ├── JournalTab.tsx
│   │   │   ├── WatchlistTab.tsx
│   │   │   ├── NewsTab.tsx
│   │   │   ├── EconomicCalendarTab.tsx
│   │   │   ├── AchievementsTab.tsx
│   │   │   ├── RiskCalculatorTab.tsx
│   │   │   ├── MarketHeatmapTab.tsx
│   │   │   ├── AnalyticsTab.tsx
│   │   │   ├── TargetsTab.tsx
│   │   │   ├── AITab.tsx
│   │   │   ├── TradingScoreTab.tsx
│   │   │   ├── WeeklyReportTab.tsx
│   │   │   ├── StreaksTab.tsx
│   │   │   ├── PsychologyTab.tsx
│   │   │   └── UserGuideTab.tsx
│   │   ├── components/             # Komponen UI dashboard
│   │   │   ├── TabContent.tsx      # Router untuk tab (dynamic imports)
│   │   │   ├── TradeForm.tsx       # Form tambah/edit trade
│   │   │   ├── TradeTable.tsx      # Tabel daftar trade
│   │   │   ├── AIPanel.tsx         # Panel AI analysis
│   │   │   ├── Sidebar.tsx         # Sidebar navigasi
│   │   │   └── ...
│   │   ├── handlers/               # Logic handlers (di-extract dari Dashboard)
│   │   │   ├── tradeHandlers.ts
│   │   │   ├── aiHandlers.ts
│   │   │   └── ...
│   │   └── utils/                  # Utility functions dashboard
│   ├── auth/
│   │   ├── signup/page.tsx         # Halaman signup
│   │   ├── login/page.tsx          # Halaman login
│   │   ├── verify/page.tsx         # Verifikasi email
│   │   └── forgot-password/page.tsx
│   ├── admin/                      # Halaman admin (protected)
│   │   └── page.tsx
│   ├── pricing/                    # Halaman pricing
│   │   └── page.tsx
│   └── api/                        # Semua API routes
│       ├── auth/                   # Auth endpoints
│       ├── trades/                 # CRUD trades
│       ├── journal/                # Journal entries
│       ├── ai/                     # AI endpoints (router utama)
│       ├── payment/                # SakuraPay
│       ├── midtrans/               # Midtrans
│       ├── admin/                  # Admin endpoints
│       ├── cron/                   # Scheduled tasks
│       ├── affiliate/              # Referral system
│       ├── promo/                  # Promo codes
│       ├── trading-accounts/       # Akun trading
│       └── ...
├── components/
│   ├── ui/                         # shadcn/ui components (Button, Card, Dialog, dll)
│   ├── landing/                    # Komponen landing page
│   └── shared/                     # Komponen bersama (Header, Footer, dll)
├── lib/
│   ├── db.ts                       # Prisma database singleton
│   ├── api-auth.ts                 # requireAuth() untuk API routes
│   ├── admin-auth.ts               # requireAdmin() dengan 3-tier check
│   ├── pro-check.ts                # isUserPro() checker
│   ├── rate-limit.ts               # In-memory rate limiter
│   ├── pricing.ts                  # Konstanta harga + formatRupiah()
│   ├── subscription.ts             # isProUser(), getProDaysRemaining()
│   ├── email.ts                    # Resend wrapper + 2000+ baris templates
│   ├── zai.ts                      # ZAI SDK wrapper (createZAI)
│   ├── zai-vision.ts               # VLM (Vision Language Model) integration
│   ├── tradeCalculations.ts        # Kalkulasi P/L, pip math
│   ├── utils.ts                    # cn() function (clsx + tailwind-merge)
│   ├── pdf-export.ts               # PDF generation
│   ├── achievement-checker.ts      # Logic cek achievement
│   ├── achievements-data.ts        # Definisi semua achievement
│   ├── auth-context.tsx            # AuthContext provider (useAuth)
│   ├── language-context.tsx        # LanguageContext provider (useLanguage, t)
│   └── supabase/
│       ├── client.ts               # Supabase client (browser)
│       └── server.ts               # Supabase server client (API routes)
├── stores/
│   ├── userStore.ts                # useUserStore (auth, trade count, free limit)
│   ├── tradeStore.ts               # useTradeStore (filters, sort, computed stats)
│   └── layoutStore.ts              # useLayoutStore (sidebar, language, theme)
└── types/
    └── index.ts                    # TypeScript type definitions

prisma/
├── schema.prisma                   # Database schema (15 models)
└── ...

public/
├── images/                         # Static images
└── ...
```

### 2.2 File Terpenting (Must-Know)

| # | File | Kenapa Penting |
|---|------|----------------|
| 1 | `src/app/dashboard/LuxTradeDashboard.tsx` | Komponen utama dashboard — semua state, handler, dan data fetching ada di sini (~900 baris) |
| 2 | `src/app/api/ai/route.ts` | Router utama AI — handle semua request AI (performa, chat, chart, market) |
| 3 | `src/lib/api-auth.ts` | Auth guard untuk API routes — dipakai di hampir semua endpoint |
| 4 | `src/lib/auth-context.tsx` | Auth provider — `useAuth()` dipakai di seluruh client components |
| 5 | `prisma/schema.prisma` | Database schema — semua model dan relasi didefinisikan di sini |
| 6 | `src/lib/zai.ts` | ZAI SDK wrapper — cara app berkomunikasi dengan AI |
| 7 | `src/lib/pricing.ts` | Konstanta harga dan formatRupiah — dipakai di payment dan UI |
| 8 | `src/app/api/payment/callback.ts` | Payment callback — verifikasi pembayaran SakuraPay |
| 9 | `src/lib/email.ts` | Email service — semua email (verifikasi, reminder, dll) |
| 10 | `src/stores/userStore.ts` | User state — auth, trade count, free limit check |

### 2.3 API Routes

#### Core

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/trades` | GET, POST, PUT, DELETE | CRUD trade |
| `/api/journal` | GET, POST, PUT, DELETE | CRUD journal entry |
| `/api/watchlist` | GET, POST, PUT, DELETE | CRUD watchlist |
| `/api/goals` | GET, POST, PUT, DELETE | CRUD weekly goals |
| `/api/tags` | GET, POST, DELETE | CRUD tags |
| `/api/todos` | GET, POST, PUT, DELETE | CRUD todos |
| `/api/analytic-screenshot` | POST | Upload screenshot analytics |
| `/api/screenshot-journal` | POST | Upload screenshot journal |
| `/api/auto-journal` | POST | Auto-generate journal dari trade |
| `/api/import` | POST | Import data trading |
| `/api/import/file` | POST | Import dari file |
| `/api/import/screenshot` | POST | Import dari screenshot (OCR) |

#### Auth

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/auth/signup` | POST | Daftar akun baru |
| `/api/auth/login` | POST | Login |
| `/api/auth/logout` | POST | Logout |
| `/api/auth/verify` | POST | Verifikasi email OTP |
| `/api/auth/forgot-password` | POST | Lupa password |
| `/api/auth/reset-password` | POST | Reset password |
| `/api/auth/resend-verification` | POST | Kirim ulang verifikasi |
| `/api/profile/me` | GET, PUT | Ambil/update profile |
| `/api/delete-account` | DELETE | Hapus akun user |

#### Payment

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/payment/create-order` | POST | Buat order pembayaran |
| `/api/payment/callback` | POST | Webhook SakuraPay |
| `/api/payment/check-status` | GET | Cek status pembayaran |
| `/api/midtrans/create-transaction` | POST | Buat transaksi Midtrans |
| `/api/midtrans/webhook` | POST | Webhook Midtrans |
| `/api/pricing` | GET | Ambil data pricing |

#### AI

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/ai` | POST | **★ ROUTER UTAMA** — handle semua type AI request dari dashboard |
| `/api/ai/chat` | POST | Chat terpisah (tidak dipakai dashboard) |
| `/api/ai/analyze-trade` | POST | Analisis trade terpisah (tidak dipakai dashboard) |
| `/api/ai/search` | POST | Pencarian AI |
| `/api/ai/vlm` | POST | Vision model terpisah |
| `/api/ai/tts` | POST | Text-to-speech |
| `/api/ai/generate-image` | POST | Generate gambar AI |

> **Penting:** Dashboard memakai `/api/ai` sebagai router utama. Route AI lainnya (`/api/ai/chat`, `/api/ai/vlm`, dll) adalah route terpisah dan **tidak** dipakai oleh dashboard saat ini.

#### Admin

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/admin/users` | GET | Daftar semua user |
| `/api/admin/users/[id]` | PUT, DELETE | Edit/hapus user |
| `/api/admin/stats` | GET | Statistik platform |
| `/api/admin/payments` | GET | Daftar pembayaran |
| `/api/admin/broadcast` | POST | Kirim email broadcast |
| `/api/admin/promo` | POST, PUT, DELETE | Kelola promo code |
| `/api/admin/affiliate` | GET | Data affiliate |

#### Cron (Scheduled Tasks)

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/cron/daily-reminder` | POST | Kirim reminder harian ke user aktif |
| `/api/cron/weekly-summary` | POST | Kirim ringkasan mingguan |
| `/api/cron/re-engage` | POST | Kirim email re-engagement ke user tidak aktif |
| `/api/cron/downgrade-expired-pro` | POST | Downgrade user PRO yang sudah expired |

#### Affiliate

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/affiliate/info` | GET | Info affiliate user |
| `/api/affiliate/referrals` | GET | Daftar referral |
| `/api/affiliate/withdraw` | POST | Request withdrawal komisi |

#### Promo

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/promo/validate` | POST | Validasi kode promo |
| `/api/promo/apply` | POST | Terapkan kode promo |

#### Trading Accounts

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/trading-accounts` | GET, POST, PUT, DELETE | CRUD akun trading |

#### Other

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/health` | GET | Health check |
| `/api/analytics` | GET | Data analytics user |
| `/api/news` | GET | Berita forex |
| `/api/news/calendar` | GET | Kalender ekonomi |
| `/api/forex` | GET | Data forex (rate, dll) |
| `/api/chart/klines` | GET | Data candlestick chart |
| `/api/equity-curve` | GET | Data equity curve |
| `/api/file-upload` | POST | Upload file umum |
| `/api/voice/transcribe` | POST | Transkripsi voice ke teks |

### 2.4 Dashboard Tabs (13+ tabs, lazy loaded via `next/dynamic`)

| # | Tab | File | Deskripsi |
|---|-----|------|-----------|
| 1 | Dashboard | `DashboardTab.tsx` | Ringkasan performa, statistik utama, equity curve |
| 2 | Trades | `TradesTab.tsx` | Daftar trade, filter, sort, CRUD |
| 3 | Calendar | `CalendarTab.tsx` | Kalender trade (timeline visual) |
| 4 | Journal | `JournalTab.tsx` | Jurnal trading (catatan harian) |
| 5 | Watchlist | `WatchlistTab.tsx` | Daftar pair yang di-watch |
| 6 | News | `NewsTab.tsx` | Berita forex terkini |
| 7 | Economic Calendar | `EconomicCalendarTab.tsx` | Jadwal event ekonomi |
| 8 | Achievements | `AchievementsTab.tsx` | Badge dan achievement yang sudah diraih |
| 9 | Risk Calculator | `RiskCalculatorTab.tsx` | Kalkulator risiko (position size, dll) |
| 10 | Market Heatmap | `MarketHeatmapTab.tsx` | Heatmap pergerakan mata uang |
| 11 | Analytics | `AnalyticsTab.tsx` | Analytics lanjutan (win rate per pair, per session, dll) |
| 12 | Targets | `TargetsTab.tsx` | Target trading mingguan |
| 13 | AI Insights | `AITab.tsx` | Analisis AI (performa, chat, chart analysis) |
| 14 | Trading Score | `TradingScoreTab.tsx` | Skor trading berdasarkan metrik |
| 15 | Weekly Report | `WeeklyReportTab.tsx` | Laporan mingguan otomatis |
| 16 | Streaks | `StreaksTab.tsx` | Streak menang/kalah |
| 17 | Psychology | `PsychologyTab.tsx` | Tracking psikologi trading |
| 18 | User Guide | `UserGuideTab.tsx` | Panduan penggunaan aplikasi |

> Semua tab di-load menggunakan `next/dynamic` dengan `ssr: false` supaya dashboard tidak berat saat pertama kali dibuka.

### 2.5 Database Models (Prisma, 15 models)

#### Profile
Model utama user.

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | String (UUID) | Primary key, sama dengan Supabase auth user ID |
| `email` | String | Email user |
| `full_name` | String | Nama lengkap |
| `plan` | Enum | FREE / PRO_30D / PRO_ANNUAL / LIFETIME |
| `is_pro` | Boolean | Flag apakah user sedang PRO |
| `proExpiry` / `subscription_until` | DateTime? | Tanggal expired PRO |
| `role` | Enum | USER / ADMIN |
| `achievements` | Json? | Daftar achievement yang sudah diraih |
| `referral_code` | String? | Kode referral unik user |
| `referred_by` | String? | Kode referral yang dipakai saat signup |
| `created_at` | DateTime | Waktu pembuatan akun |

#### Trade
Setiap transaksi yang dicatat user.

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | String (UUID) | Primary key |
| `userId` | String | FK ke Profile |
| `symbol` | String | Pair forex (contoh: EURUSD, GBPJPY) |
| `type` | Enum | BUY / SELL |
| `open_price` | Float | Harga buka |
| `close_price` | Float? | Harga tutup |
| `lot_size` | Float | Ukuran lot |
| `profit_loss` | Float? | P/L dalam mata uang akun |
| `open_time` | DateTime | Waktu buka |
| `close_time` | DateTime? | Waktu tutup |
| `session` | Enum? | Asia / London / New York / Overlap |
| `notes` | String? | Catatan trade |
| `image_url` | String? | Screenshot chart |
| `tags` | String? | Tags (comma-separated atau JSON) |
| `stop_loss` | Float? | Harga stop loss |
| `take_profit` | Float? | Harga take profit |
| `ticket_number` | String? | Nomor ticket dari broker |
| `risk_reward_ratio` | Float? | R:R ratio |

#### JournalEntry
Catatan jurnal trading harian.

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | String (UUID) | Primary key |
| `userId` | String | FK ke Profile |
| `title` | String | Judul jurnal |
| `content` | String | Isi jurnal (bisa panjang) |
| `mood` | Enum? | Mood saat trading (confident, anxious, calm, dll) |
| `market_condition` | String? | Kondisi market (trending, ranging, volatile) |
| `tags` | String? | Tags |
| `image_url` | String? | Gambar attachment |
| `created_at` | DateTime | Waktu pembuatan |

#### TradingAccount
Akun trading user (bisa punya banyak akun/broker).

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | String (UUID) | Primary key |
| `userId` | String | FK ke Profile |
| `name` | String | Nama akun (contoh: "Akun Utama") |
| `broker` | String | Nama broker |
| `account_type` | String | Tipe akun (Standard, Cent, ECN, dll) |
| `account_number` | String | Nomor akun |
| `balance` | Float? | Saldo |
| `leverage` | Int? | Leverage |
| `currency` | String | Mata uang (USD, IDR, dll) |

#### WatchlistItem
Item yang di-watch user.

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | String (UUID) | Primary key |
| `userId` | String | FK ke Profile |
| `symbol` | String | Pair forex |
| `name` | String | Nama pair |
| `target_price` | Float? | Harga target |
| `notes` | String? | Catatan |

#### Tag
Tags untuk trade dan journal.

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | String (UUID) | Primary key |
| `userId` | String | FK ke Profile |
| `name` | String | Nama tag |
| `color` | String | Warna tag (hex) |

#### WeeklyGoal
Target mingguan user.

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | String (UUID) | Primary key |
| `userId` | String | FK ke Profile |
| `week_start` | DateTime | Awal minggu |
| `targets` | Json? | Target-target yang ditetapkan |
| `current_progress` | Json? | Progress saat ini |

#### SocialLink
Link sosial media user (untuk leaderboard/community).

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | String (UUID) | Primary key |
| `userId` | String | FK ke Profile |
| `platform` | String | Platform (Instagram, Twitter, dll) |
| `url` | String | URL profil |
| `username` | String | Username |
| `status` | Enum | PENDING / APPROVED / REJECTED |

#### PromoCode
Kode promo untuk diskon.

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | String (UUID) | Primary key |
| `code` | String | Kode promo (unik) |
| `discount_percent` | Int | Persentase diskon |
| `max_quota` | Int | Kuota maksimal penggunaan |
| `used_quota` | Int | Kuota yang sudah dipakai |
| `valid_from` | DateTime | Mulai berlaku |
| `valid_until` | DateTime | Berakhir |
| `created_by` | String? | Admin yang membuat |

#### PaymentOrder
Riwayat pembayaran.

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | String (UUID) | Primary key |
| `userId` | String | FK ke Profile |
| `invoice_number` | String | Nomor invoice unik |
| `amount` | Float | Jumlah bayar |
| `plan` | Enum | Plan yang dibeli |
| `status` | Enum | PENDING / SUCCESS / FAILED / EXPIRED |
| `payment_url` | String? | URL payment gateway |
| `paid_at` | DateTime? | Waktu pembayaran |
| `gateway` | String? | Payment gateway yang dipakai |
| `promo_code` | String? | Kode promo yang dipakai |

#### BugReport
Laporan bug dari user.

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | String (UUID) | Primary key |
| `userId` | String | FK ke Profile |
| `title` | String | Judul bug |
| `description` | String | Deskripsi bug |
| `status` | Enum | OPEN / IN_PROGRESS / RESOLVED |

#### EmailBroadcast
Riwayat email broadcast dari admin.

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | String (UUID) | Primary key |
| `subject` | String | Subject email |
| `content` | String | Isi email |
| `sent_at` | DateTime | Waktu kirim |
| `sent_by` | String | Admin yang mengirim |
| `recipient_count` | Int | Jumlah penerima |

#### Affiliate & AffiliateReferral & AffiliateWithdrawal
Sistem referral/affiliate.

**Affiliate:**
| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | String (UUID) | Primary key |
| `userId` | String | FK ke Profile |
| `referral_code` | String | Kode referral unik |
| `total_earnings` | Float | Total komisi |
| `available_balance` | Float | Saldo yang bisa di-withdraw |

**AffiliateReferral:**
| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | String (UUID) | Primary key |
| `affiliate_id` | String | FK ke Affiliate |
| `referred_user_id` | String | FK ke Profile (user yang direferensikan) |
| `commission` | Float | Komisi dari referral ini |
| `status` | Enum | PENDING / CONFIRMED / PAID |

**AffiliateWithdrawal:**
| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | String (UUID) | Primary key |
| `affiliate_id` | String | FK ke Affiliate |
| `amount` | Float | Jumlah withdraw |
| `status` | Enum | PENDING / APPROVED / REJECTED / PAID |
| `bank_name` | String | Nama bank |
| `account_number` | String | Nomor rekening |

#### UserSubmission
Bukti submission untuk achievement.

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | String (UUID) | Primary key |
| `userId` | String | FK ke Profile |
| `achievement_id` | String | Achievement yang di-submit |
| `proof_url` | String? | URL bukti (screenshot) |
| `description` | String? | Deskripsi |
| `status` | Enum | PENDING / APPROVED / REJECTED |

#### MissionProgress
Progress misi/harian user.

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | String (UUID) | Primary key |
| `userId` | String | FK ke Profile |
| `mission_type` | String | Tipe misi |
| `progress` | Int | Progress saat ini |
| `target` | Int | Target misi |
| `completed` | Boolean | Sudah selesai atau belum |
| `completed_at` | DateTime? | Waktu selesai |

### 2.6 State Management

#### Zustand Stores

**`useUserStore`** — State terkait user dan autentikasi:

```typescript
// Yang disimpan:
{
  user: User | null,        // Data user dari Supabase auth
  profile: Profile | null,  // Data profile dari tabel profiles
  isPro: boolean,           // Apakah user sedang PRO
  tradeCount: number,       // Jumlah trade saat ini
  freeLimit: 50,            // Batas trade untuk FREE plan
  // Actions:
  setUser, setProfile, setTradeCount, reset
}
```

**`useTradeStore`** — State terkait trade dan filter:

```typescript
// Yang disimpan:
{
  filters: {
    symbol: string,
    type: 'ALL' | 'BUY' | 'SELL',
    session: string,
    dateRange: { from: Date, to: Date },
    searchQuery: string,
  },
  sortBy: 'date' | 'profit_loss' | 'symbol',
  sortOrder: 'asc' | 'desc',
  // Computed:
  filteredTrades: Trade[],  // Trades yang sudah di-filter & sort
  stats: {
    totalTrades: number,
    winRate: number,
    profitFactor: number,
    totalPnL: number,
    drawdown: number,
    // ...
  },
  // Actions:
  setFilters, setSortBy, setSortOrder, resetFilters
}
```

**`useLayoutStore`** — State terkait layout dan preferensi:

```typescript
// Yang disimpan:
{
  sidebarOpen: boolean,
  language: 'id' | 'en',
  theme: 'light' | 'dark',
  compactMode: boolean,
  // Actions:
  toggleSidebar, setLanguage, setTheme, toggleCompactMode
}
```

#### React Contexts

**`AuthContext`** (`src/lib/auth-context.tsx`):

```typescript
useAuth() returns:
{
  user: User | null,          // Supabase auth user
  profile: Profile | null,    // Profile dari DB
  isPro: boolean,             // Apakah PRO
  isAdmin: boolean,           // Apakah admin
  signIn(email, password),    // Login
  signUp(email, password, name), // Signup
  signOut(),                  // Logout
  refreshProfile(),           // Refresh data profile
  authLoading: boolean,       // Sedang loading
  authChecked: boolean,       // Sudah cek auth
}
```

**`LanguageContext`** (`src/lib/language-context.tsx`):

```typescript
useLanguage() returns:
{
  language: 'id' | 'en',     // Bahasa aktif
  setLanguage(lang),          // Ubah bahasa
  t(key),                     // Terjemahkan teks
  formatPrice(amount),        // Format harga sesuai bahasa
}
```

### 2.7 Shared Libraries (`src/lib/`)

| File | Fungsi | Detail Penting |
|------|--------|----------------|
| `db.ts` | Prisma database singleton | `import { db } from '@/lib/db'` — sudah di-optimasi agar tidak buat koneksi baru setiap request |
| `api-auth.ts` | `requireAuth(request)` | Verifikasi user di API route. Coba cookie-based dulu, lalu Bearer token. Return `{ user, error }` |
| `admin-auth.ts` | `requireAdmin(request)` | 3-tier check: (1) email hardcoded, (2) profile.role ADMIN, (3) Supabase service role |
| `pro-check.ts` | `isUserPro(userId)` | Cek apakah user PRO dan belum expired |
| `rate-limit.ts` | In-memory rate limiter | Track request per IP/key. Bisa di-configure window dan max request |
| `pricing.ts` | `PRICING`, `formatRupiah()` | Konstanta harga semua plan. `formatRupiah(39000)` → "Rp39.000" |
| `subscription.ts` | `isProUser()`, `getProDaysRemaining()` | Logic cek subscription status |
| `email.ts` | Resend wrapper + templates | `sendEmail(to, subject, html)`. Template email ada di dalam file ini (~2000+ baris termasuk template HTML) |
| `zai.ts` | `createZAI()` | Wrapper untuk z-ai-web-dev-sdk. Return instance ZAI yang sudah di-configure |
| `zai-vision.ts` | VLM integration | `analyzeImage(base64, prompt)` — kirim gambar ke Vision Language Model |
| `tradeCalculations.ts` | P/L calc, pip math | `calculatePnL(trade)`, `calculatePips(symbol, openPrice, closePrice)`, dll |
| `utils.ts` | `cn()` function | `cn(...classes)` — gabungkan clsx + tailwind-merge. Dipakai di hampir semua komponen |
| `pdf-export.ts` | PDF generation | Generate PDF dari data trading (untuk export laporan) |
| `achievement-checker.ts` | Achievement logic | `checkAchievement(userId, eventType, data)` — cek dan unlock achievement |
| `achievements-data.ts` | Achievement definitions | Array semua achievement (id, name, description, condition, icon) |

---

## 3. Data Flow

### 3.1 User Membuka Trade Baru

```
1. User klik "+ Add Trade" di dashboard
2. TradeForm terbuka (modal)
3. User isi form (symbol, type, harga, lot, SL, TP, notes, dll)
4. onSubmit -> fetch POST /api/trades
   body: { symbol, type, open_price, lot_size, stop_loss, take_profit, ... }
5. API: requireAuth() -> validasi data -> simpan ke DB via Prisma
6. Response: { success: true, trade: { ... } }
7. Client: toast sukses -> refresh data trades
8. Analytics di-recalculate (winRate, profitFactor, drawdown, dll)
9. Jika tradeCount mendekati 50 (FREE) -> tampilkan warning upgrade
```

### 3.2 AI Menganalisis Performa

```
1. User klik "Analisis Performa" di tab AI Insights
2. Dashboard memanggil getPerformanceTips() -> fetch POST /api/ai
   body: { type: 'performance_tips', language: 'id', data: analytics }
3. API /api/ai/route.ts:
   a. requireAuth() -> verifikasi user login
   b. isUserPro() -> cek apakah user PRO (fitur AI hanya untuk PRO)
   c. checkAIRateLimit() -> cek rate limit (20 req/min)
   d. buildPerformancePrompt() -> buat prompt RICHE dari data trading user
      - Include: total trades, win rate, PF, drawdown, top pairs, session stats
   e. askZAI() -> kirim prompt ke LLM (model: glm-4.6)
      - Jika berhasil -> return AI response
      - Jika gagal (timeout, error) -> buildSmartPerformanceFallback()
        (fallback BUKAN template — membaca data user dan generate analisis spesifik)
4. Response: { insight: "Analisis performa trading kamu..." }
5. Dashboard: setAiInsight(response.insight) -> tampilkan di UI panel
```

### 3.3 AI Chat

```
1. User ketik pesan di chat input (contoh: "Kenapa saya sering loss di session London?")
2. Dashboard memanggil sendAiChat() -> fetch POST /api/ai
   body: {
     type: 'chat',
     language: 'id',
     data: {
       message: 'Kenapa saya sering loss di session London?',
       context: {
         recentTrades: [...15 trade terakhir],
         analytics: { winRate, profitFactor, ... },
         sessionStats: { London: { winRate, count } }
       }
     }
   }
3. API /api/ai/route.ts:
   a. Auth + Pro check + Rate limit (sama seperti di atas)
   b. buildChatPrompt() -> buat prompt dengan konteks:
      - 15 trade terakhir user
      - Statistik keseluruhan
      - Breakdown per session
      - Pesan user
   c. askZAI() -> kirim ke LLM dengan konteks lengkap
   d. Jika gagal -> buildSmartChatFallback()
      - Cek keyword: sesi? pair? emosi? performa?
      - Jawab dari data yang tersedia (tanpa AI)
4. Response: { insight: "Berdasarkan data trading kamu di session London..." }
5. Dashboard: append ke chat history -> render di chat UI
```

### 3.4 Chart Analysis (VLM)

```
1. User upload screenshot chart (drag & drop atau file picker)
2. FileReader -> convert ke base64 string
3. Dashboard memanggil analyzeChart(base64) -> fetch POST /api/ai
   body: { type: 'chart_analysis', data: { imageData: 'data:image/png;base64,...' } }
4. API /api/ai/route.ts:
   a. Auth + Pro check + Rate limit
   b. askZAIVision() -> kirim gambar + prompt ke Vision Language Model
      Prompt: "Analisis chart forex ini. Identifikasi: trend, support/resistance,
               pola chart (head & shoulders, double top, dll), indikator yang terlihat,
               dan setup trading yang mungkin."
   c. VLM mengidentifikasi:
      - Trend direction (bullish/bearish/ranging)
      - Key support & resistance levels
      - Chart patterns
      - Indikator terlihat (MA, RSI, MACD, dll)
      - Potential setup & entry/exit suggestion
5. Response: { insight: "Chart menunjukkan..." }
6. Dashboard: render hasil analisis di panel
```

### 3.5 Payment Flow (SakuraPay)

```
1. User klik "Upgrade ke PRO" -> pilih plan (30 hari / Annual / Lifetime)
2. (Opsional) User masukkan kode promo
3. POST /api/payment/create-order
   body: { plan: 'PRO_30D', promoCode?: 'DISKON50' }
4. API:
   a. requireAuth() -> cek user login
   b. Hitung harga: PRICING[plan] - diskon promo
   c. Simpan PaymentOrder ke DB (status: PENDING)
   d. createSakuraOrder() -> kirim ke SakuraPay API
      - Generate invoice number unik
      - Set payment methods (QRIS, VA, E-Wallet)
   e. Dapatkan paymentUrl dari SakuraPay
5. Response: { paymentUrl: "https://pay.sakurapay.id/..." }
6. Client: window.open(paymentUrl) -> redirect ke payment gateway
7. User bayar (scan QRIS / transfer VA / e-wallet)
8. SakuraPay kirim webhook ke POST /api/payment/callback
   body: { invoiceNumber, status, signature }
9. Callback API:
   a. Verifikasi HMAC signature (keamanan)
   b. Cari PaymentOrder di DB
   c. Update status -> SUCCESS
   d. Upgrade profile: is_pro = true, subscription_until = tanggal expired
   e. Kirim email konfirmasi ke user
10. User buka dashboard -> AuthContext detect perubahan -> refresh profile
11. UI berubah: badge PRO muncul, fitur AI terbuka
```

### 3.6 Data Reading Pattern

#### Client-Side (Browser)

```typescript
// Ambil data user/profile:
const { user, profile, isPro } = useAuth()

// Ambil data trades:
const res = await fetch('/api/trades')
const { trades } = await res.json()

// Ambil dari Zustand store:
const { filteredTrades, stats } = useTradeStore()
```

#### Server-Side (API Routes)

```typescript
// Verifikasi auth:
const { error, user } = await requireAuth(request)
if (error) return error  // Return 401 response

// Ambil data dari database:
const trades = await db.trade.findMany({
  where: { userId: user.id },
  orderBy: { open_time: 'desc' }
})
```

#### Dashboard Pattern

```
LuxTradeDashboard.tsx (komponen utama)
  ├─ useEffect -> fetch semua data sekaligus:
  │   ├─ fetch('/api/trades') -> setTrades()
  │   ├─ fetch('/api/journal') -> setJournals()
  │   ├─ fetch('/api/watchlist') -> setWatchlist()
  │   ├─ fetch('/api/goals') -> setGoals()
  │   └─ fetch('/api/tags') -> setTags()
  ├─ Compute analytics dari trades (winRate, PF, dll)
  ├─ Pass data ke tab components via props
  └─ Setiap tab render sesuai data yang diterima
```

---

## 4. Auth Flow

### 4.1 Pendaftaran (Signup)

```
1. User buka /auth/signup
2. Isi form: email, password, nama lengkap
3. Klik "Daftar"
4. POST /api/auth/signup
   body: { email, password, fullName }
5. API:
   a. Cek apakah email sudah terdaftar
   b. Supabase auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
      })
   c. Supabase otomatis kirim email verifikasi
      (template email ada di resend-templates/ atau di src/lib/email.ts)
6. User cek email -> klik link verifikasi
7. Link redirect ke /auth/verify?token=xxx
8. POST /api/auth/verify
   body: { token, email }
9. API: Supabase verifyOtp() -> verifikasi berhasil
10. Auto-create profile di tabel profiles:
    - Trigger database (Supabase) ATAU
    - ensure-profile logic di API
    - Default: plan=FREE, role=USER, is_pro=false
11. Redirect ke /dashboard
```

### 4.2 Login

```
1. User buka /auth/login
2. Isi form: email, password
3. Klik "Masuk"
4. POST /api/auth/login
   body: { email, password }
5. API:
   a. Supabase auth.signInWithPassword({ email, password })
   b. Session disimpan (access_token + refresh_token)
   c. Set cookies (SSR-compatible, httpOnly)
6. Response: { success: true }
7. Client: redirect ke /dashboard
8. AuthContext (di dashboard) detect session change:
   a. supabase.auth.onAuthStateChange() triggered
   b. Fetch profile dari DB: GET /api/profile/me
   c. Set user + profile di context
   d. Cek: jika is_pro=true tapi subscription_until < now
      → auto-downgrade ke FREE
      → update DB: is_pro=false, plan=FREE
      → toast: "Masa PRO kamu sudah berakhir"
9. Dashboard siap digunakan
```

### 4.3 Auth di API Routes

**File:** `src/lib/api-auth.ts`

```typescript
// requireAuth(request) bekerja dengan 2 cara:
async function requireAuth(request: Request) {
  // Cara 1: Cookie-based (untuk browser request)
  const supabase = createClientForApi(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (user) return { user: { id: user.id, email: user.email } }

  // Cara 2: Bearer token (untuk API client / Vercel production)
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '')
    // Verifikasi token
    const supabase = createClientForApi(request)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) return { user: { id: user.id, email: user.email } }
  }

  // Gagal kedua cara
  return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}
```

**Penggunaan di API routes:**

```typescript
// Di SETIAP API route yang butuh auth:
import { requireAuth } from '@/lib/api-auth'

export async function POST(request: Request) {
  const { error, user } = await requireAuth(request)
  if (error) return error  // Return 401

  // Sekarang user.id dan user.email tersedia
  const trades = await db.trade.findMany({
    where: { userId: user.id }
  })

  return NextResponse.json({ trades })
}
```

### 4.4 Auth di Client Components

**File:** `src/lib/auth-context.tsx`

```typescript
// Di komponen manapun:
import { useAuth } from '@/lib/auth-context'

function MyComponent() {
  const {
    user,           // Supabase user object { id, email, ... }
    profile,        // Profile dari DB { full_name, plan, is_pro, ... }
    isPro,          // boolean
    isAdmin,        // boolean
    signIn,         // (email, password) => Promise
    signUp,         // (email, password, name) => Promise
    signOut,        // () => Promise
    refreshProfile, // () => Promise — refresh dari DB
    authLoading,    // boolean — sedang loading
    authChecked,    // boolean — sudah cek auth
  } = useAuth()

  if (authLoading) return <Spinner />
  if (!authChecked) return null
  if (!user) return <LoginPage />

  return <div>Halo, {profile?.full_name}!</div>
}
```

### 4.5 Admin Auth

**File:** `src/lib/admin-auth.ts`

Admin auth menggunakan **3-tier check** untuk keamanan berlapis:

```typescript
async function requireAdmin(request: Request) {
  const { error, user } = await requireAuth(request)
  if (error) return error

  // Tier 1: Cek email hardcoded
  const ADMIN_EMAILS = [
    'luxtradee@gmail.com',
    'riskiakbarp123@gmail.com'
  ]
  if (!ADMIN_EMAILS.includes(user.email)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  // Tier 2: Cek Prisma profile.role
  const profile = await db.profile.findUnique({ where: { id: user.id } })
  if (!profile || profile.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  // Tier 3: Cek Supabase profiles table via service role
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!data || data.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { user }
}
```

---

## 5. Risk Map

### 🔴 RISIKO TINGGI (Bisa break production)

#### 5.1 Menghapus `/api/ai/route.ts`

- **File:** `src/app/api/ai/route.ts`
- **Fungsi:** Router utama untuk **SEMUA** fitur AI di dashboard
- **Risiko:** Seluruh AI features (analisis performa, chat, chart analysis, market insight, trade analysis) akan **MATI**. Dashboard akan fetch `/api/ai` dan dapat 404.
- **Cara aman:**
  - Jangan hapus file ini
  - Selalu backup ke `.bak` sebelum edit besar
  - Kalau mau refactor, pastikan `switch-case` types tetap handle: `performance_tips`, `market_insight`, `trade_analysis`, `chart_analysis`, `chat`

#### 5.2 Mengubah Auth Middleware

- **File:** `src/lib/api-auth.ts`, `src/lib/supabase/server.ts`
- **Fungsi:** Verifikasi user di setiap API call
- **Risiko:**
  - Semua protected routes (trades, journal, AI, payment) jadi bisa diakses **tanpa login**
  - ATAU semua user **ter-lockout** tidak bisa akses apapun
- **Cara aman:**
  - Test dengan 2 scenario: (1) user yang login bisa akses, (2) user yang belum login dapat 401
  - Jangan hapus **Bearer token fallback** — itu penting untuk Vercel production

#### 5.3 Mengubah Prisma Schema Tanpa Migration

- **File:** `prisma/schema.prisma`
- **Fungsi:** Definisi seluruh database
- **Risiko:**
  - Data loss (kolom dihapus tanpa backup)
  - Tipe tidak cocok (app crash)
  - Relasi rusak
- **Cara aman:**
  - Selalu `bun run db:push` atau `npx prisma migrate dev` setelah edit
  - Test query di Prisma Studio (`npx prisma studio`)
  - **Backup database** sebelum menghapus kolom atau tabel

#### 5.4 Mengubah Env Variables

- **File:** `.env.local` (tidak di git), `.env.example`
- **Fungsi:** Konfigurasi Supabase, payment gateway, AI SDK, email
- **Risiko:**
  - App tidak bisa connect ke database
  - Payment gateway tidak respons
  - AI tidak bisa diakses
  - Email tidak terkirim
- **Cara aman:**
  - **Jangan push `.env.local` ke git** (sudah ada di .gitignore)
  - Copy dari `.env.example` untuk environment baru
  - Setiap env variable yang dihapus/hilang bisa break fitur

---

### 🟡 RISIKO SEDANG (Bisa break fitur tertentu)

#### 5.5 Mengubah `LuxTradeDashboard.tsx`

- **File:** `src/app/dashboard/LuxTradeDashboard.tsx` (~900 baris)
- **Fungsi:** State management utama dashboard — semua state, handler, dan data fetching
- **Risiko:**
  - Banyak fitur bergantung: tabs, trade CRUD, AI handlers, modals
  - Satu typo bisa break **beberapa** fitur sekaligus
  - Performance bisa menurun kalau re-render tidak dikontrol
- **Cara aman:**
  - File ini sudah di-extract sebagian ke:
    - `handlers/` — logic handlers (tradeHandlers.ts, aiHandlers.ts, dll)
    - `components/` — komponen UI (TradeForm, TradeTable, dll)
    - `utils/` — utility functions
  - **Kalau mau edit handler, edit di `handlers/tradeHandlers.ts` dll, bukan di file utama**
  - **Untuk UI, edit di `tabs/` atau `components/`**

#### 5.6 Mengubah System Prompt AI

- **File:** `src/app/api/ai/route.ts` (`getSystemPrompt`, `buildPerformancePrompt`, dll)
- **Fungsi:** Menentukan kualitas, bahasa, dan konteks jawaban AI
- **Risiko:**
  - Jawaban AI jadi generik / tidak membantu
  - AI jawab dalam bahasa yang salah (padahal user pilih Bahasa Indonesia)
  - AI tidak memanfaatkan data trading user
- **Cara aman:**
  - Edit **prompt-nya saja**, jangan ubah struktur kodenya
  - Selalu test dengan data trading nyata
  - Pastikan fallback functions juga di-update (supaya konsisten)

#### 5.7 Mengubah Payment Callback

- **File:** `src/app/api/payment/callback.ts`, `src/app/api/midtrans/webhook/route.ts`
- **Fungsi:** Menerima konfirmasi pembayaran dari payment gateway
- **Risiko:**
  - User bayar tapi **tidak ke-activate** PRO
  - Atau user tidak bayar tapi ke-activate (keamanan)
- **Cara aman:**
  - **Jangan ubah signature verification logic** — itu yang memastikan webhook benar-benar dari payment gateway
  - Kalau mau tambah log, tambah di tempat yang tidak mengganggu flow utama
  - Test dengan webhook tester sebelum deploy

#### 5.8 Mengubah CSS Variables / Tema Warna

- **File:** `src/app/globals.css` (bagian `.light {}` dan `.dark {}`)
- **Fungsi:** Warna seluruh aplikasi via CSS variables (`--primary`, `--accent`, dll)
- **Risiko:**
  - Warna jadi tidak konsisten
  - Kontras buruk (teks tidak terbaca)
  - shadcn/ui components bisa tampil aneh
- **Cara aman:**
  - **Hanya ubah nilai hex-nya**
  - Jangan hapus variable yang sudah ada
  - shadcn/ui components bergantung pada variable ini (`--primary`, `--background`, `--foreground`, dll)

---

### 🟢 RISIKO RENDAH (Aman diubah)

#### 5.9 Menambah Tab Baru di Dashboard

- **File:**
  - `src/app/dashboard/tabs/` → buat file tab baru
  - `src/app/dashboard/components/TabContent.tsx` → import tab baru
  - `src/app/dashboard/LuxTradeDashboard.tsx` → tambah entry di `menuItems` array
- **Cara aman:**
  1. Buat file tab baru di `tabs/MyNewTab.tsx`
  2. Tambahkan dynamic import di `TabContent.tsx`
  3. Tambah entry di array `menuItems` di `LuxTradeDashboard.tsx`
  4. Tidak perlu ubah file lain

#### 5.10 Mengubah Landing Page

- **File:** `src/components/landing/*`, `src/app/page.tsx`
- **Cara aman:**
  - Landing page **terpisah** dari dashboard
  - Aman diubah tanpa affect dashboard atau API
  - Hanya pastikan routing ke `/auth/login` dan `/dashboard` tetap bekerja

#### 5.11 Menambah API Route Baru

- **File:** `src/app/api/[nama]/route.ts`
- **Cara aman:**
  - Copy dari route yang sudah ada sebagai template
  - Ikuti pattern: `requireAuth` + `try/catch` + `NextResponse.json()`
  - Tambahkan rate limit kalau perlu

---

## 6. Change Guide — Ngoprek AI

### 6.1 Arsitektur AI

```
Dashboard (Client)                    Server
      │                                  │
      │ fetch POST /api/ai               │
      │ { type, language, data }         │
      ├────────────────────────────────►│
      │                                  │
      │                    /api/ai/route.ts
      │                    ├── requireAuth() + isUserPro()
      │                    ├── checkAIRateLimit()
      │                    ├── switch(type):
      │                    │   ├── performance_tips → buildPerformancePrompt()
      │                    │   ├── market_insight   → getMarketInsightPrompt()
      │                    │   ├── trade_analysis   → buildTradeAnalysisPrompt()
      │                    │   ├── chart_analysis   → askZAIVision()
      │                    │   └── chat             → buildChatPrompt()
      │                    ├── askZAI() → z-ai-web-dev-sdk
      │                    │   (model: glm-4.6)
      │                    └── Fallback (kalau AI gagal)
      │                        ├── buildSmartPerformanceFallback()
      │                        ├── buildSmartMarketFallback()
      │                        ├── buildSmartTradeFallback()
      │                        └── buildSmartChatFallback()
      │                                  │
      │◄──────── { insight: "..." } ────┤
      │                                  │
 setAiInsight() -> render di UI        │
```

### 6.2 File Terkait AI

| File | Fungsi | Risiko | Cara Aman Mengubah |
|------|--------|--------|---------------------|
| `src/app/api/ai/route.ts` | **Router utama** — handle semua type AI request | 🔴 Tinggi — kalau dihapus, semua AI mati | Jangan hapus. Edit prompt builder functions saja. Jangan ubah switch-case structure. |
| `src/lib/zai.ts` | SDK wrapper — `createZAI()` mengembalikan instance ZAI | 🟡 Sedang — kalau config salah, AI gagal | Jangan ubah konfigurasi load. Untuk ganti model, ubah parameter `model` di pemanggilan. |
| `src/app/api/ai/analyze-trade/route.ts` | Route terpisah untuk analisis trade | 🟢 Rendah | Tidak dipakai oleh dashboard saat ini. Dashboard pakai `/api/ai`. |
| `src/app/api/ai/chat/route.ts` | Route chat terpisah | 🟢 Rendah | Tidak dipakai oleh dashboard saat ini. |
| `src/app/api/ai/vlm/route.ts` | Route VLM terpisah | 🟢 Rendah | Tidak dipakai oleh dashboard saat ini. |
| `src/lib/zai-vision.ts` | VLM integration — kirim gambar ke Vision Language Model | 🟡 Sedang | Dipakai oleh route terpisah, bukan oleh `/api/ai` (tapi dipakai internal oleh chart_analysis). |
| `src/app/dashboard/tabs/AITab.tsx` | UI tab AI di dashboard | 🟡 Sedang — kalau props tidak cocok, UI error | Pastikan props yang diterima sama dengan yang dikirim `LuxTradeDashboard.tsx`. |
| `src/app/dashboard/LuxTradeDashboard.tsx` | Handler AI: `getPerformanceTips`, `getMarketInsight`, `sendAiChat`, `analyzeTrade`, `analyzeChart` | 🟡 Sedang — kalau fetch URL berubah, handler perlu ikut berubah | Handler ada di sekitar line ~580-728. Jangan ubah fetch URL `/api/ai`. |

### 6.3 Cara Menambah Fitur AI Baru

#### Contoh: Menambah type `"risk_assessment"`

**Step 1: Tambah handler di dashboard** (`LuxTradeDashboard.tsx`)

```typescript
const getRiskAssessment = useCallback(async () => {
  setAiLoading(true)
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'risk_assessment',
        language,
        data: analytics
      })
    })
    const data = await res.json()
    if (res.ok && data.insight) {
      setAiInsight(data.insight)
    }
  } catch {
    toast.error('Gagal mendapatkan risk assessment')
  } finally {
    setAiLoading(false)
  }
}, [analytics, language])
```

**Step 2: Tambah case di API** (`src/app/api/ai/route.ts`)

```typescript
// Di dalam switch(type):
case 'risk_assessment': {
  const prompt = `Analisis risiko trading berdasarkan data berikut:
    Total Trades: ${data.totalTrades}
    Win Rate: ${data.winRate}%
    Average Loss: ${data.avgLoss}
    Max Drawdown: ${data.maxDrawdown}
    Profit Factor: ${data.profitFactor}
    
    Berikan penilaian risiko dan rekomendasi manajemen risiko.`
  
  zaiResponse = await askZAI(getSystemPrompt(lang), prompt)
  if (!zaiResponse) {
    zaiResponse = buildSmartRiskFallback(data) // Buat fallback function juga
  }
  return NextResponse.json({ insight: zaiResponse })
}
```

**Step 3: Tambah button di `AITab.tsx`**

```typescript
<Button
  onClick={onRiskAssessment}
  disabled={loading}
  variant="outline"
  className="w-full justify-start"
>
  <Shield className="w-4 h-4 mr-2" />
  Risk Assessment
</Button>
```

**Step 4: Tambah props di `TabContent.tsx`** dan hubungkan handler dari `LuxTradeDashboard.tsx` ke `AITab` component.

### 6.4 Cara Mengubah Kualitas Jawaban AI

**Problem:** Jawaban AI terlalu generik / template.

**Solusi:** Edit prompt builder di `src/app/api/ai/route.ts`:

| Function | Lokasi | Apa yang Dikontrol |
|----------|--------|---------------------|
| `getSystemPrompt(lang)` | Line ~65-84 | Persona AI, bahasa, aturan umum jawaban |
| `buildPerformancePrompt(lang, data)` | Line ~88-168 | Konteks data untuk analisis performa (win rate, PF, drawdown, dll) |
| `buildTradeAnalysisPrompt(lang, trade)` | Line ~170-231 | Konteks data untuk analisis trade individual |
| `getMarketInsightPrompt(lang)` | Line ~272-326 | Pertanyaan dan instruksi untuk market insight |
| `buildChatPrompt(lang, message, context)` | Line ~328-366 | Konteks chat dengan data trading (15 trade terakhir, stats, session) |

**Tips untuk meningkatkan kualitas:**

1. **Tambah data spesifik ke prompt** — contoh: monthly trend, session breakdown, top losing pairs
2. **Tambah instruksi tegas di system prompt:**
   ```
   - JANGAN berikan jawaban template atau generik
   - Selalu merujuk pada DATA spesifik user
   - Berikan angka dan persentase spesifik, bukan "cukup baik" atau "perlu ditingkatkan"
   - Gunakan Bahasa Indonesia yang natural dan casual
   ```
3. **Pastikan fallback functions juga di-update** — supaya kalau AI down, jawaban fallback juga spesifik

### 6.5 Cara Mengganti Model AI

Di file `src/app/api/ai/route.ts`, ubah parameter `model`:

```typescript
// Di function askZAI():
const result = await zai.chat.completions.create({
  model: 'glm-4.6',  // ← ubah ini (contoh: 'gpt-4o', 'claude-3', dll)
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ],
  thinking: { type: 'disabled' }
})

// Di function askZAIVision():
const result = await zai.chat.completions.createVision({
  model: 'glm-4.6',  // ← ubah ini juga kalau model vision berbeda
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: base64Image } }
      ]
    }
  ]
})
```

> **Catatan:** Pastikan model yang dipilih support fitur yang dibutuhkan (chat completion untuk text, vision untuk gambar).

### 6.6 Penting: Fallback System

AI bisa gagal kapan saja — timeout, rate limit, config error, server down. Karena itu, **setiap type punya smart fallback**:

| Type | AI Function | Fallback Function |
|------|------------|-------------------|
| `performance_tips` | `askZAI()` | `buildSmartPerformanceFallback()` |
| `trade_analysis` | `askZAI()` | `buildSmartTradeFallback()` |
| `market_insight` | `askZAI()` | `buildSmartMarketFallback()` |
| `chat` | `askZAI()` | `buildSmartChatFallback()` |
| `chart_analysis` | `askZAIVision()` | Error message (tidak ada offline fallback untuk vision) |

**Fallback BUKAN template!** Mereka membaca data trading user dan menghasilkan analisis yang spesifik. Contoh:

```typescript
// buildSmartPerformanceFallback() membaca data seperti ini:
function buildSmartPerformanceFallback(data) {
  const { totalTrades, winRate, profitFactor, avgWin, avgLoss, topPair, worstPair } = data
  
  let analysis = `Berdasarkan ${totalTrades} trade kamu:\n\n`
  analysis += `📊 Win Rate: ${winRate}% — ${winRate >= 50 ? 'Sudah baik!' : 'Perlu ditingkatkan.'}\n`
  analysis += `💰 Profit Factor: ${profitFactor} — ${profitFactor >= 1.5 ? 'Sangat profitable!' : profitFactor >= 1 ? 'Masih profit, tapi bisa lebih baik.' : 'Sedang loss, coba evaluasi strategi.'}\n`
  // ... dan seterusnya, semua based on REAL DATA
  
  return analysis
}
```

Jadi meskipun AI down, user **tetap mendapat jawaban yang berguna dan spesifik** berdasarkan data trading mereka.

### 6.7 Rate Limiting

AI routes punya rate limit: **20 request per menit per user**.

Didefinisikan di `src/app/api/ai/route.ts`:

```typescript
const AI_RATE_LIMIT = 20
const AI_RATE_WINDOW = 60 * 1000 // 1 menit dalam milidetik
```

Kalau user melebihi limit, mereka mendapat response:

```json
{
  "error": "Rate limit exceeded. Coba lagi dalam beberapa detik."
}
```

Status code: **429 Too Many Requests**.

---

## 7. Glossary

| Istilah | Arti |
|---------|------|
| **PRO** | Paket berbayar yang membuka fitur premium (AI, analytics lanjutan, unlimited trades, dll) |
| **Trade** | Transaksi buy/sell yang dicatat user di jurnal |
| **P/L** | Profit/Loss — keuntungan atau kerugian dari sebuah trade |
| **Win Rate** | Persentase trade yang profit dari total trade |
| **Profit Factor (PF)** | Rasio total profit dibagi total loss. PF > 1 = profitable, PF > 1.5 = bagus |
| **Drawdown** | Penurunan equity dari puncak tertinggi. Ukuran seberapa besar "loss streak" |
| **Session** | Waktu trading berdasarkan zona waktu: Asia, London, New York, Overlap |
| **Lot** | Ukuran posisi trading. 1 lot standard = 100.000 unit mata uang dasar |
| **Pips** | Satuan pergerakan harga terkecil. Untuk kebanyakan pair, 1 pip = 0.0001 |
| **SL/TP** | Stop Loss / Take Profit — level harga untuk memotong kerugian / mengamankan profit |
| **R:R** | Risk:Reward ratio — perbandingan risiko vs potensi keuntungan sebuah trade |
| **ZAI** | z-ai-web-dev-sdk — SDK internal untuk akses AI (LLM + Vision) |
| **VLM** | Vision Language Model — AI yang bisa "melihat" dan menganalisis gambar |
| **RLS** | Row Level Security — fitur keamanan Supabase yang membatasi akses data per baris |
| **SakuraPay** | Payment gateway Indonesia (primary) — mendukung QRIS, VA, E-Wallet |
| **Midtrans** | Payment gateway Indonesia (secondary) — alternatif SakuraPay |
| **DOKU** | Payment gateway Indonesia (legacy) — sudah tidak jadi prioritas |
| **Supabase** | Backend-as-a-Service — menyediakan auth, database (PostgreSQL), dan storage |
| **Prisma** | ORM (Object-Relational Mapping) — cara mudah akses database dengan TypeScript |
| **Zustand** | State management library untuk React — ringan dan simple |
| **shadcn/ui** | Library komponen UI berbasis Radix UI + Tailwind CSS |
| **SPA** | Single Page Application — dashboard berfungsi seperti SPA dalam satu halaman |
| **Lazy Loading** | Memuat komponen hanya saat dibutuhkan — membuat dashboard lebih cepat |
| **Webhook** | Callback dari payment gateway saat ada event (pembayaran berhasil, dll) |
| **HMAC** | Hash-based Message Authentication Code — untuk verifikasi keaslian webhook |
| **OCR** | Optical Character Recognition — membaca teks dari gambar (screenshot) |
| **Equity Curve** | Grafik perkembangan saldo/equity dari waktu ke waktu |

---

> **Catatan Penting untuk Developer Berikutnya:**
>
> - **Jangan pernah** push `.env.local` ke git
> - Selalu jalankan `bun run lint` sebelum commit
> - File `/api/ai/route.ts` adalah file **PALING KRITIAL** untuk fitur AI — **JANGAN HAPUS**
> - Dashboard adalah SPA — semua state ada di `LuxTradeDashboard.tsx`
> - Gunakan `next/dynamic` dengan `ssr: false` untuk komponen berat
> - Semua API route yang butuh auth **harus** pakai `requireAuth(request)`
> - Kalau menambah fitur AI baru, pastikan juga **menambah fallback function**
> - Test payment flow dengan sandbox environment sebelum production
> - Backup database sebelum mengubah Prisma schema

---

Dokumen ini dibuat sebagai panduan awal. Untuk pertanyaan lebih lanjut, cek kode sumber langsung — kodenya cukup well-documented dengan comments. Kalau ada yang kurang jelas, jangan ragu untuk tanya!
