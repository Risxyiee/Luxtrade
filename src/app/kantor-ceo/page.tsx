'use client'

/**
 * Ruang CEO — halaman dasbor eksekutif LuxTradee Super AI Agent.
 *
 * Catatan teknis:
 *  - `next/dynamic` dengan `ssr: false` HANYA boleh dipakai di Client Component
 *    pada App Router, maka file ini 'use client' dan memuat dashboard interaktif
 *    (RuangCeoDashboard) secara dinamis tanpa SSR.
 *  - API: /api/ceo-agent (Edge Runtime) — lihat src/app/api/ceo-agent/route.ts
 */

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

const RuangCeoDashboard = dynamic(() => import('./RuangCeoDashboard'), {
  ssr: false,
  loading: () => (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10">
      <div className="space-y-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    </div>
  ),
})

export default function KantorCeoPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">
        <RuangCeoDashboard />
      </main>
      <footer className="mt-auto border-t py-4">
        <p className="text-center text-xs text-muted-foreground">
          Ruang CEO · LuxTradee Super AI Agent — CTO · CSO · CMO · CFO
        </p>
      </footer>
    </div>
  )
}
