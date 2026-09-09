import { redirect } from 'next/navigation'
import { getServerClient } from '@/lib/supabase'
import { ADMIN_EMAILS } from '@/lib/admin-auth'
import AdminPanelClient from './AdminPanelClient'

// CRITICAL: Force dynamic rendering untuk Cloudflare Workers
// Mencegah static pre-rendering pada build time
export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export default async function AdminPanel() {
  console.log('[AdminPanel Server] Starting server component...')

  console.log('[AdminPanel Server] Checking environment variables...')
  console.log('[AdminPanel Server] NEXT_PUBLIC_SUPABASE_URL:',
    process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 20)}...` : 'MISSING')
  console.log('[AdminPanel Server] NEXT_PUBLIC_SUPABASE_ANON_KEY:',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 10)}...` : 'MISSING')

  const supabase = getServerClient()

  if (!supabase) {
    console.error('[AdminPanel Server] Supabase client not initialized')
    redirect('/auth/login')
  }

  console.log('[AdminPanel Server] Supabase client created successfully')

  const { data: { user }, error } = await supabase.auth.getUser()

  console.log('[AdminPanel Server] Auth getUser result:', {
    hasUser: !!user,
    userId: user?.id,
    userEmail: user?.email,
    error: error?.message,
  })

  if (!user) {
    console.log('[AdminPanel Server] No user found, redirecting to login')
    redirect('/auth/login')
  }

  const userEmail = user.email?.toLowerCase().trim() || ''
  const isAuthorized = ADMIN_EMAILS.some(adminEmail =>
    adminEmail.toLowerCase().trim() === userEmail
  )

  console.log('[AdminPanel Server] Auth check:', {
    userId: user.id,
    userEmail: user.email,
    userEmailNormalized: userEmail,
    isAuthorized,
    adminEmails: ADMIN_EMAILS,
    emailMatch: ADMIN_EMAILS.map(e => ({
      admin: e,
      match: e.toLowerCase().trim() === userEmail,
    }))
  })

  if (!isAuthorized) {
    console.log('[AdminPanel Server] Access denied, redirecting to dashboard')
    redirect('/dashboard')
  }

  console.log('[AdminPanel Server] Admin access granted, rendering client component')

  return <AdminPanelClient />
}