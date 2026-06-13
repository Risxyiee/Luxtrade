# LUXTRADE - DOKUMENTASI LENGKAP FITUR

> **TANGGAL DIBUAT:** 2025-06-12
> **TUJUAN:** Dokumentasi lengkap semua fitur yang ada di LuxTrade untuk mencegah fitur hilang atau tertukar saat pengembangan

---

## 📋 DAFTAR ISI

1. [Fitur Utama](#fitur-utama)
2. [Sidebar Navigation](#sidebar-navigation)
3. [Tab Fitur](#tab-fitur)
4. [Fitur Premium/PRO](#fitur-premiumpro)
5. [Account Management](#account-management)
6. [Trade Management](#trade-management)
7. [AI Features](#ai-features)
8. [Achievement System](#achievement-system)
9. [Promo Code System](#promo-code-system)
10. [Subscription Plans](#subscription-plans)
11. [API Routes](#api-routes)

---

## 🎯 FITUR UTAMA

### Landing Page (`src/app/page.tsx`)
- ✅ Hero section dengan CTA "Mulai Gratis Sekarang"
- ✅ Fitur highlights: Performance Analytics, Trading Journal, AI Market Insights, Smart Watchlist, P/L Tracking, Bank-Grade Security
- ✅ Pricing table: GRATIS (10 trades/bulan), ELITE PRO, LIFETIME ULTRA
- ✅ Promo code section (TRADERCEPAT: 100% discount, 30 quota, 3 months)
- ✅ Email subscription untuk newsletter
- ✅ Testimonials section
- ✅ FAQ section
- ✅ Language selector (ID/EN)
- ✅ Footer dengan links

### Authentication
- ✅ Login page (`src/app/auth/login/page.tsx`)
- ✅ Register page (`src/app/auth/register/page.tsx`)
- ✅ Supabase auth integration
- ✅ OAuth providers (Google, dll)

---

## 📱 SIDEBAR NAVIGATION

### Menu Items (File: `src/app/dashboard/components/Sidebar.tsx`)

#### UTAMA (Tanpa PRO)
1. **Dashboard** - Overview trading performance
2. **Trades** - List semua transaksi
3. **Calendar** - Kalender trading
4. **Journal** - Jurnal trading harian
5. **Watchlist** - Daftar pantauan pair
6. **Market News** - Berita pasar
7. **Economic Calendar** - Kalender ekonomi
8. **Achievements** - Achievement Center

#### ALAT (PRO Gold)
1. **Risk Calculator** - Kalkulator risiko trading
2. **Market Heatmap** - Heatmap pasar

#### LANJUTAN (PRO Purple)
1. **Analytics** - Analisis performa mendalam
2. **Targets** - Target trading
3. **AI Insights** - Insight AI
4. **Trading Score** - Skor trading
5. **Weekly Report** - Laporan mingguan
6. **Streaks** - Streak trading
7. **Psychology Tracking** - Tracking psikologi

### Quick Action Buttons (Sidebar)
1. **Add Account** - Tambah trading account baru
   - Blue gradient button
   - Icon: Wallet
   - Mobile: Text terlihat dengan `truncate`
   - Desktop: Text normal

2. **Add Trade** - Catat trade baru
   - Purple gradient button
   - Icon: Plus
   - Mobile: Text terlihat dengan `truncate`
   - Desktop: Text normal

### Account Selector (Sidebar)
- ✅ Show all accounts with currency
- ✅ "All Accounts" option untuk melihat semua
- ✅ Delete button untuk tiap account (kecuali last account)
- ✅ Default account indicator
- ✅ Scrollable jika banyak accounts

---

## 📑 TAB FITUR

### 1. Dashboard Tab (`src/app/dashboard/tabs/DashboardTab.tsx`)
- ✅ Quick stats cards (Total P/L, Win Rate, Total Trades, Best Trade)
- ✅ P/L Chart (Area chart)
- ✅ Recent trades table
- ✅ Performance overview

### 2. Trades Tab (`src/app/dashboard/tabs/TradesTab.tsx`)
- ✅ List semua trades dengan filter
- ✅ Filter by account
- ✅ Search functionality
- ✅ Export to Excel
- ✅ View/Edit/Delete actions
- ✅ Pagination

### 3. Journal Tab (`src/app/dashboard/tabs/JournalTab.tsx`)
- ✅ List journal entries
- ✅ Add new journal
- ✅ Edit/Delete journals
- ✅ Filter by mood & market condition

### 4. Watchlist Tab (`src/app/dashboard/tabs/WatchlistTab.tsx`)
- ✅ List watchlist items
- ✅ Add/Remove watchlist
- ✅ Target price tracking

### 5. Analytics Tab (`src/app/dashboard/tabs/AnalyticsTab.tsx`)
- ✅ Win/Loss analysis
- ✅ P/L by symbol
- ✅ P/L by session
- ✅ Best performing pairs
- ✅ Performance trends

### 6. AI Tab (`src/app/dashboard/tabs/AITab.tsx`)
- ✅ Performance tips (AI)
- ✅ Market insights (AI)
- ✅ AI Chat

### 7. Psychology Tab (`src/app/dashboard/tabs/PsychologyTab.tsx`)
- ✅ Mood tracking
- ✅ Psychology score
- ✅ Correlation analysis

### 8. Heatmap Tab (`src/app/dashboard/tabs/HeatmapTab.tsx`)
- ✅ Market heatmap visualization
- ✅ Currency strength

### 9. Calendar Tab (`src/app/dashboard/tabs/CalendarTab.tsx`)
- ✅ Calendar view of trades
- ✅ Filter by date range

### 10. Risk Calculator Tab (`src/app/dashboard/tabs/RiskCalculatorTab.tsx`)
- ✅ Position size calculator
- ✅ Risk percentage
- ✅ Stop loss calculation

### 11. Targets Tab (`src/app/dashboard/tabs/TargetsTab.tsx`)
- ✅ Set trading targets
- ✅ Progress tracking
- ✅ Achievement tracking

### 12. Market News Tab (`src/app/dashboard/tabs/MarketNewsTab.tsx`)
- ✅ Latest market news
- ✅ Filter by category

### 13. Economic Calendar Tab (`src/app/dashboard/tabs/EconomicCalendarTab.tsx`)
- ✅ Upcoming economic events
- ✅ Impact levels
- ✅ Filter by currency

---

## 👑 FITUR PREMIUM/PRO

### PRO Status Check (`src/lib/auth-context.tsx`)
- ✅ Check `is_pro` from profile
- ✅ Check `subscription_until` expiry
- ✅ Admin status (`role === 'ADMIN'`)

### Free User Limitations
- ✅ Max 10 trades/month
- ✅ Limited PRO features (3x trial)
- ✅ Warning when approaching limit

### PRO Features (Unlimited Access)
- ✅ Unlimited trades
- ✅ All analytics features
- ✅ AI Insights (full access)
- ✅ Risk Calculator (advanced)
- ✅ Weekly Reports
- ✅ Trading Score
- ✅ Psychology Tracking
- ✅ Market Heatmap

---

## 💰 ACCOUNT MANAGEMENT

### Trading Account Model (`prisma/schema.prisma`)
```prisma
model TradingAccount {
  id              String   @id @default(uuid())
  user_id         String
  name            String
  broker          String?
  account_type    String   // DEMO, REAL, CENT
  account_number  String?
  initial_balance Float
  current_balance Float
  leverage        Int      @default(100)
  currency        String   @default("USD")
  is_default      Boolean  @default(false)
  is_active       Boolean  @default(true)
  created_at      DateTime @default(now())
  updated_at      DateTime @default(now())

  user            Profile  @relation(fields: [user_id], references: [id])
  trades          Trade[]

  @@index([user_id])
}
```

### Add Account Form (`src/app/dashboard/components/AddAccountForm.tsx`)
- ✅ Account Name (required)
- ✅ Broker Name (required)
- ✅ Account Type (DEMO/REAL/CENT)
- ✅ Initial Balance (required)
- ✅ Currency (USD/IDR)
- ✅ Validation client-side
- ✅ Auto-set as default if first account

### Delete Account
- ✅ Cannot delete last account
- ✅ Confirmation dialog
- ✅ Auto-set next account as default

### API Routes
- ✅ `POST /api/trading-accounts` - Create account
- ✅ `GET /api/trading-accounts` - List accounts
- ✅ `DELETE /api/trading-accounts/[id]` - Delete account
- ✅ `POST /api/trading-accounts/ensure-default` - Ensure default account exists

---

## 📊 TRADE MANAGEMENT

### Trade Model (`prisma/schema.prisma`)
```prisma
model Trade {
  id              String   @id @default(uuid())
  user_id         String
  account_id      String?

  symbol          String
  type            String   // BUY, SELL
  lot_size        Float
  open_price      Float
  close_price     Float?
  stop_loss       Float?
  take_profit     Float?
  profit_loss     Float    @default(0)

  open_time       DateTime
  close_time      DateTime?

  session         String?  // London, New York, Asian, European
  notes           String?

  screenshot_url  String?
  strategy        String?
  emotion_before  String?
  emotion_after   String?

  confidence      Int?
  setup_quality   Int?

  created_at      DateTime @default(now())
  updated_at      DateTime @default(now())

  account         TradingAccount? @relation(fields: [account_id], references: [id])

  @@index([user_id])
  @@index([account_id])
}
```

### Add Trade Options
1. **Manual Form** (`src/app/dashboard/components/TradeForm.tsx`)
   - ✅ All trade fields
   - ✅ Account selector
   - ✅ Symbol search
   - ✅ Type selection (BUY/SELL)
   - ✅ Session selection
   - ✅ Notes

2. **Screenshot OCR** (`src/app/dashboard/components/ScreenshotJournalDialog.tsx`)
   - ✅ Upload screenshot
   - ✅ AI extracts trade data
   - ✅ Auto-journal generation
   - ✅ Multi-tier fallback (Hugging Face → Ollama → Z.ai Vision → Template)

3. **CSV Import**
   - ✅ Upload CSV file
   - ✅ Preview before import
   - ✅ Editable preview
   - ✅ Batch import

4. **MT4/MT5 Report Import**
   - ✅ HTML report parsing
   - ✅ PDF report parsing
   - ✅ Auto-extract trades

### Edit Trade
- ✅ Edit modal
- ✅ All fields editable
- ✅ Validation

### Delete Trade
- ✅ Confirmation dialog
- ✅ Soft delete or permanent delete

### View Trade Details
- ✅ Detail modal
- ✅ Share card feature
- ✅ PNL visualization

---

## 🤖 AI FEATURES

### AI Services (File: `src/lib/ai-services.ts`)

#### 1. LLM (Chat & Text Generation)
- ✅ Provider: Z.ai Chat (GLM-4.6)
- ✅ Use: AI Chat, Performance tips, Market insights

#### 2. VLM (Image Understanding)
- ✅ Provider: Z.ai Vision (GLM-4.6v)
- ✅ Use: Screenshot OCR, Chart analysis

#### 3. Image Generation
- ✅ Provider: Z.ai Image (Flux)
- ✅ Use: Trade cards, Social media sharing

#### 4. TTS (Text-to-Speech)
- ✅ Provider: Z.ai TTS
- ✅ Use: Voice notifications

#### 5. ASR (Speech-to-Text)
- ✅ Provider: Z.ai ASR
- ✅ Use: Voice notes

### AI API Routes
- ✅ `POST /api/ai` - General AI endpoint
  - `type: 'performance_tips'` - Get AI performance tips
  - `type: 'market_insight'` - Get market insights
  - `type: 'chat'` - AI chat

- ✅ `POST /api/screenshot-journal` - Screenshot OCR & Journal
  - Multi-tier fallback system
  - Returns trade data + journal

### Fallback System for Screenshot OCR
1. **Hugging Face** (Free, limited)
2. **Ollama** (Local, if available)
3. **Z.ai Vision** (Primary)
4. **Template Fallback** (If all fails)

---

## 🏆 ACHIEVEMENT SYSTEM

### Achievement Model (`prisma/schema.prisma`)
```prisma
model Achievement {
  id        String   @id
  title     String
  titleId   String
  desc      String
  descId    String
  icon      String
  criteria  Json     // { target: number, type: "trades" | "streak" | "profit" }
  reward    Json     // { type: "PRO", days: 7 }

  user_submissions UserSubmission[]
  progress       MissionProgress[]
}

model UserSubmission {
  id               String   @id @default(uuid())
  user_id          String
  achievementKey   String
  proofUrl         String?
  status           String   // PENDING, APPROVED, REJECTED
  reviewedBy       String?
  createdAt        DateTime @default(now())

  user             Profile  @relation(fields: [user_id], references: [id])
}

model MissionProgress {
  id            String   @id @default(uuid())
  user_id       String
  missionKey    String
  progress      Int      @default(0)
  target        Int
  completed     Boolean  @default(false)
  claimed       Boolean  @default(false)

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user          Profile  @relation(fields: [user_id], references: [id])

  @@unique([user_id, missionKey], name: "userId_missionKey")
}
```

### Achievements List (File: `src/lib/achievements.ts`)
1. **First Trade** - Catat 1 trade pertama
2. **Consistent Trader** - Catat 10 trades
3. **Trading Pro** - Catat 50 trades
4. **Profit Master** - Total profit $100+
5. **Risk Master** - Win rate 70%+ dengan 20+ trades

### Achievement Checker (`src/lib/achievement-checker.ts`)
- ✅ Auto-check achievements on trade added
- ✅ Create submission record
- ✅ Create mission progress
- ✅ Grant PRO reward
- ✅ Send notification

### Achievement Center (`src/components/AchievementCenter.tsx`)
- ✅ List all achievements
- ✅ Show progress
- ✅ Claim rewards
- ✅ Completed achievements

### API Routes
- ✅ `POST /api/missions/claim` - Claim reward

---

## 🎟️ PROMO CODE SYSTEM

### Promo Code Model (`prisma/schema.prisma`)
```prisma
model PromoCode {
  id           String   @id @default(uuid())
  code         String   @unique
  discount     Int      @default(0)    // Percentage
  maxUses      Int      @default(100)
  usedCount    Int      @default(0)
  quota        Int      @default(30)   // Extra quota
  duration     Int      @default(3)    // Months
  isActive     Boolean  @default(true)
  expiresAt    DateTime?
  createdAt    DateTime @default(now())

  users        PromoCodeUsage[]
}

model PromoCodeUsage {
  id           String   @id @default(uuid())
  userId       String
  promoCodeId  String
  usedAt       DateTime @default(now())

  user         Profile    @relation(fields: [userId], references: [id])
  promoCode    PromoCode  @relation(fields: [promoCodeId], references: [id])

  @@unique([userId, promoCodeId])
}
```

### Active Promo Codes
- ✅ **TRADERCEPAT**: 100% discount, 30 quota, 3 months

### Promo Code Features
- ✅ Validate code
- ✅ Check expiry
- ✅ Check max uses
- ✅ Track usage per user
- ✅ Apply discount
- ✅ Add extra quota
- ✅ Extend subscription

### API Routes
- ✅ `POST /api/promo/validate` - Validate promo code
- ✅ `POST /api/promo/apply` - Apply promo code
- ✅ `POST /api/promo/create` - Create new promo (Admin)

---

## 💳 SUBSCRIPTION PLANS

### Plan Types
1. **FREE**
   - 10 trades/month
   - Basic features
   - 3x PRO trial

2. **ELITE PRO**
   - Unlimited trades
   - All features
   - AI Insights (full)
   - Analytics
   - Reports

3. **LIFETIME ULTRA**
   - All PRO features
   - Lifetime access
   - Priority support
   - VIP Telegram

### Subscription Model (`prisma/schema.prisma`)
```prisma
model Subscription {
  id                String   @id @default(uuid())
  userId            String   @unique
  plan              String   // FREE, PRO, LIFETIME
  subscriptionUntil DateTime?
  quota             Int      @default(10)
  quotaUsed         Int      @default(0)
  promoCode         String?
  status            String   @default("active")

  user              Profile  @relation(fields: [userId], references: [id])
}
```

### Payment Components
- ✅ `src/components/PaymentModal.tsx` - Payment form
- ✅ `src/components/PlanSelectionModal.tsx` - Plan selection
- ✅ `src/components/PaywallModal.tsx` - Paywall for free users

---

## 🛣️ API ROUTES

### Trading Accounts
- `GET /api/trading-accounts` - List accounts
- `POST /api/trading-accounts` - Create account
- `DELETE /api/trading-accounts/[id]` - Delete account
- `POST /api/trading-accounts/ensure-default` - Ensure default

### Trades
- `GET /api/trades` - List trades
- `POST /api/trades` - Create trade
- `PUT /api/trades/[id]` - Update trade
- `DELETE /api/trades/[id]` - Delete trade

### Analytics
- `GET /api/analytics` - Get analytics data

### Journal
- `GET /api/journal` - List journals
- `POST /api/journal` - Create journal
- `PUT /api/journal/[id]` - Update journal
- `DELETE /api/journal/[id]` - Delete journal

### Watchlist
- `GET /api/watchlist` - List watchlist
- `POST /api/watchlist` - Add to watchlist
- `DELETE /api/watchlist/[id]` - Remove from watchlist

### AI
- `POST /api/ai` - General AI endpoint

### Screenshot Journal
- `POST /api/screenshot-journal` - Screenshot OCR & journal

### Missions/Achievements
- `GET /api/missions` - List missions
- `POST /api/missions/claim` - Claim reward

### Promo Codes
- `POST /api/promo/validate` - Validate promo
- `POST /api/promo/apply` - Apply promo
- `POST /api/promo/create` - Create promo (Admin)

### Subscription
- `GET /api/subscription` - Get subscription info
- `POST /api/subscription/upgrade` - Upgrade plan

---

## 🔧 MINI SERVICES

### 1. Ollama Service (`mini-services/ollama-service/`)
- ✅ Local LLM for AI fallback
- ✅ Port: 11434
- ✅ Hot reload enabled

### 2. Z.ai Vision Service (`mini-services/zai-vision-service/`)
- ✅ Image analysis service
- ✅ Port: 3001
- ✅ Hot reload enabled

---

## 📦 DEPENDENCIES UTAMA

### Core
- ✅ Next.js 16
- ✅ React 19
- ✅ TypeScript 5
- ✅ Tailwind CSS 4

### Database & Auth
- ✅ Prisma ORM
- ✅ SQLite (dev) / PostgreSQL (prod)
- ✅ Supabase Auth

### UI Components
- ✅ shadcn/ui (New York style)
- ✅ Lucide icons
- ✅ Framer Motion (animations)
- ✅ Recharts (charts)
- ✅ Sonner (toast notifications)

### State Management
- ✅ Zustand (client state)
- ✅ TanStack Query (server state)

### AI Services
- ✅ z-ai-web-dev-sdk

---

## ⚠️ PENTING: JANGAN DIUBAH/INGKARI

### 1. Sidebar Menu Structure
- JANGAN mengubah menu items di `src/app/dashboard/components/Sidebar.tsx`
- JANGAN mengubah kategori (UTAMA, ALAT, LANJUTAN)
- JANGAN mengubah PRO requirements per menu

### 2. Achievement Definitions
- JANGAN mengubah achievement criteria di `src/lib/achievements.ts`
- JANGAN menghapus achievement yang sudah ada
- JANGAN mengubah reward structure

### 3. Promo Code Logic
- JANGAN mengubah validasi promo code
- JANGAN menghapus promo code TRADERCEPAT
- JANGAN mengubah discount/quota/duration

### 4. Account System
- JANGAN mengubah minimal 1 account requirement
- JANGAN mengubah default account logic
- JANGAN menghapus account fields

### 5. Trade Fields
- JANGAN menghapus field penting: symbol, type, lot_size, open_price, close_price, profit_loss
- JANGAN mengubah session options
- JANGAN menghapus screenshot_url field

### 6. AI Fallback System
- JANGAN mengubah fallback order
- JANGAN menghapus fallback options
- JANGAN mengubah API key logic

### 7. PRO Features
- JANGAN mengubah free user limit (10 trades)
- JANGAN menghapus PRO trial (3x)
- JANGAN mengubah plan structure (FREE, PRO, LIFETIME)

---

## 📝 CHECKLIST SEBELUM MENAMBAH FITUR BARU

Sebelum menambah fitur baru, PASTIKAN:

- [ ] Baca dokumentasi ini
- [ ] Paham struktur codebase
- [ ] Cek apakah fitur sudah ada
- [ ] Cek apakah fitur akan mengganggu fitur yang sudah ada
- [ ] Pastikan tidak menghapus/mengubah fitur yang sudah ada
- [ ] Test fitur yang sudah ada setelah perubahan
- [ ] Push ke GitHub dengan commit message yang jelas
- [ ] Update dokumentasi ini jika ada perubahan

---

## 🔍 CARA MENCEGAH FITUR HILANG

### 1. Selalu Git Commit
```bash
git add .
git commit -m "feat: [deskripsi fitur baru]"
git push
```

### 2. Review Changes
```bash
git diff
git status
```

### 3. Test Sebelum Push
- [ ] Test fitur baru
- [ ] Test fitur lama (utama)
- [ ] Cek console untuk error
- [ ] Cek dev.log

### 4. Branch untuk Fitur Besar
```bash
git checkout -b feature/nama-fitur
# ... work ...
git push origin feature/nama-fitur
# Create PR untuk review
```

---

## 📞 CONTACT & SUPPORT

Jika ada pertanyaan tentang fitur:
- Cek dokumentasi ini dulu
- Cek comment di code
- Cek git history untuk perubahan

---

## 📅 UPDATE LOG

### 2025-06-12
- ✅ Dokumentasi awal dibuat
- ✅ Semua fitur tercatat
- ✅ Sidebar mobile fix (Add Account & Add Trade text visible on mobile)

---

**DOCUMENT VERSION:** 1.0
**LAST UPDATED:** 2025-06-12