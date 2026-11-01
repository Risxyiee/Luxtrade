'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * REDIRECT — halaman /dashboard/connections sudah pensiun.
 *
 * Integrasi MetaApi DIHAPUS (keputusan Bos 2025-11): token METAAPI_TOKEN
 * di-retire, lib + API route-nya dihapus. Halaman ini dulu satu-satunya
 * konsumen /api/metaapi/connect & /api/metaapi/deals (orphan — tidak ada
 * link dari sidebar) → sekarang langsung dilempar ke tab Accounts,
 * tempat menambah akun trading secara manual.
 */
export default function ConnectionsRedirect() {
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
