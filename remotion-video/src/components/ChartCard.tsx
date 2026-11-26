import React from "react";
import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fmtNum, genCandles } from "./Chart";
import { Stickman, type StickmanPose } from "./Stickman";
import { clamp01 } from "./Ui";

/* ============================================================
   ChartCard — kartu chart gaya reel referensi Bos (DfeAm-wPf3k)
   ============================================================
   Formulanya:
   - kartu rounded dgn border teal tipis di atas bg hitam
   - header: "● XAUUSD · 1 JAM" kiri + "DATA ILUSTRASI" amber kanan
   - candle CHUNKY (sedikit, tebal) warna TradingView
   - harga axis kanan halus + chip harga live
   - alat gambar data-driven (high/zone/level/path/circle)
   - Stickman riding candle (opsional) — kunci personalitas reel

   Mode:
   - default : candle pop berurutan + langkah gambar (steps)
   - hook    : candle streaming + garis ENTRY/SL + deteksi crash */

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
  /** level: gambar juga chip label di KIRI garis (utk mode analisa
   *  yang di-zoom — chip axis kanan bisa keluar frame). */
  showLeftTag?: boolean;
}

/* ---- warna gaya TradingView (arahan Bos: candle kaya TradingView) ---- */
const UP = "#26a69a";
const DOWN = "#ef5350";
const GRID = "rgba(255,255,255,0.05)";
const AXIS = "rgba(178,181,190,0.75)";
const MUTED = "rgba(178,181,190,0.55)";
const CARD_BG = "linear-gradient(180deg, #0C1613 0%, #0A1210 100%)";
const BORDER = "rgba(45,212,191,0.5)";
const AMBER = "#F5B942";

const STEP_COLOR: Record<string, string> = {
  green: "#34D399",
  red: "#F87171",
  cyan: "#22D3EE",
  amber: AMBER,
};

const defaultColor = (t: string): string => {
  if (t === "high") return STEP_COLOR.red;
  if (t === "low") return STEP_COLOR.green;
  if (t === "level") return STEP_COLOR.amber;
  return STEP_COLOR.cyan;
};

/* ---------------- timing langkah gambar ---------------- */

export const CARD_SETTLE = 30; /* Bos: pace lebih santai */
const DRAW_FRAMES = 28; /* draw lebih pelan (16 terlalu cepat) */

export const cardStepTiming = (nSteps: number, durationInFrames: number) => {
  const n = Math.max(1, Math.min(6, nSteps));
  const avail = Math.max(60, durationInFrames - CARD_SETTLE - 24);
  return { gap: Math.max(20, Math.floor(avail / n)) };
};

/** index langkah aktif (sinkron VO — dipakai juga untuk step pills) */
export const activeCardStep = (
  nSteps: number,
  frame: number,
  durationInFrames: number,
): number => {
  if (nSteps <= 0) return -1;
  const { gap } = cardStepTiming(nSteps, durationInFrames);
  const i = Math.floor((frame - CARD_SETTLE) / gap);
  return Math.min(nSteps - 1, Math.max(0, i));
};

/* ---------------- MODE ANALISA (Bos 28-11) ----------------
   "dizoom area entry kasih detail kenapa entry disitu, candle
   berhenti saat dikasi penjelasan":
   1. candle streaming satu-per-satu (pace hook) sampai candle pauseAt
   2. candle BERHENTI (freeze — tanpa candle baru, tanpa tick)
   3. kamera ZOOM ke area entry + callout detail muncul berurutan
   4. zoom-out → streaming lanjut ke sasaran + langkah `after` */

export interface AnalyzeSpec {
  /** index candle tempat streaming BERHENTI (0-based). */
  pauseAt: number;
  /** durasi jeda analisa (frame). Default 300 (10 dtk @30fps). */
  pauseFrames?: number;
  /** area yang di-zoom — koordinat plot ternormalisasi (x waktu,
   *  y harga; 1 = atas). */
  zoom?: { x1: number; y1: number; x2: number; y2: number };
  /** faktor zoom kamera. Default 1.65. */
  zoomScale?: number;
  /** callout detail kenapa entry di situ — muncul berurutan saat jeda. */
  details?: TerminalStep[];
  /** langkah gambar SETELAH jeda (mis. proyeksi sasaran). */
  after?: TerminalStep[];
  /** teks badge jeda. Default "ANALISA". */
  pauseLabel?: string;
}

/* konstanta timing analisa — ChartCard & CardStepsScene harus sama */
export const ANZ_STREAM_START = 8;
export const ANZ_STREAM_IV = 5;
const ANZ_ZOOM_IN_DELAY = 8;
const ANZ_ZOOM_FRAMES = 36;
const ANZ_DETAIL_TAIL = 46; /* ruang sebelum zoom-out dimulai */

export const analyzeTiming = (a: AnalyzeSpec) => {
  const freezeF = ANZ_STREAM_START + Math.max(0, a.pauseAt) * ANZ_STREAM_IV;
  const pauseDur = a.pauseFrames ?? 300;
  const pauseEnd = freezeF + pauseDur;
  const zoomDone = freezeF + ANZ_ZOOM_IN_DELAY + ANZ_ZOOM_FRAMES;
  const detailStart = zoomDone + 10;
  const details = (a.details || []).slice(0, 5);
  const detailAvail = Math.max(60, pauseEnd - ANZ_DETAIL_TAIL - detailStart);
  const detailGap = Math.max(30, Math.floor(detailAvail / Math.max(1, details.length)));
  const afterStart = pauseEnd + 40;
  const after = (a.after || []).slice(0, 3);
  const afterGap = Math.max(30, Math.floor(Math.max(40, 160 / Math.max(1, after.length))));
  return { freezeF, pauseDur, pauseEnd, zoomDone, detailStart, details, detailGap, afterStart, after, afterGap };
};

/** index langkah aktif mode analisa (details dulu, lalu after) — sinkron VO. */
export const analyzeActive = (
  a: AnalyzeSpec | undefined,
  frame: number,
): number => {
  if (!a) return -1;
  const t = analyzeTiming(a);
  if (frame < t.pauseEnd) {
    const i = Math.floor((frame - t.detailStart) / t.detailGap);
    return Math.min(Math.max(0, t.details.length - 1), Math.max(0, i));
  }
  const j = Math.floor((frame - t.afterStart) / t.afterGap);
  return t.details.length + Math.min(Math.max(0, t.after.length - 1), Math.max(0, j));
};

/* ---- chip kecil gaya reel ---- */

const Tag: React.FC<{
  x: number;
  y: number;
  text: string;
  color: string;
  anchor?: "start" | "middle" | "end";
}> = ({ x, y, text, color, anchor = "middle" }) => {
  const w = Math.max(66, text.length * 14 + 26);
  const h = 38;
  const cx = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
  return (
    <g>
      <rect
        x={cx}
        y={y - h / 2}
        width={w}
        height={h}
        rx={10}
        fill="rgba(5,12,10,0.92)"
        stroke={color}
        strokeWidth={1.8}
      />
      <text
        x={cx + w / 2}
        y={y + 7}
        textAnchor="middle"
        fill={color}
        fontSize={20}
        fontWeight={800}
        fontFamily="'Manrope', 'DejaVu Sans', sans-serif"
      >
        {text}
      </text>
    </g>
  );
};

/* ============================================================
   komponen utama
   ============================================================ */

export interface ChartCardProps {
  width?: number;
  height?: number;
  seed?: number;
  path?: number[];
  steps?: TerminalStep[];
  durationInFrames?: number;
  symbol?: string;
  tf?: string;
  /** mode hook: streaming + ENTRY/SL + crash */
  hook?: boolean;
  /** cerita loss (FOMO): stickman tetap shock setelah crash, bukan celebrate */
  hookLoss?: boolean;
  /** SL normalisasi utk mode hook */
  slY?: number;
  /** entry normalisasi utk mode hook */
  entryY?: number;
  /** Stickman: pose per langkah (steps mode) */
  stickPoses?: StickmanPose[];
  /** Stickman pose manuaal (hook mode diatur internal) */
  delay?: number;
  /** MODE ANALISA (Bos 28-11): streaming → candle berhenti → zoom
   *  area entry → detail kenapa entry → lanjut ke sasaran. */
  analyze?: AnalyzeSpec;
}

const BASE_PRICE = 3650;
const toPrice = (v: number) => BASE_PRICE + (v - 0.5) * 60;

/* Lama 1 candle tumbuh penuh (frame) — Bos 26-11 v6 "gerakan candle kurang
   smooth": candle bukan lagi POP diskrit, tapi TUMBUH kontinu dari open
   (= close candle sebelumnya) ke bentuk final. Crash SL tercapai kira-kira
   60% progres pertumbuhan candle → dipakai buat sinkronisasi stamp. */
export const CANDLE_GROW = 14;

export const hookCrashFrame = (nCandles: number, slY: number, seed: number, path: number[], revealStart: number, revealIv: number): number => {
  const cs = genCandles(seed, "flat", nCandles, path);
  const idx = Math.max(3, cs.findIndex((cd) => cd.l < slY - 0.02));
  return Math.round(revealStart + idx * revealIv + CANDLE_GROW * 0.6);
};

export const ChartCard: React.FC<ChartCardProps> = ({
  width = 968,
  height = 1100,
  seed = 11,
  path,
  steps = [],
  durationInFrames = 200,
  symbol = "XAUUSD",
  tf = "1 JAM",
  hook = false,
  hookLoss = false,
  slY = 0.3,
  entryY = 0.55,
  stickPoses,
  delay = 0,
  analyze,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);

  const N = hook ? 20 : 20;
  const candles = React.useMemo(
    () => genCandles(seed, "flat", N, path),
    [seed, N, path],
  );

  /* ---- layout dalam kartu (DI ATAS — dipakai timing & zoom) ---- */
  const headH = 66;
  const padX = 44;
  const axisW = 96;
  const timeH = 54;
  const plotX = padX;
  const plotY = headH + 34;
  const plotW = width - padX - axisW - 16;
  const plotH = height - plotY - timeH - 26;

  const px = (nx: number) => plotX + clamp01(nx) * plotW;
  const py = (ny: number) => plotY + (1 - clamp01(ny)) * plotH;
  const cy = (v: number) => plotY + (1 - v) * plotH;

  const step = plotW / N;
  const bw = Math.min(30, step * 0.56);

  /* ---- timing MODE ANALISA ---- */
  const anz = analyze ? analyzeTiming(analyze) : null;
  const anzP = anz ? Math.max(0, Math.min(N - 2, analyze!.pauseAt)) : 0;
  /* revealF = jam efektif streaming: beku saat jeda, geser setelahnya */
  const revealF = anz
    ? f <= anz.freezeF
      ? f
      : f < anz.pauseEnd
        ? anz.freezeF
        : anz.freezeF + (f - anz.pauseEnd)
    : f;
  /* frame pertumbuhan candle i di mode analisa: candle <= pauseAt
     tumbuh dgn jam ASLI lalu beku di bentuk final (candle pauseAt
     selesai membentuk dirinya saat kamera mulai zoom — "candle
     berhenti"); candle > pauseAt baru tumbuh setelah jeda, dgn jam
     yang digeser sebesar durasi jeda. */
  const anzGrowF = (i: number): number => {
    if (!anz) return f;
    const t0 = ANZ_STREAM_START + i * ANZ_STREAM_IV;
    if (i <= anzP) return Math.min(f, t0 + CANDLE_GROW);
    return Math.min(revealF, t0 + CANDLE_GROW);
  };

  /* ---- kamera zoom (mode analisa) ---- */
  const zoomIn = anz
    ? clamp01(
        interpolate(
          f,
          [anz.freezeF + ANZ_ZOOM_IN_DELAY, anz.freezeF + ANZ_ZOOM_IN_DELAY + ANZ_ZOOM_FRAMES],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) },
        ),
      )
    : 0;
  const zoomOut = anz
    ? clamp01(
        interpolate(f, [anz.pauseEnd - 44, anz.pauseEnd], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.cubic),
        }),
      )
    : 1;
  const zoomP = anz ? zoomIn * (1 - zoomOut) : 0;
  const zScale = 1 + ((analyze?.zoomScale ?? 1.65) - 1) * zoomP;
  const zr = analyze?.zoom;
  const zox = zr ? plotX + (zr.x1 + zr.x2) * 0.5 * plotW : width / 2;
  const zoy = zr ? plotY + (1 - (zr.y1 + zr.y2) * 0.5) * plotH : height / 2;

  /* ---- mode hook: streaming reveal ---- */
  const REVEAL_START = 6;
  const REVEAL_IV = 5; /* streaming candle lebih lambat (Bos) */
  const revealed = hook
    ? Math.min(N, Math.max(1, Math.floor((f - REVEAL_START) / REVEAL_IV) + 1))
    : anz
      ? Math.min(anzP + 1, Math.max(1, Math.floor((revealF - ANZ_STREAM_START) / ANZ_STREAM_IV) + 1))
      : N;

  const lastIdx = revealed - 1;
  const last = candles[lastIdx];
  const priceP = interpolate(f, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  /* crash event (hook) — sinkron dgn momen low candle menembus SL
     (±60% progres pertumbuhan candle, lihat CANDLE_GROW) */
  const crashIdx = Math.max(
    3,
    candles.findIndex((cd) => cd.l < slY - 0.02),
  );
  const crashFrame = Math.round(REVEAL_START + crashIdx * REVEAL_IV + CANDLE_GROW * 0.6);
  const sinceCrash = f - crashFrame;
  const flash =
    hook && sinceCrash >= 0
      ? interpolate(f, [crashFrame, crashFrame + 5, crashFrame + 16], [0, 0.42, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const shakeAmp =
    hook && sinceCrash >= 0 && sinceCrash <= 18 ? 14 * (1 - sinceCrash / 18) : 0;
  const shakeX = shakeAmp * Math.sin(sinceCrash * 2.6);
  const shakeY = shakeAmp * Math.cos(sinceCrash * 3.1) * 0.6;
  const slBroken = hook && lastIdx >= crashIdx;
  const RECOVER_AT = crashFrame + 62; /* beri jeda baca 'SL KENA' ±2 dtk (Bos: jgn kecepetan) */
  const recovered = hook && f >= RECOVER_AT;

  /* ---- candle tumbuh kontinu (Bos: gerakan candle kurang smooth) ----
     Setiap candle TUMBUH dari open ke bentuk final selama CANDLE_GROW
     frame (easing sinus), bukan muncul sekaligus. Candle live (paling
     baru) tetap ber-tick mikro tiap frame dan tick memudar mulus saat
     candle berikutnya muncul — chart selalu ada gerakan tiap frame,
     persis candle live TradingView. */
  const candleT0 = (i: number) =>
    hook ? REVEAL_START + i * REVEAL_IV : anz ? ANZ_STREAM_START + i * ANZ_STREAM_IV : 6 + i * 2.4;
  const growP = (i: number) => {
    const gf = anz ? anzGrowF(i) : f;
    const t0 = candleT0(i);
    return clamp01(
      interpolate(gf, [t0, t0 + CANDLE_GROW], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.sin),
      }),
    );
  };
  /* amplitude tick candle i: 1 selama jadi candle live, memudar 8 frame
     setelah candle berikutnya mulai (tanpa lompatan).
     MODE ANALISA: tick = 0 selama jeda — candle BENAR-BENAR berhenti
     saat VO kasih penjelasan (Bos 28-11); nyala lagi setelah jeda. */
  const tickAmp = (i: number) => {
    if (anz) {
      const end = ANZ_STREAM_START + (i + 1) * ANZ_STREAM_IV;
      if (i === anzP) {
        if (f < anz.freezeF) return 1;
        if (f < anz.pauseEnd) return 0; /* BERHENTI */
        return clamp01(interpolate(revealF, [end, end + 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
      }
      if (i > anzP) {
        return clamp01(interpolate(revealF, [end, end + 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
      }
      return clamp01(interpolate(revealF, [end, end + 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
    }
    if (i >= N - 1) return 1;
    const end = candleT0(i + 1);
    return clamp01(
      interpolate(f, [end, end + 8], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );
  };
  /* tick mikro candle i (px → ternormalisasi): dua sin beda frekuensi
     supaya terasa seperti tick pasar, bukan getaran mekanis */
  const tickN = (i: number) =>
    ((Math.sin(f * 0.95 + i * 2.13) * 5 + Math.sin(f * 1.7 + i * 1.31) * 3) * (1 - growP(i)) * tickAmp(i)) / plotH;

  /* close candle live saat ini — dipakai chip harga + stickman biar
     keduanya meluncur mulus mengikuti pertumbuhan candle */
  const lc = candles[lastIdx];
  const liveClose = lc.o + (lc.c - lc.o) * growP(lastIdx) + tickN(lastIdx);

  /* ---- mode steps: langkah gambar (mode analisa: details+after) ---- */
  const list = anz ? [] : (steps || []).slice(0, 6);
  const nSteps = list.length;
  const { gap } = cardStepTiming(nSteps, durationInFrames);
  const active = activeCardStep(nSteps, f, durationInFrames);

  /* ---- stickman ---- */
  let stickPose: StickmanPose | null = null;
  let stickX = 0;
  let stickFootY = 0;

  if (hook) {
    stickX = px(lastIdx / (N - 1));
    stickFootY = cy(liveClose) + 8; /* ikut candle yang sedang tumbuh */
    stickPose = recovered ? (hookLoss ? "shock" : "celebrate") : slBroken ? "shock" : f < 40 ? "idle" : "walk";
    // sebelum crash: bubble ? saat mulai, lalu idle; sesudah: celebrate
    if (!recovered && !slBroken && f < crashFrame) stickPose = f < 24 ? "idle" : "idle";
  } else if (anz) {
    /* mode analisa: jalan ikut candle live → berhenti + nunjuk saat
       jeda penjelasan → jalan lagi menuju sasaran setelah zoom-out. */
    stickX = px(lastIdx / (N - 1));
    stickFootY = cy(liveClose) + 8;
    stickPose =
      f < anz.freezeF
        ? "walk"
        : f < anz.pauseEnd
          ? "point"
          : f >= durationInFrames - 46
            ? "celebrate"
            : "walk";
  } else if (stickPoses && stickPoses.length > 0 && nSteps > 0) {
    const pose = stickPoses[Math.min(active, stickPoses.length - 1)];
    const s = list[Math.min(active, list.length - 1)];
    const targetX = px(clamp01(typeof s.x1 === "number" ? s.x1 : 0.5));
    const startF = CARD_SETTLE + active * gap;
    /* geser halus dari posisi langkah sebelumnya */
    const prevS = active > 0 ? list[active - 1] : null;
    const prevX = prevS ? px(clamp01(typeof prevS.x1 === "number" ? prevS.x1 : 0.5)) : targetX;
    const mv = clamp01(
      interpolate(f, [startF, startF + 24], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.quad),
      }),
    );
    stickX = prevX + (targetX - prevX) * mv;
    /* kaki di atas candle terdekat */
    const ci = Math.round(((stickX - plotX) / plotW) * (N - 1));
    stickFootY = cy(candles[Math.min(N - 1, Math.max(0, ci))].c) + 8;
    stickPose = pose;
  }

  /* kamera zoom juga memindahkan ruang stickman (dia di luar wrapper
     svg — koordinatnya dikonversi manual biar tetap di atas candle). */
  if (anz && zoomP > 0.001) {
    stickX = zox + (stickX - zox) * zScale;
    stickFootY = zoy + (stickFootY - zoy) * zScale;
  }

  const stickIn = clamp01(
    spring({ fps, frame: Math.max(0, f - 10), config: { damping: 16, stiffness: 130 } }),
  );

  const gridRows = [0.25, 0.5, 0.75];
  const timeLabels = ["09:00", "11:00", "13:00", "15:00", "17:00"];

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 42,
        background: CARD_BG,
        border: `2px solid ${BORDER}`,
        boxShadow:
          "0 34px 110px rgba(0,0,0,0.6), 0 0 60px rgba(45,212,191,0.08), inset 0 0 80px rgba(0,0,0,0.35)",
        overflow: "hidden",
        position: "relative",
        fontFamily: "'Manrope', 'DejaVu Sans', sans-serif",
        transform: `translate(${shakeX}px, ${shakeY}px)`,
      }}
    >
      {/* header kartu */}
      <div
        style={{
          height: headH,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 34px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 11,
              height: 11,
              borderRadius: 999,
              background: "#2DD4BF",
              boxShadow: "0 0 12px rgba(45,212,191,0.9)",
            }}
          />
          <span style={{ fontWeight: 800, fontSize: 26, color: "#FFFFFF", letterSpacing: 1 }}>
            {symbol} {tf}
          </span>
        </div>
        <span
          style={{
            fontWeight: 800,
            fontSize: 22,
            color: AMBER,
            letterSpacing: 3,
          }}
        >
          DATA ILUSTRASI
        </span>
      </div>

      {/* chart svg — dibungkus wrapper zoom kamera (mode analisa) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          transform: zScale > 1.001 ? `scale(${zScale})` : undefined,
          transformOrigin: `${zox}px ${zoy - headH}px`,
          zIndex: 1,
        }}
      >
      <svg
        width={width}
        height={height - headH}
        viewBox={`0 ${headH} ${width} ${height - headH}`}
        style={{ display: "block", position: "absolute", top: 0, left: 0 }}
      >
        <defs>
          <clipPath id={`cc-${seed}`}>
            <rect x={plotX - 6} y={plotY - 10} width={plotW + 12} height={plotH + 20} />
          </clipPath>
        </defs>

        {/* grid halus */}
        {gridRows.map((g) => (
          <line
            key={g}
            x1={plotX}
            x2={plotX + plotW}
            y1={plotY + g * plotH}
            y2={plotY + g * plotH}
            stroke={GRID}
            strokeWidth={1}
          />
        ))}
        {[5, 10, 15].map((i) => (
          <line
            key={i}
            x1={plotX + i * step}
            x2={plotX + i * step}
            y1={plotY}
            y2={plotY + plotH}
            stroke={GRID}
            strokeWidth={1}
          />
        ))}

        {/* axis harga kanan (halus) */}
        {[0.12, 0.37, 0.62, 0.87].map((v) => (
          <text
            key={v}
            x={plotX + plotW + 10}
            y={py(v) + 5}
            fill={AXIS}
            fontSize={16}
            fontWeight={600}
          >
            {fmtNum(toPrice(v), 1)}
          </text>
        ))}

        {/* label waktu bawah */}
        {timeLabels.map((t, i) => (
          <text
            key={t}
            x={plotX + plotW * (0.1 + i * 0.2)}
            y={plotY + plotH + 34}
            fill={MUTED}
            fontSize={16}
            fontWeight={600}
          >
            {t}
          </text>
        ))}

        {/* garis ENTRY & SL (mode hook) */}
        {hook && (
          <g>
            <line
              x1={plotX}
              x2={plotX + plotW}
              y1={py(entryY)}
              y2={py(entryY)}
              stroke="rgba(34,211,238,0.65)"
              strokeWidth={2}
              strokeDasharray="12 8"
            />
            <rect x={plotX + plotW + 4} y={py(entryY) - 17} width={88} height={34} rx={5} fill="#0891B2" opacity={clamp01(priceP)} />
            <text x={plotX + plotW + 48} y={py(entryY) + 7} textAnchor="middle" fill="#FFFFFF" fontSize={17} fontWeight={800} opacity={clamp01(priceP)}>
              ENTRY
            </text>
            <line
              x1={plotX}
              x2={plotX + plotW}
              y1={py(slY)}
              y2={py(slY)}
              stroke={slBroken ? DOWN : "rgba(239,83,80,0.7)"}
              strokeWidth={2}
              strokeDasharray="12 8"
              style={slBroken ? { filter: "drop-shadow(0 0 10px rgba(239,83,80,0.85))" } : undefined}
            />
            <rect x={plotX + plotW + 4} y={py(slY) - 17} width={88} height={34} rx={5} fill={slBroken ? "#B91C1C" : "#7F1D1D"} opacity={clamp01(priceP)} />
            <text x={plotX + plotW + 48} y={py(slY) + 7} textAnchor="middle" fill="#FFFFFF" fontSize={17} fontWeight={800} opacity={clamp01(priceP)}>
              {slBroken ? "SL ✕" : "SL"}
            </text>
          </g>
        )}

        {/* candle chunky — TUMBUH kontinu + tick live (lihat catatan atas) */}
        {candles.map((cd, i) => {
          const t0 = candleT0(i);
          if (f < t0 || i >= revealed) return null;
          const p = growP(i);
          const op = clamp01(
            interpolate(f, [t0, t0 + 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          );
          const tk = tickN(i);
          const oNow = cd.o;
          const cNow = cd.o + (cd.c - cd.o) * p + tk;
          const topN = Math.max(oNow, cNow);
          const botN = Math.min(oNow, cNow);
          /* wick menjulur keluar dari body seiring p → 1; tick selalu
             hanya memperpanjang wick (tidak pernah menembus body) */
          const hiN = Math.max(topN, topN + (cd.h - topN) * p + Math.abs(tk));
          const loN = Math.min(botN, botN - (botN - cd.l) * p - Math.abs(tk));
          const color = cd.c >= cd.o ? UP : DOWN;
          const xMid = plotX + step * (i + 0.5);
          const bodyTop = py(topN);
          const bodyBot = py(botN);
          return (
            <g key={i} opacity={op}>
              <line x1={xMid} x2={xMid} y1={cy(hiN)} y2={cy(loN)} stroke={color} strokeWidth={3} strokeLinecap="round" />
              <rect x={xMid - bw / 2} y={bodyTop} width={bw} height={Math.max(3, bodyBot - bodyTop)} fill={color} />
            </g>
          );
        })}

        {/* chip harga live — meluncur mengikuti pertumbuhan candle live */}
        <rect
          x={plotX + plotW + 4}
          y={py(liveClose) - 16}
          width={88}
          height={32}
          rx={5}
          fill={liveClose >= lc.o ? UP : DOWN}
          opacity={priceP}
        />
        <text
          x={plotX + plotW + 48}
          y={py(liveClose) + 6}
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize={16}
          fontWeight={800}
          opacity={priceP}
        >
          {fmtNum(toPrice(liveClose), 2)}
        </text>

        {/* ═══ langkah gambar — mode steps ATAU detail/after mode analisa ═══ */}
        {(() => {
          const groups: { s: TerminalStep; i: number; start: number }[] = [];
          if (!hook) {
            if (anz) {
              anz.details.forEach((s, i) =>
                groups.push({ s, i, start: anz.detailStart + i * anz.detailGap }),
              );
              anz.after.forEach((s, i) =>
                groups.push({ s, i: 100 + i, start: anz.afterStart + i * anz.afterGap }),
              );
            } else {
              list.forEach((s, i) => groups.push({ s, i, start: CARD_SETTLE + i * gap }));
            }
          }
          if (!groups.length) return null;
          return (
            <g clipPath={`url(#cc-${seed})`}>
              {groups.map(({ s, i, start }) => {
              const t = String(s.t || "label");
              const color = STEP_COLOR[String(s.color || "")] || defaultColor(t);
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

              /* high/low — garis swing + marker */
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
                      opacity={0.9}
                      style={{ filter: `drop-shadow(0 0 8px ${color})` }}
                    />
                    <circle cx={mx} cy={myT} r={9} fill={color} style={{ filter: `drop-shadow(0 0 10px ${color})` }} />
                    <Tag x={plotX + plotW - 4} y={yLine - 26} text={label || (t === "high" ? "HIGH" : "LOW")} color={color} anchor="end" />
                  </g>
                );
              }

              /* zone — gradient fill + edge glow */
              if (t === "zone") {
                const yTop = py(Math.max(y1v, y2v));
                const yBot = py(Math.min(y1v, y2v));
                const xL = px(Math.min(x1v, x2v));
                const xR = px(Math.max(x1v, x2v));
                const w = (xR - xL) * p;
                const gid = `zg-${seed}-${i}`;
                return (
                  <g key={i}>
                    <defs>
                      <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.08} />
                      </linearGradient>
                    </defs>
                    <rect x={xL} y={yTop} width={Math.max(4, w)} height={yBot - yTop} fill={`url(#${gid})`} stroke={color} strokeWidth={2} strokeDasharray="8 6" opacity={0.95} />
                    <line x1={xL} x2={xL + Math.max(4, w)} y1={yTop} y2={yTop} stroke={color} strokeWidth={2.6} style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
                    {label && <Tag x={xR} y={yTop - 24} text={label} color={color} anchor="end" />}
                  </g>
                );
              }

              /* level — garis harga + chip axis */
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
                      strokeWidth={2.6}
                      strokeDasharray="14 10"
                      opacity={0.95}
                      style={{ filter: `drop-shadow(0 0 8px ${color})` }}
                    />
                    <rect
                      x={plotX + plotW + 4}
                      y={yLine - 16}
                      width={88}
                      height={32}
                      rx={5}
                      fill={color}
                      opacity={clamp01(interpolate(f, [start + 6, start + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))}
                    />
                    <text
                      x={plotX + plotW + 48}
                      y={yLine + 6}
                      textAnchor="middle"
                      fill="#05121a"
                      fontSize={16}
                      fontWeight={800}
                      opacity={clamp01(interpolate(f, [start + 6, start + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))}
                    >
                      {label || fmtNum(toPrice(y1v), 2)}
                    </text>
                    {s.showLeftTag && (
                      <g opacity={clamp01(interpolate(f, [start + 8, start + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))}>
                        <Tag
                          x={plotX + plotW * (typeof s.x1 === "number" ? clamp01(s.x1) : 0.06)}
                          y={yLine - 26}
                          text={label || "LEVEL"}
                          color={color}
                          anchor="start"
                        />
                      </g>
                    )}
                  </g>
                );
              }

              /* path — kurva proyeksi + panah segitiga */
              if (t === "path") {
                const ax = px(x1v);
                const ay = py(y1v);
                const bx = px(x2v);
                const by = py(y2v);
                const mxp = (ax + bx) / 2;
                const myp = (ay + by) / 2 + (bx - ax) * 0.12;
                const approx = Math.hypot(bx - ax, by - ay) * 1.25;
                const dash = approx * p;
                const angle = Math.atan2(by - myp, bx - mxp);
                const arrow = 22;
                return (
                  <g key={i}>
                    <path
                      d={`M ${ax} ${ay} Q ${mxp} ${myp} ${bx} ${by}`}
                      fill="none"
                      stroke={color}
                      strokeWidth={5}
                      strokeLinecap="round"
                      strokeDasharray={`${dash} ${approx + 20}`}
                      style={{ filter: `drop-shadow(0 0 12px ${color})` }}
                    />
                    {p > 0.85 && (
                      <path
                        d={`M 0 0 L ${-arrow} ${-arrow * 0.42} L ${-arrow} ${arrow * 0.42} Z`}
                        transform={`translate(${bx} ${by}) rotate(${(angle * 180) / Math.PI})`}
                        fill={color}
                        style={{ filter: `drop-shadow(0 0 10px ${color})` }}
                      />
                    )}
                    {label && <Tag x={(ax + bx) / 2} y={(ay + by) / 2 - 36} text={label} color={color} />}
                  </g>
                );
              }

              /* circle — dashed ring + pulse */
              if (t === "circle") {
                const cxp = px(x1v);
                const cyp = py(y1v);
                const rx = 78;
                const ry = 48;
                const pf = ((f - start) % 42) / 42;
                const pulseR = 1 + pf * 0.32;
                const pulseO = 0.5 * (1 - pf);
                return (
                  <g key={i}>
                    <ellipse cx={cxp} cy={cyp} rx={rx} ry={ry} fill={color} opacity={0.09} />
                    <ellipse cx={cxp} cy={cyp} rx={rx * pulseR} ry={ry * pulseR} fill="none" stroke={color} strokeWidth={2} opacity={pulseO} />
                    <ellipse
                      cx={cxp}
                      cy={cyp}
                      rx={rx}
                      ry={ry}
                      fill="none"
                      stroke={color}
                      strokeWidth={2.8}
                      strokeDasharray="10 7"
                      strokeDashoffset={-((f - start) * 0.4)}
                      style={{ filter: `drop-shadow(0 0 12px ${color})` }}
                    />
                    {label && <Tag x={cxp} y={cyp - ry - 26} text={label} color={color} />}
                  </g>
                );
              }

              /* label — titik + tag */
              const lxp = px(x1v);
              const lyp = py(y1v);
              const popIn = spring({
                fps,
                frame: Math.max(0, f - start - 2),
                config: { damping: 16, stiffness: 140 },
              });
              return (
                <g key={i} opacity={clamp01(popIn)} transform={`translate(${lxp} ${lyp}) scale(${0.6 + 0.4 * clamp01(popIn)})`}>
                  <circle cx={0} cy={0} r={8} fill={color} style={{ filter: `drop-shadow(0 0 10px ${color})` }} />
                  <g transform={`translate(20 -38)`}>
                    <Tag x={0} y={0} text={label || "CATATAN"} color={color} anchor="start" />
                  </g>
                </g>
              );
              })}
            </g>
          );
        })()}

        {/* flash crash (mode hook) */}
        {hook && flash > 0 && (
          <rect
            x={0}
            y={headH}
            width={width}
            height={height - headH}
            fill="url(#flashg)"
            opacity={flash}
          />
        )}
        {hook && (
          <defs>
            <radialGradient id="flashg" cx="50%" cy="45%" r="75%">
              <stop offset="0%" stopColor="rgba(239,83,80,0.6)" />
              <stop offset="60%" stopColor="rgba(239,83,80,0.22)" />
              <stop offset="100%" stopColor="rgba(239,83,80,0)" />
            </radialGradient>
          </defs>
        )}
      </svg>
      </div>

      {/* badge jeda ANALISA — tanda pasar "dipause" saat penjelasan */}
      {anz && f >= anz.freezeF - 8 && f < anz.pauseEnd && (
        <div
          style={{
            position: "absolute",
            top: headH + 20,
            right: 26,
            zIndex: 8,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 24px",
            borderRadius: 999,
            background: "rgba(5,12,10,0.85)",
            border: "1.6px solid rgba(34,211,238,0.75)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 10px 34px rgba(0,0,0,0.45), 0 0 24px rgba(34,211,238,0.25)",
            opacity: clamp01(
              interpolate(f, [anz.freezeF - 8, anz.freezeF, anz.pauseEnd - 14, anz.pauseEnd], [0, 1, 1, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            ),
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: "#22D3EE",
              boxShadow: "0 0 12px rgba(34,211,238,0.9)",
            }}
          />
          <span style={{ fontWeight: 900, fontSize: 22, letterSpacing: 4, color: "#22D3EE" }}>
            {(analyze?.pauseLabel || "ANALISA").toUpperCase()}
          </span>
        </div>
      )}

      {/* ═══ Stickman riding candle ═══ */}
      {stickPose && (
        <div
          style={{
            position: "absolute",
            left: stickX - 60,
            top: stickFootY - 178,
            opacity: clamp01(stickIn),
            transform: `scale(${0.5 + 0.5 * clamp01(stickIn)})`,
            transformOrigin: "50% 100%",
            zIndex: 6,
          }}
        >
          <Stickman
            pose={stickPose}
            bubble={hook && f < crashFrame && f > 8}
            height={148}
          />
        </div>
      )}
    </div>
  );
};
