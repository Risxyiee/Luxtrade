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

/**
 * Random-walk candlestick ternormalisasi [0..1] (1 = tinggi).
 *
 * Upgrade Bos 26-11 ("visual masih jelek"): chart TIDAK BOLEH kosong —
 * candle wajib memenuhi area vertikal. Setelah walk di-generate, seluruh
 * range di-RESKALE ke [0.10, 0.90] sehingga candle memenuhi layar seperti
 * chart TradingView asli (bukan gundukan kecil di tengah).
 *
 * `path` opsional: waypoints harga ternormalisasi (1 = tinggi) untuk
 * narasi spesifik (rally → sweep → rally). Di-interpolasi halus + noise.
 */
export function genCandles(seed: number, trend: "up" | "down" | "flat", n = 18, path?: number[]): Candle[] {
  const out: Candle[] = [];

  if (path && path.length >= 2) {
    /* narasi waypoint: resample merata ke n candle + noise deterministik */
    const segs = path.length - 1;
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1)) * segs;
      const k = Math.min(segs - 1, Math.floor(t));
      const frac = t - k;
      const base = path[k] + (path[k + 1] - path[k]) * frac;
      const noise = (((seed * 97 + i * 13) % 100) / 100 - 0.5) * 0.055;
      const o = i === 0 ? base : out[i - 1].c;
      const c = Math.min(0.98, Math.max(0.02, base + noise));
      const h = Math.max(o, c) + (((seed * 31 + i * 7) % 100) / 100) * 0.032;
      const l = Math.min(o, c) - (((seed * 53 + i * 11) % 100) / 100) * 0.032;
      out.push({ o, c, h: Math.min(0.99, h), l: Math.max(0.01, l) });
    }
  } else {
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
  }

  /* ── FILL RANGE: reskale semua candle ke [0.10, 0.90] ──
     Ini yang bikin chart penuh (kayak TradingView beneran),
     bukan candle kecil ngambang di tengah layar kosong. */
  const mn = Math.min(...out.map((c) => c.l));
  const mx = Math.max(...out.map((c) => c.h));
  const span = mx - mn || 1;
  const map = (v: number) => 0.1 + ((v - mn) / span) * 0.8;
  return out.map((c) => ({ o: map(c.o), c: map(c.c), h: map(c.h), l: map(c.l) }));
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

/* ═══ STYLE TRADINGVIEW (arahan Bos: "candle dibikin kaya tradingview")
   Warna + geometri candle mengikuti dark theme TradingView:
   up #26a69a · down #ef5350 · wick tegas 2px full opacity ·
   body solid tanpa rounded · grid #1e222d di atas bg #131722. */
const UP = "#26a69a";
const DOWN = "#ef5350";
const TV_GRID = "#1e222d";
const TV_AXIS = "rgba(178,181,190,0.85)";

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

  /* candle muncul berurutan (spring pop per-candle) — gaya TradingView
     tanpa overlay garis; timing "draw" dipertahankan untuk garis
     entry/exit yang menyala setelah semua candle terbentuk. */
  const settleDone = n * 2 + 4;
  const drawP = clamp01(
    interpolate(f, [settleDone, settleDone + 34], [0, 1], { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );

  const gridLines = [0.25, 0.5, 0.75];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      {/* grid gaya TradingView — samar, warna solid #1e222d */}
      {gridLines.map((g) => (
        <line
          key={g}
          x1={padX}
          x2={width - padX}
          y1={padY + g * innerH}
          y2={padY + g * innerH}
          stroke={TV_GRID}
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
            {/* wick tegas 2px full-opacity persis TradingView */}
            <line x1={xMid} x2={xMid} y1={y(cd.h)} y2={y(cd.l)} stroke={color} strokeWidth={2} opacity={1} />
            {/* body solid, sudut tajam (rx 0) — tanpa glow */}
            <rect x={xMid - bw / 2} y={bodyTop} width={bw} height={bodyH} rx={0} fill={color} opacity={1} />
          </g>
        );
      })}

      {/* GARIS HARGA dihapus — mode candlestick TradingView tidak
          punya overlay polyline glow; candle saja sudah bersih. */}

      {/* garis entry (abu) & exit (hasil) — gaya price line TradingView */}
      {entryY != null && drawP >= 1 && (
        <g opacity={1}>
          <line
            x1={padX}
            x2={width - padX}
            y1={y(entryY)}
            y2={y(entryY)}
            stroke="rgba(178,181,190,0.7)"
            strokeWidth={1.6}
            strokeDasharray="6 5"
          />
          {/* label kotak di axis kanan — seperti price line TradingView */}
          <rect x={width - padX - 86} y={y(entryY) - 15} width={86} height={30} fill="#434651" rx={3} />
          <text x={width - padX - 8} y={y(entryY) + 6} textAnchor="end" fill="#FFFFFF" fontSize={18} fontWeight={700} fontFamily="Manrope, DejaVu Sans, sans-serif">
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
          <rect x={width - padX - 86} y={y(exitY) - 15} width={86} height={30} fill={exitColor} rx={3} />
          <text x={width - padX - 8} y={y(exitY) + 6} textAnchor="end" fill="#FFFFFF" fontSize={18} fontWeight={800} fontFamily="Manrope, DejaVu Sans, sans-serif">
            {exitLabel}
          </text>
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
