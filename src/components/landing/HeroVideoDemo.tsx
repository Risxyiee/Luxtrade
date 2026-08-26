'use client'

import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'

interface HeroVideoDemoProps {
  videoSrcMp4?: string
  videoSrcWebm?: string
  posterSrc?: string
}

export default function HeroVideoDemo({
  videoSrcMp4 = '/demo-video.mp4',
  videoSrcWebm = '/demo-video.webm',
  posterSrc = '/demo-video-poster.png',
}: HeroVideoDemoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  const handleCanPlay = () => {
    setIsLoaded(true)
    videoRef.current?.play().then(() => {
      setIsPlaying(true)
    }).catch(() => {
      // Autoplay blocked — user interaction needed
    })
  }

  const handlePlay = () => setIsPlaying(true)
  const handlePause = () => setIsPlaying(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative mt-8 w-full max-w-sm sm:max-w-md mx-auto lg:mx-0"
    >
      {/* Phone Mockup Frame */}
      <div className="relative rounded-[2.5rem] border-[3px] border-white/15 bg-black/60 backdrop-blur-sm p-2.5 shadow-2xl shadow-blue-500/10">
        {/* Phone Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-b-2xl z-20 flex items-center justify-center">
          <div className="w-16 h-1.5 bg-white/20 rounded-full" />
        </div>

        {/* Phone Screen */}
        <div className="relative rounded-[2rem] overflow-hidden bg-black aspect-[9/16]">
          {/* Poster / Loading State */}
          {!isLoaded && posterSrc && (
            <div className="absolute inset-0 z-10">
              <img
                src={posterSrc}
                alt="LuxTradee Demo"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
              </div>
            </div>
          )}

          {/* Video Element */}
          <video
            ref={videoRef}
            className={`w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            poster={posterSrc}
            onCanPlay={handleCanPlay}
            onPlay={handlePlay}
            onPause={handlePause}
          >
            {videoSrcWebm && <source src={videoSrcWebm} type="video/webm" />}
            {videoSrcMp4 && <source src={videoSrcMp4} type="video/mp4" />}
            Your browser does not support the video tag.
          </video>

          {/* Playing indicator */}
          {isLoaded && isPlaying && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-[10px] text-white/80 font-medium tracking-wide">LIVE DEMO</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Reflection / Glow underneath phone */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-blue-500/15 blur-3xl rounded-full pointer-events-none" />
    </motion.div>
  )
}
