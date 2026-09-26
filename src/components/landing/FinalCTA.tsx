'use client'

import React, { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Rocket, ShieldCheck, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

interface FinalCTAProps {
  language?: 'id' | 'en'
}

function LuxTradeLogo3D() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const isTouch = useRef(false)

  useEffect(() => {
    isTouch.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  }, [])

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isTouch.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const cx = rect.width / 2
    const cy = rect.height / 2
    setTilt({
      x: ((y - cy) / cy) * -15,
      y: ((x - cx) / cx) * 15,
    })
  }

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 })
    setIsHovered(false)
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={() => setIsHovered(true)}
      className="mt-16 mb-8"
      style={{ perspective: '1200px' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex items-center justify-center"
        style={{
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Outer glow behind logo */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: '200px',
            height: '200px',
            background: isHovered
              ? 'radial-gradient(circle, rgba(6,182,212,0.25) 0%, rgba(59,130,246,0.12) 40%, transparent 65%)'
              : 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 55%)',
            transition: 'all 0.5s ease',
            filter: 'blur(20px)',
            animation: 'lux-glow-breathe 5s ease-in-out infinite',
          }}
        />

        {/* Tilt wrapper - responds to mouse */}
        <div
          style={{
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: 'transform 0.2s ease-out',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Spin wrapper - smooth continuous rotation */}
          <div
            style={{
              transformStyle: 'preserve-3d',
              animation: 'lux-smooth-spin 12s linear infinite',
            }}
          >
            {/* Glassmorphic platform behind logo */}
            <div
              className="relative flex items-center justify-center rounded-3xl"
              style={{
                width: '160px',
                height: '160px',
                background: isHovered
                  ? 'linear-gradient(145deg, rgba(6,182,212,0.12), rgba(59,130,246,0.08), rgba(10,10,25,0.5))'
                  : 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02), rgba(10,10,25,0.3))',
                backdropFilter: 'blur(20px) saturate(150%)',
                border: isHovered
                  ? '1px solid rgba(6,182,212,0.3)'
                  : '1px solid rgba(255,255,255,0.06)',
                boxShadow: isHovered
                  ? '0 0 50px rgba(6,182,212,0.2), 0 0 100px rgba(59,130,246,0.08), 0 25px 50px -12px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)'
                  : '0 0 30px rgba(6,182,212,0.08), 0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {/* The logo image */}
              <Image
                src="/logo.png"
                alt="LuxTradee"
                width={110}
                height={110}
                className="relative object-contain"
                style={{
                  transform: 'translateZ(30px)',
                  filter: isHovered
                    ? 'drop-shadow(0 0 18px rgba(6,182,212,0.6)) drop-shadow(0 0 36px rgba(59,130,246,0.25))'
                    : 'drop-shadow(0 0 8px rgba(6,182,212,0.3)) drop-shadow(0 0 16px rgba(59,130,246,0.12))',
                  transition: 'filter 0.5s ease',
                }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Keyframe animations */}
      <style jsx global>{`
        @keyframes lux-smooth-spin {
          0% { transform: rotateX(0deg) rotateY(0deg); }
          100% { transform: rotateX(360deg) rotateY(0deg); }
        }
        @keyframes lux-glow-breathe {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.08); }
        }
      `}</style>
    </div>
  )
}

export default function FinalCTA({ language = 'id' }: FinalCTAProps) {
  // Calculate urgency countdown (ends at midnight)
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const now = new Date()
    const endOfDay = new Date(now)
    endOfDay.setHours(23, 59, 59, 999)

    const updateTime = () => {
      const current = new Date()
      const diff = endOfDay.getTime() - current.getTime()

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 })
        return
      }

      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeLeft({ hours, minutes, seconds })
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])
  return (
    <section className="py-40 relative z-10 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100%] h-[100%] bg-blue-600/10 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-cyan-500/10 blur-[150px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 max-w-4xl mx-auto px-6 text-center flex flex-col items-center gap-8"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-xs font-mono tracking-wider text-cyan-300">
          <Rocket className="w-3 h-3" /> {language === 'en' ? 'START YOUR TRADING JOURNEY' : 'MULAI PERJALANAN TRADING ANDA'}
        </div>
        <h2 className="text-5xl md:text-7xl font-bold tracking-tighter max-w-3xl bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-gray-600">
          {language === 'en' ? 'Ready to Build Your Trading Edge?' : 'Siap Bangun Edge Trading Anda?'}
        </h2>

        {/* Countdown Timer */}
        <div className="mt-4 mb-2">
          <div className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30">
            <span className="text-orange-400 font-semibold text-sm">{language === 'en' ? 'Offer ends in:' : 'Penawaran berakhir dalam:'}</span>
            <span className="flex gap-1 ml-2">
              <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-300 font-mono font-bold text-xs">
                {String(timeLeft.hours).padStart(2, '0')}h
              </span>
              <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-300 font-mono font-bold text-xs">
                {String(timeLeft.minutes).padStart(2, '0')}m
              </span>
              <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-300 font-mono font-bold text-xs">
                {String(timeLeft.seconds).padStart(2, '0')}s
              </span>
            </span>
          </div>
        </div>

        <p className="max-w-2xl text-lg text-gray-400">
          {language === 'en'
            ? 'Join Indonesian traders who are controlling risk, disciplining psychology, and finding their best setups through LuxTradee.'
            : 'Bergabung bersama trader Indonesia yang sudah mengontrol risiko, mendisiplinkan psikologi, dan menemukan setup terbaik mereka lewat LuxTradee.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <Link href="/auth/signup">
            <span className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-medium rounded-xl hover:opacity-90 transition-all glow-bg-luxury text-lg group">
              {language === 'en' ? 'Sign Up Free Now' : 'Daftar Gratis Sekarang'} 
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        </div>
        <p className="text-xs text-gray-500 font-mono flex items-center gap-2 mt-2">
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
          {language === 'en' ? 'No credit card required. Full basic features access forever.' : 'Tanpa kartu kredit. Akses penuh fitur dasar selamanya.'}
        </p>

        {/* Discord Community Link */}
        <div className="flex flex-col items-center gap-2 mt-4">
          <a
            href="https://discord.gg/JwMxsmMqG"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#5865F2]/10 border border-[#5865F2]/30 text-[#5865F2] rounded-xl hover:bg-[#5865F2]/20 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            <span className="font-medium">{language === 'en' ? 'Join Our Discord Community' : 'Gabung Komunitas Discord Kami'}</span>
          </a>
          <p className="text-xs text-gray-500">
            {language === 'en'
              ? 'Connect with other prop firm traders, share strategies, and get support'
              : 'Terhubung dengan trader prop firm lain, bagikan strategi, dan dapat dukungan'}
          </p>
        </div>

        {/* 3D LuxTrade Logo */}
        <LuxTradeLogo3D />
      </motion.div>
    </section>
  )
}
