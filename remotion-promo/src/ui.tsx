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
 * HELPER VISUAL v3 — BLUE EDITION (skema warna biru sesuai website Luxtradee).
 * Prinsip: SEMUA elemen punya idle motion (float/sway/pulse) + entrance spring
 * dgn overshoot + partikel & kamera drift. Deterministik (pakai random(seed)).
 * Palet: bg navy #050b16, biru brand #3b82f6, cyan #22d3ee, emerald profit, merah punchline.
 */

export const COLORS = {
  bg: '#050b16',
  blue: '#3b82f6',
  blueDeep: '#2563eb',
  blueLight: '#60a5fa',
  blueSoft: '#93c5fd',
  cyan: '#22d3ee',
  white: '#f8fafc',
  muted: 'rgba(226,232,240,0.62)',
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
}> = ({ children, zoomFrom = 1.0, zoomTo = 1.08, panX = 0, panY = 0 }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const t = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const zoom = zoomFrom + (zoomTo - zoomFrom) * t
  const x = panX * t
  const y = panY * t
  return (
    <AbsoluteFill style={{ transform: `scale(${zoom}) translate(${x}px, ${y}px)` }}>
      {children}
    </AbsoluteFill>
  )
}

/* ═══ BLUE PARTICLES — debu biru/cyan berkilau naik ════════════════ */
export const BlueParticles: React.FC<{ count?: number }> = ({ count = 34 }) => {
  const frame = useCurrentFrame()
  const { height } = useVideoConfig()
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {new Array(count).fill(true).map((_, i) => {
        const seed = i * 17.3
        const x = random(`x-${seed}`) * 1080
        const speed = 0.5 + random(`s-${seed}`) * 1.1
        const drift = Math.sin(frame * 0.03 + random(`d-${seed}`) * 8) * 26
        const size = 3 + random(`z-${seed}`) * 6
        const cycle = height + 160
        const y = height + 80 - ((frame * speed + random(`y-${seed}`) * cycle) % cycle)
        const tw =
          0.35 + 0.65 * Math.abs(Math.sin(frame * 0.09 + random(`t-${seed}`) * 10))
        const isCyan = random(`c-${seed}`) > 0.55
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x + drift,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              background: isCyan ? COLORS.cyan : COLORS.blueLight,
              boxShadow: `0 0 ${size * 2.4}px ${isCyan ? 'rgba(34,211,238,0.75)' : 'rgba(96,165,250,0.7)'}`,
              opacity: tw * 0.75,
            }}
          />
        )
      })}
    </AbsoluteFill>
  )
}

/* alias utk kompatibilitas lama */
export const GoldParticles = BlueParticles

/* ═══ PROMO BACKGROUND — orb biru/cyan bergerak ════════════════════ */
export const PromoBackground: React.FC = () => {
  const frame = useCurrentFrame()
  const ox = Math.sin(frame * 0.011) * 90
  const oy = Math.cos(frame * 0.009) * 70
  const cx = Math.cos(frame * 0.013 + 2) * 110
  const cy = Math.sin(frame * 0.01 + 1) * 80
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <div
        style={{
          position: 'absolute',
          width: 1250,
          height: 1250,
          left: -260 + ox,
          top: -320 + oy,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(59,130,246,0.17) 0%, rgba(37,99,235,0.06) 45%, transparent 70%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 1000,
          height: 1000,
          right: -220 + cx,
          bottom: -260 + cy,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(34,211,238,0.12) 0%, rgba(6,182,212,0.05) 45%, transparent 70%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 700,
          height: 700,
          left: 190,
          top: 620 + oy * 0.6,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(96,165,250,0.09) 0%, transparent 65%)',
        }}
      />
    </AbsoluteFill>
  )
}

/* ═══ VIGNETTE — gelap di tepi biar fokus ke tengah ════════════════ */
export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        'radial-gradient(ellipse 78% 66% at 50% 46%, transparent 55%, rgba(2,6,14,0.55) 100%)',
      pointerEvents: 'none',
    }}
  />
)

/* ═══ TICKER STRIP — harga XAUUSD berjalan (dekorasi) ══════════════ */
export const TickerStrip: React.FC<{ top?: number; bottom?: number; speed?: number }> = ({
  top,
  bottom,
  speed = 1.6,
}) => {
  const frame = useCurrentFrame()
  const items = [
    'XAUUSD 2 391.45',
    '+0.84%',
    'BREAKOUT H1',
    'TP HIT +$124.50',
    'GOLD RUN 2 388.20',
    '-0.12%',
    'JURNAL TERCATAT',
    'STREAK 14 HARI',
  ]
  const text = items.join('   •   ') + '   •   '
  const w = text.length * 17
  const x = -((frame * speed) % w)
  return (
    <div
      style={{
        position: 'absolute',
        top: top !== undefined ? top : undefined,
        bottom: bottom !== undefined ? bottom : undefined,
        left: 0,
        right: 0,
        height: 44,
        overflow: 'hidden',
        opacity: 0.1,
        whiteSpace: 'nowrap',
      }}
    >
      <div
        style={{
          display: 'inline-block',
          transform: `translateX(${x}px)`,
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: '0.14em',
          color: COLORS.blueLight,
        }}
      >
        {text + text}
      </div>
    </div>
  )
}

/* ═══ VOICE BARS — equalizer menari (mengikuti greeting VO) ════════ */
export const VoiceBars: React.FC<{
  startFrame?: number
  barCount?: number
  barWidth?: number
  maxHeight?: number
  talkStart?: number
  talkEnd?: number
}> = ({ startFrame = 0, barCount = 15, barWidth = 26, maxHeight = 260, talkStart = 0, talkEnd = 76 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const entrance = spring({ frame: frame - startFrame, fps, config: { damping: 14, stiffness: 150 } })
  /* intensitas: besar saat "bicara", idle pelan setelahnya */
  const talking = frame >= talkStart && frame <= talkEnd
  const energy = talking ? 1 : 0.24 + 0.1 * Math.sin(frame * 0.05)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: barWidth * 0.62,
        height: maxHeight,
        opacity: Math.min(1, entrance * 1.5),
        transform: `scale(${0.6 + entrance * 0.4})`,
      }}
    >
      {new Array(barCount).fill(true).map((_, i) => {
        const seed = i * 13.7
        const p1 = random(`p1-${seed}`) * 10
        const p2 = random(`p2-${seed}`) * 10
        const w1 = 0.14 + random(`w1-${seed}`) * 0.1
        const w2 = 0.31 + random(`w2-${seed}`) * 0.12
        const wave =
          (Math.sin(frame * w1 + p1) * 0.62 + Math.sin(frame * w2 + p2) * 0.38 + 1) / 2
        const h = (26 + wave * (maxHeight - 26)) * energy * (0.55 + 0.45 * entrance)
        const isMid = Math.abs(i - (barCount - 1) / 2) < 2
        return (
          <div
            key={i}
            style={{
              width: barWidth,
              height: Math.max(10, h),
              borderRadius: barWidth,
              background: isMid
                ? `linear-gradient(180deg, ${COLORS.cyan}, ${COLORS.blue})`
                : `linear-gradient(180deg, ${COLORS.blueLight}, ${COLORS.blueDeep})`,
              boxShadow: `0 0 ${16 + wave * 22}px rgba(59,130,246,${0.35 + wave * 0.4})`,
              opacity: 0.9,
            }}
          />
        )
      })}
    </div>
  )
}

/* ═══ RING PULSE — gelombang suara memuai dari tengah ══════════════ */
export const RingPulse: React.FC<{ startFrame?: number; cycles?: number }> = ({
  startFrame = 0,
  cycles = 3,
}) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
      {new Array(cycles).fill(true).map((_, i) => {
        const local = frame - startFrame - i * 11
        if (local < 0) return null
        const t = (local % 46) / 46
        const scale = 0.7 + t * 1.9
        const opacity = (1 - t) * 0.4
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: 640,
              height: 640,
              borderRadius: '50%',
              border: `3px solid ${i % 2 === 0 ? COLORS.blue : COLORS.cyan}`,
              transform: `scale(${scale})`,
              opacity,
              boxShadow: `0 0 40px rgba(59,130,246,${opacity * 0.5})`,
            }}
          />
        )
      })}
    </AbsoluteFill>
  )
}

/* ═══ COIN ORB — bola dolar biru menyala (versi biru dr koin emas) ═ */
export const CoinOrb: React.FC<{ size?: number }> = ({ size = 110 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background:
        'radial-gradient(circle at 35% 30%, #bfdbfe 0%, #3b82f6 52%, #1d4ed8 100%)',
      border: `${Math.max(3, size * 0.045)}px solid #93c5fd`,
      boxShadow: '0 0 34px rgba(59,130,246,0.55), inset 0 0 18px rgba(255,255,255,0.25)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.48,
      fontWeight: 900,
      color: '#eff6ff',
      textShadow: '0 0 12px rgba(255,255,255,0.7)',
    }}
  >
    $
  </div>
)

/* stub lama → orb biru */
export const CoinStub: React.FC<{ size?: number }> = ({ size = 110 }) => <CoinOrb size={size} />

/* ═══ COIN FIELD — orb $ melayang naik terus ═══════════════════════ */
export const CoinField: React.FC<{ count?: number; startFrame?: number }> = ({
  count = 8,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {new Array(count).fill(true).map((_, i) => {
        const seed = i * 29.1
        const x = 80 + random(`fx-${seed}`) * 900
        const speed = 1.3 + random(`fs-${seed}`) * 1.2
        const size = 54 + random(`fz-${seed}`) * 60
        const cycle = 2200 / speed
        const progress = ((frame - startFrame) * speed + random(`fp-${seed}`) * cycle) % cycle
        const y = 2050 - progress
        const appear = spring({
          frame: frame - startFrame - i * 5,
          fps,
          config: { damping: 14, stiffness: 120 },
        })
        const sway = Math.sin(frame * 0.045 + random(`fw-${seed}`) * 9) * 34
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x + sway,
              top: y,
              opacity: appear * 0.5 * Math.min(1, progress / 60) * Math.min(1, (cycle - progress) / 40),
              transform: `scale(${0.75 + appear * 0.25}) rotate(${Math.sin(frame * 0.05 + seed) * 10}deg)`,
            }}
          >
            <CoinOrb size={size} />
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

/* ═══ SPARKLES — bintang kecil berkedip ════════════════════════════ */
export const Sparkles: React.FC<{ count?: number; startFrame?: number }> = ({
  count = 8,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {new Array(count).fill(true).map((_, i) => {
        const seed = i * 41.7
        const x = random(`sx-${seed}`) * 1010 + 35
        const y = random(`sy-${seed}`) * 1780 + 70
        const period = 42 + random(`sp-${seed}`) * 40
        const local = (frame - startFrame + random(`so-${seed}`) * period + period) % period
        const tw = local < 3 ? local / 3 : local > period - 8 ? (period - local) / 8 : 1
        const size = 10 + random(`ss-${seed}`) * 16
        const rot = frame * 0.6 + random(`sr-${seed}`) * 180
        const col = random(`sc-${seed}`) > 0.5 ? COLORS.cyan : COLORS.white
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              opacity: Math.max(0, tw) * 0.85,
              transform: `rotate(${rot}deg) scale(${0.6 + tw * 0.4})`,
              fontSize: size,
              color: col,
              textShadow: `0 0 14px ${col}`,
              fontWeight: 900,
              lineHeight: 1,
            }}
          >
            +
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

/* ═══ FLASH — kilatan layar saat punchline ═════════════════════════ */
export const Flash: React.FC<{ startFrame: number; color: string; max?: number }> = ({
  startFrame,
  color,
  max = 0.24,
}) => {
  const frame = useCurrentFrame()
  const o = frame < startFrame ? 0 : Math.max(0, max - (frame - startFrame) * (max / 7))
  return <AbsoluteFill style={{ background: `rgba(${color},${o})`, pointerEvents: 'none' }} />
}

/* ═══ WORD REVEAL — kata muncul satu per satu (spring + blur) ══════ */
export const WordReveal: React.FC<{ text: string; startFrame?: number; size?: number }> = ({
  text,
  startFrame = 0,
  size = 84,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const words = text.split(' ')
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: `0 ${size * 0.28}px`,
        rowGap: size * 0.18,
        maxWidth: 940,
      }}
    >
      {words.map((w, i) => {
        const s = spring({ frame: frame - startFrame - i * 5, fps, config: { damping: 13, stiffness: 170 } })
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              fontSize: size,
              fontWeight: 800,
              color: COLORS.white,
              opacity: Math.min(1, s * 1.4),
              transform: `translateY(${(1 - s) * 46}px) rotate(${(1 - s) * (i % 2 === 0 ? -7 : 7)}deg) scale(${0.8 + s * 0.2})`,
              filter: `blur(${(1 - s) * 8}px)`,
              textShadow: `0 0 ${28 + 10 * Math.sin(frame * 0.1 + i)}px rgba(96,165,250,0.35)`,
            }}
          >
            {w}
          </span>
        )
      })}
    </div>
  )
}

/* ═══ PUNCH TEXT — teks mendarat keras + shake ═════════════════════ */
export const PunchText: React.FC<{
  children: React.ReactNode
  startFrame: number
  size?: number
  color?: string
  shakePower?: number
  gradient?: boolean
}> = ({ children, startFrame, size = 90, color = COLORS.white, shakePower = 8, gradient = false }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - startFrame, fps, config: { damping: 11, stiffness: 210 } })
  const sx = shake(frame, startFrame, 9, shakePower)
  const pulse = 1 + 0.025 * Math.sin(frame * 0.16)
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: 900,
        textAlign: 'center',
        lineHeight: 1.16,
        maxWidth: 950,
        transform: `translateX(${sx}px) scale(${(0.55 + s * 0.45) * pulse})`,
        opacity: Math.min(1, s * 1.5),
        ...(gradient
          ? {
              backgroundImage: `linear-gradient(95deg, ${COLORS.blueSoft}, ${COLORS.cyan}, #ffffff, ${COLORS.blueLight})`,
              backgroundSize: '190% 100%',
              backgroundPosition: `${((frame * 1.5) % 190) - 45}% 0`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              filter: 'drop-shadow(0 0 26px rgba(59,130,246,0.45))',
            }
          : {
              color,
              textShadow: `0 0 ${30 + 12 * Math.sin(frame * 0.12)}px rgba(59,130,246,0.35)`,
            }),
      }}
    >
      {children}
    </div>
  )
}

/* ═══ FADE UP — masuk dari bawah/kiri/kanan ════════════════════════ */
export const FadeUp: React.FC<{
  children: React.ReactNode
  startFrame: number
  distance?: number
  fromLeft?: boolean
  fromRight?: boolean
}> = ({ children, startFrame, distance = 44, fromLeft = false, fromRight = false }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - startFrame, fps, config: { damping: 15, stiffness: 130 } })
  const dx = fromLeft ? -(1 - s) * distance : fromRight ? (1 - s) * distance : 0
  const dy = fromLeft || fromRight ? 0 : (1 - s) * distance
  return (
    <div
      style={{
        opacity: Math.min(1, s * 1.4),
        transform: `translate(${dx}px, ${dy}px)`,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      {children}
    </div>
  )
}

/* ═══ FEATURE PILL — kapsul fitur muncul bergantian ════════════════ */
export const FeaturePill: React.FC<{
  children: React.ReactNode
  startFrame: number
  phase?: number
}> = ({ children, startFrame, phase = 0 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - startFrame, fps, config: { damping: 14, stiffness: 160 } })
  const sway = Math.sin(frame * 0.06 + phase) * 5
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: '22px 44px',
        borderRadius: 999,
        border: '2px solid rgba(96,165,250,0.4)',
        background: 'rgba(59,130,246,0.12)',
        boxShadow: `0 0 ${22 + 8 * Math.sin(frame * 0.1 + phase)}px rgba(59,130,246,0.25)`,
        opacity: Math.min(1, s * 1.4),
        transform: `translateX(${(1 - s) * -110}px) translateY(${sway}px)`,
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: COLORS.cyan,
          boxShadow: `0 0 ${12 + 6 * Math.sin(frame * 0.14 + phase)}px rgba(34,211,238,0.9)`,
          flexShrink: 0,
        }}
      />
      <div style={{ fontSize: 46, fontWeight: 700, color: COLORS.white, whiteSpace: 'nowrap' }}>
        {children}
      </div>
    </div>
  )
}

/* ═══ SHINE TEXT — teks gradient dgn kilau menyapu ═════════════════ */
export const ShineText: React.FC<{
  children: React.ReactNode
  startFrame: number
  size?: number
  loop?: number
}> = ({ children, startFrame, size = 140, loop = 55 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - startFrame, fps, config: { damping: 13, stiffness: 150 } })
  const pos = ((frame * (200 / loop)) % 240) - 70
  return (
    <div
      style={{
        opacity: Math.min(1, s * 1.4),
        transform: `scale(${0.75 + s * 0.25}) translateY(${Math.sin(frame * 0.055) * 5}px)`,
        fontSize: size,
        fontWeight: 900,
        textAlign: 'center',
        lineHeight: 1.12,
        backgroundImage: `linear-gradient(100deg, ${COLORS.blueSoft} 20%, #ffffff 38%, ${COLORS.cyan} 46%, ${COLORS.blue} 60%, ${COLORS.blueSoft} 80%)`,
        backgroundSize: '240% 100%',
        backgroundPosition: `${pos}% 0`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        filter: `drop-shadow(0 0 ${30 + 12 * Math.sin(frame * 0.11)}px rgba(59,130,246,0.5))`,
      }}
    >
      {children}
    </div>
  )
}

/* ═══ COUNTER — angka roll naik + ring ekspansi ════════════════════ */
export const Counter: React.FC<{ startFrame: number; target: number }> = ({
  startFrame,
  target,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const roll = spring({ frame: frame - startFrame, fps, config: { damping: 20, stiffness: 55 } })
  const val = Math.round(interpolate(roll, [0, 1], [0, target], { extrapolateRight: 'clamp' }))
  const ringT = interpolate(roll, [0, 1], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {[0, 1].map((i) => {
        const t = ((ringT * 1.4 + i * 0.5) % 1)
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: 420,
              height: 420,
              borderRadius: '50%',
              border: `4px solid ${COLORS.cyan}`,
              opacity: (1 - t) * 0.35,
              transform: `scale(${0.75 + t * 0.65})`,
            }}
          />
        )
      })}
      <div
        style={{
          position: 'relative',
          fontSize: 250,
          fontWeight: 900,
          lineHeight: 1,
          backgroundImage: `linear-gradient(180deg, #ffffff 8%, ${COLORS.blueLight} 45%, ${COLORS.cyan} 100%)`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          filter: `drop-shadow(0 0 ${34 + 14 * Math.sin(frame * 0.13)}px rgba(59,130,246,0.55))`,
          transform: `scale(${0.7 + roll * 0.3})`,
        }}
      >
        {val}
        <span style={{ fontSize: 110, fontWeight: 900 }}>%</span>
      </div>
    </div>
  )
}

/* ═══ STAMP TEXT — dicap miring + shake ════════════════════════════ */
export const StampText: React.FC<{
  children: React.ReactNode
  startFrame: number
  size?: number
  color?: string
}> = ({ children, startFrame, size = 96, color = COLORS.emerald }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - startFrame, fps, config: { damping: 9, stiffness: 260 } })
  const sx = shake(frame, startFrame, 10, 7)
  const rgb = color === COLORS.emerald ? '16,185,129' : color === COLORS.cyan ? '34,211,238' : '59,130,246'
  return (
    <div
      style={{
        padding: `${size * 0.12}px ${size * 0.4}px`,
        border: `${Math.max(5, size * 0.065)}px solid ${color}`,
        borderRadius: 24,
        color,
        fontSize: size,
        fontWeight: 900,
        letterSpacing: '0.06em',
        transform: `translateX(${sx}px) rotate(-7deg) scale(${0.5 + s * 0.5})`,
        opacity: Math.min(1, s * 1.6),
        boxShadow: `0 0 ${30 + 10 * Math.sin(frame * 0.14)}px rgba(${rgb},0.5), inset 0 0 24px rgba(${rgb},0.14)`,
        textShadow: `0 0 20px rgba(${rgb},0.6)`,
        background: `rgba(${rgb},0.07)`,
      }}
    >
      {children}
    </div>
  )
}

/* ═══ LINE CHART — garis untung tergambar + lilin latar ════════════ */
export const LineChart: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const card = spring({ frame: frame - startFrame + 6, fps, config: { damping: 15, stiffness: 120 } })
  const W = 880
  const H = 330
  const pts = [
    [0, 235], [95, 205], [175, 220], [265, 168], [350, 182], [445, 128],
    [530, 142], [625, 92], [700, 108], [795, 48], [880, 30],
  ]
  const path = pts.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(' ')
  const draw = interpolate(frame, [startFrame, startFrame + 34], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const candles = [58, 132, 208, 286, 362, 438, 515, 592, 668, 745, 822]
  return (
    <div
      style={{
        opacity: Math.min(1, card * 1.3),
        transform: `translateY(${(1 - card) * 40}px) scale(${0.92 + card * 0.08})`,
        background: 'rgba(10,20,40,0.72)',
        border: '2px solid rgba(96,165,250,0.3)',
        borderRadius: 28,
        padding: 26,
        boxShadow: `0 0 ${30 + 10 * Math.sin(frame * 0.1)}px rgba(59,130,246,0.25)`,
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* viewBox dipertahankan 880x330, dirender lebih kecil supaya muat dgn teks kicker */}
      <svg width={712} height={267} viewBox={`0 0 ${W} ${H}`}>
        {candles.map((cx, i) => {
          const up = i % 3 !== 1
          const base = 250 - i * 17
          const h = 40 + ((i * 29) % 46)
          const col = up ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.45)'
          return (
            <g key={i}>
              <rect x={cx - 3} y={base - h} width={6} height={h + 22} fill={col} opacity={0.55} />
              <rect x={cx - 14} y={base} width={28} height={h} rx={5} fill={col} />
            </g>
          )
        })}
        <path
          d={path}
          fill="none"
          stroke={COLORS.cyan}
          strokeWidth={9}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - draw}
          style={{ filter: 'drop-shadow(0 0 10px rgba(34,211,238,0.75))' }}
        />
        {draw >= 1 ? (
          <circle cx={880} cy={30} r={11} fill="#ffffff" style={{ filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.9))' }} />
        ) : null}
      </svg>
      {draw >= 1 ? (
        <div
          style={{
            position: 'absolute',
            top: 14,
            right: 26,
            background: 'rgba(16,185,129,0.16)',
            border: '2px solid rgba(16,185,129,0.55)',
            borderRadius: 14,
            padding: '6px 18px',
            fontSize: 32,
            fontWeight: 900,
            color: '#34d399',
            textShadow: '0 0 14px rgba(52,211,153,0.6)',
          }}
        >
          +$124.50
        </div>
      ) : null}
    </div>
  )
}

/* ═══ MINI BAR CHART — 5 bar tumbuh (komisi berulang) ══════════════ */
export const MiniBarChart: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const heights = [120, 165, 150, 205, 240]
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 34, height: 250 }}>
      {heights.map((h, i) => {
        const s = spring({
          frame: frame - startFrame - i * 7,
          fps,
          config: { damping: 13, stiffness: 150 },
        })
        const last = i === heights.length - 1
        const glow = last ? 0.55 + 0.3 * Math.sin(frame * 0.15) : 0.2
        return (
          <div
            key={i}
            style={{
              width: 76,
              height: h * s,
              borderRadius: 14,
              background: last
                ? `linear-gradient(180deg, #34d399, ${COLORS.emerald})`
                : `linear-gradient(180deg, ${COLORS.blueLight}, ${COLORS.blueDeep})`,
              boxShadow: last
                ? `0 0 ${20 + 14 * Math.sin(frame * 0.15)}px rgba(16,185,129,0.6)`
                : `0 0 16px rgba(59,130,246,0.35)`,
              opacity: last ? 1 : 0.85,
              transformOrigin: 'bottom',
            }}
          />
        )
      })}
    </div>
  )
}

/* ═══ CHECK ICON ═══════════════════════════════════════════════════ */
export const CheckIcon: React.FC<{ size?: number }> = ({ size = 52 }) => (
  <svg width={size} height={size} viewBox="0 0 52 52">
    <circle cx="26" cy="26" r="24" fill="rgba(16,185,129,0.18)" stroke={COLORS.emerald} strokeWidth="4" />
    <path d="M15 27 L23 35 L38 18" fill="none" stroke="#34d399" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/* ═══ ARROW RIGHT ══════════════════════════════════════════════════ */
export const ArrowRight: React.FC<{ size?: number }> = ({ size = 54 }) => (
  <svg width={size} height={size} viewBox="0 0 54 54">
    <path d="M8 27 H42 M28 13 L44 27 L28 41" fill="none" stroke="#0a1a33" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/* ═══ CONFETTI — fisika jatuh (palet biru/cyan/emerald) ════════════ */
export const Confetti: React.FC<{
  startFrame: number
  count?: number
  cy?: number
  power?: number
}> = ({ startFrame, count = 44, cy = 46, power = 1.0 }) => {
  const frame = useCurrentFrame()
  const palette = [COLORS.blue, COLORS.cyan, COLORS.blueLight, COLORS.emerald, '#ffffff']
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {new Array(count).fill(true).map((_, i) => {
        const seed = i * 7.77
        const angle = -Math.PI / 2 + (random(`ca-${seed}`) - 0.5) * 2.4
        const vel = (260 + random(`cv-${seed}`) * 340) * power
        const vx = Math.cos(angle) * vel
        const vy = Math.sin(angle) * vel
        const dur = 58 + random(`cd-${seed}`) * 16
        const local = frame - startFrame - random(`cdl-${seed}`) * 8
        if (local < 0) return null
        const p = local / dur
        if (p > 1) return null
        const x = 540 + vx * p * 0.42
        const y = 1920 * (cy / 100) + vy * p * 0.5 + 55 * p * p
        const rot = random(`cr-${seed}`) * 360 + local * (6 + random(`crs-${seed}`) * 9)
        const w = 14 + random(`cw-${seed}`) * 16
        const h = 10 + random(`ch-${seed}`) * 12
        const fade = Math.min(1, local / 2.5) * (p > 0.72 ? (1 - p) / 0.28 : 1)
        const col = palette[i % palette.length]
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: w,
              height: h,
              background: col,
              borderRadius: 3,
              transform: `rotate(${rot}deg)`,
              opacity: fade,
              boxShadow: `0 0 10px ${col}`,
            }}
          />
        )
      })}
    </AbsoluteFill>
  )
}
