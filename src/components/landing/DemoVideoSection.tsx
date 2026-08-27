'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Monitor } from 'lucide-react'

interface DemoVideoSectionProps {
  language: 'id' | 'en'
}

export default function DemoVideoSection({ language }: DemoVideoSectionProps) {
  const [activeDemoVideo, setActiveDemoVideo] = useState<0 | 1>(0)

  return (
    <section id="demo" className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col items-center mb-8">
          {/* Unique badge: subtle outlined pill with emerald accent */}
          <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 mb-6">
            <Monitor className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-[var(--lux-text-on-surface)]">
              {language === 'id' ? 'Tampilan Asli' : 'Real Preview'}
            </span>
          </div>
        </div>

        {/* Tab buttons */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <button
            onClick={() => setActiveDemoVideo(0)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer ${activeDemoVideo === 0 ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/20' : 'bg-[var(--lux-inline-hover-bg)] text-[var(--lux-text-subtitle)] hover:text-[var(--lux-text-body-2)] hover:bg-[var(--lux-inline-hover-bg-2)] border border-[var(--lux-inline-border)]'}`}
          >
            {language === 'id' ? 'Dashboard' : 'Dashboard'}
          </button>
          <button
            onClick={() => setActiveDemoVideo(1)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer ${activeDemoVideo === 1 ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/20' : 'bg-[var(--lux-inline-hover-bg)] text-[var(--lux-text-subtitle)] hover:text-[var(--lux-text-body-2)] hover:bg-[var(--lux-inline-hover-bg-2)] border border-[var(--lux-inline-border)]'}`}
          >
            {language === 'id' ? 'Landing Page' : 'Landing Page'}
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeDemoVideo}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4 }}
            className="relative group"
          >
            {/* Elegant glowing border */}
            <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-blue-500/60 via-cyan-400/60 to-blue-500/60 opacity-60 group-hover:opacity-100 transition-opacity duration-700 blur-[1px]" />
            <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-blue-500/30 via-cyan-400/30 to-blue-500/30 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-[8px]" />
            <div className="absolute -inset-[2px] rounded-2xl bg-gradient-to-br from-blue-600/20 via-transparent to-cyan-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-[16px]" />

            {/* Video container */}
            <div className="relative rounded-2xl overflow-hidden bg-[var(--lux-video-bg)] border border-[var(--lux-inline-border)]">
              {activeDemoVideo === 0 ? (
                <video autoPlay loop muted playsInline className="w-full h-auto block" poster="/demo-video-poster.png">
                  <source src="/demo-video.mp4" type="video/mp4" />
                </video>
              ) : (
                <video autoPlay loop muted playsInline className="w-full h-auto block" poster="/demo-video-poster-2.png">
                  <source src="/demo-video-2.mp4" type="video/mp4" />
                </video>
              )}

              {/* Subtle vignette overlay */}
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.3)_100%)]" />

              {/* Play button overlay (shows on hover) */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="w-16 h-16 rounded-full bg-[var(--lux-inline-hover-bg-2)] backdrop-blur-md border border-[var(--lux-inline-hover-bg-2)] flex items-center justify-center">
                  <Play className="w-6 h-6 text-[var(--lux-text-primary)] ml-1" />
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}