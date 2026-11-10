'use client'

/**
 * GuideVideoPlayer — pintu masuk video panduan Remotion.
 * Di-dynamic-import (ssr:false) supaya:
 *  - remotion tidak masuk chunk awal dashboard (lazy load saat
 *    dialog panduan dibuka saja),
 *  - tidak ada evaluasi modul remotion di server (SSR-safe).
 */

import dynamic from 'next/dynamic'
import type { GuideLang, GuideMode } from './GuideVideo'

const GuideVideoInner = dynamic(() => import('./GuideVideoInner'), {
  ssr: false,
  loading: () => (
    <div
      className="w-full rounded-xl bg-blue-950/20 border border-blue-900/30 flex items-center justify-center animate-pulse"
      style={{ aspectRatio: '4 / 5' }}
    >
      <span className="text-xs text-cyan-300/70">Memuat video panduan...</span>
    </div>
  ),
})

export default function GuideVideoPlayer({ mode, lang }: { mode: GuideMode; lang: GuideLang }) {
  return <GuideVideoInner mode={mode} lang={lang} />
}
