'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, VolumeX, MonitorPlay } from 'lucide-react'
import { TutorialSvg } from './SectionSvgArt'

interface TutorialVideoSectionProps {
  language: 'id' | 'en'
}

// Simplified floating particles
function VideoParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute -top-8 -left-8 w-40 h-40 rounded-full bg-blue-500/10 blur-[60px]"
        animate={{ x: [0, 30, -10, 0], y: [0, -20, 15, 0], scale: [1, 1.3, 0.9, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-blue-500/15 blur-[70px]"
        animate={{ x: [0, -25, 15, 0], y: [0, 20, -15, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2
        return (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white/60"
            style={{
              left: `${50 + Math.cos(angle) * 55}%`,
              top: `${50 + Math.sin(angle) * 50}%`,
            }}
            animate={{ opacity: [0, 0.8, 0], scale: [0.5, 1.2, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.5, ease: 'easeInOut' }}
          />
        )
      })}
    </div>
  )
}

export default function TutorialVideoSection({ language }: TutorialVideoSectionProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [showVideo, setShowVideo] = useState(false)

  const handlePlay = () => {
    setShowVideo(true)
    setIsPlaying(true)
  }

  return (
    <section className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <TutorialSvg />

      <div className="max-w-[400px] sm:max-w-[420px] mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col items-center mb-12">
          <p className="text-[12px] font-medium tracking-[0.18em] uppercase text-[#8892b0] mb-3">
            {language === 'id' ? 'Video Tutorial' : 'Video Tutorial'}
          </p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-[40px] font-medium tracking-tight text-[#f0f2ff] mb-3 text-center"
          >
            {language === 'id' ? 'Lihat Cara Kerjanya' : 'See How It Works'}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ delay: 0.2 }}
            className="text-[#8892b0] max-w-md text-center text-base"
          >
            {language === 'id'
              ? 'Tutorial singkat cara menambahkan trade di LuxTrade.'
              : 'A quick tutorial on how to add a trade in LuxTrade.'}
          </motion.p>
        </div>

        {/* Video Container */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.5 }}
          className="relative group"
        >
          {/* Outer glow */}
          <div className="absolute -inset-4 rounded-2xl bg-white/[0.03] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

          {/* Inner content */}
          <div className="relative rounded-2xl overflow-hidden bg-[#0c1445] shadow-2xl">
            <VideoParticles />
            <div className="absolute inset-0 rounded-2xl border border-white/10 z-10 pointer-events-none" />

            {/* YouTube Embed or Placeholder */}
            {showVideo ? (
              <div className="relative z-[5] w-full aspect-video">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0"
                  title="LuxTrade Tutorial"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div
                className="relative z-[5] w-full aspect-video flex items-center justify-center cursor-pointer bg-gradient-to-br from-[#0c1445] to-[#0a0e2a]"
                onClick={handlePlay}
              >
                <div className="flex flex-col items-center gap-3">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-500 text-white flex items-center justify-center"
                  >
                    <Play className="w-7 h-7 sm:w-8 sm:h-8 text-white ml-1 relative z-10" fill="white" />
                  </motion.div>
                  <p className="text-sm text-[#8892b0]">
                    {language === 'id' ? 'Klik untuk menonton' : 'Click to watch'}
                  </p>
                </div>
              </div>
            )}

            {/* Top badges */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10">
                <MonitorPlay className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] text-[#f0f2ff]/80 font-medium">
                  {language === 'id' ? 'Tutorial Trade' : 'Trade Tutorial'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10">
                <VolumeX className="w-3 h-3 text-[#8892b0]" />
                <span className="text-[10px] text-[#8892b0] font-medium">Video</span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-xs text-[#8892b0] mt-6 opacity-50"
        >
          {language === 'id'
            ? 'Klik play untuk mulai tutorial'
            : 'Click play to start the tutorial'}
        </motion.p>
      </div>
    </section>
  )
}
