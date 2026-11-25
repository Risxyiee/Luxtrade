import React from "react";
import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fmtNum, genCandles } from "./Chart";
import { C, FONT, clamp01 } from "./Ui";

/* ============================================================
   ChartScreen — layar terminal trading realistis ("LuxTerminal")
   ============================================================
   Referensi Bos 26-11 (reel IG @inzaghitrades — proyeksi standard
   deviation): konten edukasi tampil SEBAGAI LAYAR PLATFORM beneran,
   BUKAN kartu teks — chart candle + alat gambar yang muncul
   LANGKAH DEMI LANGKAH sinkron dengan voiceover.

   Data-driven & aman: semua langkah gambar dari field `draw` spec
   Sinta (sudah di-sanitize di worker):
     { t: 'high'|'low'|'zone'|'level'|'path'|'label'|'circle',
       label?, x1?, x2?, y1?, y2?, color? }
   Koordinat NORMALISASI: x = waktu kiri→kanan (0..1),
   y = harga bawah→atas (0..1).

   Semua deterministik dari `seed` — render konsisten runner/preview. */

export type TerminalStepT =
  | "high"
  | "low"
  | "zone"
  | "level"
  | "path"
  | "label"
  | "circle";

export interface TerminalStep {
  t?: TerminalStepT | string;
  label?: string;
  x1?: number;
  x2?: number;
  y1?: number;
  y2?: number;
  color?: string;
}

export interface ChartScreenProps {
  width?: number;
  height?: number;
  seed?: number;
  trend?: "up" | "down" | "flat";
  /** Narasi waypoint harga ternormalisasi (1 = tinggi) — override trend. */
  path?: number[];
  steps?: TerminalStep[];
  symbol?: string;
  tf?: string;
  /** Tunda mulai (frame) — biar entrance scene selesai dulu. */
  delay?: number;
  /** Full-bleed: tanpa kartu/border/shadow — chart jadi SELURUH LAYAR
   *  (gaya reel @inzaghitrades, arahan Bos "bukan teks aja"). */
  fullBleed?: boolean;
  /** Durasi scene (frame) — dipakai menyebar timing langkah gambar. */
  durationInFrames?: number;
}

const STEP_COLOR: Record<string, string> = {
  green: C.green,
  red: C.red,
  cyan: C.accent,
  amber: "#FBBF24",
};

const defaultColor = (t: string): string => {
  if (t === "high") return STEP_COLOR.red;
  if (t === "low") return STEP_COLOR.green;
  if (t === "level") return STEP_COLOR.amber;
  return STEP_COLOR.cyan;
};

/* ---------------- timing langkah gambar ---------------- */

const SETTLE = 20; // candle "terbentuk" dulu sampai frame ini
const DRAW_FRAMES = 16; // durasi draw-in per langkah

export const stepTiming = (
  nSteps: number,
  durationInFrames = 170,
): { gap: number } => {
  const n = Math.max(1, Math.min(6, nSteps));
  const avail = Math.max(60, durationInFrames - SETTLE - 18);
  return { gap: Math.max(18, Math.floor(avail / n)) };
};

/** Langkah aktif saat ini (untuk chip "LANGKAH n/m" sinkron VO). */
export const activeStepIndex = (
  nSteps: number,
  frame: number,
  durationInFrames = 170,
): number => {
  if (nSteps <= 0) return -1;
  const { gap } = stepTiming(nSteps, durationInFrames);
  const i = Math.floor((frame - SETTLE) / gap);
  return Math.min(nSteps - 1, Math.max(0, i));
};

/* ---------------- layout konstanta ---------------- */

const TOP_BAR = 84;
const RAIL = 58;
const AXIS_W = 118;
const TIME_H = 50;
const BASE_PRICE = 3652;
const TFS = ["M15", "H1", "H4", "D1"];
const TIME_LABELS = ["09:00", "11:00", "13:00", "15:00", "17:00"];

/* ═══ STYLE TRADINGVIEW (arahan Bos: "candle dibikin kaya tradingview")
   Dark theme TradingView asli: bg #131722, grid #1e222d, candle
   up #26a69a / down #ef5350, axis text #b2b5be, chip harga live
   berwarna di axis kanan. */
const TV_BG = "#131722";
const TV_GRID = "#1e222d";
const TV_UP = "#26a69a";
const TV_DOWN = "#ef5350";
const TV_AXIS = "rgba(178,181,190,0.85)";
const TV_MUTED = "rgba(178,181,190,0.6)";

/* ---------------- ikon toolbar kiri ---------------- */

const RailIcon: React.FC<{ kind: string; active: boolean }> = ({
  kind,
  active,
}) => {
  const stroke = active ? "#04121a" : "rgba(255,255,255,0.55)";
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: active ? C.accent : "transparent",
      }}
    >
      <svg
        width={22}
        height={22}
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {kind === "cursor" && <path d="M5 3l14 8-6 2-3 7z" />}
        {kind === "trend" && (
          <>
            <line x1="4" y1="20" x2="20" y2="4" />
            <circle cx="4" cy="20" r="1.6" fill={stroke} />
            <circle cx="20" cy="4" r="1.6" fill={stroke} />
          </>
        )}
        {kind === "fib" && (
          <>
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" strokeDasharray="3 2" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </>
        )}
        {kind === "zone" && <rect x="4" y="7" width="16" height="10" rx="1.5" />}
        {kind === "text" && <path d="M5 5h14M12 5v14" />}
        {kind === "ruler" && <path d="M3 17L17 3l4 4L7 21z" />}
      </svg>
    </div>
  );
};

/* ---------------- chip kecil (label / axis) ---------------- */

const Chip: React.FC<{
  x: number;
  y: number;
  text: string;
  color: string;
  anchor?: "start" | "middle" | "end";
}> = ({ x, y, text, color, anchor = "middle" }) => {
  const w = Math.max(64, text.length * 13 + 24);
  const h = 34;
  const cx = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
  return (
    <g>
      <rect
        x={cx}
        y={y - h / 2}
        width={w}
        height={h}
        rx={9}
        fill="rgba(4,10,16,0.92)"
        stroke={color}
        strokeWidth={1.6}
      />
      <text
        x={cx + w / 2}
        y={y + 6}
        textAnchor="middle"
        fill={color}
        fontSize={19}
        fontWeight={800}
        fontFamily="Manrope, DejaVu Sans, sans-serif"
      >
        {text}
      </text>
    </g>
  );
};

/* ============================================================
   Komponen utama
   ============================================================ */

export const ChartScreen: React.FC<ChartScreenProps> = ({
  width = 920,
  height = 1200,
  seed = 11,
  trend = "flat",
  path,
  steps = [],
  symbol = "XAUUSD",
  tf = "H1",
  delay = 10,
  fullBleed = false,
  durationInFrames = 170,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);

  const nCandles = 34;
  const candles = React.useMemo(
    () => genCandles(seed, trend, nCandles, path),
    [seed, trend, nCandles, path],
  );

  /* ---- area plot ---- */
  const plotX = RAIL + 14;
  const plotY = TOP_BAR + 16;
  const plotW = width - RAIL - AXIS_W - 28;
  const plotH = height - TOP_BAR - TIME_H - 34;

  const px = (nx: number) => plotX + clamp01(nx) * plotW;
  const py = (ny: number) => plotY + (1 - clamp01(ny)) * plotH;
  const cy = (v: number) => plotY + (1 - v) * plotH; // candle normalized

  const step = plotW / nCandles;
  const bw = Math.max(7, step * 0.5);

  /* ---- harga "asli" dari candle ternormalisasi ---- */
  const toPrice = (v: number) => BASE_PRICE + (v - 0.5) * 64;
  const last = candles[candles.length - 1];
  const first = candles[0];
  const priceTarget = toPrice(last.c);
  const priceP = interpolate(f, [0, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const priceShown = toPrice(first.o) + (priceTarget - toPrice(first.o)) * priceP;
  const isUp = last.c >= last.o;
  const chgPct = (last.c - first.o) * 8;

  /* ---- timing langkah ---- */
  const list = steps.slice(0, 6);
  const n = list.length;
  const { gap } = stepTiming(n, durationInFrames);

  /* alat aktif di toolbar — cermin langkah yang dipakai */
  const types = list.map((s) => String(s.t || ""));
  const activeTool = types.includes("level")
    ? "fib"
    : types.includes("zone")
      ? "zone"
      : types.includes("path")
        ? "trend"
        : types.includes("high") || types.includes("low")
          ? "cursor"
          : "cursor";

  const gridRows = [0.2, 0.4, 0.6, 0.8];

  return (
    <div
      style={{
        width,
        height,
        borderRadius: fullBleed ? 0 : 26,
        background: TV_BG,
        border: fullBleed ? "none" : "1px solid rgba(148,163,184,0.18)",
        boxShadow: fullBleed ? "none" : "0 30px 90px rgba(0,0,0,0.55)",
        overflow: "hidden",
        position: "relative",
        fontFamily: FONT,
      }}
    >
      {/* ═══ TOP BAR — identitas platform ═══ */}
      <div
        style={{
          height: TOP_BAR,
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "0 22px",
          borderBottom: "1px solid rgba(148,163,184,0.14)",
          background: "rgba(255,255,255,0.025)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: C.green,
              boxShadow: "0 0 10px rgba(52,211,153,0.8)",
            }}
          />
          <span style={{ fontWeight: 800, fontSize: 27, color: C.white, letterSpacing: 1 }}>
            {symbol}
          </span>
        </div>
        <span
          style={{
            fontWeight: 800,
            fontSize: 34,
            color: isUp ? C.green : C.red,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmtNum(priceShown, 2)}
        </span>
        <span
          style={{
            padding: "4px 12px",
            borderRadius: 8,
            background: isUp ? "rgba(52,211,153,0.14)" : "rgba(248,113,113,0.14)",
            color: isUp ? C.green : C.red,
            fontWeight: 800,
            fontSize: 19,
          }}
        >
          {chgPct >= 0 ? "+" : ""}
          {chgPct.toFixed(2)}%
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {TFS.map((t) => (
            <div
              key={t}
              style={{
                padding: "7px 14px",
                borderRadius: 9,
                fontSize: 18,
                fontWeight: 800,
                color: t === tf ? "#04121a" : "rgba(255,255,255,0.6)",
                background: t === tf ? C.accent : "rgba(255,255,255,0.06)",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ BODY: rail kiri + chart + axis ═══ */}
      <div style={{ display: "flex", height: height - TOP_BAR }}>
        {/* tool rail */}
        <div
          style={{
            width: RAIL,
            padding: "14px 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            borderRight: "1px solid rgba(148,163,184,0.12)",
          }}
        >
          {["cursor", "trend", "fib", "zone", "text", "ruler"].map((k) => (
            <RailIcon key={k} kind={k} active={k === activeTool} />
          ))}
        </div>

        {/* chart + axes */}
        <div style={{ position: "relative", flex: 1 }}>
          <svg
            width={width - RAIL}
            height={height - TOP_BAR}
            viewBox={`0 0 ${width - RAIL} ${height - TOP_BAR}`}
            style={{ display: "block" }}
          >
            <defs>
              <clipPath id="plotclip">
                <rect x={plotX} y={plotY - 8} width={plotW} height={plotH + 16} />
              </clipPath>
            </defs>

            {/* watermark */}
            <text
              x={plotX + plotW / 2}
              y={plotY + plotH / 2}
              textAnchor="middle"
              fill="rgba(255,255,255,0.05)"
              fontSize={58}
              fontWeight={900}
              fontFamily="Manrope, DejaVu Sans, sans-serif"
              letterSpacing={8}
            >
              LUXTRADE
            </text>

            {/* grid gaya TradingView — warna solid #1e222d */}
            {gridRows.map((g) => (
              <line
                key={g}
                x1={plotX}
                x2={plotX + plotW}
                y1={plotY + g * plotH}
                y2={plotY + g * plotH}
                stroke={TV_GRID}
                strokeWidth={1}
              />
            ))}
            {[6, 12, 18, 24].map((i) => (
              <line
                key={i}
                x1={plotX + i * step}
                x2={plotX + i * step}
                y1={plotY}
                y2={plotY + plotH}
                stroke={TV_GRID}
                strokeWidth={1}
              />
            ))}

            {/* axis harga kanan — abu TV #b2b5be */}
            {[0.08, 0.29, 0.5, 0.71, 0.92].map((v) => (
              <text
                key={v}
                x={plotX + plotW + 10}
                y={py(v) + 6}
                fill={TV_AXIS}
                fontSize={16}
                fontWeight={600}
                fontFamily="Manrope, DejaVu Sans, sans-serif"
              >
                {fmtNum(toPrice(v), 1)}
              </text>
            ))}

            {/* ═══ chip harga live di axis kanan — persis TradingView ═══ */}
            <rect
              x={plotX + plotW + 2}
              y={cy(last.c) - 15}
              width={70}
              height={30}
              rx={4}
              fill={last.c >= last.o ? TV_UP : TV_DOWN}
              opacity={priceP}
            />
            <text
              x={plotX + plotW + 2 + 35}
              y={cy(last.c) + 6}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize={15}
              fontWeight={800}
              fontFamily="Manrope, DejaVu Sans, sans-serif"
              opacity={priceP}
            >
              {fmtNum(priceShown, 2)}
            </text>

            {/* label waktu bawah */}
            {TIME_LABELS.map((t, i) => (
              <text
                key={t}
                x={plotX + plotW * (0.08 + i * 0.21)}
                y={plotY + plotH + 34}
                fill={TV_MUTED}
                fontSize={17}
                fontWeight={600}
                fontFamily="Manrope, DejaVu Sans, sans-serif"
              >
                {t}
              </text>
            ))}

            {/* ═══ candle gaya TradingView: wick tegas 2px, body solid tajam ═══ */}
            {candles.map((cd, i) => {
              const appear = spring({
                fps,
                frame: Math.max(0, f - 2 - i * 1.2),
                config: { damping: 14, stiffness: 180 },
              });
              const xMid = plotX + step * (i + 0.5);
              const up = cd.c >= cd.o;
              const color = up ? TV_UP : TV_DOWN;
              const bodyTop = cy(Math.max(cd.o, cd.c));
              const bodyH = Math.max(3, Math.abs(cy(cd.o) - cy(cd.c)));
              return (
                <g
                  key={i}
                  opacity={clamp01(appear)}
                  transform={`translate(${xMid} ${cy(cd.c)}) scale(${clamp01(appear)}) translate(${-xMid} ${-cy(cd.c)})`}
                >
                  {/* wick 2px full-opacity, tanpa rounded cap — TradingView */}
                  <line
                    x1={xMid}
                    x2={xMid}
                    y1={cy(cd.h)}
                    y2={cy(cd.l)}
                    stroke={color}
                    strokeWidth={2}
                    opacity={1}
                  />
                  {/* body solid sudut tajam, tanpa glow */}
                  <rect
                    x={xMid - bw / 2}
                    y={bodyTop}
                    width={bw}
                    height={bodyH}
                    rx={0}
                    fill={color}
                    opacity={1}
                  />
                </g>
              );
            })}

            {/* ═══ LANGKAH GAMBAR — muncul berurutan sinkron VO ═══ */}
            <g clipPath="url(#plotclip)">
              {list.map((s, i) => {
                const t = String(s.t || "label");
                const color = STEP_COLOR[String(s.color || "")] || defaultColor(t);
                const start = SETTLE + i * gap;
                const p = clamp01(
                  interpolate(f, [start, start + DRAW_FRAMES], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.16, 1, 0.3, 1),
                  }),
                );
                if (f < start || p <= 0) return null;
                const label = String(s.label || "").slice(0, 14);
                const y1v = clamp01(typeof s.y1 === "number" ? s.y1 : 0.6);
                const y2v = clamp01(typeof s.y2 === "number" ? s.y2 : 0.3);
                const x1v = clamp01(typeof s.x1 === "number" ? s.x1 : 0.3);
                const x2v = clamp01(typeof s.x2 === "number" ? s.x2 : 0.7);

                /* ---- high / low : garis swing + penanda candle ---- */
                if (t === "high" || t === "low") {
                  const key = t === "high" ? "h" : "l";
                  let best = 0;
                  let bestD = 9;
                  candles.forEach((cd, ci) => {
                    const d = Math.abs(cd[key as "h" | "l"] - y1v);
                    if (d < bestD) {
                      bestD = d;
                      best = ci;
                    }
                  });
                  const mx = plotX + step * (best + 0.5);
                  const myT = t === "high" ? cy(candles[best].h) : cy(candles[best].l);
                  const yLine = py(y1v);
                  return (
                    <g key={i} opacity={0.95}>
                      <line
                        x1={plotX}
                        x2={plotX + plotW * p}
                        y1={yLine}
                        y2={yLine}
                        stroke={color}
                        strokeWidth={2.6}
                        strokeDasharray="12 8"
                        opacity={0.85}
                      />
                      <g opacity={clamp01(interpolate(f, [start + 4, start + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))}>
                        <path
                          d={
                            t === "high"
                              ? `M ${mx} ${myT - 14} l -9 14 l 18 0 z`
                              : `M ${mx} ${myT + 14} l -9 -14 l 18 0 z`
                          }
                          fill={color}
                          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
                        />
                      </g>
                      <Chip
                        x={Math.min(plotX + plotW * p - 8, plotX + plotW - 78)}
                        y={yLine - 24}
                        text={label || (t === "high" ? "HIGH" : "LOW")}
                        color={color}
                      />
                    </g>
                  );
                }

                /* ---- zone : kotak supply/demand/OB/FVG ---- */
                if (t === "zone") {
                  const yTop = py(Math.max(y1v, y2v));
                  const yBot = py(Math.min(y1v, y2v));
                  const xL = px(Math.min(x1v, x2v));
                  const xR = px(Math.max(x1v, x2v));
                  const w = (xR - xL) * p;
                  return (
                    <g key={i}>
                      <rect
                        x={xL}
                        y={yTop}
                        width={Math.max(4, w)}
                        height={yBot - yTop}
                        fill={color}
                        opacity={0.13}
                      />
                      <rect
                        x={xL}
                        y={yTop}
                        width={Math.max(4, w)}
                        height={yBot - yTop}
                        fill="none"
                        stroke={color}
                        strokeWidth={2}
                        rx={6}
                        opacity={0.85}
                      />
                      {label && (
                        <Chip x={xL + 12} y={yTop - 22} text={label} color={color} anchor="start" />
                      )}
                    </g>
                  );
                }

                /* ---- level : garis proyeksi target (fib/SD) ---- */
                if (t === "level") {
                  const yLine = py(y1v);
                  return (
                    <g key={i}>
                      <line
                        x1={plotX}
                        x2={plotX + plotW * p}
                        y1={yLine}
                        y2={yLine}
                        stroke={color}
                        strokeWidth={2.4}
                        strokeDasharray="16 10"
                        opacity={0.9}
                      />
                      <rect
                        x={plotX + plotW + 8}
                        y={yLine - 15}
                        width={AXIS_W - 22}
                        height={30}
                        rx={7}
                        fill={color}
                        opacity={clamp01(interpolate(f, [start + 6, start + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))}
                      />
                      <text
                        x={plotX + plotW + 8 + (AXIS_W - 22) / 2}
                        y={yLine + 6}
                        textAnchor="middle"
                        fill="#04121a"
                        fontSize={17}
                        fontWeight={800}
                        fontFamily="Manrope, DejaVu Sans, sans-serif"
                        opacity={clamp01(interpolate(f, [start + 6, start + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))}
                      >
                        {fmtNum(toPrice(y1v), 2)}
                      </text>
                      {label && <Chip x={plotX + 16} y={yLine - 24} text={label} color={color} anchor="start" />}
                    </g>
                  );
                }

                /* ---- path : skenario pergerakan harga (panah) ---- */
                if (t === "path") {
                  const ax = px(x1v);
                  const ay = py(y1v);
                  const bx = px(x2v);
                  const by = py(y2v);
                  const mxp = (ax + bx) / 2;
                  const myp = (ay + by) / 2 + (bx - ax) * 0.12;
                  /* panjang kasar kurva Q utk dash reveal */
                  const approx = Math.hypot(bx - ax, by - ay) * 1.25;
                  const dash = approx * p;
                  const angle = Math.atan2(by - myp, bx - mxp);
                  const arrow = 16;
                  return (
                    <g key={i}>
                      <path
                        d={`M ${ax} ${ay} Q ${mxp} ${myp} ${bx} ${by}`}
                        fill="none"
                        stroke={color}
                        strokeWidth={4}
                        strokeLinecap="round"
                        strokeDasharray={`${dash} ${approx + 20}`}
                        style={{ filter: `drop-shadow(0 0 10px ${color})` }}
                      />
                      {p > 0.85 && (
                        <path
                          d={`M ${bx} ${by} l ${-arrow * Math.cos(angle - 0.45)} ${-arrow * Math.sin(angle - 0.45)} M ${bx} ${by} l ${-arrow * Math.cos(angle + 0.45)} ${-arrow * Math.sin(angle + 0.45)}`}
                          stroke={color}
                          strokeWidth={4}
                          strokeLinecap="round"
                        />
                      )}
                      {label && (
                        <Chip x={(ax + bx) / 2} y={(ay + by) / 2 - 34} text={label} color={color} />
                      )}
                    </g>
                  );
                }

                /* ---- circle : highlight area (liquidity/sweep) ---- */
                if (t === "circle") {
                  const cxp = px(x1v);
                  const cyp = py(y1v);
                  const total = 2 * (2 * 100 + 2 * 64);
                  return (
                    <g key={i}>
                      <ellipse
                        cx={cxp}
                        cy={cyp}
                        rx={100}
                        ry={64}
                        fill={color}
                        opacity={0.08}
                      />
                      <ellipse
                        cx={cxp}
                        cy={cyp}
                        rx={100}
                        ry={64}
                        fill="none"
                        stroke={color}
                        strokeWidth={3}
                        strokeDasharray={`${total * p} ${total + 20}`}
                        style={{ filter: `drop-shadow(0 0 10px ${color})` }}
                      />
                      {label && <Chip x={cxp} y={cyp - 82} text={label} color={color} />}
                    </g>
                  );
                }

                /* ---- label : chip teks + titik penunjuk ---- */
                const lxp = px(x1v);
                const lyp = py(y1v);
                const popIn = spring({
                  fps,
                  frame: Math.max(0, f - start - 2),
                  config: { damping: 13, stiffness: 200 },
                });
                return (
                  <g key={i} opacity={clamp01(popIn)} transform={`translate(${lxp} ${lyp}) scale(${0.6 + 0.4 * clamp01(popIn)})`}>
                    <circle cx={0} cy={0} r={7} fill={color} style={{ filter: `drop-shadow(0 0 10px ${color})` }} />
                    <g transform={`translate(18 -34)`}>
                      <Chip x={0} y={0} text={label || "CATATAN"} color={color} anchor="start" />
                    </g>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
};
