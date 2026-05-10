'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AffiliateRedirect() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to dashboard immediately
    router.replace('/dashboard')
  }, [router])

  return (
    <div className="min-h-screen bg-[#0a0612] flex items-center justify-center">
      <div className="text-center text-white/60">
        <p>Redirecting to dashboard...</p>
      </div>
    </div>
  )
}
