'use client'

import React, { useMemo, useEffect, useState, useId } from 'react'
import { motion } from 'framer-motion'

interface Candle {
  id: number
  x: number
  bodyH: number
  bodyY: number
  wickTop: number
  wickBottom: number
  isBull: boolean
}

function generateCandles(count: number, sectionWidth: number, sectionHeight: number): Candle[] {
  const candles: Candle[] = []
  const spacing = sectionWidth / count
  const baseY = sectionHeight * 0.45
  const maxBodyH = sectionHeight * 0.18
  const maxWick = sectionHeight * 0.12
  let trend = 0
  let price = baseY

  for (let i = 0; i < count; i++) {
    trend += (Math.random() - 0.48) * 0.6
    trend = Math.max(-1, Math.min(1, trend))
    const isBull = trend > -0.15

    const bodyH = 12 + Math.random() * maxBodyH
    const wickUp = 4 + Math.random() * maxWick
    const wickDown = 4 + Math.random() * maxWick

    price += isBull ? -2 : 2
    price = Math.max(sectionHeight * 0.15, Math.min(sectionHeight * 0.75, price))

    candles.push({
      id: i,
      x: spacing * i + spacing * 0.3,
      bodyH,
      bodyY: price,
      wickTop: price - wickUp,
      wickBottom: price + bodyH + wickDown,
      isBull,
    })
  }
  return candles
}

function CandleCluster({ candles, opacity, yDir }: { candles: Candle[]; opacity: number; yDir: number }) {
  return (
    <svg className="w-full h-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 600 500" fill="none">
      {candles.map((c) => (
        <motion.g
          key={c.id}
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            y: [0, c.isBull ? -8 * yDir : 8 * yDir, 0],
          }}
          transition={{
            opacity: { duration: 0.5, delay: c.id * 0.04 },
            y: {
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut',
              delay: c.id * 0.15,
            },
          }}
        >
          <line x1={c.x} y1={c.wickTop} x2={c.x} y2={c.wickBottom} stroke={c.isBull ? '#10b981' : '#1e40af'} strokeWidth={2} opacity={opacity} />
          <rect x={c.x - 5} y={c.bodyY} width={10} height={c.bodyH} fill={c.isBull ? '#10b981' : '#1e40af'} opacity={opacity} rx={1} />
        </motion.g>
      ))}
    </svg>
  )
}

export default function CandlestickBackground() {
  const [isDesktop, setIsDesktop] = useState(false)
  const styleId = useId()
  const leftCandles = useMemo(() => generateCandles(14, 600, 500), [])
  const rightCandles = useMemo(() => generateCandles(14, 600, 500), [])
  const mobileCandles = useMemo(() => generateCandles(6, 400, 600), [])

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check, { passive: true })
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* CSS keyframe for mobile — injected once */}
      <style dangerouslySetInnerHTML={{ __html: `@keyframes candleFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}` }} />

      {/* Desktop: Framer Motion clusters */}
      {isDesktop && (
        <>
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[600px] h-[500px]">
            <CandleCluster candles={leftCandles} opacity={0.2} yDir={1} />
          </div>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] h-[500px]">
            <CandleCluster candles={rightCandles} opacity={0.15} yDir={-1} />
          </div>
        </>
      )}

      {/* Mobile: static SVG with single CSS animation */}
      {!isDesktop && (
        <div className="absolute inset-0" style={{ animation: 'candleFloat 6s ease-in-out infinite' }}>
          <svg className="w-full h-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 600" fill="none">
            {mobileCandles.map((c) => (
              <g key={`m-${c.id}`}>
                <line x1={c.x} y1={c.wickTop} x2={c.x} y2={c.wickBottom} stroke={c.isBull ? '#10b981' : '#1e40af'} strokeWidth={1.5} opacity={0.12} />
                <rect x={c.x - 4} y={c.bodyY} width={8} height={c.bodyH * 0.9} fill={c.isBull ? '#10b981' : '#1e40af'} opacity={0.12} rx={1} />
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  )
}
