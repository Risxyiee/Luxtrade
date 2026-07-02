'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play } from 'lucide-react'

interface DemoVideoSectionProps {
  language: 'id' | 'en'
}

export default function DemoVideoSection({ language }: DemoVideoSectionProps) {
  const [activeDemoVideo, setActiveDemoVideo] = useState<0 | 1>(0)

  return (
    <section id="demo" className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center h-9 w-max bg-[#2a1b3d]/90 backdrop-blur-sm border border-white/10 rounded-xl mb-6">
            <div className="w-4 h-full" />
            <div className="flex items-center gap-2 text-sm font-medium text-white/90">
              <Play className="w-4 h-4 text-emerald-400" />
              {language === 'id' ? 'Tampilan Asli' : 'Real Preview'}
            </div>
            <div className="w-4 h-full" />
          </div>
        </div>

        {/* Tab buttons */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <button
            onClick={() => setActiveDemoVideo(0)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer ${activeDemoVideo === 0 ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg shadow-purple-500/20' : 'bg-white/[0.04] text-white/50 hover:text-white/80 hover:bg-white/[0.08] border border-white/[0.08]'}`}
          >
            {language === 'id' ? 'Dashboard' : 'Dashboard'}
          </button>
          <button
            onClick={() => setActiveDemoVideo(1)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer ${activeDemoVideo === 1 ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg shadow-purple-500/20' : 'bg-white/[0.04] text-white/50 hover:text-white/80 hover:bg-white/[0.08] border border-white/[0.08]'}`}
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
            <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-purple-500/60 via-cyan-400/60 to-purple-500/60 opacity-60 group-hover:opacity-100 transition-opacity duration-700 blur-[1px]" />
            <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-purple-500/30 via-cyan-400/30 to-purple-500/30 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-[8px]" />
            <div className="absolute -inset-[2px] rounded-2xl bg-gradient-to-br from-purple-600/20 via-transparent to-cyan-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-[16px]" />

            {/* Video container */}
            <div className="relative rounded-2xl overflow-hidden bg-[#080510] border border-white/[0.08]">
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
                <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                  <Play className="w-6 h-6 text-white ml-1" />
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}