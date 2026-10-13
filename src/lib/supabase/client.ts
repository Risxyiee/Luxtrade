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

  // Check if env vars are available
  if (!key) {
    console.error('⚠️ NEXT_PUBLIC_SUPABASE_ANON_KEY not set. Supabase features will not work until this is configured.')

    // Return placeholder client so the app doesn't crash
    return createBrowserClient(url, 'placeholder-key-not-configured')
  }

  return createBrowserClient(url, key)
}