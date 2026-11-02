import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  C,
  CARD,
  FONT,
  SPRING_POP,
  SPRING_SOFT,
  SceneShell,
  TitleBlock,
  clamp01,
  pop,
} from "../components/Ui";
import type { SceneComponentProps } from "../components/Ui";

/* ---------------- mini chart data (deterministic) ---------------- */

type CandleDef = { o: number; c: number; h: number; l: number };

const MINI_CANDLES: CandleDef[] = [
  { o: 0.3, c: 0.44, h: 0.48, l: 0.26 },
  { o: 0.44, c: 0.36, h: 0.47, l: 0.32 },
  { o: 0.37, c: 0.56, h: 0.61, l: 0.34 },
  { o: 0.56, c: 0.49, h: 0.59, l: 0.45 },
  { o: 0.5, c: 0.68, h: 0.72, l: 0.47 },
  { o: 0.68, c: 0.61, h: 0.7, l: 0.57 },
  { o: 0.62, c: 0.82, h: 0.86, l: 0.59 },
];

const CHART_W = 282;
const CHART_H = 200;
const AREA_TOP = 14;
const AREA_BOTTOM = 188;
const PAD_X = 16;
const BODY_W = 22;

const yOf = (v: number): number => AREA_BOTTOM - v * (AREA_BOTTOM - AREA_TOP);
const xCenter = (i: number): number =>
  PAD_X + ((CHART_W - PAD_X * 2) / MINI_CANDLES.length) * (i + 0.5);

/* ---------------- notification card ---------------- */

const NotificationCard: React.FC<{
  dotColor: string;
  title: string;
  sub: string;
  delay: number;
}> = ({ dotColor, title, sub, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = pop(frame, fps, delay, SPRING_SOFT);
  return (
    <div
      style={{
        ...CARD,
        borderRadius: 20,
        background: "rgba(255,255,255,0.05)",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 7,
        boxShadow: "0 14px 34px rgba(0,0,0,0.35)",
        opacity: clamp01(s),
        transform: `translateX(${(1 - s) * 300}px)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: dotColor,
            boxShadow: `0 0 12px ${dotColor}`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: 20,
            color: C.white,
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>
      </div>
      <span
        style={{
          fontFamily: FONT,
          fontWeight: 500,
          fontSize: 18,
          color: C.muted,
          paddingLeft: 21,
        }}
      >
        {sub}
      </span>
    </div>
  );
};

/* ---------------- scene ---------------- */

export const Scene2Phone: React.FC<SceneComponentProps> = ({
  title,
  sub,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneIn = pop(frame, fps, 8, SPRING_SOFT);
  const floatY = Math.sin(frame / 95) * 8;
  const tilt = -4 + Math.sin(frame / 80) * 1.3;

  return (
    <SceneShell durationInFrames={durationInFrames}>
      <TitleBlock title={title} sub={sub} titleSize={88} />

      {/* CSS phone mockup */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 688,
          marginLeft: -170,
          width: 340,
          height: 640,
          borderRadius: 56,
          border: "3px solid rgba(245,200,66,0.35)",
          background: C.panel,
          boxShadow:
            "0 0 120px rgba(245,200,66,0.18), 0 40px 90px rgba(0,0,0,0.6)",
          overflow: "hidden",
          opacity: clamp01(phoneIn),
          transform: `translateY(${(1 - phoneIn) * 640 + floatY}px) rotate(${tilt}deg)`,
        }}
      >
        {/* notch */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: "50%",
            marginLeft: -55,
            width: 110,
            height: 26,
            borderRadius: 999,
            background: C.bg,
          }}
        />

        <div
          style={{
            padding: "54px 16px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* mini candlestick chart */}
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: 18,
              padding: 10,
            }}
          >
            <svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
              <line
                x1={8}
                x2={CHART_W - 8}
                y1={AREA_BOTTOM - 0.34 * (AREA_BOTTOM - AREA_TOP)}
                y2={AREA_BOTTOM - 0.34 * (AREA_BOTTOM - AREA_TOP)}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1.5}
              />
              {MINI_CANDLES.map((cd, i) => {
                const s = pop(frame, fps, 26 + i * 4, SPRING_POP);
                const color =
                  i === MINI_CANDLES.length - 1
                    ? C.gold
                    : cd.c >= cd.o
                      ? C.green
                      : C.red;
                const bodyTop = yOf(Math.max(cd.o, cd.c));
                const bodyH = Math.max(4, Math.abs(yOf(cd.o) - yOf(cd.c)));
                return (
                  <g
                    key={i}
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: "50% 100%",
                      transform: `scaleY(${s})`,
                      opacity: clamp01(s * 1.3),
                    }}
                  >
                    <line
                      x1={xCenter(i)}
                      x2={xCenter(i)}
                      y1={yOf(cd.h)}
                      y2={yOf(cd.l)}
                      stroke={color}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      opacity={0.75}
                    />
                    <rect
                      x={xCenter(i) - BODY_W / 2}
                      y={bodyTop}
                      width={BODY_W}
                      height={bodyH}
                      rx={7}
                      fill={color}
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* push notifications */}
          <NotificationCard
            dotColor={C.gold}
            title="Sinyal BUY · XAUUSD"
            sub="Akurasi model 87%"
            delay={48}
          />
          <NotificationCard
            dotColor={C.green}
            title="TP tercapai"
            sub="tercatat otomatis di jurnal"
            delay={62}
          />
        </div>
      </div>
    </SceneShell>
  );
};
