'use client'

/**
 * Ruang CEO — KANTOR VIRTUAL 3D LuxTradee Super AI Agent.
 *
 * Catatan teknis:
 *  - `next/dynamic` dengan `ssr: false` HANYA boleh dipakai di Client Component
 *    pada App Router, maka file ini 'use client' dan memuat scene 3D
 *    (KantorCeo3D) secara dinamis tanpa SSR — Three.js tidak ikut bundle SSR.
 *  - API: /api/ceo-agent (Cloudflare Workers via OpenNext) —
 *    lihat src/app/api/ceo-agent/route.ts
 */

import dynamic from 'next/dynamic'

const KantorCeo3D = dynamic(() => import('./KantorCeo3D'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: '#05050a',
        color: '#10f5a0',
        fontFamily: 'monospace',
        letterSpacing: '.2em',
        fontSize: 12,
      }}
    >
      MEMUAT KANTOR 3D…
    </div>
  ),
})

export default function KantorCeoPage() {
  return <KantorCeo3D />
}
