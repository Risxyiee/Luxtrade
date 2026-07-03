'use client'

import React, { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, VolumeX, MonitorPlay, Sparkles } from 'lucide-react'

interface TutorialVideoSectionProps {
  language: 'id' | 'en'
}

// Floating particles around the video
function VideoParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Orbiting glow orbs */}
      <motion.div
        className="absolute -top-8 -left-8 w-40 h-40 rounded-full bg-purple-500/20 blur-[60px]"
        animate={{
          x: [0, 30, -10, 0],
          y: [0, -20, 15, 0],
          scale: [1, 1.3, 0.9, 1],
          opacity: [0.4, 0.7, 0.3, 0.5],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-cyan-500/15 blur-[70px]"
        animate={{
          x: [0, -25, 15, 0],
          y: [0, 20, -15, 0],
          scale: [1, 1.2, 0.8, 1],
          opacity: [0.3, 0.6, 0.2, 0.4],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
      <motion.div
        className="absolute top-1/2 -right-16 w-32 h-32 rounded-full bg-amber-500/15 blur-[50px]"
        animate={{
          x: [0, 20, -20, 0],
          y: [-30, 10, 20, -30],
          opacity: [0.2, 0.5, 0.15, 0.3],
        }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
      <motion.div
        className="absolute top-1/3 -left-20 w-36 h-36 rounded-full bg-pink-500/10 blur-[60px]"
        animate={{
          x: [0, -15, 25, 0],
          y: [10, -25, 5, 10],
          opacity: [0.15, 0.4, 0.1, 0.25],
        }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />

      {/* Tiny floating sparkles */}
      {[...Array(12)].map((_, i) => {
        const angle = (i / 12) * Math.PI * 2
        const radiusX = 52 + (i % 3) * 5
        const radiusY = 48 + (i % 2) * 4
        return (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white/60"
            style={{
              left: `${50 + Math.cos(angle) * radiusX}%`,
              top: `${50 + Math.sin(angle) * radiusY}%`,
            }}
            animate={{
              opacity: [0, 0.8, 0],
              scale: [0.5, 1.2, 0.5],
              y: [0, -8, 0],
            }}
            transition={{
              duration: 2 + (i % 3) * 0.5,
              repeat: Infinity,
              delay: i * 0.3,
              ease: 'easeInOut',
            }}
          />
        )
      })}
    </div>
  )
}

// Animated gradient border
function AnimatedBorder() {
  return (
    <div className="absolute -inset-[2px] rounded-2xl overflow-hidden pointer-events-none">
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'conic-gradient(from 0deg, #8b5cf6, #06b6d4, #f59e0b, #ec4899, #8b5cf6)',
          borderRadius: 'inherit',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  )
}

export default function TutorialVideoSection({ language }: TutorialVideoSectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.3 }
    )
    const el = videoRef.current?.parentElement
    if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const handlePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Section background glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/5 to-transparent pointer-events-none" />

      <div className="max-w-3xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col items-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-gradient-to-r from-purple-500/15 via-cyan-500/10 to-amber-500/10 border border-purple-500/25 mb-6"
          >
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
            </motion.div>
            <span className="text-sm font-bold text-[var(--lux-text-on-surface)]">
              {language === 'id' ? 'Video Tutorial' : 'Video Tutorial'}
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl font-bold text-[var(--lux-text-primary)] mb-3 text-center"
          >
            {language === 'id'
              ? 'Lihat Cara Kerjanya'
              : 'See How It Works'}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-[var(--lux-text-subtitle)] max-w-md text-center text-base"
          >
            {language === 'id'
              ? 'Tutorial singkat cara menambahkan trade di LuxTrade.'
              : 'A quick tutorial on how to add a trade in LuxTrade.'}
          </motion.p>
        </div>

        {/* Video Container with Premium Effects */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative group"
        >
          {/* Outer glow ring */}
          <motion.div
            className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-purple-500/20 via-cyan-500/15 to-amber-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"
          />

          {/* Animated rotating border */}
          <div className="absolute -inset-[2px] rounded-2xl overflow-hidden opacity-60 group-hover:opacity-100 transition-opacity duration-500">
            <motion.div
              className="absolute -inset-[100%]"
              style={{
                background: 'conic-gradient(from 0deg, transparent 0%, #8b5cf6 10%, #06b6d4 20%, transparent 30%, #f59e0b 50%, transparent 60%, #ec4899 75%, transparent 85%, #8b5cf6 100%)',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
            />
          </div>

          {/* Inner content with dark bg to mask the rotating border center */}
          <div className="relative rounded-2xl overflow-hidden bg-[#0a0712] shadow-2xl shadow-purple-500/20">
            {/* Floating particles */}
            <VideoParticles />

            {/* Subtle inner border glow */}
            <div className="absolute inset-0 rounded-2xl border border-white/10 z-10 pointer-events-none" />
            <motion.div
              className="absolute inset-0 rounded-2xl z-10 pointer-events-none"
              style={{
                boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.08), inset 0 -1px 0 0 rgba(255,255,255,0.03)',
              }}
            />

            {/* Video */}
            <video
              ref={videoRef}
              src="/demo-tutorial.mp4"
              playsInline
              preload="metadata"
              loop
              className="w-full object-contain relative z-[5] cursor-pointer"
              onClick={handlePlay}
            />

            {/* Play/Pause Overlay */}
            <AnimatePresence>
              {!isPlaying && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] cursor-pointer z-20"
                  onClick={handlePlay}
                >
                  {/* Pulsing ring behind play button */}
                  <motion.div
                    className="absolute w-24 h-24 sm:w-32 sm:h-32 rounded-full border-2 border-purple-400/30"
                    animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                  />
                  <motion.div
                    className="absolute w-24 h-24 sm:w-32 sm:h-32 rounded-full border border-cyan-400/20"
                    animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
                  />

                  {/* Play button */}
                  <motion.div
                    whileHover={{ scale: 1.1, boxShadow: '0 0 40px rgba(139,92,246,0.5)' }}
                    whileTap={{ scale: 0.95 }}
                    className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/40"
                  >
                    <div className="absolute inset-[2px] rounded-full bg-gradient-to-br from-purple-400/20 to-violet-500/20 backdrop-blur-sm" />
                    <Play className="w-7 h-7 sm:w-8 sm:h-8 text-white ml-1 relative z-10" fill="white" />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pause button (when playing) */}
            <AnimatePresence>
              {isPlaying && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-4 right-4 z-20"
                >
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => { e.stopPropagation(); handlePlay() }}
                    className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    <Pause className="w-4 h-4 text-white" fill="white" />
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Top badges */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10">
                <MonitorPlay className="w-3 h-3 text-purple-400" />
                <span className="text-[10px] text-white/80 font-medium">
                  {language === 'id' ? 'Tutorial Trade' : 'Trade Tutorial'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10">
                <VolumeX className="w-3 h-3 text-white/60" />
                <span className="text-[10px] text-white/60 font-medium">No Audio</span>
              </div>
            </div>
          </div>

          {/* Corner accents */}
          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-purple-400/50 rounded-tl-2xl pointer-events-none" />
          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-cyan-400/50 rounded-tr-2xl pointer-events-none" />
          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-amber-400/50 rounded-bl-2xl pointer-events-none" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-pink-400/50 rounded-br-2xl pointer-events-none" />
        </motion.div>

        {/* Bottom caption */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center text-xs text-[var(--lux-text-subtitle)] mt-6 opacity-50"
        >
          {language === 'id'
            ? 'Video tanpa suara — fokus ke tampilan'
            : 'Video without audio — focused on visuals'}
        </motion.p>
      </div>
    </section>
  )
}