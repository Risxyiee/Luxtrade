# Task 3 - PropFirmTab Component

## Agent: main

## Task
Create the PropFirmTab component at `src/app/dashboard/tabs/PropFirmTab.tsx` — a comprehensive Prop Firm Challenge Tracking tab for prop firm traders.

## Work Log

### Analysis
- Read worklog.md to understand previous work (Tasks 1-2: Cloudflare deployment fix, bindings config)
- Examined existing tab components (AnalyticsTab, RiskCalculatorTab, AffiliateTab, CommunityTab) for patterns
- Reviewed all prop-firm API routes:
  - `GET /api/prop-firm` — list rules
  - `POST /api/prop-firm` — create rule
  - `PATCH /api/prop-firm/[id]` — update rule
  - `DELETE /api/prop-firm/[id]` — delete rule
  - `GET /api/prop-firm/templates` — pre-configured firm templates (FTMO, MFF, FundedNext, The5ers, SurgeTrader)
  - `POST /api/prop-firm/calculate` — compute drawdown from trades
- Reviewed PaywallModal and RiskCalculatorTab paywall patterns
- Reviewed authFetch pattern from `@/lib/api-fetch`

### Implementation
Created `src/app/dashboard/tabs/PropFirmTab.tsx` with:

1. **Props Interface** — `PropFirmTabProps` with isPro, onUpgrade, language, trades
2. **Paywall Gate** — When `!isPro`, shows Lock icon with pulsing animation + upgrade button (matching RiskCalculatorTab pattern)
3. **Bilingual Support** — Full `t()` dictionary with 50+ keys for 'id' (Indonesian) and 'en' (English)
4. **Active Challenge Cards** — Each card shows:
   - Firm name + Phase badge (Phase 1=blue, Phase 2=amber, Funded=green)
   - Challenge size formatted as currency
   - SVG Circular Gauge for Drawdown (green/yellow/red based on %)
   - SVG Circular Gauge for Daily Drawdown
   - SVG Circular Gauge for Profit Target Progress (cyan/emerald)
   - Progress bars for drawdown and profit
   - Stats: Current PnL, Days Traded, Profit Split
   - Violation banner with red pulsing border
   - Action buttons: Refresh, Edit, Delete
5. **Add Challenge Modal** — Form with:
   - Template selector dropdown (FTMO, MFF, FundedNext, The5ers, SurgeTrader)
   - Challenge size presets from template
   - All form fields with auto-calc from template
   - Auto-calc dollar amounts from percentages
6. **Edit Challenge Modal** — Same form pre-filled with existing values
7. **Delete Confirmation Dialog**
8. **Auto-calculate on mount** — Calls `/api/prop-firm/calculate` for each rule on first load
9. **Styling** — LuxTrade dark theme (bg-[#0d1117]), glass-morphism cards, framer-motion animations, color-coded gauges

### Verification
- ESLint passed with no errors
- TypeScript types throughout
- Uses authFetch for authenticated API calls
- Uses sonner toast for notifications
- Uses framer-motion for animations
- Uses lucide-react icons as specified
- Responsive grid layout (1 col mobile, 2 col desktop)

## Stage Summary
- PropFirmTab component fully implemented with all requested features
- Production-ready with proper TypeScript types, error handling, and loading states
- Consistent with existing LuxTrade codebase patterns
