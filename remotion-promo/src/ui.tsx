import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

/**
 * HELPER VISUAL — promo LuxTradee (kinetic typography ala motion design).
 * Palet: bg #050507 (gelap khas LuxTradee), aksen amber/gold #f59e0b,
 * emerald utk profit, merah utk punchline problem. Font Lexend (brand).
 */

export const COLORS = {
  bg: '#050507',
  gold: '#f59e0b',
  goldLight: '#fbbf24',
  white: '#ffffff',
  muted: 'rgba(255,255,255,0.62)',
  red: '#ef4444',
  emerald: '#10b981',
}

/* ── Background: gradient + blob bergerak + vignette ─────────────── */
export const PromoBackground: React.FC = () => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const t = frame / durationInFrames
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1200px 800px at ${20 + 10 * Math.sin(t * 4)}% ${15 + 8 * Math.cos(t * 3)}, rgba(245,158,11,0.13), transparent 60%),
                     radial-gradient(1000px 900px at ${80 + 8 * Math.cos(t * 3)}% ${85 + 6 * Math.sin(t * 5)}, rgba(245,158,11,0.08), transparent 55%),
                     linear-gradient(180deg, #0a0a0f 0%, #050507 100%)`,
      }}
    />
  )
}

/* ── Vignette halus di tepi ───────────────────────────────────────── */
export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        'radial-gradient(120% 100% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)',
    }}
  />
)

/* ── Reveal kata-per-kata (spring) ────────────────────────────────── */
export const WordReveal: React.FC<{
  text: string
  startFrame: number
  size?: number
  color?: string
  weight?: number
  gap?: number
  lineHeight?: number
}> = ({ text, startFrame, size = 92, color = COLORS.white, weight = 800, gap = 4, lineHeight = 1.15 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const words = text.split(' ')
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: `${gap}px 22px`,
        fontSize: size,
        fontWeight: weight,
        lineHeight,
        color,
        textTransform: 'uppercase',
        letterSpacing: '-0.02em',
      }}
    >
      {words.map((w, i) => {
        const s = spring({
          frame: frame - (startFrame + i * 5),
          fps,
          config: { damping: 14, stiffness: 160, mass: 0.7 },
        })
        return (
          <span
            key={`${w}-${i}`}
            style={{
              display: 'inline-block',
              opacity: s,
              transform: `translateY(${(1 - s) * 60}px) scale(${0.8 + s * 0.2})`,
            }}
          >
            {w}
          </span>
        )
      })}
    </div>
  )
}

/* ── Punch text: scale besar→normal (zoom punch) ──────────────────── */
export const PunchText: React.FC<{
  children: React.ReactNode
  startFrame: number
  size?: number
  color?: string
  shake?: boolean
  gradient?: boolean
}> = ({ children, startFrame, size = 110, color = COLORS.white, shake = false, gradient = false }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 11, stiffness: 200, mass: 0.6 },
  })
  const shakeX = shake ? Math.sin(frame * 2.2) * 6 * (1 - s * 0.6) : 0
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: 900,
        color: gradient ? undefined : color,
        ...(gradient
          ? {
              backgroundImage: `linear-gradient(92deg, ${COLORS.goldLight}, ${COLORS.gold}, ${COLORS.goldLight})`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }
          : {}),
        textTransform: 'uppercase',
        letterSpacing: '-0.02em',
        lineHeight: 1.08,
        textAlign: 'center',
        maxWidth: '92%',
        opacity: Math.min(1, s * 2),
        transform: `scale(${2 - s}) translateX(${shakeX}px)`,
        textShadow: gradient ? 'none' : `0 0 60px ${color}22`,
      }}
    >
      {children}
    </div>
  )
}

/* ── Fade-up sederhana ────────────────────────────────────────────── */
export const FadeUp: React.FC<{
  children: React.ReactNode
  startFrame: number
  distance?: number
  opacityOnly?: boolean
}> = ({ children, startFrame, distance = 40, opacityOnly = false }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 18, stiffness: 140 },
  })
  return (
    <div
      style={{
        opacity: s,
        transform: opacityOnly ? undefined : `translateY(${(1 - s) * distance}px)`,
      }}
    >
      {children}
    </div>
  )
}

/* ── Pill fitur ───────────────────────────────────────────────────── */
export const FeaturePill: React.FC<{ children: React.ReactNode; startFrame: number }> = ({
  children,
  startFrame,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - startFrame, fps, config: { damping: 15, stiffness: 170 } })
  return (
    <div
      style={{
        opacity: s,
        transform: `scale(${0.7 + s * 0.3})`,
        border: '2px solid rgba(245,158,11,0.5)',
        background: 'rgba(245,158,11,0.10)',
        borderRadius: 999,
        padding: '20px 44px',
        fontSize: 40,
        fontWeight: 600,
        color: COLORS.goldLight,
      }}
    >
      {children}
    </div>
  )
}

/* ── Candlestick chart dekoratif beranimasi ───────────────────────── */
export const CandleChart: React.FC<{ startFrame: number; frames: number }> = ({
  startFrame,
  frames,
}) => {
  const frame = useCurrentFrame()
  const local = frame - startFrame
  const candles = React.useMemo(() => {
    // Pola uptrend agar terasa "profit" — naik bertahap
    const data: Array<{ x: number; green: boolean; h: number; y: number }> = []
    let level = 420
    for (let i = 0; i < 9; i++) {
      const green = i !== 2 && i !== 5
      level -= green ? 34 + (i % 3) * 8 : 18
      data.push({ x: i * 54, green, h: 60 + ((i * 37) % 70), y: level })
    }
    return data
  }, [])
  return (
    <div style={{ position: 'relative', width: 500, height: 320, opacity: 0.9 }}>
      {candles.map((c, i) => {
        const s = spring({ frame: local - i * 5, fps: 30, config: { damping: 14, stiffness: 180 } })
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: c.x,
              width: 34,
              background: c.green ? COLORS.emerald : COLORS.red,
              borderRadius: 6,
              transform: `scaleY(${s})`,
              transformOrigin: 'bottom',
              height: c.h,
              top: c.y + (320 - c.h - c.y) * 0,
              bottom: undefined,
              boxShadow: c.green ? '0 0 30px rgba(16,185,129,0.35)' : 'none',
              opacity: 0.85,
            }}
          />
        )
      })}
    </div>
  )
}

/* ── Shine sweep utk teks gradient (FREE PRO 3 BULAN) ─────────────── */
export const ShineText: React.FC<{ children: React.ReactNode; startFrame: number; size?: number }> = ({
  children,
  startFrame,
  size = 130,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - startFrame, fps, config: { damping: 12, stiffness: 190 } })
  const sweep = interpolate(frame, [startFrame + 20, startFrame + 55], [-150, 150], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div
        style={{
          fontSize: size,
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '-0.02em',
          lineHeight: 1.05,
          backgroundImage: `linear-gradient(92deg, ${COLORS.goldLight} 0%, ${COLORS.gold} 40%, #fff7e0 50%, ${COLORS.gold} 60%, ${COLORS.goldLight} 100%)`,
          backgroundSize: '200% 100%',
          backgroundPosition: `${sweep}% 0`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          transform: `scale(${0.6 + s * 0.4})`,
          filter: `drop-shadow(0 0 50px rgba(245,158,11,0.45))`,
        }}
      >
        {children}
      </div>
    </div>
  )
}

/* ── Counter angka (0 → target) ───────────────────────────────────── */
export const Counter: React.FC<{ startFrame: number; target: number; suffix?: string }> = ({
  startFrame,
  target,
  suffix = '%',
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - startFrame, fps, config: { damping: 16, stiffness: 90, mass: 1.1 } })
  const value = Math.round(s * target)
  return (
    <span
      style={{
        fontSize: 300,
        fontWeight: 900,
        lineHeight: 1,
        color: COLORS.gold,
        textShadow: '0 0 90px rgba(245,158,11,0.5)',
        letterSpacing: '-0.04em',
      }}
    >
      {value}
      {suffix}
    </span>
  )
}
