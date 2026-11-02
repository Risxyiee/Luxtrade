import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import {
  C,
  EASE,
  FONT,
  SPRING_POP,
  SceneShell,
  TitleBlock,
  clamp01,
  pop,
  rise,
} from "../components/Ui";
import type { SceneComponentProps } from "../components/Ui";

export const Scene4Execute: React.FC<SceneComponentProps> = ({
  title,
  sub,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardS = pop(frame, fps, 8, SPRING_POP);

  const circleDraw = interpolate(frame, [26, 44], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const checkDraw = interpolate(frame, [34, 52], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const ringDraw = interpolate(frame, [42, 80], [1, 0.25], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const ringPct = Math.round((1 - ringDraw) * 100);

  const execP = pop(frame, fps, 34);

  return (
    <SceneShell durationInFrames={durationInFrames}>
      <TitleBlock title={title} sub={sub} titleSize={78} top={282} />

      {/* alert card (sticker-pop entrance) */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 660,
          marginLeft: -420,
          width: 840,
          borderRadius: 32,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(34,211,238,0.22)",
          padding: "48px 56px",
          boxShadow:
            "0 0 100px rgba(34,211,238,0.10), 0 40px 90px rgba(0,0,0,0.5)",
          opacity: clamp01(cardS * 1.5),
          transform: `scale(${0.7 + 0.3 * cardS}) rotate(${(1 - cardS) * -5}deg)`,
        }}
      >
        {/* header */}
        <div
          style={{
            ...rise(frame, 16, 24),
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: C.accent,
              boxShadow: "0 0 14px rgba(34,211,238,0.8)",
            }}
          />
          <span
            style={{
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 22,
              letterSpacing: 5,
              color: C.accent,
            }}
          >
            ALERT · XAUUSD
          </span>
        </div>

        {/* big line */}
        <div
          style={{
            ...rise(frame, 22, 34),
            marginTop: 22,
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: 56,
            letterSpacing: 1,
            color: C.white,
            textShadow: "0 0 40px rgba(34,211,238,0.25)",
          }}
        >
          BUY 2.335,10
        </div>

        {/* executed row */}
        <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 34 }}>
          <svg width={64} height={64} viewBox="0 0 64 64">
            <circle
              cx={32}
              cy={32}
              r={27}
              fill="rgba(52,211,153,0.08)"
              stroke="rgba(52,211,153,0.4)"
              strokeWidth={3}
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={circleDraw}
              transform="rotate(-90 32 32)"
            />
            <path
              d="M20 33 L29 42 L45 24"
              fill="none"
              stroke={C.green}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={checkDraw}
            />
          </svg>
          <span
            style={{
              fontFamily: FONT,
              fontWeight: 500,
              fontSize: 28,
              color: C.white,
              opacity: clamp01(execP),
              transform: `translateX(${(1 - execP) * 24}px)`,
            }}
          >
            Tereksekusi otomatis
          </span>
        </div>

        {/* divider */}
        <div
          style={{
            height: 1,
            background: "rgba(255,255,255,0.08)",
            marginTop: 38,
            opacity: clamp01(pop(frame, fps, 38)),
          }}
        />

        {/* streak ring gauge */}
        <div style={{ display: "flex", alignItems: "center", gap: 30, marginTop: 34 }}>
          <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
            <svg width={120} height={120} viewBox="0 0 120 120">
              <circle
                cx={60}
                cy={60}
                r={48}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={10}
              />
              <circle
                cx={60}
                cy={60}
                r={48}
                fill="none"
                stroke={C.accent}
                strokeWidth={10}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={ringDraw}
                transform="rotate(-90 60 60)"
                style={{ filter: "drop-shadow(0 0 10px rgba(34,211,238,0.5))" }}
              />
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT,
                fontWeight: 800,
                fontSize: 26,
                color: C.accent,
                opacity: clamp01(pop(frame, fps, 56)),
              }}
            >
              {ringPct}%
            </div>
          </div>
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 500,
              fontSize: 24,
              color: C.muted,
              opacity: clamp01(pop(frame, fps, 48)),
            }}
          >
            disiplin streak 12 hari
          </div>
        </div>
      </div>
    </SceneShell>
  );
};
