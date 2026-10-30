import { redirect } from 'next/navigation'

/**
 * LEGACY redirect — /admin-dashboard-secret sudah dikonsolidasikan ke /dashboard/admin.
 * Halaman ini cuma penjaga URL lama (bookmark / ketik langsung).
 *
 * Riwayat (P1 final, 2026-10-30): dulu 537 baris duplikat user management yang
 * membaca DB LANGSUNG dari browser (anon key) dengan gate client-side saja.
 * Sekarang redirect polos tanpa data; admin asli di /dashboard/admin.
 */
export default function AdminDashboardSecretRedirect() {
  redirect('/dashboard/admin')
}
