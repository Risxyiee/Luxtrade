'use client'

import { createBrowserClient } from '@supabase/ssr'

function readEnv(name: string): string | undefined {
  if (typeof process === 'undefined') return undefined
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

  // In production, if key is missing, log warning but allow build to continue
  if (!key) {
    console.warn('[Supabase Client] NEXT_PUBLIC_SUPABASE_ANON_KEY not available during build. Will be available at runtime.')
  }

  return createBrowserClient(url, key || 'placeholder-key-for-build')
}