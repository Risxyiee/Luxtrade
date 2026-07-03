'use client'

import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Play, VolumeX, MonitorPlay } from 'lucide-react'

interface TutorialVideoSectionProps {
  language: 'id' | 'en'
}

export default function TutorialVideoSection({ language }: TutorialVideoSectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)

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
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col items-center mb-10">
          <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 border border-emerald-500/25 mb-6">
            <MonitorPlay className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-[var(--lux-text-on-surface)]">
              {language === 'id' ? 'Tutorial' : 'Tutorial'}
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--lux-text-primary)] mb-3 text-center">
            {language === 'id'
              ? 'Lihat Cara Kerjanya'
              : 'See How It Works'}
          </h2>
          <p className="text-[var(--lux-text-subtitle)] max-w-md text-center text-base">
            {language === 'id'
              ? 'Tutorial singkat cara menambahkan trade di LuxTrade.'
              : 'A quick tutorial on how to add a trade in LuxTrade.'}
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/50 shadow-2xl shadow-purple-500/10"
        >
          {/* Video */}
          <video
            ref={videoRef}
            src="/demo-tutorial.mp4"
            playsInline
            preload="metadata"
            className="w-full aspect-video object-cover cursor-pointer"
            onClick={handlePlay}
          />

          {/* Play/Pause Overlay */}
          {!isPlaying && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
              onClick={handlePlay}
            >
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center"
              >
                <Play className="w-7 h-7 sm:w-8 sm:h-8 text-white ml-1" fill="white" />
              </motion.div>
            </motion.div>
          )}

          {/* Muted Badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10">
            <VolumeX className="w-3.5 h-3.5 text-white/70" />
            <span className="text-[10px] text-white/70 font-medium">No Audio</span>
          </div>
        </motion.div>

        <p className="text-center text-xs text-[var(--lux-text-subtitle)] mt-4 opacity-60">
          {language === 'id'
            ? 'Video tanpa suara — fokus ke tampilan'
            : 'Video without audio — focused on visuals'}
        </p>
      </div>
    </section>
  )
}