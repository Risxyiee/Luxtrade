'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * REDIRECT — halaman cleanup connections ikut pensiun bersama integrasi
 * MetaApi yang dihapus (2025-11). Dulu dipakai membersihkan akun PENDING
 * sisa connect MetaApi yang gagal; sekarang tidak relevan lagi.
 */
export default function ConnectionsCleanupRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard')
  }, [router])

  return (
    <div className="min-h-screen bg-lux-bg-primary flex items-center justify-center">
      <p className="text-lux-text-muted text-sm">Mengalihkan ke Accounts…</p>
    </div>
  )
}
