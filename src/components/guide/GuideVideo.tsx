/**
 * ============================================================
 * GuideVideo — komposisi Remotion "video panduan" Auto-Journal
 * & Screenshot AI. Dimainkan di browser via @remotion/player
 * (tanpa file MP4 — dirender realtime oleh Player).
 * ============================================================
 * Storyboard (30fps · 450 frame ≈ 15 detik · loop):
 *   S1  0–90    Buka MT4/MT5 → tap tab "History"
 *   S2  90–174  Daftar history → tap trade yang sudah close
 *   S3  174–258 Detail trade muncul → FLASH kamera (screenshot)
 *   S4  258–348 Upload di LuxTradee → tombol AI ditekan
 *   S5  348–450 AI mengisi otomatis (jurnal/form) → badge sukses
 *
 * Semua deterministic (tanpa Math.random/Date) — aman untuk
 * render Remotion. Teks mengikuti bahasa (id/en) & mode
 * (auto = Auto-Journal, manual = Screenshot AI isi otomatis).
 */

import React from 'react'
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'

export const GUIDE_W = 400
export const GUIDE_H = 500
export const GUIDE_FPS = 30
export const GUIDE_DURATION = 450

export type GuideMode = 'auto' | 'manual'
export type GuideLang = 'id' | 'en'

/* ----------------------------- Palet warna ----------------------------- */
const C = {
  bg: '#060a13',
  screen: '#0b111c',
  card: '#111a2a',
  card2: '#0e1622',
  line: 'rgba(148,163,184,0.18)',
  text: '#e2e8f0',
  dim: '#8fa3bd',
  cyan: '#22d3ee',
  blue: '#3b82f6',
  green: '#34d399',
  red: '#f87171',
  dark: '#05080f',
}

/* ------------------------------- Teks ------------------------------- */
const STRINGS: Record<
  GuideLang,
  Record<GuideMode, {
    brand: string
    captions: [string, string, string, string, string]
    aiBtn: string
    finalBadge: string
    savedLabel: string
  }>
> = {
  id: {
    auto: {
      brand: 'Panduan LuxTradee',
      captions: [
        'Buka MT4/MT5, tap tab History',
        'Pilih trade yang sudah close',
        'Screenshot detail trade-nya',
        'Upload di LuxTradee',
        'AI bikin jurnalnya otomatis',
      ],
      aiBtn: 'Auto-Journal (AI Lengkap)',
      finalBadge: 'Jurnal tercatat otomatis',
      savedLabel: 'Tersimpan',
    },
    manual: {
      brand: 'Panduan LuxTradee',
      captions: [
        'Buka MT4/MT5, tap tab History',
        'Pilih trade yang sudah close',
        'Screenshot detail trade-nya',
        'Upload di LuxTradee',
        'AI isi form-nya otomatis',
      ],
      aiBtn: 'Screenshot (AI Isi Otomatis)',
      finalBadge: 'Form terisi otomatis',
      savedLabel: 'Tersimpan',
    },
  },
  en: {
    auto: {
      brand: 'LuxTradee Guide',
      captions: [
        'Open MT4/MT5, tap the History tab',
        'Pick a closed trade',
        'Screenshot the trade details',
        'Upload on LuxTradee',
        'AI writes the journal for you',
      ],
      aiBtn: 'Auto-Journal (AI Complete)',
      finalBadge: 'Journaled automatically',
      savedLabel: 'Saved',
    },
    manual: {
      brand: 'LuxTradee Guide',
      captions: [
        'Open MT4/MT5, tap the History tab',
        'Pick a closed trade',
        'Screenshot the trade details',
        'Upload on LuxTradee',
        'AI fills the form for you',
      ],
      aiBtn: 'Screenshot (AI Auto-fill)',
      finalBadge: 'Form filled automatically',
      savedLabel: 'Saved',
    },
  },
}

/* --------------------------- Util kecil animasi --------------------------- */
const enter = (frame: number, delay: number, dur = 16) =>
  interpolate(frame, [delay, delay + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  })

/** Ripple ketukan (lingkaran membesar memudar) */
const Ripple: React.FC<{ at: number; x: number; y: number }> = ({ at, x, y }) => {
  const frame = useCurrentFrame()
  if (frame < at) return null
  const p = interpolate(frame, [at, at + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  if (p >= 1) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 46,
        height: 46,
        marginLeft: -23,
        marginTop: -23,
        borderRadius: '50%',
        border: '3px solid rgba(255,255,255,0.9)',
        transform: `scale(${0.35 + p * 1.15})`,
        opacity: 1 - p,
      }}
    />
  )
}

/** Jari (titik putih) yang menekan layar */
const Finger: React.FC<{ at: number; x: number; y: number }> = ({ at, x, y }) => {
  const frame = useCurrentFrame()
  const vis = frame >= at && frame <= at + 22
  if (!vis) return null
  const press = interpolate(frame, [at, at + 6, at + 16, at + 22], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 26,
        height: 26,
        marginLeft: -13,
        marginTop: -13,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.95), rgba(203,213,225,0.55))',
        boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
        transform: `scale(${0.8 + press * 0.25})`,
        opacity: Math.min(1, press * 2),
      }}
    />
  )
}

/** Bingkai HP dengan notch — dipakai semua scene */
const Phone: React.FC<{ children: React.ReactNode; accent: string; glow?: number }> = ({
  children,
  accent,
  glow = 0,
}) => (
  <div
    style={{
      width: 248,
      height: 342,
      borderRadius: 24,
      background: C.screen,
      border: `2px solid ${accent}55`,
      boxShadow: `0 24px 70px rgba(0,0,0,0.6), 0 0 ${18 + glow * 26}px ${accent}${glow > 0.4 ? '44' : '00'}`,
      overflow: 'hidden',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    {/* notch */}
    <div
      style={{
        position: 'absolute',
        top: 6,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 74,
        height: 12,
        borderRadius: 8,
        background: C.dark,
        zIndex: 5,
      }}
    />
    {children}
  </div>
)

/* ------------------------- Caption langkah (atas) ------------------------- */
const StepCaption: React.FC<{ n: number; text: string; accent: string }> = ({ n, text, accent }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 160 }, durationInFrames: 18 })
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        transform: `translateY(${(1 - pop) * -14}px)`,
        opacity: pop,
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: accent,
          color: '#04121a',
          fontWeight: 800,
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {n}
      </div>
      <div
        style={{
          fontSize: 15.5,
          fontWeight: 700,
          color: C.text,
          textShadow: '0 2px 10px rgba(0,0,0,0.6)',
        }}
      >
        {text}
      </div>
    </div>
  )
}

/* ============================ SCENE 1 — MT5 ============================ */
const S1: React.FC<{ caption: string; accent: string }> = ({ caption, accent }) => {
  const frame = useCurrentFrame()
  const hl = interpolate(frame, [24, 40, 62, 78], [0, 1, 1, 0.55], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const rows = ['EURUSD', 'XAUUSD', 'GBPUSD', 'USDJPY']
  return (
    <>
      <StepCaption n={1} text={caption} accent={accent} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Phone accent={accent}>
          {/* app bar */}
          <div
            style={{
              marginTop: 22,
              padding: '8px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: C.card2,
              borderBottom: `1px solid ${C.line}`,
              opacity: enter(frame, 2),
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 800, color: C.text }}>MetaTrader 5</span>
            <span style={{ fontSize: 9, color: C.dim }}>Demo</span>
          </div>
          {/* quotes */}
          <div style={{ flex: 1, padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {rows.map((r, i) => (
              <div
                key={r}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  background: C.card,
                  borderRadius: 7,
                  padding: '7px 10px',
                  border: `1px solid ${C.line}`,
                  opacity: enter(frame, 6 + i * 5),
                  transform: `translateY(${(1 - enter(frame, 6 + i * 5)) * 8}px)`,
                }}
              >
                <span style={{ fontSize: 10.5, fontWeight: 700, color: C.text }}>{r}</span>
                <span style={{ fontSize: 10.5, color: i % 2 ? C.red : C.green }}>
                  {i % 2 ? '2,391.1' : '2,391.4'}
                </span>
              </div>
            ))}
          </div>
          {/* bottom nav */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-around',
              padding: '8px 4px 12px',
              background: C.card2,
              borderTop: `1px solid ${C.line}`,
              position: 'relative',
            }}
          >
            {['Quotes', 'Chart', 'Trade', 'History', 'Set'].map((t, i) => {
              const isHistory = i === 3
              return (
                <div key={t} style={{ textAlign: 'center', position: 'relative' }}>
                  <div
                    style={{
                      width: 17,
                      height: 17,
                      borderRadius: 5,
                      margin: '0 auto 3px',
                      background: isHistory && hl > 0.4 ? accent : 'rgba(148,163,184,0.25)',
                      transform: `scale(${isHistory ? 1 + hl * 0.35 : 1})`,
                    }}
                  />
                  <div
                    style={{
                      fontSize: 7.5,
                      color: isHistory && hl > 0.4 ? accent : C.dim,
                      fontWeight: isHistory && hl > 0.4 ? 800 : 500,
                    }}
                  >
                    {t}
                  </div>
                </div>
              )
            })}
            {/* highlight History tab */}
            <div
              style={{
                position: 'absolute',
                right: 30,
                bottom: 6,
                width: 44,
                height: 38,
                borderRadius: 8,
                border: `2px solid ${accent}`,
                opacity: hl * 0.9,
              }}
            />
            <Ripple at={58} x={200} y={315} />
            <Finger at={58} x={200} y={315} />
          </div>
        </Phone>
      </div>
    </>
  )
}

/* ======================= SCENE 2 — daftar history ======================= */
const S2: React.FC<{ caption: string; accent: string }> = ({ caption, accent }) => {
  const frame = useCurrentFrame()
  const trades = [
    { s: 'XAUUSD', t: 'Buy 0.50', p: '+$245.50', up: true },
    { s: 'EURUSD', t: 'Sell 0.30', p: '-$18.20', up: false },
    { s: 'GBPUSD', t: 'Sell 0.20', p: '+$91.05', up: true },
    { s: 'USDJPY', t: 'Buy 0.10', p: '+$12.40', up: true },
  ]
  const sel = interpolate(frame, [42, 58], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  return (
    <>
      <StepCaption n={2} text={caption} accent={accent} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Phone accent={accent}>
          <div
            style={{
              marginTop: 22,
              padding: '8px 12px',
              background: C.card2,
              borderBottom: `1px solid ${C.line}`,
              fontSize: 11,
              fontWeight: 800,
              color: C.text,
              opacity: enter(frame, 2),
            }}
          >
            History
          </div>
          <div style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {trades.map((t, i) => {
              const isSel = i === 0
              return (
                <div
                  key={t.s}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: isSel && sel > 0 ? `color-mix(in srgb, ${accent} 22%, ${C.card})` : C.card,
                    borderRadius: 8,
                    padding: '9px 10px',
                    border: `1px solid ${isSel && sel > 0 ? accent : C.line}`,
                    opacity: enter(frame, 4 + i * 6),
                    transform: `translateY(${(1 - enter(frame, 4 + i * 6)) * 8}px) scale(${isSel ? 1 + sel * 0.04 : 1})`,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 800, color: C.text }}>{t.s}</div>
                    <div style={{ fontSize: 8.5, color: C.dim }}>{t.t}</div>
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: t.up ? C.green : C.red }}>{t.p}</div>
                </div>
              )
            })}
          </div>
          <Ripple at={52} x={110} y={105} />
          <Finger at={52} x={110} y={105} />
        </Phone>
      </div>
    </>
  )
}

/* =================== SCENE 3 — detail trade + screenshot =================== */
const S3: React.FC<{ caption: string; accent: string }> = ({ caption, accent }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const flash = interpolate(frame, [48, 54, 68], [0, 0.9, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  })
  const shot = spring({ frame: Math.max(0, frame - 62), fps, config: { damping: 16 }, durationInFrames: 22 })
  const fields = [
    ['Symbol', 'XAUUSD'],
    ['Open', '2,391.20'],
    ['Close', '2,396.10'],
    ['Lot', '0.50'],
    ['Profit', '+$245.50'],
  ]
  return (
    <>
      <StepCaption n={3} text={caption} accent={accent} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {/* detail card di dalam phone */}
        <Phone accent={accent}>
          <div
            style={{
              marginTop: 22,
              padding: '8px 12px',
              background: C.card2,
              borderBottom: `1px solid ${C.line}`,
              display: 'flex',
              justifyContent: 'space-between',
              opacity: enter(frame, 2),
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 800, color: C.text }}>XAUUSD · Buy</span>
            <span style={{ fontSize: 9, color: C.green, fontWeight: 800 }}>+245.50</span>
          </div>
          <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fields.map(([k, v], i) => (
              <div
                key={k}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  background: C.card,
                  border: `1px solid ${C.line}`,
                  borderRadius: 7,
                  padding: '7px 10px',
                  opacity: enter(frame, 6 + i * 6),
                }}
              >
                <span style={{ fontSize: 9.5, color: C.dim }}>{k}</span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: k === 'Profit' ? C.green : C.text,
                  }}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>
        </Phone>
        {/* flash kamera */}
        {flash > 0 && (
          <AbsoluteFill style={{ background: 'white', opacity: flash, borderRadius: 20 }} />
        )}
        {/* chip screenshot terbang keluar */}
        {shot > 0 && (
          <div
            style={{
              position: 'absolute',
              right: 6,
              bottom: 18,
              transform: `scale(${0.5 + shot * 0.5}) rotate(${(1 - shot) * -8}deg)`,
              opacity: shot,
              background: C.card,
              border: `2px solid ${accent}`,
              borderRadius: 10,
              padding: '8px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            }}
          >
            <div
              style={{
                width: 22,
                height: 26,
                borderRadius: 4,
                background: `linear-gradient(135deg, ${accent}66, ${C.card2})`,
                border: '1px solid rgba(255,255,255,0.35)',
              }}
            />
            <span style={{ fontSize: 9.5, fontWeight: 700, color: C.text }}>
              screenshot.png
            </span>
          </div>
        )}
      </div>
    </>
  )
}

/* ===================== SCENE 4 — upload di LuxTradee ===================== */
const S4: React.FC<{ caption: string; accent: string; aiBtn: string }> = ({ caption, accent, aiBtn }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const drop = spring({ frame: Math.max(0, frame - 20), fps, config: { damping: 13 }, durationInFrames: 20 })
  const press = interpolate(frame, [56, 64, 74], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const glow = interpolate(frame, [40, 56, 88], [0, 1, 0.55], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  return (
    <>
      <StepCaption n={4} text={caption} accent={accent} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: 268,
            borderRadius: 16,
            background: C.card,
            border: `1.5px solid ${accent}44`,
            padding: 14,
            boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
          }}
        >
          {/* brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, opacity: enter(frame, 2) }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 7,
                background: `linear-gradient(135deg, ${accent}, ${C.blue})`,
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>LuxTradee</span>
          </div>
          {/* dropzone */}
          <div
            style={{
              height: 96,
              borderRadius: 12,
              border: `2px dashed ${accent}${drop > 0.3 ? '' : '77'}`,
              background: drop > 0.3 ? `color-mix(in srgb, ${accent} 12%, transparent)` : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {drop < 0.25 ? (
              <span style={{ fontSize: 10, color: C.dim }}>Letakkan screenshot di sini</span>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transform: `scale(${0.7 + drop * 0.3})`,
                  opacity: Math.min(1, drop * 1.6),
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 32,
                    borderRadius: 5,
                    background: `linear-gradient(135deg, ${accent}77, ${C.card2})`,
                    border: '1px solid rgba(255,255,255,0.4)',
                  }}
                />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: C.text }}>screenshot.png</span>
              </div>
            )}
          </div>
          {/* tombol AI */}
          <div
            style={{
              marginTop: 12,
              borderRadius: 10,
              padding: '11px 12px',
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 800,
              color: '#04121a',
              background: `linear-gradient(90deg, ${accent}, ${C.blue})`,
              boxShadow: `0 0 ${glow * 30}px ${accent}88`,
              transform: `scale(${1 - press * 0.05})`,
            }}
          >
            {aiBtn}
          </div>
        </div>
        <Finger at={58} x={200} y={330} />
        <Ripple at={58} x={200} y={330} />
      </div>
    </>
  )
}

/* =================== SCENE 5 — AI mengisi otomatis =================== */
const S5: React.FC<{
  caption: string
  accent: string
  mode: GuideMode
  finalBadge: string
  savedLabel: string
}> = ({ caption, accent, mode, finalBadge, savedLabel }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const scan = interpolate(frame, [10, 55], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const badge = spring({ frame: Math.max(0, frame - 66), fps, config: { damping: 12 }, durationInFrames: 20 })

  const journalLines = [
    'XAUUSD · Buy 0.50 lot',
    'Entry 2,391.20 → Exit 2,396.10',
    'Profit +$245.50',
    'Breakout resistance, RR 1:2',
  ]
  const formRows = [
    ['Symbol', 'XAUUSD'],
    ['Lot', '0.50'],
    ['Entry', '2,391.20'],
    ['Exit', '2,396.10'],
    ['Profit', '+$245.50'],
  ]

  return (
    <>
      <StepCaption n={5} text={caption} accent={accent} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div
          style={{
            width: 268,
            borderRadius: 16,
            background: C.card,
            border: `1.5px solid ${accent}44`,
            padding: 14,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
          }}
        >
          {/* scanner beam AI */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${scan * 100}%`,
              height: 26,
              background: `linear-gradient(180deg, transparent, ${accent}33, transparent)`,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, opacity: enter(frame, 2) }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 6,
                background: `linear-gradient(135deg, ${accent}, ${C.blue})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#04121a',
                fontSize: 11,
                fontWeight: 900,
              }}
            >
              AI
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.text }}>
              {mode === 'auto' ? 'Auto-Journal' : 'Form Trade'}
            </span>
          </div>

          {mode === 'auto'
            ? journalLines.map((line, i) => {
                const o = enter(frame, 18 + i * 11)
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      background: C.card2,
                      border: `1px solid ${C.line}`,
                      borderRadius: 8,
                      padding: '8px 10px',
                      marginBottom: 6,
                      opacity: o,
                      transform: `translateX(${(1 - o) * -14}px)`,
                    }}
                  >
                    <span style={{ color: C.green, fontSize: 11, fontWeight: 900, opacity: o }}>✓</span>
                    <span
                      style={{
                        fontSize: 10,
                        color: i === 2 ? C.green : C.text,
                        fontWeight: i === 2 ? 800 : 500,
                      }}
                    >
                      {line}
                    </span>
                  </div>
                )
              })
            : formRows.map(([k, v], i) => {
                const o = enter(frame, 14 + i * 9)
                return (
                  <div
                    key={k}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: C.card2,
                      border: `1px solid ${C.line}`,
                      borderRadius: 8,
                      padding: '7px 10px',
                      marginBottom: 6,
                      opacity: o,
                      transform: `translateX(${(1 - o) * -14}px)`,
                    }}
                  >
                    <span style={{ fontSize: 9.5, color: C.dim }}>{k}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{ fontSize: 9.5, fontWeight: 800, color: k === 'Profit' ? C.green : C.text }}
                      >
                        {v}
                      </span>
                      <span style={{ color: C.green, fontSize: 10, fontWeight: 900, opacity: o }}>✓</span>
                    </div>
                  </div>
                )
              })}

          {/* badge sukses */}
          {badge > 0 && (
            <div
              style={{
                marginTop: 4,
                display: 'flex',
                justifyContent: 'center',
                transform: `scale(${badge})`,
                opacity: badge,
              }}
            >
              <div
                style={{
                  background: `color-mix(in srgb, ${C.green} 18%, ${C.card2})`,
                  border: `1.5px solid ${C.green}`,
                  color: C.green,
                  fontSize: 11,
                  fontWeight: 800,
                  borderRadius: 999,
                  padding: '7px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 12 }}>✓</span> {finalBadge}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* label kecil "tersimpan" */}
      {badge > 0.9 && (
        <div
          style={{
            position: 'absolute',
            bottom: 34,
            right: 30,
            fontSize: 9,
            color: C.dim,
            opacity: (badge - 0.9) * 10,
          }}
        >
          {savedLabel} ✓
        </div>
      )}
    </>
  )
}

/* ============================ KOMPOSISI ROOT ============================ */
export const GuideVideo: React.FC<{ mode: GuideMode; lang: GuideLang }> = ({ mode, lang }) => {
  const t = STRINGS[lang][mode]
  const accent = mode === 'auto' ? C.cyan : C.green
  const frame = useCurrentFrame()

  const scenes: Array<[number, number, React.ReactNode]> = [
    [0, 90, <S1 key="s1" caption={t.captions[0]} accent={accent} />],
    [90, 174, <S2 key="s2" caption={t.captions[1]} accent={accent} />],
    [174, 258, <S3 key="s3" caption={t.captions[2]} accent={accent} />],
    [258, 348, <S4 key="s4" caption={t.captions[3]} accent={accent} aiBtn={t.aiBtn} />],
    [
      348,
      GUIDE_DURATION,
      <S5
        key="s5"
        caption={t.captions[4]}
        accent={accent}
        mode={mode}
        finalBadge={t.finalBadge}
        savedLabel={t.savedLabel}
      />,
    ],
  ]

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {/* header brand kecil */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          opacity: 0.75,
        }}
      >
        <div
          style={{
            width: 13,
            height: 13,
            borderRadius: 4,
            background: `linear-gradient(135deg, ${accent}, ${C.blue})`,
          }}
        />
        <span style={{ fontSize: 9, fontWeight: 700, color: C.dim, letterSpacing: 0.4 }}>{t.brand}</span>
      </div>

      <div style={{ position: 'absolute', top: 40, left: 20, right: 20, bottom: 26, display: 'flex', flexDirection: 'column' }}>
        {scenes.map(([from, dur, node]) => (
          <Sequence key={from} from={from} durationInFrames={dur - from} name={`S${from}`}>
            <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{node}</AbsoluteFill>
          </Sequence>
        ))}
      </div>

      {/* progress bar bawah */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: 'rgba(148,163,184,0.14)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${(frame / GUIDE_DURATION) * 100}%`,
            background: `linear-gradient(90deg, ${accent}, ${C.blue})`,
          }}
        />
      </div>
    </AbsoluteFill>
  )
}

export default GuideVideo
