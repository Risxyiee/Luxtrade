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
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 })
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
    setGlarePos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
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
      className="mt-16 mb-4"
      style={{ perspective: '1200px' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8, rotateY: -30 }}
        whileInView={{ opacity: 1, scale: 1, rotateY: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex items-center justify-center"
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: 'transform 0.15s ease-out',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Outer glow ring */}
        <div
          className="absolute w-32 h-32 rounded-full pointer-events-none"
          style={{
            background: isHovered
              ? 'radial-gradient(circle, rgba(6,182,212,0.3) 0%, rgba(59,130,246,0.15) 40%, transparent 70%)'
              : 'radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 60%)',
            transition: 'background 0.5s ease',
            transform: 'translateZ(-10px) scale(1.5)',
            filter: 'blur(10px)',
          }}
        />

        {/* Orbiting ring 1 */}
        <div
          className="absolute w-28 h-28 rounded-full border border-cyan-400/20 pointer-events-none"
          style={{
            transform: 'translateZ(15px) rotateX(60deg)',
            animation: 'logo-orbit-1 8s linear infinite',
          }}
        />

        {/* Orbiting ring 2 */}
        <div
          className="absolute w-28 h-28 rounded-full border border-blue-400/15 pointer-events-none"
          style={{
            transform: 'translateZ(15px) rotateX(60deg) rotateY(60deg)',
            animation: 'logo-orbit-2 12s linear infinite',
          }}
        />

        {/* Orbiting ring 3 */}
        <div
          className="absolute w-28 h-28 rounded-full border border-blue-300/10 pointer-events-none"
          style={{
            transform: 'translateZ(15px) rotateX(60deg) rotateY(120deg)',
            animation: 'logo-orbit-3 16s linear infinite',
          }}
        />

        {/* Logo container with depth */}
        <div
          className="relative w-20 h-20 flex items-center justify-center rounded-2xl"
          style={{
            transform: 'translateZ(30px)',
            background: isHovered
              ? 'linear-gradient(135deg, rgba(6,182,212,0.12), rgba(59,130,246,0.08))'
              : 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
            backdropFilter: 'blur(20px)',
            border: isHovered ? '1px solid rgba(6,182,212,0.3)' : '1px solid rgba(255,255,255,0.06)',
            boxShadow: isHovered
              ? '0 0 40px rgba(6,182,212,0.2), 0 0 80px rgba(59,130,246,0.1), 0 25px 50px -12px rgba(0,0,0,0.8)'
              : '0 0 30px rgba(6,182,212,0.08), 0 25px 50px -12px rgba(0,0,0,0.6)',
            transition: 'all 0.5s ease',
          }}
        >
          {/* Holographic glare on logo card */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.12), transparent 50%)`,
              mixBlendMode: 'overlay',
              opacity: isHovered ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
          />

          <Image
            src="/logo.png"
            alt="LuxTrade"
            width={48}
            height={48}
            className="relative object-contain"
            style={{
              transform: 'translateZ(50px)',
              filter: isHovered ? 'drop-shadow(0 0 12px rgba(6,182,212,0.6))' : 'drop-shadow(0 0 6px rgba(6,182,212,0.3))',
              transition: 'filter 0.5s ease',
            }}
          />
        </div>

        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full pointer-events-none"
            style={{
              background: i % 2 === 0 ? 'rgba(6,182,212,0.6)' : 'rgba(59,130,246,0.5)',
              boxShadow: `0 0 6px ${i % 2 === 0 ? 'rgba(6,182,212,0.4)' : 'rgba(59,130,246,0.3)'}`,
              animation: `logo-particle-${i} ${4 + i * 1.5}s ease-in-out infinite`,
              animationDelay: `${i * 0.5}s`,
              transform: 'translateZ(20px)',
            }}
          />
        ))}
      </motion.div>

      {/* Brand text */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.5 }}
        className="text-center mt-6"
      >
        <span className="text-lg font-light tracking-[0.25em] uppercase bg-clip-text text-transparent bg-gradient-to-r from-white/80 via-cyan-300/90 to-blue-400/80">
          LuxTrade
        </span>
      </motion.div>

      {/* Keyframe animations */}
      <style jsx global>{`
        @keyframes logo-orbit-1 {
          0% { transform: translateZ(15px) rotateX(60deg) rotateZ(0deg); }
          100% { transform: translateZ(15px) rotateX(60deg) rotateZ(360deg); }
        }
        @keyframes logo-orbit-2 {
          0% { transform: translateZ(15px) rotateX(60deg) rotateY(60deg) rotateZ(0deg); }
          100% { transform: translateZ(15px) rotateX(60deg) rotateY(60deg) rotateZ(360deg); }
        }
        @keyframes logo-orbit-3 {
          0% { transform: translateZ(15px) rotateX(60deg) rotateY(120deg) rotateZ(0deg); }
          100% { transform: translateZ(15px) rotateX(60deg) rotateY(120deg) rotateZ(360deg); }
        }
        @keyframes logo-particle-0 { 0%,100%{transform:translateZ(20px) translate(0,0);opacity:0.6} 50%{transform:translateZ(20px) translate(20px,-30px);opacity:1} }
        @keyframes logo-particle-1 { 0%,100%{transform:translateZ(20px) translate(0,0);opacity:0.5} 50%{transform:translateZ(20px) translate(-25px,15px);opacity:0.9} }
        @keyframes logo-particle-2 { 0%,100%{transform:translateZ(20px) translate(0,0);opacity:0.7} 50%{transform:translateZ(20px) translate(15px,25px);opacity:1} }
        @keyframes logo-particle-3 { 0%,100%{transform:translateZ(20px) translate(0,0);opacity:0.4} 50%{transform:translateZ(20px) translate(-20px,-20px);opacity:0.8} }
        @keyframes logo-particle-4 { 0%,100%{transform:translateZ(20px) translate(0,0);opacity:0.6} 50%{transform:translateZ(20px) translate(30px,10px);opacity:1} }
        @keyframes logo-particle-5 { 0%,100%{transform:translateZ(20px) translate(0,0);opacity:0.5} 50%{transform:translateZ(20px) translate(-10px,30px);opacity:0.9} }
      `}</style>
    </div>
  )
}

export default function FinalCTA({ language = 'id' }: FinalCTAProps) {
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

        {/* 3D LuxTrade Logo */}
        <LuxTradeLogo3D />
      </motion.div>
    </section>
  )
}
