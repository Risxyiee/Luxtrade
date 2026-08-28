<p align="center">
  <img src="public/favicon.ico" alt="LuxTrade" width="64" height="64" />
</p>

<h1 align="center">LuxTrade</h1>

<p align="center">
  <strong>Trading Journal & Analytics Platform</strong><br/>
  Catat, analisis, dan tingkatkan performa trading kamu — semua dalam satu tempat.
</p>

<p align="center">
  <a href="https://luxtrade.vercel.app">Live Demo</a> &middot;
  <a href="#fitur">Fitur</a> &middot;
  <a href="HANDOFF.md">Handoff Doc</a> &middot;
  <a href="#tech-stack">Tech Stack</a>
</p>

---

## Tentang

LuxTrade adalah platform **trading journal** yang dirancang khusus untuk trader Indonesia. Menyediakan fitur pencatatan trade, analisis performa, journal psikologi, dan asisten AI — semuanya dalam satu dashboard yang bersih dan responsif.

### Kenapa LuxTrade?

- **Journal Trading** — Catat setiap trade dengan detail lengkap (pair, lot, entry/exit, S/L, T/P, emosi, screenshot)
- **AI Assistant** — Analisis performa, insight pasar, dan chat AI berbasis data trading kamu
- **Analytics Mendalam** — Win rate, profit factor, max drawdown, equity curve, heatmap sesi, analisis per pair
- **Payment Terintegrasi** — SakuraPay, Midtrans, DOKU — semua dalam Rupiah
- **Bahasa Indonesia** — Default Bahasa Indonesia, dengan opsi English

---

## Fitur

### Dashboard (16 Tab)

| Tab | Deskripsi |
|-----|-----------|
| Overview | Statistik utama, equity curve, activity feed, weekly performance |
| Trades | Daftar trade dengan filter, sort, search, export |
| Journal | Catatan journal harian dengan mood & market condition |
| Calendar | Kalender trade visual |
| Watchlist | Pair yang di-monitor |
| **AI Assistant** | Tips performa, insight pasar, analisis trade, analisis chart, chat AI |
| Analytics | Analisis lanjutan per pair, sesi, timeframe |
| Accounts | Manajemen akun broker |
| Targets | Target mingguan |
| Risk Calculator | Kalkulator position sizing |
| Heatmap | Heatmap performa per hari/jam |
| Market News | Feed berita pasar |
| Economic Calendar | Kalender ekonomi |
| Psychology | Tracking emosi & psikologi trading |
| User Guide | Panduan onboarding |

### AI Features (PRO)

- **Performance Tips** — Analisis win rate, risk-reward, expected value, streak
- **Market Insight** — Insight pasar berdasarkan sesi trading saat ini
- **Trade Analysis** — Deep dive analisis trade spesifik dengan konteks
- **Chart Analysis** — Upload chart screenshot, AI analisis trend, S/R, pattern
- **AI Chat** — Chat bebas tentang trading dengan konteks data kamu

### Pricing (IDR)

| Paket | Harga |
|-------|-------|
| PRO Bulanan | Rp39.000 / bulan |
| PRO Tahunan | Rp390.000 / tahun (hemat 2 bulan) |
| PRO Lifetime | Rp299.000 (30 slot founding member) |

---

## Tech Stack

| Teknologi | Fungsi |
|-----------|--------|
| **Next.js 16** (App Router) | Framework utama |
| **React 19** + TypeScript 5 | UI & type safety |
| **Tailwind CSS 4** + shadcn/ui | Styling & komponen |
| **Prisma 6** + PostgreSQL | Database ORM |
| **Supabase Auth** | Autentikasi |
| **Zustand** | Client state management |
| **z-ai-web-dev-sdk** (GLM-4.6) | AI assistant |
| **SakuraPay / Midtrans / DOKU** | Payment gateway |
| **Recharts** | Charts & visualisasi |
| **Framer Motion** | Animasi |
| **Resend** | Email service |
| **Sentry** | Error monitoring |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                 # Landing page
│   ├── proxy.ts                 # Auth guard (pengganti middleware.ts)
│   ├── auth/                    # Login, signup, verify
│   ├── dashboard/
│   │   ├── LuxTradeDashboard.tsx  # Komponen utama dashboard
│   │   ├── tabs/                   # 16 tab dashboard
│   │   ├── components/             # Komponen pendukung
│   │   └── handlers/               # Handler logic terpisah
│   └── api/                     # ~120+ API routes
│       ├── ai/route.ts            # AI endpoint utama (5 tipe)
│       ├── trades/                # CRUD trades
│       ├── payment/               # SakuraPay
│       ├── midtrans/              # Midtrans
│       ├── promo/                 # Promo codes
│       ├── admin/                 # Admin panel
│       └── cron/                  # Scheduled jobs
├── components/
│   ├── ui/                      # shadcn/ui (jangan edit manual)
│   └── landing/                 # Landing page components
├── lib/
│   ├── api-auth.ts             # requireAuth()
│   ├── pro-check.ts            # isUserPro()
│   ├── zai.ts                   # ZAI SDK wrapper
│   ├── db.ts                    # Prisma client
│   ├── auth-context.tsx         # AuthProvider
│   └── payment/                 # Gateway helpers
├── store/                       # Zustand stores
├── contexts/                    # React contexts (i18n)
└── types/                       # TypeScript types

prisma/
├── schema.prisma                # 16 database models

mini-services/
├── ollama-service/              # Vision AI (port 3031)
├── zai-vision-service/          # ZAI Vision (port 3010)
└── affiliate-ws/                # WebSocket affiliate (port 3004)
```

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (recommended) atau Node.js 18+
- PostgreSQL database (Supabase recommended)

### Setup

```bash
# 1. Clone repo

# 2. Install dependencies
bun install

# 3. Setup environment variables

# 4. Push database schema
bun run db:push

# 5. Start dev server
bun run dev
```

### Environment Variables

```env
# Supabase (WAJIB)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=

# Email (WAJIB)
RESEND_API_KEY=
RESEND_TEMPLATE_CONFIRM=
RESEND_TEMPLATE_RESET=

# AI (untuk fitur AI)
ZAI_BASE_URL=
ZAI_API_KEY=
ZAI_CHAT_ID=
ZAI_TOKEN=
ZAI_USER_ID=

# App URL
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SITE_URL=

# Payment (opsional, sesuai gateway)
SAKURA_API_ID=
SAKURA_API_KEY=
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
```

### Useful Commands

```bash
bun run dev              # Start dev server (port 3000)
bun run lint             # Cek code quality
bun run db:push           # Push schema ke database
bun run db:migrate        # Migration (production)
bun run db:generate       # Generate Prisma client
```

---

## Documentation

| Dokumen | Deskripsi |
|---------|-----------|
| [HANDOFF.md](HANDOFF.md) | Panduan maintenance lengkap (file map, data flow, auth, AI, risk map, change guide) |

---

## License

Private project. All rights reserved.

---

<p align="center">
  Built for Indonesian traders &middot; Powered by Next.js & AI
</p>
