import { supabase } from '@/lib/supabase'

/**
 * Authenticated fetch for API routes.
 * Automatically includes the Supabase session token as a Bearer header.
 * This fixes Vercel production issues where Edge→Serverless cookie propagation
 * can cause auth to fail.
 *
 * Usage (replaces fetch):
 *   import { authFetch } from '@/lib/api-fetch'
 *   const res = await authFetch('/api/admin/users')
 *   const res = await authFetch('/api/admin/users', { method: 'PATCH', body: JSON.stringify(...) })
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(options.headers || {})

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }

  return fetch(url, { ...options, headers, credentials: 'include' })
}