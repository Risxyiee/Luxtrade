import { redirect } from 'next/navigation'

/**
 * LEGACY redirect — /admin-secure sudah dikonsolidasikan ke /dashboard/admin.
 * Halaman ini cuma penjaga URL lama (bookmark / ketik langsung).
 *
 * Riwayat (P1 final, 2026-10-30): dulu 611 baris duplikat user management
 * dengan gate client-side saja. Sekarang redirect polos tanpa data apa pun;
 * admin asli di /dashboard/admin (gate server + middleware).
 */
export default function AdminSecureRedirect() {
  redirect('/dashboard/admin')
}
