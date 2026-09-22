import { redirect } from 'next/navigation'

/**
 * LEGACY redirect — /admin-panel has been consolidated into /dashboard/admin.
 * This page is kept only to handle old bookmarks / direct URLs.
 */
export default function AdminPanelRedirect() {
  redirect('/dashboard/admin')
}
