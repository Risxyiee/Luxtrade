---
Task ID: 1
Agent: zai-code-assistant
Task: Clone and migrate Luxtrade repository from GitHub to the current project

Work Log:
- Cloned the Luxtrade repository from GitHub using provided access token
- Updated package.json with missing dependencies from Luxtrade (Supabase packages, Vercel Analytics, PDF generation libraries, etc.)
- Updated Prisma schema with new models: AffiliateProfile, PageVisit, Withdrawal
- Copied public assets (logo files) from Luxtrade to public folder
- Copied all src/lib files (auth-context.tsx, email.ts, export-utils.ts, supabase.ts, telegram.ts)
- Copied all src/app files (pages and API routes) including: dashboard, auth pages, admin pages, and various API endpoints
- Copied all custom components from src/components (AIWeeklyReport, ActivityFeed, TradingScore, etc.)
- Copied middleware.ts file
- Removed duplicate components/components folder
- Fixed import issue in layout.tsx (changed @vercel/analytics/react to @vercel/analytics)
- Ran bun install to install all new dependencies successfully
- Ran prisma db push to update database schema with new models
- Regenerated Prisma client to ensure all models are properly typed

Stage Summary:
- Successfully migrated entire Luxtrade codebase to the current project
- All source files, components, and configurations have been copied
- Database schema updated with new models for affiliate functionality, page tracking, and withdrawals
- All dependencies installed without errors
- Dev server is running and application is accessible
- Fixed minor import issue in layout.tsx
- Application ready for testing and development
