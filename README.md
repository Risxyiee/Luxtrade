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
| PRO Bulanan | Rp49.000 / bulan (coret Rp100.000) |
| PRO 6 Bulan | Rp199.000 |
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
| [DEPLOYMENT.md](DEPLOYMENT.md) | Deployment guide (Cloudflare Workers, env vars, build/deploy commands) |
| [HANDOFF.md](HANDOFF.md) | Panduan maintenance lengkap (file map, data flow, auth, AI, risk map, change guide) |
| [docs/archive/](docs/archive/) | Archived historical documentation |

---

## Pine Signals (PRO) — runtime Pine Script di server

User menempel Pine Script (v5/v6) miliknya, server menjalankannya pada candle
H1 yang **sudah close**, menampilkan sinyal di chart (Lightweight Charts v5),
dan mengirim alert (web push / Telegram / webhook). Event memakai format standar
yang sama dengan `src/lib/signals/champion-signal.js` (engine Champion v6 — file
referensi, tidak diubah).

### Komponen

| File | Peran |
| --- | --- |
| `src/lib/signals/champion-signal.js` | Engine Champion v6 (referensi parity, tidak diubah) |
| `src/lib/pine/champion-v6.pine` | Port Pine v5 setia dari engine di atas |
| `src/lib/pine/pine-runner.ts` | Sandbox worker thread + timeout + rate limit + validasi |
| `src/lib/pine/pine-worker.mjs` | Realm eksekusi PineTS (tanpa jaringan, loop guard) |
| `src/lib/pine/normalize.ts` | Konversi alert → event standar (idempoten) |
| `src/lib/pine/live.ts` | Mode live per candle close + backtest |
| `supabase/migrations/20261112_pine_signals.sql` | DDL (dieksekusi manual di Supabase SQL Editor) |
| `scripts/pine-test-a.ts` | Uji A parity; `scripts/pine-test-bcd.ts` = Uji B/C/D |

### Hasil uji penerimaan

- **Uji A** — `bun scripts/pine-test-a.ts`: 13 skenario × 3000 candle H1, event
  Pine (via pine-runner) **identik** dengan champion-signal.js: jumlah, isi
  (entry/sl/tp/side/candleTime), urutan, termasuk `CANCEL_PENDING`
  (EXPIRED + OUT_OF_SESSION), `REPLACE_LIMIT`, dan meta ADX/DI (0 selisih).
- **Uji B** — infinite loop dihentikan loop-guard PineTS (±0,2 dtk); loop berat
  dihentikan timeout hard worker (5 dtk); server tetap responsif.
- **Uji C** — id event deterministik `${scriptId}:${candleTime}:${side}:${event}`;
  penyisipan DB pre-select-diff → restart/retry tidak pernah alert ganda.
- **Uji D** — candle duplikat/out-of-order dibuang di runner DAN engine.

### Lisensi PineTS — WAJIB DIBACA SEBELUM RILIS BERBAYAR

Paket `pinets` (PineTS, LuxAlgo) berlisensi **AGPL-3.0-only** dengan opsi
**lisensi komersial**. Menyalurkan fitur ini sebagai bagian dari layanan web
berbayar (SaaS) memicu kewajiban copyleft AGPL **kecuali** membeli lisensi
komersial ke LuxAlgo (`business@luxalgo.com`). Sebelum monetisasi, selesaikan
dulu aspek lisensi ini (bukan nasihat hukum).

### Asumsi & batasan (jujur)

1. **Tidak dijamin 100% sama dengan TradingView.** Kecocokan terverifikasi
   terhadap engine JS Champion v6 (Uji A), bukan terhadap broker-emu TradingView
   untuk script arbitrer (fitur lanjutan seperti bar magnifier, request.security
   lintas-timeframe, calc_on_order_fills tidak didukung/diabaikan).
2. **Model fill broker server** (hasil probe PineTS 0.13.1): order limit aktif
   mulai bar setelah pemasangan; BUY limit terisi saat `low <= level` (harga
   `min(open, level)`, gap-through termasuk); stop diprioritaskan di atas TP
   bila keduanya kena di bar yang sama; re-call `strategy.entry` id sama saat
   pending membuat order hilang di PineTS → template Champion selalu
   `strategy.cancel` dulu sebelum entry baru.
3. **Pine asli Bos sudah diverifikasi** (`src/lib/pine/champion-v6-original.pine`,
   file utuh tanpa diubah): lolos validasi website; pada 3000 candle — sesi
   `time(tf, session, "Asia/Jakarta")` vs formula engine = **0 beda**; fill
   broker PineTS vs simulator = **0 beda**; setiap bar order engine terdeteksi
   sinyal di Pine asli. Satu-satunya beda: aturan tie fractal — `ta.pivothigh`
   (kiri boleh sama, kanan strict) vs engine JS (kiri strict, kanan boleh sama)
   → nilai `lastPH/lastPL` beda di 36/15.000 bar, **0 bar sinyal berubah**.
   Script asli hanya mengirim alert teks "sinyal" (tanpa event cancel/replace)
   dan alertnya fire di SEMUA bar sinyal (termasuk saat posisi open/pending) —
   by design; edisi website (`champion-v6.pine`) menambahkan alert JSON agar
   event PLACE/REPLACE/CANCEL/CLOSE lengkap, logika keputusan identik.
4. **Warm-up
5. **Warm-up**: ADX Pine baru valid ±bar ke-23; engine JS mem-seed RMA dengan
   nol sejak bar ke-14; keduanya konvergen & identik setelahnya. Produksi selalu
   memakai window ≥ 500 bar (live: 1200) sehingga tidak relevan.
6. **Re-run penuh per candle close** (bukan incremental), event baru ditentukan
   lewat kunci idempotensi di tabel `pine_events`. Candle berjalan tidak pernah
   memicu event.
7. **Runtime**: eksekusi Pine di server butuh worker_threads (Node.js/Bun).
   Di Cloudflare Workers edge (deploy utama) worker_threads tidak tersedia:
   - **Backtest & chart** otomatis pindah eksekusi ke BROWSER (Web Worker
     `browser-worker.mjs` + build browser PineTS) — plots, trade broker, dan
     sinyal tetap tampil penuh di chart. Toast memberi tahu mode browser.
   - **Validasi** tetap jalan di edge (statis; dry-run dilewati dengan warning).
   - **Mode live (cron alert)** masih butuh runtime Node/Bun yang berbagi DB
     Supabase yang sama — trigger dari luar:
     `curl -X POST -H "Authorization: Bearer $PINE_CRON_SECRET" <host>/api/pine/cron-live`.
8. **Batas**: source ≤ 50.000 byte, ≤ 20.000 bar, rate limit 12 run/menit &
   60 run/jam per user, timeout 5 dtk, loop guard 500k iterasi.
9. **Sinyal bukan nasihat keuangan** — disclaimer tampil di UI.

---

## License

Luxtradee dirilis di bawah **GNU Affero General Public License v3.0**
(lihat `LICENSE`). Alasannya: proyek ini memakai [PineTS](https://github.com/LuxAlgo/PineTS)
(LuxAlgo) yang berlisensi AGPL-3.0 / komersial — memakai versi AGPL berarti
keseluruhan karya gabungan wajib ikut AGPL-3.0. Dependensi pihak ketiga lainnya
mempertahankan lisensinya masing-masing. Rincian kewajiban lisensi PineTS: lihat bagian "Lisensi PineTS" di atas.

---

<p align="center">
  Built for Indonesian traders &middot; Powered by Next.js & AI
</p>
