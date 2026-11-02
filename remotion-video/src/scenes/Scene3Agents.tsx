import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import {
  C,
  EASE,
  FONT,
  SPRING_POP,
  SPRING_SOFT,
  SceneShell,
  TitleBlock,
  clamp01,
  pop,
} from "../components/Ui";
import type { SceneComponentProps } from "../components/Ui";

const AGENTS = [
  "Raka",
  "Maya",
  "Bagas",
  "Putri",
  "Dewi",
  "Farhan",
  "Sinta",
  "Alexander",
];

const RADAR = 560;
const CENTER_X = 540;
const CENTER_Y = 960;

export const Scene3Agents: React.FC<SceneComponentProps> = ({
  title,
  sub,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const radarIn = pop(frame, fps, 6, SPRING_SOFT);
  const count = Math.round(
    interpolate(frame, [24, 78], [0, 24], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE,
    }),
  );

  return (
    <SceneShell durationInFrames={durationInFrames}>
      <TitleBlock title={title} sub={sub} titleSize={84} top={286} />

      {/* AI radar */}
      <div
        style={{
          position: "absolute",
          left: CENTER_X - RADAR / 2,
          top: CENTER_Y - RADAR / 2,
          width: RADAR,
          height: RADAR,
          borderRadius: "50%",
          border: "1.5px solid rgba(245,200,66,0.28)",
          boxShadow:
            "0 0 120px rgba(245,200,66,0.10), inset 0 0 80px rgba(245,200,66,0.06)",
          opacity: clamp01(radarIn),
          transform: `scale(${0.85 + 0.15 * radarIn})`,
        }}
      >
        {/* inner ring */}
        <div
          style={{
            position: "absolute",
            inset: 90,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        />
        {/* rotating sweep */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background:
              "conic-gradient(from 0deg, rgba(245,200,66,0.30) 0deg, rgba(245,200,66,0.06) 50deg, rgba(245,200,66,0) 80deg, rgba(245,200,66,0) 360deg)",
            transform: `rotate(${frame * 2}deg)`,
          }}
        />
        {/* pulsing center dot */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 18,
            height: 18,
            marginLeft: -9,
            marginTop: -9,
            borderRadius: "50%",
            background: C.gold,
            boxShadow:
              "0 0 26px rgba(245,200,66,0.9), 0 0 70px rgba(245,200,66,0.4)",
            transform: `scale(${1 + 0.22 * Math.sin(frame / 9)})`,
          }}
        />
      </div>

      {/* orbiting agent chips */}
      {AGENTS.map((name, i) => {
        const angle = (i / AGENTS.length) * Math.PI * 2 - Math.PI / 2;
        const rx = 420 + Math.sin(frame / 110 + i) * 10;
        const ry = 384 + Math.cos(frame / 95 + i * 1.3) * 10;
        const s = pop(frame, fps, 16 + i * 4, SPRING_POP);
        return (
          <div
            key={name}
            style={{
              position: "absolute",
              left: CENTER_X + Math.cos(angle) * rx,
              top: CENTER_Y + Math.sin(angle) * ry,
              transform: `translate(-50%, -50%) scale(${s})`,
              opacity: clamp01(s),
              padding: "14px 28px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(245,200,66,0.22)",
              backdropFilter: "blur(6px)",
              fontFamily: FONT,
              fontWeight: 500,
              fontSize: 26,
              color: C.white,
              whiteSpace: "nowrap",
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            }}
          >
            {name}
          </div>
        );
      })}

      {/* 24/7 counter */}
      <div
        style={{
          position: "absolute",
          top: 1408,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: clamp01(pop(frame, fps, 20)),
        }}
      >
        <span
          style={{
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: 64,
            color: C.gold,
            textShadow: "0 0 40px rgba(245,200,66,0.35)",
          }}
        >
          {count}
        </span>
        <span
          style={{
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: 64,
            color: "rgba(255,255,255,0.55)",
          }}
        >
          /7
        </span>
      </div>
    </SceneShell>
  );
};
