# C11 — Welcome/Onboarding Checklist (Dashboard Home)

## Status: DONE (frontend-only)

## Files
- CREATED `src/components/dashboard/OnboardingChecklist.tsx` ('use client'): compact dismissible Card at top of dashboard main content. Title "Selamat datang di LuxTradee 👋", subtitle, shadcn Progress bar, 4 steps (upload-screenshot → trades tab, add-manual-trade → trade wizard modal, view-analytics → analytics tab, upgrade-pro → plan selection modal; step upgrade hidden for PRO via isPro prop). Checkbox per step (shadcn Checkbox), persistence in localStorage `lux_onboarding_steps` (JSON array of done ids) + `lux_onboarding_dismissed`='true' on dismiss; dismissed never renders again; all-done → success row + auto-dismiss after 2s. framer-motion one-shot entrance (respects useReducedMotion). Emerald accent (no blue/indigo), min-h-11 touch targets, ul/li semantics, aria-labels.
- MODIFIED `src/app/dashboard/LuxTradeDashboard.tsx` — 1 import (line ~36, after DashboardCSBotWidget) + 1 render between `<AppInstallBanner />` and `{/* Tab Content */}` (lines ~1213-1219), props: onNavigate=setActiveTab, onAddTrade=()=>setAddTradeOpen(true), onUpgrade=()=>setPlanSelectionModalOpen(true), isPro={isPro}. No other files touched. Note: src/app/dashboard/page.tsx is a thin wrapper (dynamicImport of LuxTradeDashboard) — the real "dashboard page" is LuxTradeDashboard.tsx.

## Key context for next agents
- Dashboard is tab-state based (setActiveTab), NOT URL routes. Real tab ids: dashboard, trades, accounts, journal, watchlist, analytics, ai, chart, etc.
- Existing onboarding surfaces (untouched): full tab `src/app/dashboard/tabs/OnboardingTab.tsx` (tab id 'onboarding', syncs via /api/onboarding/progress, key luxtrade-onboarding-progress) + DB-backed modal onboarding via /api/onboarding (key luxtrade_onboarding_done). New checklist is deliberately separate/lightweight per task spec (own keys lux_onboarding_*).
- Verification: `bun run lint` (eslint .) exit 0; `bunx eslint <component> <page>` exit 0 (0 errors; project flat-config emits "file ignored" warning when files passed explicitly); `bunx tsc --noEmit` exit 0; GET /dashboard on running dev server → 200.
