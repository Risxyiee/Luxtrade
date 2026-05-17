'use client'

export const dynamic = 'force-dynamic'

import dynamicImport from 'next/dynamic'

// Dynamically import the dashboard component to avoid hoisting issues
const LuxTradeDashboard = dynamicImport(() => import('./LuxTradeDashboard'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#0a0712] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60 text-sm">Loading dashboard...</p>
      </div>
    </div>
  )
})

export default LuxTradeDashboard
