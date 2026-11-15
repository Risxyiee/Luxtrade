import React from 'react'
import { AbsoluteFill, Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { TransitionSeries, linearTiming } from '@remotion/transitions'
import { slide } from '@remotion/transitions/slide'
import { wipe } from '@remotion/transitions/wipe'
import { flip } from '@remotion/transitions/flip'
import { clockWipe } from '@remotion/transitions/clock-wipe'
import { loadFont } from '@remotion/google-fonts/Lexend'
import {
  ArrowRight,
  BlueParticles,
  CameraDrift,
  CheckIcon,
  CoinField,
  CoinOrb,
  COLORS,
  Confetti,
  Counter,
  FadeUp,
  FeaturePill,
  Flash,
  Float,
  LineChart,
  MiniBarChart,
  PunchText,
  PromoBackground,
  RingPulse,
  ShineText,
  Sparkles,
  StampText,
  TickerStrip,
  Vignette,
  VoiceBars,
  WordReveal,
  shake,
} from './ui'

/* Font brand LuxTradee (sama dgn situs) */
const { fontFamily } = loadFont('normal', { weights: ['400', '600', '700', '800', '900'] })

/*
 * LUXTRADEE PROMO v3 — BLUE EDITION + VOICE GREETING (1080x1920, ±31 dtk).
 * Skema biru sesuai website luxtradee.web.id (#3b82f6 / #22d3ee di atas navy).
 * Scene 1 memakai suara ASLI pemilik (greeting.wav): "Hello… selamat datang!"
 * — teks "SELAMAT DATANG" muncul tepat saat suaranya terdengar (frame 22).
 * Sisanya kinetic typography penuh gerakan: kamera drift, partikel, orb $,
 * confetti fisika, grafik live, transisi slide/wipe/flip/clock antar scene.
 */

/* ═══ SCENE 1 — GREETING SUARA ASLI (90f) ═══════════════════════════ */
/* VO S1 = suara ASLI pemilik (greeting.wav) — sudah terpasang di bawah */
const SceneGreeting: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const sub = spring({ frame: frame - 50, fps, config: { damping: 15, stiffness: 130 } })
  return (
    <AbsoluteFill>
      {/* VO suara pemilik: "Hello… selamat datang, selamat datang!" (2,39 dtk) */}
      <Sequence from={4}>
        <Audio src={staticFile('vo/greeting.wav')} />
      </Sequence>
      <CameraDrift zoomFrom={1.04} zoomTo={1.12} panY={-20}>
        <RingPulse startFrame={6} cycles={4} />
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 54 }}>
          {/* equalizer menari tepat saat suara terdengar */}
          <div style={{ transform: `translateY(${Math.sin(frame * 0.05) * 6}px)` }}>
            <VoiceBars startFrame={2} talkStart={4} talkEnd={78} />
          </div>
          {/* teks muncul pas suara "selamat datang" (frame ~22) */}
          <WordReveal text="SELAMAT DATANG," startFrame={20} size={112} />
          <FadeUp startFrame={50} distance={38}>
            <div
              style={{
                fontSize: 54,
                fontWeight: 700,
                color: COLORS.blueLight,
                textAlign: 'center',
                opacity: Math.min(1, sub * 1.4),
                transform: `translateY(${(1 - sub) * 26}px)`,
                textShadow: `0 0 ${24 + 10 * Math.sin(frame * 0.12)}px rgba(96,165,250,0.5)`,
              }}
            >
              trader XAUUSD Indonesia
            </div>
          </FadeUp>
          <FadeUp startFrame={64} distance={30}>
            <div style={{ fontSize: 40, fontWeight: 500, color: COLORS.muted, textAlign: 'center' }}>
              Kamu datang di tempat yang tepat.
            </div>
          </FadeUp>
        </AbsoluteFill>
        <Sparkles count={9} startFrame={16} />
        <Flash startFrame={20} color="59,130,246" max={0.16} />
      </CameraDrift>
    </AbsoluteFill>
  )
}

/* ═══ SCENE 2 — HOOK (100f) ═════════════════════════════════════════ */
const SceneHook: React.FC = () => (
  <AbsoluteFill>
    {/* VO: "Punya skill trading emas... tapi cuma diem?" (2,25 dtk) */}
    <Sequence from={6}>
      <Audio src={staticFile('vo/vo2.wav')} />
    </Sequence>
    <CameraDrift zoomFrom={1.05} zoomTo={1.14} panY={-24}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 64 }}>
        <Float amp={8} phase={0.6}>
          <WordReveal text="Punya skill trading XAUUSD?" startFrame={3} size={90} />
        </Float>
        <PunchText startFrame={52} size={104} color={COLORS.red} shakePower={9}>
          Tapi cuma diem?
        </PunchText>
        <Sparkles count={9} startFrame={50} />
        <Flash startFrame={52} color="239,68,68" max={0.22} />
        {/* orb dolar dekor pojok */}
        <Float amp={16} speed={0.05} phase={2} rotateAmp={8} style={{ position: 'absolute', top: 300, right: 90 }}>
          <div style={{ opacity: 0.35, transform: 'scale(0.8)' }}>
            <CoinOrb size={110} />
          </div>
        </Float>
        <Float amp={13} speed={0.045} phase={4.2} rotateAmp={-7} style={{ position: 'absolute', bottom: 430, left: 80 }}>
          <div style={{ opacity: 0.25, transform: 'scale(0.62)' }}>
            <CoinOrb size={110} />
          </div>
        </Float>
      </AbsoluteFill>
    </CameraDrift>
  </AbsoluteFill>
)

/* ═══ SCENE 3 — PROBLEM (100f) ══════════════════════════════════════ */
const SceneProblem: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  /* orb "dompet" jatuh saat punchline mendarat */
  const fall = spring({ frame: frame - 62, fps, config: { damping: 20, stiffness: 60 } })
  return (
    <AbsoluteFill>
      {/* VO: "Analisis bagus, konten keren, tapi dompet tipis?" (3,23 dtk) */}
      <Sequence from={4}>
        <Audio src={staticFile('vo/vo3.wav')} />
      </Sequence>
      <CameraDrift zoomFrom={1.02} zoomTo={1.1} panX={-18}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 46 }}>
          <FadeUp startFrame={5} fromLeft distance={70}>
            <Float amp={7} phase={0.4}>
              <div style={{ fontSize: 64, fontWeight: 600, color: COLORS.muted, textAlign: 'center' }}>
                Analisis kamu bagus...
              </div>
            </Float>
          </FadeUp>
          <FadeUp startFrame={26} fromRight distance={70}>
            <Float amp={7} phase={2.6}>
              <div style={{ fontSize: 64, fontWeight: 600, color: COLORS.muted, textAlign: 'center' }}>
                Konten kamu keren...
              </div>
            </Float>
          </FadeUp>
          {/* 3 orb muncul lalu jatuh */}
          <div style={{ display: 'flex', gap: 34, marginTop: 8 }}>
            {[0, 1, 2].map((i) => {
              const appear = spring({ frame: frame - 26 - i * 4, fps, config: { damping: 12, stiffness: 180 } })
              const fallY = fall > 0 ? fall * 520 : 0
              return (
                <div
                  key={i}
                  style={{
                    opacity: appear * (fall > 0 ? Math.max(0, 1 - fall * 1.4) : 1),
                    transform: `translateY(${(1 - appear) * 40 + fallY}px) rotate(${fall * (i + 1) * 40}deg)`,
                  }}
                >
                  <Float amp={6} phase={i * 1.8} rotateAmp={6}>
                    <div style={{ transform: `scale(${1.1 - i * 0.18})` }}>
                      <CoinOrb size={110} />
                    </div>
                  </Float>
                </div>
              )
            })}
          </div>
          <PunchText startFrame={62} size={90} color={COLORS.red} shakePower={10}>
            Tapi dompet masih tipis?
          </PunchText>
          <Sparkles count={7} startFrame={58} />
          <Flash startFrame={62} color="239,68,68" max={0.25} />
        </AbsoluteFill>
      </CameraDrift>
    </AbsoluteFill>
  )
}

/* ═══ SCENE 4 — BRAND + SOLUSI (205f) ═══════════════════════════════ */
const SceneBrand: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const logoSpring = spring({ frame: frame - 4, fps, config: { damping: 13, stiffness: 130 } })
  const blur = (1 - logoSpring) * 22
  const underline = Math.min(100, Math.max(0, ((frame - 34) / 22) * 100))
  const kamuPulse = 1 + 0.06 * Math.sin(frame * 0.15)
  return (
    <AbsoluteFill>
      {/* VO: "Kenalin, Luxtradee!" (f6) + "Impor CSV, screenshot dibaca AI..." (f64) */}
      <Sequence from={6}>
        <Audio src={staticFile('vo/vo4a.wav')} />
      </Sequence>
      <Sequence from={64}>
        <Audio src={staticFile('vo/vo4b.wav')} />
      </Sequence>
      <CameraDrift zoomFrom={1.0} zoomTo={1.08} panY={-30}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 38 }}>
          <Float amp={9} speed={0.045}>
            <div
              style={{
                fontSize: 134,
                fontWeight: 900,
                letterSpacing: '0.02em',
                backgroundImage: `linear-gradient(92deg, ${COLORS.blueSoft}, ${COLORS.cyan}, #ffffff, ${COLORS.blue})`,
                backgroundSize: '200% 100%',
                backgroundPosition: `${((frame * 1.6) % 200) - 50}% 0`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                filter: `blur(${blur}px) drop-shadow(0 0 ${55 + 15 * Math.sin(frame * 0.1)}px rgba(59,130,246,0.45))`,
                transform: `scale(${0.85 + logoSpring * 0.15})`,
              }}
            >
              LUXTRADEE
            </div>
          </Float>
          {/* underline tumbuh */}
          <div
            style={{
              width: `${underline}%`,
              height: 8,
              borderRadius: 4,
              background: `linear-gradient(90deg, transparent, ${COLORS.cyan}, ${COLORS.blue}, transparent)`,
              boxShadow: '0 0 20px rgba(59,130,246,0.55)',
              marginTop: -18,
            }}
          />
          <FadeUp startFrame={40} distance={34}>
            <div style={{ fontSize: 52, fontWeight: 700, color: COLORS.white, textAlign: 'center' }}>
              Jurnal Trading AI
              <div style={{ fontSize: 40, fontWeight: 500, color: COLORS.muted, marginTop: 8 }}>
                untuk Trader Indonesia
              </div>
            </div>
          </FadeUp>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', marginTop: 14 }}>
            <FeaturePill startFrame={74} phase={0}>
              Impor CSV MT4 / MT5
            </FeaturePill>
            <FeaturePill startFrame={90} phase={2.1}>
              Screenshot dibaca AI
            </FeaturePill>
            <FeaturePill startFrame={106} phase={4.2}>
              Deteksi pola kesalahan
            </FeaturePill>
          </div>
          {/* chart live di bawah */}
          <div style={{ position: 'absolute', bottom: 230, left: 158, opacity: 0.95 }}>
            <LineChart startFrame={116} />
          </div>
          <FadeUp startFrame={150} distance={40}>
            <Float amp={6} phase={1.5}>
              <div style={{ fontSize: 48, fontWeight: 800, color: COLORS.white, textAlign: 'center', maxWidth: 880 }}>
                Sekarang giliran{' '}
                <span
                  style={{
                    color: COLORS.cyan,
                    display: 'inline-block',
                    transform: `scale(${kamuPulse})`,
                    textShadow: `0 0 ${30 + 14 * Math.sin(frame * 0.13)}px rgba(34,211,238,0.65)`,
                  }}
                >
                  KAMU
                </span>{' '}
                yang dapat cuan.
              </div>
            </Float>
          </FadeUp>
          <Sparkles count={10} startFrame={20} />
        </AbsoluteFill>
      </CameraDrift>
    </AbsoluteFill>
  )
}

/* ═══ SCENE 5 — KOMISI 20% (186f) ═══════════════════════════════════ */
const SceneKomisi: React.FC = () => {
  const frame = useCurrentFrame()
  const sx = shake(frame, 52, 10, 6)
  return (
    <AbsoluteFill>
      {/* VO: "Setiap member daftar lewat kodemu, kamu dapat komisi 20 persen. Berulang, tiap bulan." (5,59 dtk) */}
      <Sequence from={4}>
        <Audio src={staticFile('vo/vo5.wav')} />
      </Sequence>
      <CameraDrift zoomFrom={1.03} zoomTo={1.1} panY={20}>
        <CoinField count={8} startFrame={10} />
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            gap: 42,
            transform: `translateX(${sx}px)`,
          }}
        >
          <FadeUp startFrame={2} distance={30}>
            <div style={{ fontSize: 46, fontWeight: 600, color: COLORS.muted, letterSpacing: '0.08em', textAlign: 'center' }}>
              KOMISI DARI TIAP PENJUALAN
            </div>
          </FadeUp>
          <Counter startFrame={36} target={20} />
          <PunchText startFrame={130} size={84} color={COLORS.cyan} gradient shakePower={6}>
            Berulang. Bukan sekali.
          </PunchText>
          <div style={{ marginTop: 4 }}>
            <MiniBarChart startFrame={132} />
          </div>
          <FadeUp startFrame={150} distance={36}>
            <Float amp={6} phase={3}>
              <div style={{ fontSize: 50, fontWeight: 700, color: COLORS.white, textAlign: 'center', lineHeight: 1.3 }}>
                10 member aktif
                <div
                  style={{
                    color: COLORS.emerald,
                    fontSize: 60,
                    fontWeight: 900,
                    textShadow: `0 0 ${26 + 12 * Math.sin(frame * 0.13)}px rgba(16,185,129,0.55)`,
                  }}
                >
                  = cuan masuk tiap bulan
                </div>
              </div>
            </Float>
          </FadeUp>
          <Flash startFrame={52} color="59,130,246" max={0.26} />
          <Sparkles count={9} startFrame={30} />
        </AbsoluteFill>
      </CameraDrift>
    </AbsoluteFill>
  )
}

/* ═══ SCENE 6 — FREE PRO 3 BULAN (145f) ═════════════════════════════ */
const SceneFreePro: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const badge = spring({ frame: frame - 2, fps, config: { damping: 13, stiffness: 170 } })
  const strike = Math.min(100, Math.max(0, ((frame - 88) / 14) * 100))
  const price = spring({ frame: frame - 70, fps, config: { damping: 15, stiffness: 140 } })
  const sx = shake(frame, 104, 10, 7)
  return (
    <AbsoluteFill>
      {/* VO: "Khusus kreator TikTok, free Pro 3 bulan. Gratis!" (4,02 dtk) */}
      <Sequence from={10}>
        <Audio src={staticFile('vo/vo6.wav')} />
      </Sequence>
      <CameraDrift zoomFrom={1.02} zoomTo={1.1}>
        <Confetti startFrame={104} count={52} cy={46} power={1.35} />
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            gap: 44,
            transform: `translateX(${sx}px)`,
          }}
        >
          <div
            style={{
              opacity: Math.min(1, badge * 1.6),
              transform: `scale(${0.7 + badge * 0.3}) translateY(${Math.sin(frame * 0.06) * 5}px)`,
              border: '2px solid rgba(255,255,255,0.25)',
              borderRadius: 999,
              padding: '16px 44px',
              fontSize: 38,
              fontWeight: 600,
              color: COLORS.white,
              background: 'rgba(255,255,255,0.06)',
              boxShadow: '0 0 30px rgba(255,255,255,0.08)',
            }}
          >
            Khusus Konten Kreator TikTok
          </div>
          <ShineText startFrame={50} size={148}>
            Free Pro
            <br />
            3 Bulan
          </ShineText>
          <div style={{ display: 'flex', alignItems: 'center', gap: 38, marginTop: 6 }}>
            <div style={{ position: 'relative', opacity: Math.min(1, price * 1.5), transform: `translateY(${(1 - price) * 40}px)` }}>
              <Float amp={4} phase={2}>
                <div style={{ fontSize: 56, fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>Rp147.000</div>
              </Float>
              <div
                style={{
                  position: 'absolute',
                  top: '52%',
                  left: '-4%',
                  width: `${strike}%`,
                  height: 9,
                  background: COLORS.red,
                  borderRadius: 5,
                  transform: 'rotate(-6deg)',
                  boxShadow: '0 0 16px rgba(239,68,68,0.6)',
                }}
              />
            </div>
            <StampText startFrame={104} size={98} color={COLORS.emerald}>
              Gratis
            </StampText>
          </div>
          <Flash startFrame={104} color="16,185,129" max={0.25} />
          <Sparkles count={13} startFrame={16} />
        </AbsoluteFill>
      </CameraDrift>
    </AbsoluteFill>
  )
}

/* ═══ SCENE 7 — 3 LANGKAH (148f) ════════════════════════════════════ */
const StepRow: React.FC<{
  no: string
  label: string
  startFrame: number
  accent?: boolean
  phase?: number
}> = ({ no, label, startFrame, accent = false, phase = 0 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - startFrame, fps, config: { damping: 14, stiffness: 160 } })
  const badge = spring({ frame: frame - startFrame + 3, fps, config: { damping: 11, stiffness: 210 } })
  const idleY = Math.sin(frame * 0.06 + phase) * 6
  const glow = 0.5 + 0.5 * Math.sin(frame * 0.16)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 28,
        opacity: Math.min(1, s * 1.5),
        transform: `translateX(${(1 - s) * -160}px) translateY(${idleY}px)`,
      }}
    >
      <div
        style={{
          width: 108,
          height: 108,
          borderRadius: '50%',
          border: `4px solid ${accent ? COLORS.emerald : 'rgba(96,165,250,0.75)'}`,
          background: accent ? 'rgba(16,185,129,0.14)' : 'rgba(59,130,246,0.14)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 52,
          fontWeight: 900,
          color: accent ? '#34d399' : COLORS.cyan,
          transform: `scale(${0.5 + badge * 0.5})`,
          boxShadow: accent
            ? `0 0 ${20 + glow * 22}px rgba(16,185,129,0.5)`
            : `0 0 ${16 + glow * 12}px rgba(59,130,246,0.4)`,
          flexShrink: 0,
        }}
      >
        {no}
      </div>
      <div style={{ fontSize: 52, fontWeight: 700, color: COLORS.white, display: 'flex', alignItems: 'center', gap: 18 }}>
        {label}
        {accent ? (
          <span style={{ transform: `scale(${0.5 + badge * 0.5})`, display: 'inline-flex' }}>
            <CheckIcon size={52} />
          </span>
        ) : null}
      </div>
    </div>
  )
}

const SceneCara: React.FC = () => {
  const frame = useCurrentFrame()
  const lineGrow = Math.min(1, Math.max(0, (frame - 16) / 54))
  return (
    <AbsoluteFill>
      {/* VO: "Daftar, bagikan kode referral, komisi mengalir. Selesai!" (4,48 dtk) */}
      <Sequence from={2}>
        <Audio src={staticFile('vo/vo7.wav')} />
      </Sequence>
      <CameraDrift zoomFrom={1.02} zoomTo={1.09} panX={14}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 54 }}>
          <FadeUp startFrame={0} distance={30}>
            <div style={{ fontSize: 44, fontWeight: 600, color: COLORS.muted, letterSpacing: '0.1em', textAlign: 'center' }}>
              GAMPANG. CUMA 3 LANGKAH.
            </div>
          </FadeUp>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 52, maxWidth: '96%' }}>
            {/* garis konektor tumbuh */}
            <div
              style={{
                position: 'absolute',
                left: 57,
                top: 100,
                width: 5,
                height: `${lineGrow * 230}px`,
                background: `linear-gradient(180deg, ${COLORS.blue}, rgba(59,130,246,0.15))`,
                borderRadius: 3,
              }}
            />
            <StepRow no="01" label="Daftar gratis" startFrame={14} phase={0} />
            <StepRow no="02" label="Bagikan kode referral kamu" startFrame={38} phase={2.1} />
            <StepRow no="03" label="Komisi mengalir. Selesai." startFrame={62} accent phase={4.2} />
          </div>
          <Sparkles count={7} startFrame={56} />
        </AbsoluteFill>
      </CameraDrift>
    </AbsoluteFill>
  )
}

/* ═══ SCENE 8 — CTA (135f) ══════════════════════════════════════════ */
const SceneCta: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames: D } = useVideoConfig()
  const underline = Math.min(100, Math.max(0, ((frame - 18) / 18) * 100))
  const btn = spring({ frame: frame - 22, fps, config: { damping: 12, stiffness: 180 } })
  const btnPulse = 1 + 0.035 * Math.sin(frame * 0.2)
  const arrowBob = Math.sin(frame * 0.18) * 8
  const endFade = interpolate(frame, [D - 8, D - 1], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 46, opacity: endFade }}>
      {/* VO: "Buka luxtradee dot web dot id slash affiliate, daftar sekarang!" (3,59 dtk) */}
      <Sequence from={8}>
        <Audio src={staticFile('vo/vo8.wav')} />
      </Sequence>
      {/* orb glow pulsing */}
      <div
        style={{
          position: 'absolute',
          width: 900,
          height: 900,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(59,130,246,${0.15 + 0.05 * Math.sin(frame * 0.1)}) 0%, transparent 65%)`,
        }}
      />
      <PunchText startFrame={0} size={60} color={COLORS.white} gradient={false} shakePower={5}>
        luxtradee.web.id/affiliate
      </PunchText>
      <div
        style={{
          width: `${underline}%`,
          height: 10,
          background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.blue})`,
          borderRadius: 5,
          boxShadow: '0 0 22px rgba(59,130,246,0.6)',
          marginTop: -22,
        }}
      />
      {/* tombol CTA membesar-mengecil + panah bergoyang */}
      <div
        style={{
          opacity: Math.min(1, btn * 1.6),
          transform: `scale(${(0.6 + btn * 0.4) * btnPulse}) translateY(${Math.sin(frame * 0.06) * 5}px)`,
          background: `linear-gradient(92deg, ${COLORS.cyan}, ${COLORS.blue})`,
          borderRadius: 999,
          padding: '30px 64px',
          fontSize: 52,
          fontWeight: 900,
          color: '#06122b',
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          boxShadow: `0 0 ${40 + 20 * Math.sin(frame * 0.15)}px rgba(59,130,246,0.6), 0 10px 0 rgba(29,78,216,0.6)`,
        }}
      >
        DAFTAR SEKARANG
        <span style={{ transform: `translateX(${arrowBob}px)`, display: 'inline-flex' }}>
          <ArrowRight size={54} />
        </span>
      </div>
      <FadeUp startFrame={40} distance={30}>
        <Float amp={5} phase={1.2}>
          <div style={{ fontSize: 42, fontWeight: 700, color: COLORS.cyan, textAlign: 'center' }}>
            Konten kreator TikTok → Free Pro 3 bulan
          </div>
        </Float>
      </FadeUp>
      <FadeUp startFrame={54} distance={30}>
        <div style={{ fontSize: 38, fontWeight: 500, color: COLORS.muted, textAlign: 'center' }}>
          Slot kreator terbatas. Mulai hari ini.
        </div>
      </FadeUp>
      <FadeUp startFrame={68} distance={30}>
        <ShineText startFrame={72} size={62} loop={50}>
          LUXTRADEE
        </ShineText>
      </FadeUp>
      <Confetti startFrame={22} count={26} cy={48} power={0.75} />
      <Sparkles count={10} startFrame={8} />
    </AbsoluteFill>
  )
}

/* ═══ TIMELINE UTAMA — TransitionSeries (transisi sinematik) ═══════ */
export const PromoVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily }}>
      <PromoBackground />
      <BlueParticles count={36} />
      <TickerStrip top={80} />
      <TickerStrip bottom={60} speed={1.9} />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={90}>
          <SceneGreeting />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={linearTiming({ durationInFrames: 14 })} />
        <TransitionSeries.Sequence durationInFrames={100}>
          <SceneHook />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: 'from-left' })} timing={linearTiming({ durationInFrames: 12 })} />
        <TransitionSeries.Sequence durationInFrames={114}>
          <SceneProblem />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={clockWipe({ width: 1080, height: 1920 })} timing={linearTiming({ durationInFrames: 13 })} />
        <TransitionSeries.Sequence durationInFrames={205}>
          <SceneBrand />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={flip({ direction: 'from-right' })} timing={linearTiming({ durationInFrames: 15 })} />
        <TransitionSeries.Sequence durationInFrames={186}>
          <SceneKomisi />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: 'from-bottom' })} timing={linearTiming({ durationInFrames: 14 })} />
        <TransitionSeries.Sequence durationInFrames={145}>
          <SceneFreePro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: 'from-right' })} timing={linearTiming({ durationInFrames: 12 })} />
        <TransitionSeries.Sequence durationInFrames={148}>
          <SceneCara />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={clockWipe({ width: 1080, height: 1920 })} timing={linearTiming({ durationInFrames: 12 })} />
        <TransitionSeries.Sequence durationInFrames={135}>
          <SceneCta />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <Vignette />
    </AbsoluteFill>
  )
}
