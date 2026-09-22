# Task 3-e & 3-h: Improve Pricing Cards and FAQ Section

**Agent**: landing-pricing-faq
**Status**: ✅ Completed

## Task 3-e: Improve Pricing Cards

### Changes Made to `/home/z/my-project/src/components/landing/PricingSectionNew.tsx`

1. **Annual/Monthly Toggle**
   - Added `isAnnual` state with styled pill toggle (Bulanan/Tahunan)
   - Glass morphic container: `bg-white/[0.04] border-white/[0.08] rounded-full`
   - Active button: `bg-white/10 text-white shadow-sm`
   - "Hemat Rp78K" / "Save Rp78K" badge with Zap icon appears when annual selected (framer-motion scale-in)

2. **Dynamic Pricing**
   - Monthly: Rp39K/bulan
   - Annual: Rp390K/tahun with strikethrough Rp468K, "~17% lebih murah" subtitle
   - Promo pricing adapts: Rp25K/mo or Rp250K/yr

3. **4 New Pro Features** (total 8)
   - Prioritas Support / Priority Support
   - Ekspor CSV & PDF / Export CSV & PDF
   - Jurnal Tak Terbatas / Unlimited Journal Entries
   - Skor Trading & Psikologi / Trading Score & Psychology

4. **"Most Popular" Glow Effect**
   - Pro card restructured with outer wrapper for animated glow border
   - `.border-glow-animated` class with gradient position animation
   - `pro-card-glow` keyframe: 4s cycle, blue↔cyan gradient sweep
   - Badge text changed to "PALING POPULER" / "MOST POPULAR"

5. **Security Badges**
   - Kept: "Pembayaran aman via Midtrans 🔒" / "Secure payment via Midtrans 🔒"
   - Added: ShieldCheck icon + "Tanpa auto-renew. Bisa cancel kapan pun." / "No auto-renew. Cancel anytime."

### CSS Added to `/home/z/my-project/src/app/globals.css`
- `@keyframes pro-card-glow` — gradient position + opacity animation
- `.border-glow-animated` — linear-gradient blue/cyan sweep, 300% background-size, 4s infinite

---

## Task 3-h: Improve FAQ Section

### Changes Made to `/home/z/my-project/src/components/landing/FAQSection.tsx`

1. **Expanded to 10 FAQ Items** (from 6)
   - 7: Mobile support (category: general)
   - 8: Broker compatibility (category: technical)
   - 9: AI Vision explanation (category: technical)
   - 10: Affiliate program (category: payment)

2. **Category Badges** (color-coded)
   - Umum/General → blue-500/10 bg, blue-400 text, blue-500/20 border
   - Teknis/Technical → cyan-500/10 bg, cyan-400 text, cyan-500/20 border
   - Pembayaran/Payment → emerald-500/10 bg, emerald-400 text, emerald-500/20 border

3. **Migrated to shadcn/ui Accordion**
   - Uses `@/components/ui/accordion` (Radix-based)
   - `type="single" collapsible` for one-at-a-time behavior
   - Smooth open/close via Radix CSS animations (accordion-down/accordion-up)
   - State managed via `openItem` / `setOpenItem` with string value

4. **Data Architecture**
   - Typed `FAQItem` interface with `q_id`, `q_en`, `a_id`, `a_en`, `category`
   - `faqData` constant array separate from rendering logic
   - `getCategoryBadge()` helper function for badge rendering

---

## Verification
- ✅ ESLint: no warnings or errors
- ✅ Next.js build: successful
- ✅ All changes bilingual (id/en)
