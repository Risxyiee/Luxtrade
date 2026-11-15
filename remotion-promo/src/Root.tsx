import React from 'react'
import { Composition } from 'remotion'
import { PromoVideo } from './PromoVideo'

/* Komposisi: 1080x1920 (TikTok vertikal), 30fps, 32 dtk = 960 frame */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PromoVideo"
        component={PromoVideo}
        durationInFrames={960}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  )
}
