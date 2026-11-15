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
  CameraDrift,
  CheckIcon,
  CoinField,
  COLORS,
  Confetti,
  Counter,
  FadeUp,
  FeaturePill,
  Flash,
  Float,
  GoldParticles,
  LineChart,
  MiniBarChart,
  PunchText,
  PromoBackground,
  ShineText,
  Sparkles,
  StampText,
  TickerStrip,
  Vignette,
  WaveText,
  WordReveal,
  shake,
} from './ui'

/* Font brand LuxTradee (sama dgn situs) */
const { fontFamily } = loadFont('normal', { weights: ['400', '600', '700', '800', '900'] })

/*
 * LUXTRADEE PROMO v2 — FULL MOTION (1080x1920, ±31 dtk).
 * Semua elemen bergerak terus: idle float, partikel emas, kamera drift,
 * koin terbang, confetti, transisi slide/wipe/flip/clock antar scene.
 * Copy lengkap: remotion-promo/COPYWRITING.md
 */

/* ═══ SCENE 1 — HOOK (100f) ════════════════════════════════════════ */
const SceneHook: React.FC = () => (
  <AbsoluteFill>
    {/* VO: "Punya skill trading emas... tapi cuma diem?" */}
    <Sequence from={10}>
      <Audio src={staticFile('vo/vo1.wav')} />
    </Sequence>
    <CameraDrift zoomFrom={1.05} zoomTo={1.14} panY={-24}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 64 }}>
        <Float amp={8} phase={0.6}>
          <WordReveal text="Punya skill trading XAUUSD?" startFrame={3} size={90} />
        </Float>
        <PunchText startFrame={56} size={104} color={COLORS.red} shakePower={9}>
          Tapi cuma diem?
        </PunchText>
        <Sparkles count={9} startFrame={50} />
        <Flash startFrame={56} color="239,68,68" max={0.22} />
        {/* koin dekor pojok */}
        <Float amp={16} speed={0.05} phase={2} rotateAmp={8} style={{ position: 'absolute', top: 300, right: 90 }}>
          <div style={{ opacity: 0.35, transform: 'scale(0.8)' }}>
            <CoinStub />
          </div>
        </Float>
        <Float amp={13} speed={0.045} phase={4.2} rotateAmp={-7} style={{ position: 'absolute', bottom: 430, left: 80 }}>
          <div style={{ opacity: 0.25, transform: 'scale(0.62)' }}>
            <CoinStub />
          </div>
        </Float>
      </AbsoluteFill>
    </CameraDrift>
  </AbsoluteFill>
)

/* stub koin tanpa field (dekor) */
const CoinStub: React.FC = () => (
  <div
    style={{
      width: 110,
      height: 110,
      borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 30%, #fde68a 0%, #f59e0b 55%, #b45309 100%)',
      border: '5px solid #fcd34d',
      boxShadow: '0 0 30px rgba(245,158,11,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 54,
      fontWeight: 900,
      color: '#78350f',
    }}
  >
    $
  </div>
)

/* ═══ SCENE 2 — PROBLEM (100f) ═════════════════════════════════════ */
const SceneProblem: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  /* koin "dompet" jatuh saat punchline mendarat */
  const fall = spring({ frame: frame - 64, fps, config: { damping: 20, stiffness: 60 } })
  return (
    <AbsoluteFill>
      {/* VO: "Analisis bagus, konten keren... tapi dompet masih tipis?" */}
      <Sequence from={12}>
        <Audio src={staticFile('vo/vo2.wav')} />
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
          <FadeUp startFrame={30} fromRight distance={70}>
            <Float amp={7} phase={2.6}>
              <div style={{ fontSize: 64, fontWeight: 600, color: COLORS.muted, textAlign: 'center' }}>
                Konten kamu keren...
              </div>
            </Float>
          </FadeUp>
          {/* 3 koin muncul lalu jatuh */}
          <div style={{ display: 'flex', gap: 34, marginTop: 8 }}>
            {[0, 1, 2].map((i) => {
              const appear = spring({ frame: frame - 28 - i * 4, fps, config: { damping: 12, stiffness: 180 } })
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
                      <CoinStub />
                    </div>
                  </Float>
                </div>
              )
            })}
          </div>
          <PunchText startFrame={66} size={90} color={COLORS.red} shakePower={10}>
            Tapi dompet masih tipis?
          </PunchText>
          <Sparkles count={7} startFrame={60} />
          <Flash startFrame={66} color="239,68,68" max={0.25} />
        </AbsoluteFill>
      </CameraDrift>
    </AbsoluteFill>
  )
}

/* ═══ SCENE 3 — BRAND + SOLUSI (205f) ══════════════════════════════ */
const SceneBrand: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const logoSpring = spring({ frame: frame - 4, fps, config: { damping: 13, stiffness: 130 } })
  const blur = (1 - logoSpring) * 22
  const underline = Math.min(100, Math.max(0, ((frame - 34) / 22) * 100))
  const kamuPulse = 1 + 0.06 * Math.sin(frame * 0.15)
  return (
    <AbsoluteFill>
      {/* VO: "Kenalin, Luxtradee!" + "Impor CSV, screenshot dibaca AI..." */}
      <Sequence from={10}>
        <Audio src={staticFile('vo/vo3a.wav')} />
      </Sequence>
      <Sequence from={76}>
        <Audio src={staticFile('vo/vo3b.wav')} />
      </Sequence>
      <CameraDrift zoomFrom={1.0} zoomTo={1.08} panY={-30}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 38 }}>
          <Float amp={9} speed={0.045}>
            <div
              style={{
                fontSize: 134,
                fontWeight: 900,
                letterSpacing: '0.02em',
                backgroundImage: `linear-gradient(92deg, ${COLORS.goldLight}, ${COLORS.gold}, #fff3d0, ${COLORS.gold})`,
                backgroundSize: '200% 100%',
                backgroundPosition: `${((frame * 1.6) % 200) - 50}% 0`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                filter: `blur(${blur}px) drop-shadow(0 0 ${55 + 15 * Math.sin(frame * 0.1)}px rgba(245,158,11,0.4))`,
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
              background: `linear-gradient(90deg, transparent, ${COLORS.goldLight}, ${COLORS.gold}, transparent)`,
              boxShadow: '0 0 20px rgba(245,158,11,0.5)',
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
            <FeaturePill startFrame={84} phase={0}>
              Impor CSV MT4 / MT5
            </FeaturePill>
            <FeaturePill startFrame={100} phase={2.1}>
              Screenshot dibaca AI
            </FeaturePill>
            <FeaturePill startFrame={116} phase={4.2}>
              Deteksi pola kesalahan
            </FeaturePill>
          </div>
          {/* chart live di bawah */}
          <div style={{ position: 'absolute', bottom: 250, left: 100, opacity: 0.95 }}>
            <LineChart startFrame={126} />
          </div>
          <FadeUp startFrame={162} distance={40}>
            <Float amp={6} phase={1.5}>
              <div style={{ fontSize: 54, fontWeight: 800, color: COLORS.white, textAlign: 'center' }}>
                Sekarang giliran{' '}
                <span
                  style={{
                    color: COLORS.gold,
                    display: 'inline-block',
                    transform: `scale(${kamuPulse})`,
                    textShadow: `0 0 ${30 + 14 * Math.sin(frame * 0.13)}px rgba(245,158,11,0.6)`,
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

/* ═══ SCENE 4 — KOMISI 20% (180f) ══════════════════════════════════ */
const SceneKomisi: React.FC = () => {
  const frame = useCurrentFrame()
  const sx = shake(frame, 32, 10, 6)
  return (
    <AbsoluteFill>
      {/* VO: "Tiap member daftar lewat kodemu, komisi 20%..." */}
      <Sequence from={8}>
        <Audio src={staticFile('vo/vo4.wav')} />
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
          <Counter startFrame={8} target={20} />
          <PunchText startFrame={72} size={84} color={COLORS.goldLight} gradient shakePower={6}>
            Berulang. Bukan sekali.
          </PunchText>
          <div style={{ marginTop: 4 }}>
            <MiniBarChart startFrame={100} />
          </div>
          <FadeUp startFrame={128} distance={36}>
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
          <Flash startFrame={32} color="245,158,11" max={0.3} />
          <Sparkles count={9} startFrame={30} />
        </AbsoluteFill>
      </CameraDrift>
    </AbsoluteFill>
  )
}

/* ═══ SCENE 5 — FREE PRO 3 BULAN (150f) ════════════════════════════ */
const SceneFreePro: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const badge = spring({ frame: frame - 2, fps, config: { damping: 13, stiffness: 170 } })
  const strike = Math.min(100, Math.max(0, ((frame - 84) / 14) * 100))
  const price = spring({ frame: frame - 66, fps, config: { damping: 15, stiffness: 140 } })
  const sx = shake(frame, 100, 10, 7)
  return (
    <AbsoluteFill>
      {/* VO: "Khusus kreator TikTok: Free Pro 3 bulan. Gratis!" */}
      <Sequence from={16}>
        <Audio src={staticFile('vo/vo5.wav')} />
      </Sequence>
      <CameraDrift zoomFrom={1.02} zoomTo={1.1}>
        <Confetti startFrame={22} count={52} cy={46} power={1.35} />
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            gap: 46,
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
          <ShineText startFrame={22} size={148}>
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
            <StampText startFrame={100} size={98} color={COLORS.emerald}>
              Gratis
            </StampText>
          </div>
          <Flash startFrame={100} color="16,185,129" max={0.25} />
          <Sparkles count={13} startFrame={16} />
        </AbsoluteFill>
      </CameraDrift>
    </AbsoluteFill>
  )
}

/* ═══ SCENE 6 — 3 LANGKAH (120f) ═══════════════════════════════════ */
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
          border: `4px solid ${accent ? COLORS.emerald : 'rgba(245,158,11,0.7)'}`,
          background: accent ? 'rgba(16,185,129,0.14)' : 'rgba(245,158,11,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 52,
          fontWeight: 900,
          color: accent ? '#34d399' : COLORS.goldLight,
          transform: `scale(${0.5 + badge * 0.5})`,
          boxShadow: accent
            ? `0 0 ${20 + glow * 22}px rgba(16,185,129,0.5)`
            : `0 0 ${16 + glow * 12}px rgba(245,158,11,0.35)`,
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
  const lineGrow = Math.min(1, Math.max(0, (frame - 18) / 60))
  return (
    <AbsoluteFill>
      {/* VO: "Daftar, bagikan kode referral-mu, komisi mengalir." */}
      <Sequence from={8}>
        <Audio src={staticFile('vo/vo6.wav')} />
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
                background: `linear-gradient(180deg, ${COLORS.gold}, rgba(245,158,11,0.15))`,
                borderRadius: 3,
              }}
            />
            <StepRow no="01" label="Daftar gratis" startFrame={14} phase={0} />
            <StepRow no="02" label="Bagikan kode referral kamu" startFrame={40} phase={2.1} />
            <StepRow no="03" label="Komisi mengalir. Selesai." startFrame={66} accent phase={4.2} />
          </div>
          <Sparkles count={7} startFrame={60} />
        </AbsoluteFill>
      </CameraDrift>
    </AbsoluteFill>
  )
}

/* ═══ SCENE 7 — CTA (135f) ═════════════════════════════════════════ */
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
      {/* VO: "Buka luxtradee.web.id/affiliate. Gas sekarang!" */}
      <Sequence from={8}>
        <Audio src={staticFile('vo/vo7.wav')} />
      </Sequence>
      {/* orb glow pulsing */}
      <div
        style={{
          position: 'absolute',
          width: 900,
          height: 900,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(245,158,11,${0.14 + 0.05 * Math.sin(frame * 0.1)}) 0%, transparent 65%)`,
        }}
      />
      <PunchText startFrame={0} size={60} color={COLORS.white} gradient={false} shakePower={5}>
        luxtradee.web.id/affiliate
      </PunchText>
      <div
        style={{
          width: `${underline}%`,
          height: 10,
          background: `linear-gradient(90deg, ${COLORS.goldLight}, ${COLORS.gold})`,
          borderRadius: 5,
          boxShadow: '0 0 22px rgba(245,158,11,0.55)',
          marginTop: -22,
        }}
      />
      {/* tombol CTA membesar-mengecil + panah bergoyang */}
      <div
        style={{
          opacity: Math.min(1, btn * 1.6),
          transform: `scale(${(0.6 + btn * 0.4) * btnPulse}) translateY(${Math.sin(frame * 0.06) * 5}px)`,
          background: `linear-gradient(92deg, ${COLORS.goldLight}, ${COLORS.gold})`,
          borderRadius: 999,
          padding: '30px 64px',
          fontSize: 52,
          fontWeight: 900,
          color: '#78350f',
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          boxShadow: `0 0 ${40 + 20 * Math.sin(frame * 0.15)}px rgba(245,158,11,0.55), 0 10px 0 rgba(120,53,15,0.55)`,
        }}
      >
        DAFTAR SEKARANG
        <span style={{ transform: `translateX(${arrowBob}px)`, display: 'inline-flex' }}>
          <ArrowRight size={54} />
        </span>
      </div>
      <FadeUp startFrame={40} distance={30}>
        <Float amp={5} phase={1.2}>
          <div style={{ fontSize: 42, fontWeight: 700, color: COLORS.goldLight, textAlign: 'center' }}>
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
      <GoldParticles count={36} />
      <TickerStrip top={80} />
      <TickerStrip bottom={60} speed={1.9} />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={100}>
          <SceneHook />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={linearTiming({ durationInFrames: 14 })} />
        <TransitionSeries.Sequence durationInFrames={100}>
          <SceneProblem />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: 'from-left' })} timing={linearTiming({ durationInFrames: 12 })} />
        <TransitionSeries.Sequence durationInFrames={205}>
          <SceneBrand />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={clockWipe({ width: 1080, height: 1920 })} timing={linearTiming({ durationInFrames: 13 })} />
        <TransitionSeries.Sequence durationInFrames={180}>
          <SceneKomisi />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={flip({ direction: 'from-right' })} timing={linearTiming({ durationInFrames: 15 })} />
        <TransitionSeries.Sequence durationInFrames={150}>
          <SceneFreePro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: 'from-bottom' })} timing={linearTiming({ durationInFrames: 14 })} />
        <TransitionSeries.Sequence durationInFrames={120}>
          <SceneCara />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: 'from-right' })} timing={linearTiming({ durationInFrames: 12 })} />
        <TransitionSeries.Sequence durationInFrames={135}>
          <SceneCta />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <Vignette />
    </AbsoluteFill>
  )
}
