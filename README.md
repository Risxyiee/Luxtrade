<p align="center">
  <img src="public/favicon.ico" alt="LuxTrade" width="64" height="64" />
</p>

<h1 align="center">LuxTrade</h1>

<p align="center">
  <strong>Trading Journal & Analytics Platform</strong><br/>
  Catat, analisis, dan tingkatkan performa trading kamu — semua dalam satu tempat.
</p>

<p align="center">
  <a href="https://luxtrade.id">Live Site</a> &middot;
  <a href="#fitur">Fitur</a> &middot;
  <a href="HANDOFF.md">Handoff Doc</a> &middot;
  <a href="#tech-stack">Tech Stack</a>
</p>

---

## Tentang

LuxTrade adalah platform **trading journal** yang dirancang khusus untuk trader Indonesia. Menyediakan fitur pencatatan trade, analisis performa, journal psikologi, dan asisten AI — semuanya dalam satu dashboard yang bersih dan responsif.

### Kenapa LuxTrade?

- **Journal Trading** — Catat setiap trade dengan detail lengkap (pair, lot, entry/exit, S/L, T/P, emosi, screenshot)
- **AI Assistant** — Analisis performa, insight pasar, dan chat AI berbasis Gemini & data trading kamu
- **Analytics Mendalam** — Win rate, profit factor, max drawdown, equity curve, heatmap sesi, analisis per pair
- **Payment Terintegrasi** — Midtrans — semua dalam Rupiah
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
- **Auto Journal** — Scan screenshot trade, AI otomatis ekstrak data + buat journal

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
| **Next.js 15** (App Router) | Framework utama |
| **React 19** + TypeScript 5 | UI & type safety |
| **Tailwind CSS 4** + shadcn/ui | Styling & komponen |
| **Supabase** (Auth + PostgreSQL) | Database & autentikasi |
| **Zustand** | Client state management |
| **Gemini 2.5 Flash** | AI (chat, vision, auto-journal) |
| **Midtrans Snap** | Payment gateway |
| **Recharts** | Charts & visualisasi |
| **Framer Motion** | Animasi |
| **Resend** | Email service |
| **Socket.IO** | Real-time affiliate updates |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── LuxTradeLanding.tsx          # Komponen utama landing
│   ├── auth/                        # Login, signup, verify
│   ├── dashboard/
│   │   ├── LuxTradeDashboard.tsx    # Komponen utama dashboard
│   │   ├── tabs/                    # 16 tab dashboard
│   │   ├── components/              # Komponen pendukung
│   │   ├── admin/                   # Admin panel pages
│   │   └── connections/             # Social links page
│   └── api/                         # 100+ API routes
│       ├── ai/                      # AI endpoints (chat, vision, auto-journal, recommendations)
│       ├── trades/                  # CRUD trades
│       ├── journal/                 # Journal CRUD
│       ├── midtrans/                # Midtrans payment
│       ├── promo/                   # Promo codes
│       ├── affiliate/               # Affiliate system
│       ├── admin/                   # Admin panel APIs
│       ├── news/                    # Market news
│       └── auth/                    # Auth APIs
├── components/
│   ├── ui/                          # shadcn/ui (jangan edit manual)
│   └── landing/                     # Landing page components
├── lib/
│   ├── supabase-admin-alt.ts        # Supabase admin client
│   ├── supabase/server.ts           # Supabase SSR client
│   ├── gemini.ts                    # Gemini AI wrapper
│   ├── aiml-vision.ts               # Vision AI (Gemini + OpenRouter fallback)
│   ├── auth-context.tsx             # AuthProvider
│   ├── pro-check.ts                 # isUserPro() helper
│   ├── pricing.ts                   # Pricing plans
│   └── email.ts                     # Resend email helper
├── store/                           # Zustand stores
├── contexts/                        # React contexts (i18n)
└── types/                           # TypeScript types

mini-services/
└── affiliate-ws/                    # WebSocket affiliate real-time (port 3004)

resend-templates/                    # Email HTML templates
```

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (recommended) atau Node.js 18+
- Supabase project (Auth + PostgreSQL)

### Setup

```bash
# 1. Clone repo
git clone https://github.com/Risxyiee/Luxtrade.git
cd Luxtrade

# 2. Install dependencies
bun install

# 3. Setup environment variables
cp .env.example .env
# Edit .env dengan kredensial Supabase, Gemini, Midtrans, dll.

# 4. Start dev server
bun run dev

# 5. Start affiliate WebSocket service (opsional)
cd mini-services/affiliate-ws && bun run dev
```

### Environment Variables

```env
# Supabase (WAJIB)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Email (WAJIB)
RESEND_API_KEY=

# AI — Gemini (untuk fitur PRO AI)
GEMINI_API_KEY=

# AI — OpenRouter fallback (opsional)
OPENROUTER_API_KEY=

# Payment — Midtrans
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=

# App URL
NEXT_PUBLIC_APP_URL=https://luxtrade.id
NEXT_PUBLIC_SITE_URL=https://luxtrade.id

# Admin
ADMIN_EMAILS=
```

### Useful Commands

```bash
bun run dev              # Start dev server (port 3000)
bun run lint             # Cek code quality
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
