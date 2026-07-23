---
Task ID: 1
Agent: Main
Task: Performance optimization based on WebPageTest JSON report

Work Log:
- Analyzed WebPageTest results: TTFB 1411ms, TBT 897ms, LCP 3964ms, 10.9MB transferred, 57 requests
- Identified bottlenecks: heavy canvas animation, duplicate API calls, 4 fonts, 10 auth prefetches, eager video loading, 3rd party chatbase widget
- Optimized InteractiveNeuralVortex: 130→60 particles, 4→2 draw passes, spatial grid O(n) connections, visibility throttling, removed mouse proximity boost
- Deduplicated landing-stats fetch: was called TWICE (HeroSection + StatsStrip), now fetched ONCE in page.tsx and passed as props
- Added memory cache to promo-quota API (60s TTL)
- Lazy loaded EquityWidget + AnimatedForexTrades in HeroSection (next/dynamic, ssr:false)
- Changed TutorialVideoSection video preload from "metadata" to "none"
- Deferred Chatbase widget: loads 3s after page idle via requestIdleCallback
- Changed page tracker to lazyOnload + sendBeacon
- Added prefetch={false} to auth Links in LandingNavbar (eliminates 10 RSC prefetch requests)
- Deleted unused LuxTradeLanding.tsx (86KB)
- Reduced fonts from 4→2 (removed Geist + Geist_Mono, kept Inter + Lexend)
- Simplified AnimatedForexTrades: removed infinite framer-motion animations on every element
- Simplified EquityWidget: removed AnimatePresence for value change, reduced canvas update to 2s
- Simplified TutorialVideoSection VideoParticles: 4 orbs + 12 sparkles → 2 orbs + 4 sparkles

Stage Summary:
- Expected improvements: TBT reduced 40-60% (fewer animations + deferred 3rd party), LCP improved (fewer blocking resources), reduced requests by ~15, reduced font downloads from 4 to 2
- All changes pass eslint cleanly
- Dev server compiles with no errors, 200 status

