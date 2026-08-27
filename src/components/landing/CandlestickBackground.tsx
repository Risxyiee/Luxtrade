'use client'

import React, { useRef, useEffect, useState } from 'react'
import { motion, useScroll, useTransform, useSpring } from 'framer-motion'
import Image from 'next/image'

export default function CandlestickBackground() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check, { passive: true })
    return () => window.removeEventListener('resize', check)
  }, [])

  // Scroll-driven rotation — one full X spin as hero scrolls through viewport
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  })

  const rawRotateX = useTransform(scrollYProgress, [0, 1], [0, 360])
  const rotateX = useSpring(rawRotateX, { stiffness: 50, damping: 25, restDelta: 0.001 })

  const rawRotateY = useTransform(scrollYProgress, [0, 0.5, 1], [0, 45, 0])
  const rotateY = useSpring(rawRotateY, { stiffness: 50, damping: 25, restDelta: 0.001 })

  const logoSize = isDesktop ? 260 : 160
  const imageW = isDesktop ? 180 : 110

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Soft ambient glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: isDesktop ? '400px' : '250px',
          height: isDesktop ? '400px' : '250px',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, rgba(59,130,246,0.04) 40%, transparent 60%)',
          filter: 'blur(25px)',
          animation: 'hero-bg-glow 8s ease-in-out infinite',
        }}
      />

      {/* 3D spinning logo — centered, behind content */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ perspective: '1200px' }}
      >
        <motion.div
          style={{
            rotateX,
            rotateY,
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Glassmorphic disc behind logo */}
          <div
            className="relative flex items-center justify-center rounded-full"
            style={{
              width: `${logoSize}px`,
              height: `${logoSize}px`,
              background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(10,10,25,0.15))',
              backdropFilter: 'blur(15px)',
              border: '1px solid rgba(255,255,255,0.04)',
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
                  ? 'drop-shadow(0 0 12px rgba(6,182,212,0.2)) drop-shadow(0 0 24px rgba(59,130,246,0.08))'
                  : 'drop-shadow(0 0 8px rgba(6,182,212,0.12))',
                opacity: isDesktop ? 0.18 : 0.1,
              }}
            />
          </div>
        </motion.div>
      </div>

      {/* Keyframe */}
      <style jsx global>{`
        @keyframes hero-bg-glow {
          0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.5; transform: translate(-50%, -50%) scale(1.08); }
        }
      `}</style>
    </div>
  )
}
