'use client'

import { useEffect, useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

/**
 * ImpersonationBanner
 *
 * Shows a banner at the top of the dashboard when admin is viewing as another user.
 * Allows admin to exit impersonation mode and return to admin panel.
 */
export default function ImpersonationBanner() {
  const router = useRouter()
  const [impersonatingEmail, setImpersonatingEmail] = useState<string | null>(null)

  useEffect(() => {
    // Check if admin is impersonating
    const email = localStorage.getItem('admin_impersonating_email')
    if (email) {
      setImpersonatingEmail(email)
    }
  }, [])

  const exitImpersonation = () => {
    localStorage.removeItem('admin_impersonating')
    localStorage.removeItem('admin_impersonating_email')
    setImpersonatingEmail(null)
    toast.success('Keluar dari mode impersonation')
    router.push('/admin-secret')
  }

  if (!impersonatingEmail) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-red-600 to-orange-600 text-white px-4 py-2 flex items-center justify-center gap-3 shadow-lg">
      <AlertTriangle className="w-4 h-4" />
      <span className="text-sm font-medium">
        Anda sedang melihat akun <span className="font-bold">{impersonatingEmail}</span>
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={exitImpersonation}
        className="bg-white/10 hover:bg-white/20 border-white/20 text-white ml-4"
      >
        <X className="w-4 h-4 mr-1" />
        Keluar
      </Button>
    </div>
  )
}
