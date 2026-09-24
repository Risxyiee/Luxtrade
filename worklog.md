---
Task ID: 1
Agent: Main
Task: Debug SQL snippet with "policy already exists" error + Add PrimeAcademyFX partner logo

Work Log:
- Analyzed the SQL error: `CREATE POLICY` fails on re-run because policies already exist from previous partial execution
- Fix: Replace all `CREATE POLICY` with `DROP POLICY IF EXISTS ... ON table; CREATE POLICY ...` pattern for idempotent SQL
- Also need `DROP TABLE IF EXISTS` guards for re-runs (optional but safer)
- Verified PartnerBanner.tsx component already exists with correct setup
- Generated PrimeAcademyFX logo using AI image generation → saved to /home/z/my-project/public/primeacademyfx-logo.jpeg
- Verified landing page (page.tsx) already imports and renders PartnerBanner
- Verified brand name consistency: "LuxTradee" (double-e) in PartnerBanner
- Verified CTA link: https://primeacademyfx.com/ on both logo click and CTA button
- Lint check passed on PartnerBanner.tsx and page.tsx

Stage Summary:
- SQL fix: Need idempotent SQL using DROP POLICY IF EXISTS before CREATE POLICY
- PrimeAcademyFX partner banner: Already fully set up with logo, CTA, and landing page integration
- Logo file: /home/z/my-project/public/primeacademyfx-logo.jpeg (144KB, AI-generated)
