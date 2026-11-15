import React from 'react'
import { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { loadFont } from '@remotion/google-fonts/Lexend'
import {
  CandleChart,
  Counter,
  COLORS,
  FadeUp,
  FeaturePill,
  PromoBackground,
  PunchText,
  ShineText,
  Vignette,
  WordReveal,
} from './ui'

/* Font brand LuxTradee (sama dgn situs) */
const { fontFamily } = loadFont('normal', { weights: ['400', '600', '700', '800', '900'] })

/*
 * LUXTRADEE PROMO — Affiliate & Konten Kreator TikTok (±32 dtk, 1080x1920).
 * Struktur: HOOK → PROBLEM → SOLUSI/BRAND → KOMISI 20% → FREE PRO 3 BULAN
 *           → 3 LANGKAH → CTA.
 * Copy lengkap: remotion-promo/COPYWRITING.md
 */

/* ═══ SCENE 1 — HOOK (0–120) ═══════════════════════════════════════ */
const SceneHook: React.FC = () => {
  const frame = useCurrentFrame()
  const exit = interpolate(frame, [108, 120], [1, 1.18], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const fade = interpolate(frame, [112, 120], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 60, transform: `scale(${exit})`, opacity: fade }}>
      <WordReveal text="Punya skill trading XAUUSD?" startFrame={2} size={92} />
      <PunchText startFrame={58} size={100} color={COLORS.red} shake>
        Tapi cuma diem?
      </PunchText>
    </AbsoluteFill>
  )
}

/* ═══ SCENE 2 — PROBLEM (120–240) ══════════════════════════════════ */
const SceneProblem: React.FC = () => {
  const frame = useCurrentFrame()
  const exit = interpolate(frame, [108, 120], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 48, opacity: exit }}>
      <FadeUp startFrame={6} opacityOnly>
        <div style={{ fontSize: 68, fontWeight: 600, color: COLORS.muted }}>Analisis kamu bagus...</div>
      </FadeUp>
      <FadeUp startFrame={34} opacityOnly>
        <div style={{ fontSize: 68, fontWeight: 600, color: COLORS.muted }}>Konten kamu keren...</div>
      </FadeUp>
      <PunchText startFrame={64} size={88} color={COLORS.red} shake>
        Tapi dompet masih tipis?
      </PunchText>
    </AbsoluteFill>
  )
}

/* ═══ SCENE 3 — BRAND + SOLUSI (240–450) ═══════════════════════════ */
const SceneBrand: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const exit = interpolate(frame, [198, 210], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  // Logo: blur → sharp
  const logoSpring = spring({ frame: frame - 4, fps, config: { damping: 14, stiffness: 130 } })
  const blur = (1 - logoSpring) * 22
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 40, opacity: exit }}>
      <div
        style={{
          fontSize: 132,
          fontWeight: 900,
          letterSpacing: '0.02em',
          backgroundImage: `linear-gradient(92deg, ${COLORS.goldLight}, ${COLORS.gold}, #fff3d0, ${COLORS.gold})`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          filter: `blur(${blur}px) drop-shadow(0 0 60px rgba(245,158,11,0.35))`,
          transform: `scale(${0.85 + logoSpring * 0.15})`,
        }}
      >
        LUXTRADEE
      </div>
      <FadeUp startFrame={40} opacityOnly>
        <div style={{ fontSize: 52, fontWeight: 700, color: COLORS.white, textAlign: 'center' }}>
          Jurnal Trading AI
          <div style={{ fontSize: 40, fontWeight: 500, color: COLORS.muted, marginTop: 8 }}>
            untuk Trader Indonesia
          </div>
        </div>
      </FadeUp>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', marginTop: 12 }}>
        <FeaturePill startFrame={86}>Impor CSV MT4 / MT5</FeaturePill>
        <FeaturePill startFrame={100}>Screenshot dibaca AI</FeaturePill>
        <FeaturePill startFrame={114}>Deteksi pola kesalahan</FeaturePill>
      </div>
      <div style={{ position: 'absolute', bottom: 210, opacity: 0.5 }}>
        <CandleChart startFrame={120} frames={60} />
      </div>
      <FadeUp startFrame={150} opacityOnly>
        <div style={{ fontSize: 56, fontWeight: 800, color: COLORS.white, textAlign: 'center' }}>
          Sekarang giliran <span style={{ color: COLORS.gold }}>KAMU</span> yang dapat cuan.
        </div>
      </FadeUp>
    </AbsoluteFill>
  )
}

/* ═══ SCENE 4 — KOMISI 20% (450–630) ═══════════════════════════════ */
const SceneKomisi: React.FC = () => {
  const frame = useCurrentFrame()
  const exit = interpolate(frame, [168, 180], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 44, opacity: exit }}>
      <FadeUp startFrame={2} opacityOnly>
        <div style={{ fontSize: 46, fontWeight: 600, color: COLORS.muted, letterSpacing: '0.08em' }}>
          KOMISI DARI TIAP PENJUALAN
        </div>
      </FadeUp>
      <Counter startFrame={8} target={20} />
      <PunchText startFrame={70} size={92} color={COLORS.goldLight}>
        Berulang. Bukan sekali.
      </PunchText>
      <FadeUp startFrame={104}>
        <div style={{ fontSize: 56, fontWeight: 700, color: COLORS.white, textAlign: 'center', lineHeight: 1.3 }}>
          10 member aktif
          <div style={{ color: COLORS.emerald, fontSize: 66, fontWeight: 900 }}>
            = cuan masuk tiap bulan
          </div>
        </div>
      </FadeUp>
    </AbsoluteFill>
  )
}

/* ═══ SCENE 5 — FREE PRO 3 BULAN (630–780) ═════════════════════════ */
const SceneFreePro: React.FC = () => {
  const frame = useCurrentFrame()
  const exit = interpolate(frame, [138, 150], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const strike = interpolate(frame, [78, 92], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 48, opacity: exit }}>
      <FadeUp startFrame={2} opacityOnly>
        <div
          style={{
            border: '2px solid rgba(255,255,255,0.25)',
            borderRadius: 999,
            padding: '16px 44px',
            fontSize: 38,
            fontWeight: 600,
            color: COLORS.white,
            background: 'rgba(255,255,255,0.06)',
          }}
        >
          Khusus Konten Kreator TikTok
        </div>
      </FadeUp>
      <div style={{ textAlign: 'center' }}>
        <ShineText startFrame={26} size={150}>
          Free Pro
          <br />
          3 Bulan
        </ShineText>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 36, marginTop: 10 }}>
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 58, fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>Rp147.000</div>
          <div
            style={{
              position: 'absolute',
              top: '52%',
              left: '-4%',
              width: `${strike}%`,
              height: 8,
              background: COLORS.red,
              borderRadius: 4,
              transform: 'rotate(-6deg)',
            }}
          />
        </div>
        <PunchText startFrame={86} size={96} color={COLORS.emerald}>
          Gratis
        </PunchText>
      </div>
    </AbsoluteFill>
  )
}

/* ═══ SCENE 6 — 3 LANGKAH (780–900) ════════════════════════════════ */
const StepRow: React.FC<{ no: string; label: string; startFrame: number; accent?: boolean }> = ({
  no,
  label,
  startFrame,
  accent = false,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - startFrame, fps, config: { damping: 15, stiffness: 150 } })
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 36,
        opacity: s,
        transform: `translateX(${(1 - s) * -140}px)`,
      }}
    >
      <div
        style={{
          fontSize: 96,
          fontWeight: 900,
          color: accent ? COLORS.gold : 'rgba(245,158,11,0.55)',
          width: 150,
          textAlign: 'right',
        }}
      >
        {no}
      </div>
      <div style={{ fontSize: 62, fontWeight: 700, color: COLORS.white }}>{label}</div>
    </div>
  )
}

const SceneCara: React.FC = () => {
  const frame = useCurrentFrame()
  const exit = interpolate(frame, [108, 120], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 60, opacity: exit }}>
      <FadeUp startFrame={0} opacityOnly>
        <div style={{ fontSize: 44, fontWeight: 600, color: COLORS.muted, letterSpacing: '0.1em' }}>
          GAMPANG. CUMA 3 LANGKAH.
        </div>
      </FadeUp>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 52 }}>
        <StepRow no="01" label="Daftar gratis" startFrame={14} />
        <StepRow no="02" label="Bagikan kode referral kamu" startFrame={40} />
        <StepRow no="03" label="Komisi mengalir. Selesai." startFrame={66} accent />
      </div>
    </AbsoluteFill>
  )
}

/* ═══ SCENE 7 — CTA (900–960) ══════════════════════════════════════ */
const SceneCta: React.FC = () => {
  const frame = useCurrentFrame()
  const underline = interpolate(frame, [22, 42], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const fadeEnd = interpolate(frame, [48, 60], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 52, opacity: fadeEnd }}>
      <PunchText startFrame={0} size={58} color={COLORS.white} gradient={false}>
        luxtradee.web.id/affiliate
      </PunchText>
      <div
        style={{
          width: `${underline}%`,
          height: 10,
          background: `linear-gradient(90deg, ${COLORS.goldLight}, ${COLORS.gold})`,
          borderRadius: 5,
        }}
      />
      <FadeUp startFrame={24} opacityOnly>
        <div style={{ fontSize: 44, fontWeight: 600, color: COLORS.muted, textAlign: 'center' }}>
          Slot kreator terbatas. Mulai hari ini.
        </div>
      </FadeUp>
      <FadeUp startFrame={34} opacityOnly>
        <div
          style={{
            fontSize: 40,
            fontWeight: 900,
            letterSpacing: '0.06em',
            backgroundImage: `linear-gradient(92deg, ${COLORS.goldLight}, ${COLORS.gold})`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          LUXTRADEE
        </div>
      </FadeUp>
    </AbsoluteFill>
  )
}

/* ═══ TIMELINE UTAMA ═══════════════════════════════════════════════ */
export const PromoVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily }}>
      <PromoBackground />
      <Vignette />
      <Sequence from={0} durationInFrames={120}>
        <SceneHook />
      </Sequence>
      <Sequence from={120} durationInFrames={120}>
        <SceneProblem />
      </Sequence>
      <Sequence from={240} durationInFrames={210}>
        <SceneBrand />
      </Sequence>
      <Sequence from={450} durationInFrames={180}>
        <SceneKomisi />
      </Sequence>
      <Sequence from={630} durationInFrames={150}>
        <SceneFreePro />
      </Sequence>
      <Sequence from={780} durationInFrames={120}>
        <SceneCara />
      </Sequence>
      <Sequence from={900} durationInFrames={60}>
        <SceneCta />
      </Sequence>
    </AbsoluteFill>
  )
}
