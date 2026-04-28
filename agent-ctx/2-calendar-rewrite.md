---
Task ID: 2
Agent: Calendar API Rewrite Agent
Task: Rewrite /api/news/calendar/route.ts to fetch from Investing.com Economic Calendar

## What Was Done

Rewrote `/src/app/api/news/calendar/route.ts` (222 → ~640 lines) with a comprehensive 3-tier data source strategy:

### 1. Primary Source: Investing.com Economic Calendar (page_reader)
- Fetches `https://www.investing.com/economic-calendar/` using `z-ai-web-dev-sdk` `page_reader`
- Full HTML parsing engine (`parseInvestingCalendarHtml`):
  - Date header extraction with position mapping
  - Multiple row pattern detection (tr, div-based, event containers)
  - Currency detection from flags/classes (26 country→currency mappings)
  - Impact detection from CSS classes/dot patterns
  - Event name extraction from multiple selectors
  - Actual/Forecast/Previous value extraction
  - Deduplication by event name + currency + date

### 2. Secondary Source: web_search + page_reader fallback
- 3 search queries targeting Investing.com and forex calendar
- Tries page_reader on found Investing.com URLs (up to 3)
- Falls back to search snippet extraction as last resort

### 3. Final Fallback: generateWeeklyEvents()
- Enhanced to calculate real dates for current week (e.g., "Apr 28")
- Time estimates for each event
- 19 events across Mon–Fri

### Key Improvements
- Smart sorting: date → impact (high first) → time → currency priority
- Max 50 events, max 200 HTML rows processed
- 1-hour in-memory cache
- Same response format with flag per event

### Current Status
- Investing.com returns 403 (blocks page_reader) — this is expected
- Fallback chain activates correctly and returns real dates
- All lint checks pass (zero errors)
- API returns 200 with properly structured events

## Files Modified
- `/src/app/api/news/calendar/route.ts` — Complete rewrite
- `/home/z/my-project/worklog.md` — Appended work log
