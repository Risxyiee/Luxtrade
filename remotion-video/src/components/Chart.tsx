import React from "react";
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C, SPRING_POP, SPRING_SOFT, clamp01, EASE } from "./Ui";

/* ============================================================
   PriceChart — chart candlestick SVG animasi (deterministik)
   ============================================================
   Dipakai scene 'chart' di SintaReels + seluruh SignalRecap.
   Semua data di-generate dari `seed` (remotion random) sehingga
   render konsisten di runner maupun preview. */

export interface Candle {
  o: number;
  c: number;
  h: number;
  l: number;
}

/** Random-walk candlestick ternormalisasi [0..1] (1 = tinggi). */
export function genCandles(seed: number, trend: "up" | "down" | "flat", n = 18): Candle[] {
  const out: Candle[] = [];
  let price = 0.5;
  const bias = trend === "up" ? 0.028 : trend === "down" ? -0.028 : 0;
  for (let i = 0; i < n; i++) {
    const o = price;
    const drift = bias + (((seed * 97 + i * 13) % 100) / 100 - 0.5) * 0.11;
    const c = Math.min(0.96, Math.max(0.04, o + drift));
    const h = Math.max(o, c) + (((seed * 31 + i * 7) % 100) / 100) * 0.05;
    const l = Math.min(o, c) - (((seed * 53 + i * 11) % 100) / 100) * 0.05;
    out.push({ o, c, h: Math.min(0.99, h), l: Math.max(0.01, l) });
    price = c;
  }
  return out;
}

/** Format angka gaya Indonesia: 2.335,40 — tanpa bergantung ICU runtime. */
export function fmtNum(v: number, minFrac = 2): string {
  const neg = v < 0;
  const abs = Math.abs(v);
  const frac = abs % 1;
  let int = Math.floor(abs);
  let fracStr = "";
  if (minFrac > 0) {
    fracStr = frac.toFixed(minFrac).slice(1); // ".xx"
  }
  const groups: string[] = [];
  while (int > 0) {
    groups.unshift(String(int % 1000).padStart(3, "0"));
    int = Math.floor(int / 1000);
  }
  const intStr = groups.length ? groups.join(".").replace(/^0+/, "") || "0" : "0";
  return (neg ? "-" : "") + intStr + fracStr;
}

const UP = C.green;
const DOWN = C.red;

export interface CandleChartProps {
  seed?: number;
  trend?: "up" | "down" | "flat";
  /** Garis horizontal harga (normalisasi 0..1, 1 = atas) — entry & exit. */
  entryY?: number | null;
  exitY?: number | null;
  entryLabel?: string;
  exitLabel?: string;
  /** Warna garis exit (hasil): hijau utk TP, merah utk SL. */
  exitColor?: string;
  width?: number;
  height?: number;
  /** Tunda mulai animasi (frame) — biar sinkron entrance scene. */
  delay?: number;
}

/**
 * Chart kanvas: candle muncul satu per satu → garis harga
 * "menggambar dirinya" menembus close tiap candle → garis
 * entry/exit menyala + label harga. Semua timing relatif frame.
 */
export const CandleChart: React.FC<CandleChartProps> = ({
  seed = 7,
  trend = "up",
  entryY = null,
  exitY = null,
  entryLabel = "ENTRY",
  exitLabel = "EXIT",
  exitColor = C.green,
  width = 840,
  height = 520,
  delay = 6,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);

  const candles = React.useMemo(() => genCandles(seed, trend), [seed, trend]);
  const n = candles.length;
  const padX = 18;
  const padY = 34;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const step = innerW / n;
  const bw = step * 0.52;

  const y = (v: number) => padY + (1 - v) * innerH;

  // polyline close prices
  const pts = candles.map((cd, i) => [padX + step * (i + 0.5), y(cd.c)] as const);
  let pathLen = 0;
  for (let i = 1; i < pts.length; i++) {
    pathLen += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  const drawStart = n * 2 + 4;
  const drawP = clamp01(
    interpolate(f, [drawStart, drawStart + 34], [0, 1], { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
  const dash = pathLen * drawP;

  // kepala garis (dot glow) bergerak menyusuri path
  const headIdx = Math.min(n - 1, Math.floor(drawP * (n - 1)));
  const head = pts[headIdx];

  const gridLines = [0.25, 0.5, 0.75];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      {/* grid samar */}
      {gridLines.map((g) => (
        <line
          key={g}
          x1={padX}
          x2={width - padX}
          y1={padY + g * innerH}
          y2={padY + g * innerH}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={1}
        />
      ))}

      {/* candle muncul berurutan */}
      {candles.map((cd, i) => {
        const appear = spring({ fps, frame: Math.max(0, f - i * 2), config: SPRING_POP });
        const xMid = padX + step * (i + 0.5);
        const up = cd.c >= cd.o;
        const color = up ? UP : DOWN;
        const bodyTop = y(Math.max(cd.o, cd.c));
        const bodyH = Math.max(3, Math.abs(y(cd.o) - y(cd.c)));
        return (
          <g key={i} opacity={clamp01(appear)} transform={`translate(${xMid} ${y(cd.c)}) scale(${appear}) translate(${-xMid} ${-y(cd.c)})`}>
            <line x1={xMid} x2={xMid} y1={y(cd.h)} y2={y(cd.l)} stroke={color} strokeWidth={2.5} strokeLinecap="round" opacity={0.75} />
            <rect x={xMid - bw / 2} y={bodyTop} width={bw} height={bodyH} rx={4} fill={color} opacity={0.92} />
          </g>
        );
      })}

      {/* garis harga menggambar dirinya */}
      <polyline
        points={pts.map((p) => `${p[0]},${p[1]}`).join(" ")}
        fill="none"
        stroke={C.accent}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${dash} ${pathLen + 10}`}
        style={{ filter: "drop-shadow(0 0 12px rgba(34,211,238,0.65))" }}
      />
      {drawP > 0 && drawP < 1 && (
        <circle cx={head[0]} cy={head[1]} r={9} fill={C.accent} style={{ filter: "drop-shadow(0 0 14px rgba(34,211,238,0.9))" }} />
      )}

      {/* garis entry (abu) & exit (hasil) */}
      {entryY != null && drawP >= 1 && (
        <g opacity={1}>
          <line
            x1={padX}
            x2={width - padX}
            y1={y(entryY)}
            y2={y(entryY)}
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={2.5}
            strokeDasharray="10 8"
          />
          <text x={width - padX - 8} y={y(entryY) - 12} textAnchor="end" fill="rgba(255,255,255,0.75)" fontSize={22} fontWeight={700} fontFamily="Manrope, DejaVu Sans, sans-serif">
            {entryLabel}
          </text>
        </g>
      )}
      {exitY != null && drawP >= 1 && (
        <g>
          <line
            x1={padX}
            x2={width - padX}
            y1={y(exitY)}
            y2={y(exitY)}
            stroke={exitColor}
            strokeWidth={3}
            strokeDasharray="10 8"
            style={{ filter: `drop-shadow(0 0 8px ${exitColor})` }}
          />
          <text x={width - padX - 8} y={y(exitY) - 12} textAnchor="end" fill={exitColor} fontSize={22} fontWeight={800} fontFamily="Manrope, DejaVu Sans, sans-serif">
            {exitLabel}
          </text>
          <circle cx={pts[n - 1][0]} cy={y(exitY)} r={10} fill={exitColor} style={{ filter: `drop-shadow(0 0 14px ${exitColor})` }} />
        </g>
      )}
    </svg>
  );
};

/* ============================================================
   Kartu pembungkus chart (panel glassy konsisten brand)
   ============================================================ */

export const ChartPanel: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ fps, frame: Math.max(0, frame - delay), config: SPRING_SOFT });
  return (
    <div
      style={{
        padding: 30,
        borderRadius: 34,
        background: "rgba(255,255,255,0.035)",
        border: "1px solid rgba(34,211,238,0.22)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
        opacity: clamp01(s),
        transform: `translateY(${(1 - s) * 60}px) scale(${0.97 + 0.03 * s})`,
      }}
    >
      {children}
    </div>
  );
};
