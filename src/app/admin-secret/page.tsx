import { redirect } from 'next/navigation'

/**
 * LEGACY redirect — /admin-secret sudah dikonsolidasikan ke /dashboard/admin.
 * Halaman ini cuma penjaga URL lama (bookmark / ketik langsung).
 *
 * Riwayat (P1 final, 2026-10-30): dulu 690 baris duplikat user management
 * (aktivasi PRO 30/180/365 hari) yang sempat hardcode Rp48.000/Rp749.000.
 * Harga kini single-source di lib/pricing.ts dan aktivasi lewat panel baru
 * /dashboard/admin (gate server-component + middleware ADMIN_EMAILS).
 */
export default function AdminSecretRedirect() {
  redirect('/dashboard/admin')
}
