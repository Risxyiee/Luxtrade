---
Task ID: 1
Agent: main
Task: Fix auto-journal data not appearing in dashboard

Work Log:
- Read `/api/auto-journal/route.ts` — confirmed DB writes for both trade and journal are correct (steps 11, returns success with trade+journal records)
- Read `TradeWizardForm.tsx` handleAutoJournal success handler (line 438) — found it calls `setTimeout(() => onSave(), 1500)`
- Traced `onSave` → `handleAddTrade` in `tradeHandlers.ts` — this function VALIDATES required fields (symbol, type, lot_size, open_price, account_id) and calls `POST /api/trades`
- **ROOT CAUSE FOUND**: `handleAddTrade` requires `account_id` which is NOT set in auto-journal flow. So `onSave()` either:
  1. Silently fails validation → no dashboard refresh, or
  2. If validation somehow passes → creates a DUPLICATE trade (the API already saved it)
  3. Even if it worked, the 1500ms `setTimeout` + the validation toast could be lost
- The auto-journal API already saves both trade AND journal to the database. The `onSave()` call was unnecessary and harmful.

Stage Summary:
- Added `onAutoJournalSuccess?: () => void` prop to `TradeWizardForm`
- Changed success handler from `setTimeout(() => onSave(), 1500)` to immediate `onAutoJournalSuccess()` + `onCancel()`
- `DashboardModals` passes `onAutoJournalSuccess={() => { setAddTradeOpen(false); setFormData(emptyFormData); fetchData() }}`
- This ensures: (1) modal closes, (2) form resets, (3) dashboard data refreshes showing the new trade + journal
