import { redirect } from 'next/navigation'
import { getServerClient } from '@/lib/supabase'
import { ADMIN_EMAILS } from '@/lib/admin-auth'
import AdminTestimonialsClient from './AdminTestimonialsClient'

export const dynamic = 'force-dynamic'

export default async function AdminTestimonialsPage() {
  const supabase = await getServerClient()
  if (!supabase) redirect('/auth/login')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const userEmail = user.email?.toLowerCase().trim() || ''
  const isAuthorized = ADMIN_EMAILS.some(adminEmail =>
    adminEmail.toLowerCase().trim() === userEmail
  )

  if (!isAuthorized) redirect('/dashboard')

  return <AdminTestimonialsClient />
}
