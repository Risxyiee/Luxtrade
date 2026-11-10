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

  // FIX AUTH: legacy JWT key (eyJ...) sudah disabled oleh Supabase (1 Nov 2025).
  // Kalau build env masih menunjuk key legacy, jangan pakai — login bakal 401
  // "Legacy API keys are disabled". Fallback ke publishable key yang benar.
  if (key && key.startsWith('eyJ')) {
    console.error('⚠️ NEXT_PUBLIC_SUPABASE_ANON_KEY berisi LEGACY JWT key (disabled Supabase). Pakai publishable key fallback.')
    return createBrowserClient(url, 'sb_publishable_gYf7ekooCy36EmIv8_PKzw_ixj0zKhE')
  }

  // Check if env vars are available
  if (!key) {
    console.error('⚠️ NEXT_PUBLIC_SUPABASE_ANON_KEY not set. Supabase features will not work until this is configured.')

    // Return placeholder client so the app doesn't crash
    return createBrowserClient(url, 'placeholder-key-not-configured')
  }

  return createBrowserClient(url, key)
}