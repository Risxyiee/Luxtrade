import React from 'react'
import { Composition } from 'remotion'
import { PromoVideo } from './PromoVideo'

/* Komposisi: 1080x1920 (TikTok vertikal), 30fps.
 * Total TransitionSeries = (90+100+114+205+186+145+148+135) - (14+12+13+15+14+12+12) = 1031 frame = ±34 dtk
 * VO: S1 suara asli pemilik (greeting.wav), S2-S8 narator id-ID-ArdiNeural (edge-tts) */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PromoVideo"
        component={PromoVideo}
        durationInFrames={1031}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  )
}
