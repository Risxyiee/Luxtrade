import { NextResponse } from 'next/server'

/**
 * Debug API endpoint to check environment variables.
 * This helps diagnose Cloudflare Pages deployment issues.
 *
 * WARNING: Only use this for debugging, then remove it or protect it.
 */
export async function GET() {
  const envVars = {
    // Supabase
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET ✓' : 'MISSING ✗',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? `SET (length: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length})` : 'MISSING ✗',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? `SET (length: ${process.env.SUPABASE_SERVICE_ROLE_KEY.length})` : 'MISSING ✗',

    // App
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'NOT SET',

    // Environment
    NODE_ENV: process.env.NODE_ENV,

    // Cloudflare specific
    CF_PAGES: process.env.CF_PAGES || 'NOT SET',
    CF_PAGES_BRANCH: process.env.CF_PAGES_BRANCH || 'NOT SET',
    CF_PAGES_COMMIT_SHA: process.env.CF_PAGES_COMMIT_SHA || 'NOT SET',
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    envVars,
    summary: {
      isSupabaseConfigured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      isCloudflarePages: !!process.env.CF_PAGES,
    }
  })
}