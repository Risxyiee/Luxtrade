'use client'

/**
 * GuideVideoInner — wrapper @remotion/player. File ini HANYA
 * dimuat via next/dynamic (ssr:false) dari GuideVideoPlayer,
 * jadi paket remotion tidak pernah dievaluasi saat SSR.
 *
 * Catatan playback: autoPlay bisa ditolak browser (kebijakan
 * autoplay / quirk saat mount di dalam dialog). Karena itu kita
 * pasang ref + retry play() di mount — kalau tetap pause, user
 * tinggal klik video (clickToPlay aktif).
 */

import { useEffect, useRef } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import {
  GUIDE_DURATION,
  GUIDE_FPS,
  GUIDE_H,
  GUIDE_W,
  GuideVideo,
  type GuideLang,
  type GuideMode,
} from './GuideVideo'

export default function GuideVideoInner({ mode, lang }: { mode: GuideMode; lang: GuideLang }) {
  const playerRef = useRef<PlayerRef>(null)

  useEffect(() => {
    const p = playerRef.current
    if (!p) return
    let tries = 0
    const id = setInterval(() => {
      tries += 1
      if (tries > 12) {
        clearInterval(id)
        return
      }
      if (p.isPlaying()) {
        clearInterval(id)
        return
      }
      try {
        p.play()
      } catch {
        /* autoplay ditolak — user bisa klik video untuk play */
      }
    }, 400)
    return () => clearInterval(id)
  }, [])

  return (
    <Player
      ref={playerRef}
      component={GuideVideo}
      inputProps={{ mode, lang }}
      durationInFrames={GUIDE_DURATION}
      compositionWidth={GUIDE_W}
      compositionHeight={GUIDE_H}
      fps={GUIDE_FPS}
      style={{ width: '100%', borderRadius: 14 }}
      controls
      clickToPlay
      loop
      autoPlay
      acknowledgeRemotionLicense
    />
  )
}
