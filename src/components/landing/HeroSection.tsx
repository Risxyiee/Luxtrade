'use client'

import React, { useRef, useEffect, useState } from 'react'
import { motion, useScroll, useTransform, useSpring } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { Sparkles, ScanLine } from 'lucide-react'

interface HeroSectionProps {
  language?: 'id' | 'en'
}

function HeroLogo3D() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check, { passive: true })
    return () => window.removeEventListener('resize', check)
  }, [])

  // Scroll-driven Y-axis spin (baling-baling style)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  })

  const rawRotateY = useTransform(scrollYProgress, [0, 1], [-30, 390])
  const rotateY = useSpring(rawRotateY, { stiffness: 60, damping: 30, restDelta: 0.001 })

  // Slight X tilt for depth feel
  const rawRotateX = useTransform(scrollYProgress, [0, 0.5, 1], [10, 0, -10])
  const rotateX = useSpring(rawRotateX, { stiffness: 60, damping: 30, restDelta: 0.001 })

  const logoSize = isDesktop ? 500 : 260
  const imageW = isDesktop ? 340 : 180

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Large ambient glow behind logo */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: isDesktop ? '700px' : '380px',
          height: isDesktop ? '700px' : '380px',
          top: isDesktop ? '45%' : '12%',
          left: isDesktop ? '35%' : '50%',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, rgba(6,182,212,0.08) 30%, rgba(16,185,129,0.04) 50%, transparent 70%)',
          filter: 'blur(40px)',
          animation: 'hero-logo-glow 7s ease-in-out infinite',
        }}
      />

      {/* Secondary glow ring for depth */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: isDesktop ? '400px' : '220px',
          height: isDesktop ? '400px' : '220px',
          top: isDesktop ? '45%' : '12%',
          left: isDesktop ? '35%' : '50%',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, transparent 40%, rgba(59,130,246,0.08) 60%, transparent 80%)',
          filter: 'blur(20px)',
          animation: 'hero-logo-glow 7s ease-in-out infinite',
          animationDelay: '-3.5s',
        }}
      />

      {/* 3D spinning logo */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          top: isDesktop ? '45%' : '12%',
          left: isDesktop ? '35%' : '50%',
          transform: 'translate(-50%, -50%)',
          perspective: '1200px',
        }}
      >
        <motion.div
          style={{
            rotateX,
            rotateY,
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Glassmorphic disc */}
          <div
            className="relative flex items-center justify-center rounded-full"
            style={{
              width: `${logoSize}px`,
              height: `${logoSize}px`,
              background: 'linear-gradient(145deg, rgba(59,130,246,0.06), rgba(6,182,212,0.03), rgba(10,10,25,0.12))',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(59,130,246,0.12)',
              boxShadow: '0 0 60px rgba(59,130,246,0.08), inset 0 0 40px rgba(6,182,212,0.04)',
            }}
          >
            <Image
              src="/logo.png"
              alt=""
              width={imageW}
              height={imageW}
              className="object-contain"
              style={{
                transform: 'translateZ(30px)',
                filter: isDesktop
                  ? 'drop-shadow(0 0 25px rgba(59,130,246,0.35)) drop-shadow(0 0 50px rgba(6,182,212,0.2)) drop-shadow(0 0 80px rgba(16,185,129,0.1))'
                  : 'drop-shadow(0 0 18px rgba(59,130,246,0.3)) drop-shadow(0 0 35px rgba(6,182,212,0.15))',
                opacity: isDesktop ? 0.35 : 0.25,
              }}
            />
          </div>
        </motion.div>
      </div>

      <style jsx global>{`
        @keyframes hero-logo-glow {
          0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.6; transform: translate(-50%, -50%) scale(1.15); }
        }
      `}</style>
    </div>
  )
}

export default function HeroSection({ language = 'id' }: HeroSectionProps) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 pb-20 z-10">
      <HeroLogo3D />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[100%] h-[60%] bg-blue-600/10 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[40%] bg-cyan-500/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-12 text-center lg:text-left">
        <div className="flex-1 flex flex-col gap-6 lg:items-start items-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-xs font-mono tracking-wider text-cyan-300"
          >
            <Sparkles className="w-3 h-3" /> {language === 'en' ? 'TRADING JOURNAL' : 'TRADING JOURNAL INDONESIA'}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter max-w-2xl bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-gray-600"
          >
            {language === 'en' ? 'Stop Trading Blind. Build Your Edge.' : 'Berhenti Trading Asal-Asalan. Bangun Edge Anda.'}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="max-w-xl text-lg text-gray-400"
          >
            {language === 'en'
              ? 'A trading journal for traders — just upload your MT5 history, the system automatically creates your journal, detects error patterns with AI, and watch your equity curve grow.'
              : 'Trading journal buat trader Indonesia — cukup upload history MT5, sistem otomatis jadikan jurnal, deteksi pola kesalahan lewat AI, dan lihat equity curve kamu naik.'}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.24 }}
            className="flex flex-col sm:flex-row gap-4 mt-4"
          >
            <Link href="#simulator">
              <span className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-medium rounded-xl hover:opacity-90 transition-all glow-bg-luxury">
                {language === 'en' ? 'Try AI Simulator' : 'Coba AI Simulator'} <ScanLine className="w-4 h-4" />
              </span>
            </Link>
            <Link href="#pricing">
              <span className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 text-white font-medium rounded-xl hover:bg-white/10 border border-white/10 transition-all">
                {language === 'en' ? 'View Pricing' : 'Lihat Pricing'}
              </span>
            </Link>
          </motion.div>

        </div>

        {/* Right Column: Stacked UI Mockups (Desktop) */}
        <motion.div
          className="flex-1 relative w-full max-w-md h-[600px] hidden lg:flex items-center justify-center"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
        >
          <div className="phone-mockup w-64 absolute top-10 left-1/2 -translate-x-1/2 z-30 animate-float-lux glow-bg-luxury">
            <Image src="/screenshot-dashboard.jpeg" alt="Dashboard LuxTradee" width={256} height={500} loading="lazy" className="shadow-2xl" />
          </div>
          <div className="phone-mockup w-48 absolute top-32 left-0 z-20 -rotate-12 animate-float-lux" style={{ animationDelay: '1s' }}>
            <Image src="/screenshot-calendar.jpeg" alt="Kalender Trading" width={192} height={380} loading="lazy" className="shadow-2xl opacity-80" />
          </div>
          <div className="phone-mockup w-48 absolute top-32 right-0 z-20 rotate-12 animate-float-lux" style={{ animationDelay: '2s' }}>
            <Image src="/screenshot-trades.jpeg" alt="Histori Trade" width={192} height={380} loading="lazy" className="shadow-2xl opacity-80" />
          </div>
        </motion.div>

        {/* Mobile: Single phone mockup */}
        <motion.div
          className="lg:hidden w-full max-w-xs"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="phone-mockup glow-bg-luxury animate-float-lux">
            <Image src="/screenshot-dashboard.jpeg" alt="Dashboard LuxTradee" width={300} height={600} priority />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
