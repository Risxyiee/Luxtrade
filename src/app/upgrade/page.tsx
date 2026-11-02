'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { getClientBrowserAsync } from '@/lib/supabase-browser'
import UpgradeFormClient from './UpgradeFormClient'

/**
 * FIX (laporan Bos: /upgrade 500 di production):
 * Dulu Server Component yang manggil `cookies()` (next/headers) +
 * supabase.auth.getUser() di RSC render. Di Cloudflare Workers
 * (opennextjs-cloudflare) pola ini gagal → 500 konsisten, dan halaman ini
 * SATU-SATUNYA di app yang pakai pola itu (halaman lain aman).
 *
 * Sekarang: client-side auth — pola yang sama dengan dashboard/settings
 * yang terbukti stabil di production. Halaman jadi static shell (0 CPU di
 * Worker), auth dicek di browser, belum login → redirect ke /auth/login.
 * Tidak ada konten rahasia di sini (harga & form checkout publik; aksi
 * pembayaran tetap dijaga API server-side fail-closed).
 */
export default function UpgradePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    const checkAuth = async () => {
      try {
        const supabase = await getClientBrowserAsync()

        if (!supabase) {
          if (!cancelled) {
            setLoadFailed(true)
            setChecking(false)
          }
          return
        }

        const { data: { user } } = await supabase.auth.getUser()

        if (cancelled) return

        if (!user) {
          // Belum login → redirect (server lama: redirect('/auth/login?redirect=/upgrade'))
          router.replace('/auth/login?redirect=/upgrade')
          return
        }

        setUser(user)
        setChecking(false)
      } catch {
        if (!cancelled) {
          setLoadFailed(true)
          setChecking(false)
        }
      }
    }

    checkAuth()
    return () => { cancelled = true }
  }, [router])

  // Sedang cek sesi
  if (checking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Memuat halaman upgrade…</p>
      </div>
    )
  }

  // Gagal load konfigurasi/auth — kasih cara keluar yang jelas
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-4 text-center">
        <p className="text-sm text-muted-foreground">
          Tidak dapat memuat halaman upgrade. Periksa koneksi lalu coba lagi.
        </p>
        <button
          onClick={() => { setChecking(true); setLoadFailed(false); router.refresh() }}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Coba Lagi
        </button>
      </div>
    )
  }

  return <UpgradeFormClient user={{ id: user.id, email: user.email || '' }} />
}
