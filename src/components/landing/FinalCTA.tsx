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
      x: ((y - cy) / cy) * -20,
      y: ((x - cx) / cx) * 20,
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

  const particleColors = [
    { bg: 'rgba(6,182,212,0.7)', shadow: 'rgba(6,182,212,0.5)' },
    { bg: 'rgba(59,130,246,0.6)', shadow: 'rgba(59,130,246,0.4)' },
    { bg: 'rgba(99,102,241,0.5)', shadow: 'rgba(99,102,241,0.3)' },
    { bg: 'rgba(6,182,212,0.5)', shadow: 'rgba(6,182,212,0.4)' },
    { bg: 'rgba(139,92,246,0.4)', shadow: 'rgba(139,92,246,0.3)' },
    { bg: 'rgba(59,130,246,0.7)', shadow: 'rgba(59,130,246,0.5)' },
    { bg: 'rgba(6,182,212,0.6)', shadow: 'rgba(6,182,212,0.4)' },
    { bg: 'rgba(99,102,241,0.6)', shadow: 'rgba(99,102,241,0.4)' },
    { bg: 'rgba(59,130,246,0.5)', shadow: 'rgba(59,130,246,0.3)' },
    { bg: 'rgba(6,182,212,0.4)', shadow: 'rgba(6,182,212,0.3)' },
  ]

  const particleSizes = [3, 2, 1.5, 3, 2, 1.5, 3, 2, 1.5, 2]

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={() => setIsHovered(true)}
      className="mt-16 mb-8"
      style={{ perspective: '1000px' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.6, rotateY: -45, rotateX: 15 }}
        whileInView={{ opacity: 1, scale: 1, rotateY: 0, rotateX: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex items-center justify-center"
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: 'transform 0.15s ease-out',
          transformStyle: 'preserve-3d',
          width: '200px',
          height: '200px',
        }}
      >
        {/* Deep outer glow */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: '320px',
            height: '320px',
            background: isHovered
              ? 'radial-gradient(circle, rgba(6,182,212,0.35) 0%, rgba(59,130,246,0.2) 25%, rgba(99,102,241,0.1) 45%, transparent 65%)'
              : 'radial-gradient(circle, rgba(6,182,212,0.18) 0%, rgba(59,130,246,0.1) 30%, transparent 60%)',
            transition: 'all 0.6s ease',
            transform: 'translateZ(-20px) scale(1.6)',
            filter: 'blur(15px)',
            animation: 'lux-glow-pulse 4s ease-in-out infinite',
          }}
        />

        {/* Secondary ambient glow */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: '400px',
            height: '400px',
            background: isHovered
              ? 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, rgba(139,92,246,0.08) 40%, transparent 70%)'
              : 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 55%)',
            transition: 'all 0.6s ease',
            transform: 'translateZ(-40px)',
            filter: 'blur(25px)',
            animation: 'lux-ambient-pulse 6s ease-in-out infinite',
          }}
        />

        {/* Orbiting ring 1 - tilted */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: '200px',
            height: '200px',
            border: '1.5px solid rgba(6,182,212,0.25)',
            borderRadius: '50%',
            transform: 'translateZ(20px) rotateX(65deg)',
            animation: 'logo-orbit-1 8s linear infinite',
            boxShadow: '0 0 15px rgba(6,182,212,0.1), inset 0 0 15px rgba(6,182,212,0.05)',
          }}
        />

        {/* Orbiting ring 2 */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: '220px',
            height: '220px',
            border: '1px solid rgba(59,130,246,0.18)',
            borderRadius: '50%',
            transform: 'translateZ(10px) rotateX(65deg) rotateY(60deg)',
            animation: 'logo-orbit-2 12s linear infinite',
            boxShadow: '0 0 12px rgba(59,130,246,0.08)',
          }}
        />

        {/* Orbiting ring 3 */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: '240px',
            height: '240px',
            border: '1px solid rgba(99,102,241,0.12)',
            borderRadius: '50%',
            transform: 'translateZ(0px) rotateX(65deg) rotateY(120deg)',
            animation: 'logo-orbit-3 16s linear infinite',
            boxShadow: '0 0 10px rgba(99,102,241,0.06)',
          }}
        />

        {/* Orbiting ring 4 - outermost, subtle */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: '260px',
            height: '260px',
            border: '0.5px solid rgba(6,182,212,0.08)',
            borderRadius: '50%',
            transform: 'translateZ(-10px) rotateX(65deg) rotateY(180deg)',
            animation: 'logo-orbit-4 20s linear infinite reverse',
          }}
        />

        {/* Orbiting dot on ring 1 */}
        <div className="absolute pointer-events-none" style={{ animation: 'logo-orbit-1 8s linear infinite' }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'rgba(6,182,212,0.8)',
            boxShadow: '0 0 12px rgba(6,182,212,0.6), 0 0 24px rgba(6,182,212,0.3)',
            transform: 'translateX(100px) translateZ(20px)',
          }} />
        </div>

        {/* Orbiting dot on ring 2 */}
        <div className="absolute pointer-events-none" style={{ animation: 'logo-orbit-2 12s linear infinite' }}>
          <div style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: 'rgba(59,130,246,0.8)',
            boxShadow: '0 0 10px rgba(59,130,246,0.5), 0 0 20px rgba(59,130,246,0.2)',
            transform: 'translateX(110px) translateZ(10px)',
          }} />
        </div>

        {/* Main logo container - glassmorphic platform */}
        <div
          className="relative flex items-center justify-center rounded-3xl"
          style={{
            width: '140px',
            height: '140px',
            transform: 'translateZ(40px)',
            background: isHovered
              ? 'linear-gradient(145deg, rgba(6,182,212,0.15), rgba(59,130,246,0.1), rgba(15,15,30,0.6))'
              : 'linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02), rgba(10,10,25,0.4))',
            backdropFilter: 'blur(30px) saturate(180%)',
            border: isHovered
              ? '1.5px solid rgba(6,182,212,0.35)'
              : '1px solid rgba(255,255,255,0.08)',
            boxShadow: isHovered
              ? '0 0 60px rgba(6,182,212,0.25), 0 0 120px rgba(59,130,246,0.12), 0 30px 60px -15px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)'
              : '0 0 40px rgba(6,182,212,0.1), 0 0 80px rgba(59,130,246,0.05), 0 30px 60px -15px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Holographic glare sweep */}
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none overflow-hidden"
            style={{
              opacity: isHovered ? 1 : 0.3,
              transition: 'opacity 0.5s ease',
            }}
          >
            <div style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.2), transparent 40%)`,
              mixBlendMode: 'overlay',
            }} />
            <div style={{
              position: 'absolute',
              top: '-50%',
              left: '-50%',
              width: '200%',
              height: '200%',
              background: 'linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.04) 45%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 55%, transparent 60%)',
              animation: 'holographic-sweep 5s ease-in-out infinite',
            }} />
          </div>

          {/* Inner edge highlight */}
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              background: isHovered
                ? 'linear-gradient(135deg, rgba(6,182,212,0.15) 0%, transparent 30%, transparent 70%, rgba(59,130,246,0.1) 100%)'
                : 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%)',
              transition: 'background 0.5s ease',
            }}
          />

          <Image
            src="/logo.png"
            alt="LuxTrade"
            width={100}
            height={100}
            className="relative object-contain"
            style={{
              transform: 'translateZ(60px)',
              filter: isHovered
                ? 'drop-shadow(0 0 20px rgba(6,182,212,0.7)) drop-shadow(0 0 40px rgba(59,130,246,0.3))'
                : 'drop-shadow(0 0 10px rgba(6,182,212,0.4)) drop-shadow(0 0 20px rgba(59,130,246,0.15))',
              transition: 'filter 0.5s ease',
            }}
          />
        </div>

        {/* Floating particles */}
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: `${particleSizes[i]}px`,
              height: `${particleSizes[i]}px`,
              background: particleColors[i].bg,
              boxShadow: `0 0 ${i % 3 === 0 ? '12' : '8'}px ${particleColors[i].shadow}`,
              animation: `logo-particle-${i} ${4 + i * 1.2}s ease-in-out infinite`,
              animationDelay: `${i * 0.4}s`,
              transform: 'translateZ(25px)',
            }}
          />
        ))}
      </motion.div>

      {/* Keyframe animations */}
      <style jsx global>{`
        @keyframes logo-orbit-1 {
          0% { transform: translateZ(20px) rotateX(65deg) rotateZ(0deg); }
          100% { transform: translateZ(20px) rotateX(65deg) rotateZ(360deg); }
        }
        @keyframes logo-orbit-2 {
          0% { transform: translateZ(10px) rotateX(65deg) rotateY(60deg) rotateZ(0deg); }
          100% { transform: translateZ(10px) rotateX(65deg) rotateY(60deg) rotateZ(360deg); }
        }
        @keyframes logo-orbit-3 {
          0% { transform: translateZ(0px) rotateX(65deg) rotateY(120deg) rotateZ(0deg); }
          100% { transform: translateZ(0px) rotateX(65deg) rotateY(120deg) rotateZ(360deg); }
        }
        @keyframes logo-orbit-4 {
          0% { transform: translateZ(-10px) rotateX(65deg) rotateY(180deg) rotateZ(0deg); }
          100% { transform: translateZ(-10px) rotateX(65deg) rotateY(180deg) rotateZ(360deg); }
        }
        @keyframes lux-glow-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes lux-ambient-pulse {
          0%, 100% { opacity: 1; transform: translateZ(-40px) scale(1); }
          50% { opacity: 0.6; transform: translateZ(-40px) scale(1.1); }
        }
        @keyframes holographic-sweep {
          0% { transform: translateX(-30%) translateY(-30%) rotate(0deg); }
          50% { transform: translateX(30%) translateY(30%) rotate(5deg); }
          100% { transform: translateX(-30%) translateY(-30%) rotate(0deg); }
        }
        @keyframes logo-particle-0 { 0%,100%{transform:translateZ(25px) translate(0,0);opacity:0.6} 50%{transform:translateZ(25px) translate(35px,-50px);opacity:1} }
        @keyframes logo-particle-1 { 0%,100%{transform:translateZ(25px) translate(0,0);opacity:0.5} 50%{transform:translateZ(25px) translate(-45px,25px);opacity:0.9} }
        @keyframes logo-particle-2 { 0%,100%{transform:translateZ(25px) translate(0,0);opacity:0.7} 50%{transform:translateZ(25px) translate(25px,45px);opacity:1} }
        @keyframes logo-particle-3 { 0%,100%{transform:translateZ(25px) translate(0,0);opacity:0.4} 50%{transform:translateZ(25px) translate(-35px,-35px);opacity:0.8} }
        @keyframes logo-particle-4 { 0%,100%{transform:translateZ(25px) translate(0,0);opacity:0.6} 50%{transform:translateZ(25px) translate(55px,15px);opacity:1} }
        @keyframes logo-particle-5 { 0%,100%{transform:translateZ(25px) translate(0,0);opacity:0.5} 50%{transform:translateZ(25px) translate(-15px,55px);opacity:0.9} }
        @keyframes logo-particle-6 { 0%,100%{transform:translateZ(25px) translate(0,0);opacity:0.4} 50%{transform:translateZ(25px) translate(40px,35px);opacity:1} }
        @keyframes logo-particle-7 { 0%,100%{transform:translateZ(25px) translate(0,0);opacity:0.6} 50%{transform:translateZ(25px) translate(-50px,-20px);opacity:0.8} }
        @keyframes logo-particle-8 { 0%,100%{transform:translateZ(25px) translate(0,0);opacity:0.5} 50%{transform:translateZ(25px) translate(20px,-55px);opacity:0.9} }
        @keyframes logo-particle-9 { 0%,100%{transform:translateZ(25px) translate(0,0);opacity:0.7} 50%{transform:translateZ(25px) translate(-30px,40px);opacity:1} }
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
