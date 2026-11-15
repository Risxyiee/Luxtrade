import React from 'react'
import { Composition } from 'remotion'
import { PromoVideo } from './PromoVideo'

/* Komposisi: 1080x1920 (TikTok vertikal), 30fps.
 * Total TransitionSeries = (100+100+205+180+150+120+135) - (14+12+13+15+14+12) = 910 frame = ±30,3 dtk */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PromoVideo"
        component={PromoVideo}
        durationInFrames={910}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  )
}
