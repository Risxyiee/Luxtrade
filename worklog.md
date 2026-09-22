---
Task ID: 1
Agent: main
Task: Fix testimonial upload, add language toggle, add admin testimonial management

Work Log:
- Explored full codebase: testimonial form, API routes, LanguageContext, admin routes
- Fixed TestimonialsSection.tsx: certificate image now shows as "Sertifikat" badge (FileCheck icon) instead of avatar
- Updated upload-photo API: renamed comment and file path from "photos/" to "certificates/"
- Changed testimonial submission: status default from 'approved' to 'pending' (requires admin review)
- Updated success message: now says "pending review" instead of just "submitted"
- Fixed LanguageContext.tsx: removed setTimeout hydration hack, added mounted state
- Improved LanguageSwitcher.tsx: now shows ID | EN toggle buttons (both visible) instead of single toggle
- Created /api/admin/testimonials API route: GET (list all with counts), PATCH (approve/reject/feature/unfeature/verify/unverify), DELETE
- Created /dashboard/admin/testimonials admin page: full management UI with status filters, search, approve/reject/feature/delete/verify actions, certificate preview modal
- Added "Testimonials" link to admin panel quick actions
- Fixed bun.lock sync issue (regenerated lockfile)
- Verified with agent-browser: language toggle works (ID/EN), content switches consistently, testimonial form shows "Bukti Sertifikat Lolos ProFirm"

Stage Summary:
- Testimonial upload now correctly labeled as "Bukti Sertifikat Lolos ProFirm" (certificate proof)
- Certificate images displayed as clickable "Sertifikat" badge in testimonial cards, not as avatar
- Language toggle (ID | EN) visible in navbar and sidebar, works correctly
- New submissions default to 'pending' status requiring admin approval
- Admin testimonial management page at /dashboard/admin/testimonials
- Admin API at /api/admin/testimonials (GET/PATCH/DELETE)

---
Task ID: fix-restore-dashboard
Agent: main
Task: Restore dashboard that was incorrectly deleted, keep only the mp4 fix

Work Log:
- Realized user wanted to KEEP dashboard, not delete it
- Reverted the commit that deleted dashboard and changed all /dashboard references
- Dashboard route (/dashboard) fully restored with all components
- Middleware, DynamicCharts, and all other files restored to original state
- Kept the fix: deleted demo-tutorial.mp4 (55 MiB) that caused Cloudflare deploy error
- Updated TutorialVideoSection.tsx to use YouTube iframe instead of local mp4
- Verified both landing page (/) and dashboard (/dashboard) return HTTP 200

Stage Summary:
- Dashboard fully restored - no longer deleted
- demo-tutorial.mp4 deleted (fixes Cloudflare "Asset too large" error)
- TutorialVideoSection.tsx updated to use YouTube embed instead of local video
- Both / and /dashboard work correctly
- No files in public/ exceed 10MB
