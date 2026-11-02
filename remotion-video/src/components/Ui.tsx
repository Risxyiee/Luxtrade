import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { SpringConfig } from "remotion";

/* ---------------- design tokens ---------------- */

export const C = {
  bg: "#05050A",
  panel: "#0B0B14",
  gold: "#F5C842",
  goldDeep: "#B8860B",
  goldGlow: "rgba(245,200,66,0.35)",
  green: "#34D399",
  red: "#F87171",
  white: "#FFFFFF",
  muted: "#9CA3AF",
};

export const FONT = "'Manrope', 'DejaVu Sans', sans-serif";

export const EASE = Easing.bezier(0.16, 1, 0.3, 1);

export const SPRING_SOFT: SpringConfig = { damping: 200, mass: 1, stiffness: 100, overshootClamping: false };
export const SPRING_POP: SpringConfig = { damping: 13, stiffness: 170, mass: 1, overshootClamping: false };

export const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(245,200,66,0.22)",
  borderRadius: 28,
};

export interface SceneComponentProps {
  title: string;
  sub: string;
  domain: string;
  handle: string;
  durationInFrames: number;
}

/* ---------------- animation helpers ---------------- */

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Deterministic spring entrance with delay (frames). */
export const pop = (
  frame: number,
  fps: number,
  delay: number,
  config: SpringConfig = SPRING_SOFT,
): number => {
  const f = Math.floor(frame - delay);
  return f <= 0 ? 0 : spring({ fps, frame: f, config });
};

/** Smooth fade + rise entrance (opacity/transform only). */
export const rise = (
  frame: number,
  delay: number,
  distance = 40,
): { opacity: number; transform: string } => {
  const p = interpolate(frame, [delay, delay + 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  return { opacity: p, transform: `translateY(${(1 - p) * distance}px)` };
};

/* ---------------- scene chrome ---------------- */

/** Wraps every scene: subtle fade-in (first 8f) / fade-out (last 8f). */
export const SceneShell: React.FC<{
  durationInFrames: number;
  children: React.ReactNode;
}> = ({ durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 8, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE,
    },
  );
  return (
    <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>
      {children}
    </AbsoluteFill>
  );
};

/** Standard title block near the top (title + sub, staggered entrance). */
export const TitleBlock: React.FC<{
  title: string;
  sub: string;
  delay?: number;
  titleSize?: number;
  top?: number;
}> = ({ title, sub, delay = 4, titleSize = 84, top = 296 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = pop(frame, fps, delay);
  const s = pop(frame, fps, delay + 7);
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 80,
        right: 80,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 26,
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: titleSize,
          lineHeight: 1.08,
          letterSpacing: 2,
          color: C.white,
          textShadow: "0 0 46px rgba(245,200,66,0.35)",
          opacity: clamp01(t),
          transform: `translateY(${(1 - t) * 46}px)`,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: FONT,
          fontWeight: 500,
          fontSize: 34,
          color: C.muted,
          maxWidth: 820,
          opacity: clamp01(s),
          transform: `translateY(${(1 - s) * 30}px)`,
        }}
      >
        {sub}
      </div>
    </div>
  );
};

/** Top-left glassy brand pill with a mini candlestick logo. */
export const BrandChip: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = pop(frame, fps, 2);
  return (
    <div
      style={{
        position: "absolute",
        top: 70,
        left: 60,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 24px 14px 16px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(245,200,66,0.25)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
        opacity: clamp01(s),
        transform: `translateY(${(1 - s) * -56}px)`,
      }}
    >
      <svg width={32} height={26} viewBox="0 0 36 28">
        <line x1={7} y1={3} x2={7} y2={25} stroke={C.green} strokeWidth={2} strokeLinecap="round" opacity={0.7} />
        <rect x={3.5} y={9} width={7} height={10} rx={2.5} fill={C.green} />
        <line x1={18} y1={5} x2={18} y2={23} stroke={C.red} strokeWidth={2} strokeLinecap="round" opacity={0.7} />
        <rect x={14.5} y={11} width={7} height={7} rx={2.5} fill={C.red} />
        <line x1={29} y1={2} x2={29} y2={26} stroke={C.gold} strokeWidth={2} strokeLinecap="round" opacity={0.85} />
        <rect x={25.5} y={7} width={7} height={13} rx={2.5} fill={C.gold} />
      </svg>
      <span
        style={{
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 20,
          letterSpacing: 6,
          color: C.white,
        }}
      >
        LUXTRADE
      </span>
    </div>
  );
};

/** Top full-width progress bar (gold fill over faint track). */
export const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = clamp01(frame / Math.max(1, durationInFrames));
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 6,
        background: "rgba(255,255,255,0.08)",
        zIndex: 10,
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress * 100}%`,
          background: `linear-gradient(90deg, ${C.goldDeep}, ${C.gold})`,
          boxShadow: "0 0 14px rgba(245,200,66,0.55)",
        }}
      />
    </div>
  );
};

/** Bottom-center scene indicator dots. */
export const SceneDots: React.FC<{ activeIndex: number; total: number }> = ({
  activeIndex,
  total,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 64,
        left: 0,
        right: 0,
        height: 10,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 14,
        zIndex: 10,
      }}
    >
      {Array.from({ length: total }).map((_, i) => {
        const active = i === activeIndex;
        return (
          <div
            key={i}
            style={{
              width: active ? 36 : 10,
              height: 10,
              borderRadius: 999,
              background: active ? C.gold : "rgba(255,255,255,0.18)",
              boxShadow: active ? "0 0 16px rgba(245,200,66,0.5)" : "none",
            }}
          />
        );
      })}
    </div>
  );
};
