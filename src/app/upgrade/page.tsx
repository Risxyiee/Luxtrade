import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import UpgradeFormClient from './UpgradeFormClient'

/**
 * Server Component — auth guard + renders client form
 * Runs on Cloudflare Edge runtime via OpenNext (no Node.js needed).
 */
export default async function UpgradePage() {
  // In local dev without Supabase, bypass auth and use dev user
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return <UpgradeFormClient user={{ id: 'dev-user', email: 'dev@test.com' }} />
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?redirect=/upgrade')
  }

  return <UpgradeFormClient user={{ id: user.id, email: user.email || '' }} />
}
