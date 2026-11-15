import React from 'react'
import {
  AbsoluteFill,
  interpolate,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'

/**
 * HELPER VISUAL v2 — promo LuxTradee (penuh gerakan, anti-kaku).
 * Prinsip: SEMUA elemen punya idle motion (float/sway/pulse) + entrance spring
 * dgn overshoot + partikel & kamera drift. Deterministik (pakai random(seed)).
 * Palet: bg #050507, aksen gold #f59e0b, emerald profit, merah punchline.
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

/* ═══ SHAKE HELPER — guncangan layar dekay ═════════════════════════ */
export const shake = (frame: number, start: number, dur: number, power: number): number => {
  if (frame < start || frame > start + dur) return 0
  const t = (frame - start) / dur
  return Math.sin((frame - start) * 2.4) * power * (1 - t)
}

/* ═══ FLOAT — idle bobbing utk SEMUA elemen ════════════════════════ */
export const Float: React.FC<{
  children: React.ReactNode
  amp?: number
  speed?: number
  phase?: number
  rotateAmp?: number
  style?: React.CSSProperties
}> = ({ children, amp = 10, speed = 0.055, phase = 0, rotateAmp = 0, style }) => {
  const frame = useCurrentFrame()
  const y = Math.sin(frame * speed + phase) * amp
  const r = rotateAmp ? Math.sin(frame * speed * 0.8 + phase) * rotateAmp : 0
  return (
    <div style={{ ...style, transform: `translateY(${y}px) rotate(${r}deg)` }}>{children}</div>
  )
}

/* ═══ CAMERA DRIFT — slow zoom/pan ala Ken Burns per scene ═════════ */
export const CameraDrift: React.FC<{
  children: React.ReactNode
  zoomFrom?: number
  zoomTo?: number
  panX?: number
  panY?: number
}> = ({ children, zoomFrom = 1.05, zoomTo = 1.13, panX = 0, panY = 0 }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const t = Math.min(1, frame / Math.max(1, durationInFrames))
  const z = zoomFrom + (zoomTo - zoomFrom) * t
  return (
    <AbsoluteFill
      style={{ transform: `scale(${z}) translate(${panX * t}px, ${panY * t}px)` }}
    >
      {children}
    </AbsoluteFill>
  )
}

/* ═══ GOLD PARTICLES — debu emas naik terus (global) ═══════════════ */
export const GoldParticles: React.FC<{ count?: number; opacity?: number }> = ({
  count = 34,
  opacity = 1,
}) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity }}>
      {new Array(count).fill(0).map((_, i) => {
        const seed = `gp-${i}`
        const x = random(`x-${seed}`) * 100
        const speed = 0.6 + random(`s-${seed}`) * 1.4
        const size = 3 + random(`z-${seed}`) * 7
        const phase = random(`p-${seed}`) * 1000
        const tw = 0.04 + random(`t-${seed}`) * 0.08
        const cycle = durationInFrames * speed * 0.05 + 30
        const y = 110 - (((frame * speed * 0.35 + phase) % (cycle * 2)) / (cycle * 2)) * 130
        const sway = Math.sin(frame * tw + phase) * 2.2
        const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(frame * tw * 3 + phase))
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x + sway}%`,
              top: `${y}%`,
              width: size,
              height: size,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #fde68a 0%, #f59e0b 70%)',
              boxShadow: '0 0 12px rgba(245,158,11,0.8)',
              opacity: twinkle * 0.75,
            }}
          />
        )
      })}
    </AbsoluteFill>
  )
}

/* ═══ COIN FIELD — koin emas $ melayang naik ═══════════════════════ */
export const CoinField: React.FC<{ count?: number; startFrame?: number }> = ({
  count = 8,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {new Array(count).fill(0).map((_, i) => {
        const seed = `coin-${i}`
        const x = 6 + random(`x-${seed}`) * 88
        const speed = 0.9 + random(`s-${seed}`) * 1.3
        const size = 54 + random(`z-${seed}`) * 66
        const phase = random(`p-${seed}`) * 100
        const local = frame - startFrame
        const cycle = 120
        const p = (((local * speed * 0.6 + phase) % cycle) + cycle) % cycle
        const y = 105 - (p / cycle) * 125
        const sway = Math.sin(frame * 0.05 + phase) * 3
        const wobble = Math.sin(frame * 0.08 + phase) * 14
        const fadeIn = interpolate(p, [0, 8], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
        const fadeOut = interpolate(p, [cycle - 14, cycle], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x + sway}%`,
              top: `${y}%`,
              opacity: fadeIn * fadeOut * 0.9,
            }}
          >
            <Coin size={size} rotate={wobble} />
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

/* ═══ COIN — koin emas tunggal ═════════════════════════════════════ */
export const Coin: React.FC<{ size?: number; rotate?: number }> = ({ size = 70, rotate = 0 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 30%, #fde68a 0%, #f59e0b 55%, #b45309 100%)',
      border: `${Math.max(2, size * 0.05)}px solid #fcd34d`,
      boxShadow:
        'inset 0 -4px 8px rgba(120,53,15,0.6), 0 0 26px rgba(245,158,11,0.55), 0 6px 0 rgba(120,53,15,0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transform: `rotate(${rotate}deg)`,
    }}
  >
    <span
      style={{
        fontSize: size * 0.5,
        fontWeight: 900,
        color: '#78350f',
        textShadow: '0 1px 0 #fde68a',
      }}
    >
      $
    </span>
  </div>
)

/* ═══ SPARKLES — bintang kelap-kelip ═══════════════════════════════ */
export const Sparkles: React.FC<{ count?: number; startFrame?: number; spread?: number }> = ({
  count = 10,
  startFrame = 0,
  spread = 100,
}) => {
  const frame = useCurrentFrame()
  const local = frame - startFrame
  if (local < 0) return null
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {new Array(count).fill(0).map((_, i) => {
        const seed = `sp-${i}`
        const x = 8 + random(`x-${seed}`) * (spread < 100 ? spread : 84)
        const y = 8 + random(`y-${seed}`) * 78
        const size = 14 + random(`z-${seed}`) * 22
        const phase = random(`p-${seed}`) * 10
        const tw = 0.09 + random(`t-${seed}`) * 0.06
        const appear = interpolate(local, [i * 2, i * 2 + 10], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
        const pulse = 0.5 + 0.5 * Math.sin(local * tw * 2 + phase)
        const rot = local * 0.6 + phase * 40
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              opacity: appear * (0.25 + pulse * 0.75),
              transform: `scale(${0.6 + pulse * 0.5}) rotate(${rot}deg)`,
            }}
          >
            <StarIcon size={size} color={i % 3 === 0 ? COLORS.white : COLORS.goldLight} />
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

/* ═══ StarIcon — bintang 4 sudut ═══════════════════════════════════ */
export const StarIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 20,
  color = COLORS.goldLight,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 0 L14.6 9.4 L24 12 L14.6 14.6 L12 24 L9.4 14.6 L0 12 L9.4 9.4 Z" />
  </svg>
)

/* ═══ CONFETTI — ledakan potongan kertas (fisika sederhana) ════════ */
const CONFETTI_COLORS = ['#fbbf24', '#f59e0b', '#ffffff', '#10b981', '#fde68a']
export const Confetti: React.FC<{
  startFrame: number
  count?: number
  cx?: number
  cy?: number
  power?: number
}> = ({ startFrame, count = 42, cx = 50, cy = 42, power = 1 }) => {
  const frame = useCurrentFrame()
  const local = frame - startFrame
  if (local < 0) return null
  const dur = 62
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {new Array(count).fill(0).map((_, i) => {
        const seed = `cf-${i}`
        const angle = -Math.PI / 2 + (random(`a-${seed}`) - 0.5) * Math.PI * 1.5
        const v = (9 + random(`v-${seed}`) * 16) * power
        const vx = Math.cos(angle) * v
        const vy = Math.sin(angle) * v
        const p = Math.min(1, local / dur)
        const x = cx + vx * p * 1.35
        const y = cy + vy * p * 1.35 + 55 * p * p
        const spin = (random(`r-${seed}`) - 0.5) * 900 * p
        const size = 9 + random(`z-${seed}`) * 13
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
        const isCircle = i % 4 === 0
        const fade = p < 0.5 ? 1 : 1 - (p - 0.5) / 0.35
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: isCircle ? size : size * 1.7,
              borderRadius: isCircle ? '50%' : 3,
              background: color,
              opacity: Math.min(1, local / 2.5) * Math.max(0, fade),
              transform: `rotate(${spin}deg)`,
              boxShadow: `0 0 10px ${color}55`,
            }}
          />
        )
      })}
    </AbsoluteFill>
  )
}

/* ═══ FLASH — kilatan radial singkat ═══════════════════════════════ */
export const Flash: React.FC<{
  startFrame: number
  dur?: number
  color?: string
  max?: number
}> = ({ startFrame, dur = 9, color = '255,255,255', max = 0.32 }) => {
  const frame = useCurrentFrame()
  const local = frame - startFrame
  if (local < 0 || local > dur) return null
  const o = max * (1 - local / dur)
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 50%, rgba(${color},${o}) 0%, transparent 70%)`,
      }}
    />
  )
}

/* ═══ TICKER STRIP — jalur harga XAUUSD berjalan (dekor) ═══════════ */
export const TickerStrip: React.FC<{ top?: number; bottom?: number; speed?: number }> = ({
  top,
  bottom,
  speed = 2.4,
}) => {
  const frame = useCurrentFrame()
  const unit = 'XAU/USD 2,034.50  +0.82%   •   JOURNAL. ANALYZE. PROFIT.   •   '
  const text = unit.repeat(6)
  return (
    <div
      style={{
        position: 'absolute',
        top,
        bottom,
        left: 0,
        right: 0,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        opacity: 0.09,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'inline-block',
          fontSize: 34,
          fontWeight: 700,
          letterSpacing: '0.14em',
          color: COLORS.goldLight,
          transform: `translateX(-${(frame * speed) % 1900}px)`,
        }}
      >
        {text}
      </div>
      <div
        style={{
          display: 'inline-block',
          fontSize: 34,
          fontWeight: 700,
          letterSpacing: '0.14em',
          color: COLORS.goldLight,
          transform: `translateX(-${(frame * speed) % 1900}px)`,
        }}
      >
        {text}
      </div>
    </div>
  )
}

/* ═══ BACKGROUND — orb cahaya bergerak + gradient ══════════════════ */
export const PromoBackground: React.FC = () => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const t = frame / durationInFrames
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1200px 800px at ${22 + 12 * Math.sin(t * 5)}% ${16 + 9 * Math.cos(t * 4)}, rgba(245,158,11,0.16), transparent 60%),
                     radial-gradient(1000px 900px at ${78 + 10 * Math.cos(t * 4)}% ${84 + 8 * Math.sin(t * 6)}, rgba(245,158,11,0.10), transparent 55%),
                     radial-gradient(900px 700px at ${50 + 14 * Math.sin(t * 3)}% ${55 + 12 * Math.cos(t * 5)}, rgba(16,185,129,0.05), transparent 60%),
                     linear-gradient(180deg, #0a0a0f 0%, #050507 100%)`,
      }}
    />
  )
}

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        'radial-gradient(120% 100% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)',
    }}
  />
)

/* ═══ WORD REVEAL v2 — kata spring + rotasi + idle float ═══════════ */
export const WordReveal: React.FC<{
  text: string
  startFrame: number
  size?: number
  color?: string
  weight?: number
  stagger?: number
}> = ({ text, startFrame, size = 92, color = COLORS.white, weight = 800, stagger = 5 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const words = text.split(' ')
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '4px 24px',
        fontSize: size,
        fontWeight: weight,
        lineHeight: 1.15,
        color,
        textTransform: 'uppercase',
        letterSpacing: '-0.02em',
        maxWidth: '92%',
        textAlign: 'center',
      }}
    >
      {words.map((w, i) => {
        const s = spring({
          frame: frame - (startFrame + i * stagger),
          fps,
          config: { damping: 12, stiffness: 190, mass: 0.7 },
        })
        const dir = i % 2 === 0 ? 1 : -1
        const idleY = Math.sin(frame * 0.05 + i * 1.4) * 6
        const idleR = Math.sin(frame * 0.04 + i * 1.1) * 1.3
        return (
          <span
            key={`${w}-${i}`}
            style={{
              display: 'inline-block',
              opacity: Math.min(1, s * 1.6),
              transform: `translateY(${(1 - s) * 80 + idleY}px) rotate(${dir * 9 * (1 - s) + idleR}deg) scale(${0.72 + s * 0.28})`,
              filter: `blur(${(1 - s) * 6}px)`,
            }}
          >
            {w}
          </span>
        )
      })}
    </div>
  )
}

/* ═══ PUNCH TEXT v2 — zoom punch + shake + idle pulse ══════════════ */
export const PunchText: React.FC<{
  children: React.ReactNode
  startFrame: number
  size?: number
  color?: string
  shakePower?: number
  gradient?: boolean
}> = ({
  children,
  startFrame,
  size = 110,
  color = COLORS.white,
  shakePower = 7,
  gradient = false,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 10, stiffness: 210, mass: 0.6 },
  })
  const sx = shake(frame, startFrame, 14, shakePower)
  const idlePulse = 1 + 0.018 * Math.sin(frame * 0.16)
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
        opacity: Math.min(1, s * 2.2),
        transform: `scale(${(1 + (1 - s) * 1.15) * idlePulse}) translateX(${sx}px)`,
        filter: `blur(${(1 - Math.min(1, s * 2)) * 4}px)`,
        textShadow: gradient ? 'none' : `0 0 ${55 + 18 * Math.sin(frame * 0.12)}px ${color}44`,
      }}
    >
      {children}
    </div>
  )
}

/* ═══ WAVE TEXT — huruf bergelombang ═══════════════════════════════ */
export const WaveText: React.FC<{
  text: string
  startFrame: number
  size?: number
  color?: string
  amp?: number
}> = ({ text, startFrame, size = 80, color = COLORS.white, amp = 12 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const letters = text.split('')
  const base = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 13, stiffness: 170 },
  })
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        fontSize: size,
        fontWeight: 900,
        textTransform: 'uppercase',
        letterSpacing: '-0.01em',
        color,
      }}
    >
      {letters.map((ch, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            opacity: Math.min(1, base * 1.5),
            transform: `translateY(${(1 - base) * 50 + Math.sin(frame * 0.14 + i * 0.55) * amp * base}px) rotate(${Math.sin(frame * 0.1 + i * 0.5) * 2}deg)`,
            whiteSpace: ch === ' ' ? 'pre' : undefined,
          }}
        >
          {ch}
        </span>
      ))}
    </div>
  )
}

/* ═══ FADE UP ══════════════════════════════════════════════════════ */
export const FadeUp: React.FC<{
  children: React.ReactNode
  startFrame: number
  distance?: number
  fromLeft?: boolean
  fromRight?: boolean
}> = ({ children, startFrame, distance = 40, fromLeft = false, fromRight = false }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 16, stiffness: 150 },
  })
  const dx = fromLeft ? (1 - s) * -distance : fromRight ? (1 - s) * distance : 0
  return (
    <div style={{ opacity: Math.min(1, s * 1.5), transform: `translate(${dx}px, ${(1 - s) * (fromLeft || fromRight ? 0 : distance)}px)` }}>
      {children}
    </div>
  )
}

/* ═══ FEATURE PILL v2 — pop + float + dot pulse ════════════════════ */
export const FeaturePill: React.FC<{ children: React.ReactNode; startFrame: number; phase?: number }> = ({
  children,
  startFrame,
  phase = 0,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 13, stiffness: 180, mass: 0.7 },
  })
  const idleY = Math.sin(frame * 0.06 + phase) * 7
  const dotPulse = 0.5 + 0.5 * Math.sin(frame * 0.18 + phase)
  return (
    <div
      style={{
        opacity: Math.min(1, s * 1.6),
        transform: `scale(${0.7 + s * 0.3}) translateY(${idleY}px)`,
        border: '2px solid rgba(245,158,11,0.5)',
        background: 'rgba(245,158,11,0.10)',
        borderRadius: 999,
        padding: '20px 44px',
        fontSize: 40,
        fontWeight: 600,
        color: COLORS.goldLight,
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        boxShadow: '0 0 30px rgba(245,158,11,0.12)',
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: COLORS.emerald,
          boxShadow: `0 0 ${8 + dotPulse * 14}px rgba(16,185,129,0.9)`,
        }}
      />
      {children}
    </div>
  )
}

/* ═══ SHINE TEXT v2 — sweep kilau berulang terus ═══════════════════ */
export const ShineText: React.FC<{
  children: React.ReactNode
  startFrame: number
  size?: number
  loop?: number
}> = ({ children, startFrame, size = 130, loop = 55 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 12, stiffness: 190 },
  })
  const sweep = ((frame - startFrame - 12) % loop) / loop
  const pos = -150 + Math.max(0, sweep) * 300
  const idleY = Math.sin(frame * 0.05) * 8
  return (
    <div style={{ transform: `translateY(${idleY}px) scale(${0.6 + s * 0.4})` }}>
      <div
        style={{
          fontSize: size,
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '-0.02em',
          lineHeight: 1.05,
          textAlign: 'center',
          backgroundImage: `linear-gradient(92deg, ${COLORS.goldLight} 0%, ${COLORS.gold} 40%, #fff7e0 50%, ${COLORS.gold} 60%, ${COLORS.goldLight} 100%)`,
          backgroundSize: '200% 100%',
          backgroundPosition: `${pos}% 0`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          filter: `drop-shadow(0 0 ${45 + 15 * Math.sin(frame * 0.1)}px rgba(245,158,11,0.5))`,
        }}
      >
        {children}
      </div>
    </div>
  )
}

/* ═══ COUNTER — angka roll 0→target dgn overshoot ══════════════════ */
export const Counter: React.FC<{ startFrame: number; target: number; suffix?: string }> = ({
  startFrame,
  target,
  suffix = '%',
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 13, stiffness: 80, mass: 1.2 },
  })
  const value = Math.round(s * target)
  const ring = spring({
    frame: frame - startFrame + 4,
    fps,
    config: { damping: 20, stiffness: 60 },
  })
  const glow = 0.4 + 0.3 * Math.sin(frame * 0.1)
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* cincin ekspansi saat angka mendarat */}
      <div
        style={{
          position: 'absolute',
          width: 560,
          height: 560,
          borderRadius: '50%',
          border: `6px solid rgba(245,158,11,${0.5 * (1 - ring)})`,
          transform: `scale(${0.5 + ring * 0.9})`,
        }}
      />
      <span
        style={{
          fontSize: 300,
          fontWeight: 900,
          lineHeight: 1,
          color: COLORS.gold,
          textShadow: `0 0 ${80 + 25 * Math.sin(frame * 0.12)}px rgba(245,158,11,${glow + 0.2})`,
          letterSpacing: '-0.04em',
        }}
      >
        {value}
        {suffix}
      </span>
    </div>
  )
}

/* ═══ STAMP TEXT — dicap masuk (scale besar → kecil, rotate) ═══════ */
export const StampText: React.FC<{
  children: React.ReactNode
  startFrame: number
  size?: number
  color?: string
}> = ({ children, startFrame, size = 96, color = COLORS.emerald }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 9, stiffness: 260, mass: 0.5 },
  })
  const sx = shake(frame, startFrame, 10, 9)
  const pulse = 1 + 0.02 * Math.sin(frame * 0.2)
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: 900,
        color,
        textTransform: 'uppercase',
        letterSpacing: '-0.01em',
        opacity: Math.min(1, s * 2.5),
        transform: `scale(${(1 + (1 - s) * 2.2) * pulse}) rotate(${-4 + (1 - s) * -8}deg) translateX(${sx}px)`,
        textShadow: `0 0 ${50 + 20 * Math.sin(frame * 0.14)}px ${color}55`,
      }}
    >
      {children}
    </div>
  )
}

/* ═══ LINE CHART — garis profit tergambar live + dot ujung bercahaya ═ */
export const LineChart: React.FC<{ startFrame: number; width?: number; height?: number }> = ({
  startFrame,
  width = 880,
  height = 300,
}) => {
  const frame = useCurrentFrame()
  const local = frame - startFrame
  const drawDur = 75
  const pts: Array<[number, number]> = []
  for (let i = 0; i < 12; i++) {
    const x = (i / 11) * width
    const y = height - 30 - i * 21 - Math.sin(i * 1.7) * 16 - (i % 3 === 1 ? 14 : 0)
    pts.push([x, y])
  }
  const segs: number[] = []
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    segs.push(d)
    total += d
  }
  const progress = Math.min(1, Math.max(0, local / drawDur))
  const eased = 1 - Math.pow(1 - progress, 2.2)
  const targetLen = eased * total
  let acc = 0
  let tipX = pts[0][0]
  let tipY = pts[0][1]
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= targetLen) {
      const t = (targetLen - acc) / segs[i]
      tipX = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t
      tipY = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t
      break
    }
    acc += segs[i]
  }
  const tipPulse = 1 + 0.35 * Math.sin(frame * 0.25)
  const chip = spring({
    frame: local - drawDur - 4,
    fps: 30,
    config: { damping: 12, stiffness: 170 },
  })
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ')
  return (
    <div style={{ position: 'relative', width, height }}>
      {/* lilin latar tipis */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: (width - 13 * 26) / 12, opacity: 0.14 }}>
        {new Array(13).fill(0).map((_, i) => {
          const h = 30 + random(`c-${i}`) * 90
          const grow = spring({ frame: local - i * 3, fps: 30, config: { damping: 15, stiffness: 150 } })
          return (
            <div
              key={i}
              style={{
                width: 26,
                height: h,
                borderRadius: 5,
                background: i % 4 === 2 ? COLORS.red : COLORS.emerald,
                transform: `scaleY(${grow})`,
                transformOrigin: 'bottom',
              }}
            />
          )
        })}
      </div>
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id="lineGold" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={COLORS.goldLight} />
            <stop offset="100%" stopColor="#fff3d0" />
          </linearGradient>
        </defs>
        <path
          d={pathD}
          fill="none"
          stroke="url(#lineGold)"
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={total}
          strokeDashoffset={total - targetLen}
          style={{ filter: 'drop-shadow(0 0 14px rgba(245,158,11,0.65))' }}
        />
      </svg>
      {/* dot ujung bercahaya */}
      <div
        style={{
          position: 'absolute',
          left: tipX,
          top: tipY,
          width: 26,
          height: 26,
          marginLeft: -13,
          marginTop: -13,
          borderRadius: '50%',
          background: '#fff7e0',
          boxShadow: `0 0 ${24 * tipPulse}px rgba(253,230,138,0.95), 0 0 60px rgba(245,158,11,0.6)`,
          opacity: local > 0 ? 1 : 0,
        }}
      />
      {/* chip profit */}
      <div
        style={{
          position: 'absolute',
          right: 10,
          top: 6,
          opacity: Math.min(1, chip * 1.6),
          transform: `scale(${0.6 + chip * 0.4}) translateY(${Math.sin(frame * 0.08) * 6}px)`,
          background: 'rgba(16,185,129,0.16)',
          border: '2px solid rgba(16,185,129,0.6)',
          borderRadius: 999,
          padding: '14px 30px',
          fontSize: 40,
          fontWeight: 900,
          color: '#34d399',
          boxShadow: '0 0 30px rgba(16,185,129,0.25)',
        }}
      >
        +$124.50
      </div>
    </div>
  )
}

/* ═══ BAR CHART — bar komisi bulanan tumbuh ════════════════════════ */
export const MiniBarChart: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame()
  const local = frame - startFrame
  const heights = [46, 72, 102, 136, 172]
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 30, height: 190 }}>
      {heights.map((h, i) => {
        const s = spring({
          frame: local - i * 7,
          fps: 30,
          config: { damping: 13, stiffness: 150 },
        })
        const glow = 0.5 + 0.5 * Math.sin(frame * 0.12 + i)
        return (
          <div
            key={i}
            style={{
              width: 74,
              height: h,
              borderRadius: '14px 14px 6px 6px',
              background:
                i === heights.length - 1
                  ? `linear-gradient(180deg, #34d399, ${COLORS.emerald})`
                  : `linear-gradient(180deg, rgba(251,191,36,0.9), rgba(245,158,11,0.35))`,
              transform: `scaleY(${Math.max(0.01, s)})`,
              transformOrigin: 'bottom',
              boxShadow:
                i === heights.length - 1
                  ? `0 0 ${16 + glow * 18}px rgba(16,185,129,0.6)`
                  : '0 0 14px rgba(245,158,11,0.25)',
            }}
          />
        )
      })}
    </div>
  )
}

/* ═══ CHECK ICON ═══════════════════════════════════════════════════ */
export const CheckIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={COLORS.emerald} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

/* ═══ ARROW RIGHT ══════════════════════════════════════════════════ */
export const ArrowRight: React.FC<{ size?: number; color?: string }> = ({
  size = 44,
  color = '#78350f',
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
)
