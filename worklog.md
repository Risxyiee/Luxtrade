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
