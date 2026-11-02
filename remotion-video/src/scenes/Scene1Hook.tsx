import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import {
  C,
  EASE,
  FONT,
  SPRING_POP,
  SPRING_SOFT,
  SceneShell,
  clamp01,
  pop,
} from "../components/Ui";
import type { SceneComponentProps } from "../components/Ui";

/* ---------------- candlestick data (hand-tuned uptrend, deterministic) ---------------- */

type CandleDef = { o: number; c: number; h: number; l: number };

const CANDLES: CandleDef[] = [
  { o: 0.16, c: 0.26, h: 0.3, l: 0.12 },
  { o: 0.26, c: 0.2, h: 0.29, l: 0.16 },
  { o: 0.21, c: 0.36, h: 0.4, l: 0.18 },
  { o: 0.36, c: 0.3, h: 0.39, l: 0.26 },
  { o: 0.31, c: 0.48, h: 0.52, l: 0.28 },
  { o: 0.48, c: 0.41, h: 0.51, l: 0.37 },
  { o: 0.42, c: 0.6, h: 0.64, l: 0.39 },
  { o: 0.6, c: 0.53, h: 0.63, l: 0.49 },
  { o: 0.54, c: 0.76, h: 0.8, l: 0.5 },
];

const CHART_W = 940;
const CHART_H = 620;
const AREA_TOP = 26;
const AREA_BOTTOM = 592;
const PAD_X = 44;
const BODY_W = 46;

const yOf = (v: number): number => AREA_BOTTOM - v * (AREA_BOTTOM - AREA_TOP);
const xCenter = (i: number): number =>
  PAD_X + ((CHART_W - PAD_X * 2) / CANDLES.length) * (i + 0.5);

const candleColor = (cd: CandleDef, i: number): string => {
  if (i === CANDLES.length - 1) return C.accent;
  return cd.c >= cd.o ? C.green : C.red;
};

/* ---------------- scene ---------------- */

export const Scene1Hook: React.FC<SceneComponentProps> = ({
  title,
  sub,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = title.split(" ");
  const subP = pop(frame, fps, 6 + words.length * 6);

  const trendPoints = CANDLES.map((cd, i) => `${xCenter(i)},${yOf(cd.c)}`).join(" ");
  const trendDraw = interpolate(frame, [38, 96], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

  return (
    <SceneShell durationInFrames={durationInFrames}>
      {/* animated candlestick chart behind the text */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 660,
          transform: `translateX(-50%) translateY(${Math.sin(frame / 90) * 8}px)`,
        }}
      >
        <svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
          {[0.25, 0.5, 0.75].map((v) => (
            <line
              key={v}
              x1={20}
              x2={CHART_W - 20}
              y1={yOf(v)}
              y2={yOf(v)}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1.5}
            />
          ))}
          {CANDLES.map((cd, i) => {
            const s = pop(frame, fps, 10 + i * 3, SPRING_SOFT);
            const color = candleColor(cd, i);
            const isLast = i === CANDLES.length - 1;
            const bodyTop = yOf(Math.max(cd.o, cd.c));
            const bodyH = Math.max(5, Math.abs(yOf(cd.o) - yOf(cd.c)));
            return (
              <g
                key={i}
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "50% 100%",
                  transform: `scaleY(${s})`,
                  opacity: clamp01(s * 1.3),
                  filter: isLast
                    ? "drop-shadow(0 0 18px rgba(34,211,238,0.55))"
                    : undefined,
                }}
              >
                <line
                  x1={xCenter(i)}
                  x2={xCenter(i)}
                  y1={yOf(cd.h)}
                  y2={yOf(cd.l)}
                  stroke={color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  opacity={0.75}
                />
                <rect
                  x={xCenter(i) - BODY_W / 2}
                  y={bodyTop}
                  width={BODY_W}
                  height={bodyH}
                  rx={10}
                  fill={color}
                />
              </g>
            );
          })}
          <polyline
            points={trendPoints}
            fill="none"
            stroke={C.accent}
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={trendDraw}
            opacity={0.95}
            style={{ filter: "drop-shadow(0 0 12px rgba(34,211,238,0.5))" }}
          />
        </svg>
      </div>

      {/* dark scrim so the copy stays readable over the chart */}
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          top: 600,
          bottom: 420,
          background:
            "radial-gradient(ellipse 70% 60% at center, rgba(5,5,10,0.82) 0%, rgba(5,5,10,0) 70%)",
        }}
      />

      {/* giant hook title, word by word */}
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          top: 600,
          bottom: 420,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            columnGap: 22,
            rowGap: 10,
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: 100,
            lineHeight: 1.05,
            letterSpacing: 2,
            color: C.white,
            textShadow:
              "0 0 60px rgba(34,211,238,0.32), 0 6px 30px rgba(0,0,0,0.65)",
          }}
        >
          {words.map((word, i) => {
            const s = pop(frame, fps, 6 + i * 6, SPRING_POP);
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  opacity: clamp01(s),
                  transform: `translateY(${(1 - s) * 70}px) scale(${0.72 + 0.28 * s})`,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 34,
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: 34,
            color: C.muted,
            textAlign: "center",
            opacity: clamp01(subP),
            transform: `translateY(${(1 - subP) * 30}px)`,
          }}
        >
          {sub}
        </div>
      </div>
    </SceneShell>
  );
};
