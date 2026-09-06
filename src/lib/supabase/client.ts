'use client'

import { createBrowserClient } from '@supabase/ssr'

function readEnv(name: string): string | undefined {
  if (typeof process === 'undefined') return undefined

  // For NEXT_PUBLIC_SUPABASE_ANON_KEY, always use SUPABASE_ANON_KEY
  if (name === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
    const v = process.env.SUPABASE_ANON_KEY
    if (v && v !== 'undefined') return v
    return undefined
  }

  const v = process.env[name]
  if (!v || v === 'undefined') return undefined
  return v
}

/**
 * Create a Supabase client for client-side use
 * This function should be used in Client Components
 *
 * @returns Supabase client configured for client-side use
 */
export function createClient() {
  const url = readEnv('NEXT_PUBLIC_SUPABASE_URL') || 'https://klxkdrfsfcoankbaoejn.supabase.co'
  const key = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  // Check if env vars are available
  if (!key) {
    const isProduction = typeof process !== 'undefined' && process.env.NODE_ENV === 'production'
    const errorMsg = isProduction
      ? 'CRITICAL: NEXT_PUBLIC_SUPABASE_ANON_KEY is required in production. Please set this environment variable in Cloudflare Pages settings.'
      : '⚠️ NEXT_PUBLIC_SUPABASE_ANON_KEY not set. Supabase features will not work in development.'

    console.error(errorMsg)

    if (isProduction) {
      throw new Error(errorMsg)
    }

    // In development, create client with placeholder for build to succeed
    return createBrowserClient(url, 'dev-placeholder-key')
  }

  return createBrowserClient(url, key)
}