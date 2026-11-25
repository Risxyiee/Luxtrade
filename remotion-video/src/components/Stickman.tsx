import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp01 } from "./Ui";

/* ============================================================
   Stickman — karakter trader mini yang HIDUP di atas candle
   ============================================================
   Kunci keren-nya reel referensi Bos (DfeAm-wPf3k): ada tokoh
   yang berdiri/berjalan di atas chart — bukan cuma garis & teks.

   Pose (props.pose):
     idle      : berdiri, goyang halus
     shock     : kaget — tangan ke atas, badan mundur (SL kena!)
     celebrate : lompat tangan V (profit)
     walk      : jalan (kaki langkah, tangan ayun)
     point     : tunjuk ke kanan (arah target/level)
   Bubble: "?" muncul di atas kepala (props.bubble) */

export type StickmanPose = "idle" | "shock" | "celebrate" | "walk" | "point";

interface StickmanProps {
  pose: StickmanPose;
  /** frame relatif — untuk animasi kaki/tangan/jump */
  anchorFrame?: number;
  /** tampilkan gelembung "?" di atas kepala */
  bubble?: boolean;
  /** ukuran tinggi total (px) */
  height?: number;
}

const W = 200;
const H = 270;

export const Stickman: React.FC<StickmanProps> = ({
  pose,
  anchorFrame = 0,
  bubble = false,
  height = 170,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - anchorFrame);

  /* geometri dasar (viewBox 200x270, kaki di y=250) */
  const headY = 46;
  const neckY = 84;
  const hipY = 170;
  const footY = 250;
  const cx = 100;

  /* sudut animasi per pose */
  let armL = { x: 58, y: 150 }; // ujung tangan kiri (default idle: turun)
  let armR = { x: 142, y: 150 };
  let legL = { x: 66, y: footY };
  let legR = { x: 134, y: footY };
  let bodyTilt = 0;
  let headDx = 0;
  let jump = 0;

  if (pose === "shock") {
    armL = { x: 46, y: 34 };
    armR = { x: 154, y: 34 };
    bodyTilt = -6;
    headDx = -6;
  } else if (pose === "celebrate") {
    armL = { x: 40, y: 30 };
    armR = { x: 160, y: 30 };
    /* lompat: bounce periodik */
    const jp = (f % 36) / 36;
    jump = -Math.sin(jp * Math.PI) * 26;
    legL = { x: 74, y: footY - Math.sin(jp * Math.PI) * 10 };
    legR = { x: 126, y: footY - Math.sin(jp * Math.PI) * 10 };
  } else if (pose === "walk") {
    const a = f * 0.32;
    const s = Math.sin(a);
    legL = { x: cx - 36 * s, y: footY - Math.abs(s) * 12 };
    legR = { x: cx + 36 * s, y: footY - Math.abs(Math.sin(a + Math.PI)) * 12 };
    armL = { x: cx - 30 * -s, y: 148 };
    armR = { x: cx + 30 * -s, y: 148 };
  } else if (pose === "point") {
    armL = { x: 64, y: 152 };
    armR = { x: 168, y: 96 }; // tunjuk kanan-atas
    bodyTilt = 3;
  }

  const scale = height / H;

  return (
    <div
      style={{
        width: W * scale,
        height: H * scale,
        transform: `translateY(${jump * scale}px)`,
        position: "relative",
      }}
    >
      <svg
        width={W * scale}
        height={H * scale}
        viewBox={`0 0 ${W} ${H}`}
        style={{
          display: "block",
          overflow: "visible",
          filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.55))",
        }}
      >
        <g
          transform={`translate(${headDx} 0) rotate(${bodyTilt} ${cx} ${hipY})`}
          stroke="#FFFFFF"
          strokeWidth={13}
          strokeLinecap="round"
          fill="none"
        >
          {/* kepala */}
          <circle cx={cx} cy={headY} r={30} fill="#FFFFFF" stroke="none" />
          {/* badan */}
          <line x1={cx} y1={neckY} x2={cx} y2={hipY} />
          {/* tangan */}
          <line x1={cx} y1={neckY + 8} x2={armL.x} y2={armL.y} />
          <line x1={cx} y1={neckY + 8} x2={armR.x} y2={armR.y} />
          {/* kaki */}
          <line x1={cx} y1={hipY} x2={legL.x} y2={legL.y} />
          <line x1={cx} y1={hipY} x2={legR.x} y2={legR.y} />
        </g>

        {/* gelembung "?" */}
        {bubble && (
          <g transform={`translate(${cx + 52} 8)`}>
            <circle cx={-14} cy={34} r={7} fill="rgba(255,255,255,0.5)" />
            <circle cx={-28} cy={52} r={5} fill="rgba(255,255,255,0.35)" />
            <rect
              x={-6}
              y={-16}
              width={64}
              height={58}
              rx={14}
              fill="rgba(9,18,26,0.9)"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth={2.5}
            />
            <text
              x={26}
              y={30}
              textAnchor="middle"
              fontSize={44}
              fontWeight={900}
              fill="#FFFFFF"
              fontFamily="'Manrope', 'DejaVu Sans', sans-serif"
            >
              ?
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

/** helper: entrance pop untuk stickman */
export const useStickmanIn = (delay: number): number => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  return clamp01(spring({ fps, frame: Math.max(0, frame - delay), config: { damping: 12, stiffness: 200 } }));
};
