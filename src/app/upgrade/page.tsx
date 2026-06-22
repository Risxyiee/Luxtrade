import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import UpgradeFormClient from './UpgradeFormClient'

/**
 * Server Component — auth guard + renders client form
 * Runs as Node.js server component (NO edge runtime).
 */
export default async function UpgradePage() {
  // In local dev without Supabase, bypass auth and use dev user
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return <UpgradeFormClient user={{ id: 'dev-user', email: 'dev@test.com' }} />
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?redirect=/upgrade')
  }

  return <UpgradeFormClient user={user} />
}

// Explicitly use Node.js runtime — NEVER edge runtime
export const runtime = 'nodejs'
