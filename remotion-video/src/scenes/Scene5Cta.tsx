import React from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import {
  C,
  EASE,
  FONT,
  SPRING_SOFT,
  SceneShell,
  clamp01,
  pop,
} from "../components/Ui";
import type { SceneComponentProps } from "../components/Ui";

/* ---------------- deterministic confetti vectors (computed once) ---------------- */

const BURST_X = 540;
const BURST_Y = 780;

/* confetti 3 warna landing: cyan muda / biru / cyan */
const CONFETTI = Array.from({ length: 12 }).map((_, i) => ({
  angle: (i / 12) * Math.PI * 2 + 0.42,
  dist: 130 + random(i * 13) * 250,
  size: 6 + random(i * 13 + 3) * 6,
  color: i % 3 === 0 ? "#A5F3FC" : i % 3 === 1 ? "#3B82F6" : C.accent,
  spin: (random(i * 13 + 5) - 0.5) * 240,
}));

/* ---------------- scene ---------------- */

export const Scene5Cta: React.FC<SceneComponentProps> = ({
  title,
  sub,
  domain,
  handle,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoS = pop(frame, fps, 6, SPRING_SOFT);
  const titleP = pop(frame, fps, 14, SPRING_SOFT);
  const subP = pop(frame, fps, 22, SPRING_SOFT);
  const ctaS = pop(frame, fps, 30, SPRING_SOFT);
  const handleP = pop(frame, fps, 40, SPRING_SOFT);

  const pulse = 1.02 + 0.02 * Math.sin(frame / 13);

  const burstP = interpolate(frame, [16, 82], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

  return (
    <SceneShell durationInFrames={durationInFrames}>
      {/* one-shot confetti burst warna landing (biru/cyan) */}
      <div style={{ position: "absolute", left: 0, top: 0 }}>
        {CONFETTI.map((p, i) => {
          const x = BURST_X + Math.cos(p.angle) * p.dist * burstP;
          const y = BURST_Y + Math.sin(p.angle) * p.dist * burstP + 150 * burstP * burstP;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: p.size,
                height: p.size,
                borderRadius: 3,
                background: p.color,
                opacity: (1 - burstP) * 0.9,
                transform: `translate3d(${x}px, ${y}px, 0) rotate(${p.spin * burstP}deg)`,
              }}
            />
          );
        })}
      </div>

      {/* centered finale stack */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          paddingTop: 60,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* logo mark */}
        <div
          style={{
            opacity: clamp01(logoS),
            transform: `scale(${0.55 + 0.45 * logoS})`,
            marginBottom: 42,
          }}
        >
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 34,
              background: `linear-gradient(135deg, ${C.accentDeep}, ${C.accent})`,
              boxShadow:
                "0 16px 60px rgba(59,130,246,0.30), 0 0 120px rgba(34,211,238,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width={58} height={58} viewBox="0 0 60 60">
              <line x1={15} y1={14} x2={15} y2={48} stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.9} />
              <rect x={10} y={22} width={10} height={16} rx={3} fill="#FFFFFF" />
              <line x1={30} y1={8} x2={30} y2={42} stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.9} />
              <rect x={25} y={13} width={10} height={18} rx={3} fill="#FFFFFF" />
              <line x1={45} y1={16} x2={45} y2={52} stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.9} />
              <rect x={40} y={24} width={10} height={18} rx={3} fill="#FFFFFF" />
            </svg>
          </div>
        </div>

        {/* shimmering wordmark */}
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: 110,
            letterSpacing: 4,
            lineHeight: 1,
            backgroundImage:
              "linear-gradient(100deg, #3B82F6 15%, #67E8F9 45%, #22D3EE 75%)",
            backgroundSize: "200% 100%",
            backgroundPosition: `${50 + Math.sin(frame / 30) * 45}% 50%`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 36px rgba(34,211,238,0.28))",
            opacity: clamp01(titleP),
            transform: `translateY(${(1 - titleP) * 56}px)`,
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: 28,
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: 34,
            color: C.muted,
            maxWidth: 860,
            textAlign: "center",
            opacity: clamp01(subP),
            transform: `translateY(${(1 - subP) * 30}px)`,
          }}
        >
          {sub}
        </div>

        {/* CTA pill */}
        <div
          style={{
            marginTop: 58,
            opacity: clamp01(ctaS),
            transform: `scale(${ctaS * pulse})`,
          }}
        >
          <div
            style={{
              /* sama persis dgn tombol CTA landing: from-blue-500 to-cyan-400 */
              background: "linear-gradient(90deg, #3B82F6, #22D3EE)",
              color: "#FFFFFF",
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 34,
              borderRadius: 999,
              padding: "24px 56px",
              boxShadow:
                "0 0 70px rgba(34,211,238,0.35), 0 18px 50px rgba(0,0,0,0.45)",
            }}
          >
            {domain}
          </div>
        </div>

        <div
          style={{
            marginTop: 26,
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: 26,
            color: C.muted,
            opacity: 0.85 * clamp01(handleP),
          }}
        >
          {handle}
        </div>
      </div>
    </SceneShell>
  );
};
