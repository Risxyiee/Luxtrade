# BUG 2 Fix: Data PropFirm Guard Tidak Terhubung ke Dashboard Utama

## Summary
Connected the PropFirm Guard feature to the main dashboard by creating a compact summary widget and wiring it through the component hierarchy.

## Changes Made

### 1. Created `/src/app/dashboard/components/PropFirmGuardSummary.tsx`
- Self-contained `'use client'` component that fetches active prop firm challenges from `/api/prop-firm-guard` on mount
- Shows compact summary card with:
  - Number of active challenges
  - Highest drawdown % across all challenges (daily + total)
  - Colored status indicator (green/amber/red) based on DD level
  - Breach warning badge if any challenges are breached
  - Best profit target progress across active challenges
  - "Set up" prompt when no challenges exist
  - Button to open the full PropFirmGuard tab via `onOpenGuard` callback
- Follows existing design patterns (dark theme, gradient accents, motion animations)

### 2. Modified `/src/app/dashboard/tabs/DashboardTab.tsx`
- Added `onTabChange?: (tab: string) => void` to `DashboardTabProps`
- Imported `PropFirmGuardSummary` component
- Placed the widget between the Quick Action Buttons and the Equity Curve (section 1.6)
- Passed `onOpenGuard` callback that calls `onTabChange('propfirm')` to navigate to the full tab

### 3. Modified `/src/app/dashboard/components/TabContent.tsx`
- Passed `onTabChange={setActiveTab}` to `DashboardTab`, using the existing `setActiveTab` prop already available in `TabContentProps`

## Data Flow
```
LuxTradeDashboard (setActiveTab)
  → TabContent (setActiveTab prop)
    → DashboardTab (onTabChange={setActiveTab})
      → PropFirmGuardSummary (onOpenGuard={() => onTabChange('propfirm')})
```

## Verification
- ESLint: clean (no errors in changed files)
- TypeScript: no new type errors introduced
