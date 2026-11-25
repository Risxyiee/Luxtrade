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
   HookTerminal — HOOK full-bleed layar trading (Bos 26-11:
   "bukan teks aja sm animasi biasa")
   ============================================================
   3 detik pertama WAJIB langsung chart penuh — bukan tipografi
   di layar kosong. Narasi visual "SL kena dulu, baru harga jalan":

     frame 0-..   candle streaming rally ke atas (entry)
     crashFrame   candle menembus SL → flash merah + screen shake
                  + stamp "SL KENA!" + PnL merah count-down
     recovery     harga rally keras → stamp PnL hijau count-up
                  (bukti: "baru harga jalan")

   Semua deterministik (seed) — render konsisten runner/preview. */

const TV_BG = "#131722";
const TV_GRID = "#1e222d";
const TV_UP = "#26a69a";
const TV_DOWN = "#ef5350";
const TV_AXIS = "rgba(178,181,190,0.85)";
const TV_MUTED = "rgba(178,181,190,0.6)";

const BASE_PRICE = 3648.13;
const toPrice = (v: number) => BASE_PRICE + (v - 0.5) * 80;

/* narasi waypoint: rally → tembus SL → recovery rally keras */
const HOOK_PATH = [0.34, 0.46, 0.54, 0.58, 0.54, 0.44, 0.3, 0.18, 0.26, 0.4, 0.55, 0.7, 0.84, 0.92];
const ENTRY_Y = 0.52;
const SL_Y = 0.2;
const N_CANDLES = 34;
const REVEAL_START = 4;
const REVEAL_IV = 2.2;

/* candle pertama yang menembus SL — dihitung deterministik di module scope
   supaya scene lain (HookScene caption) bisa sinkron tanpa render. */
const _hookCandles = genCandles(29, "flat", N_CANDLES, HOOK_PATH);
const _crashIdx = Math.max(4, _hookCandles.findIndex((cd) => cd.l < SL_Y - 0.02));
export const HOOK_CRASH_FRAME = Math.round(REVEAL_START + _crashIdx * REVEAL_IV + 1);

const TOP_BAR = 96;
const RAIL = 0; /* full-bleed: tanpa rail kiri — chart murni */
const AXIS_W = 132;
const TIME_H = 56;

export const HookTerminal: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame);

  const width = 1080;
  const height = 1920;

  const candles = React.useMemo(() => _hookCandles, []);

  /* candle pertama yang menembus SL ke bawah = momen crash */
  const crashIdx = _crashIdx;
  const crashFrame = HOOK_CRASH_FRAME;

  const plotX = 18;
  const plotY = TOP_BAR + 20;
  const plotW = width - 18 - AXIS_W;
  const plotH = height - TOP_BAR - TIME_H - 30;
  const step = plotW / N_CANDLES;
  const bw = Math.max(9, step * 0.52);

  const py = (v: number) => plotY + (1 - v) * plotH;
  const px = (i: number) => plotX + step * (i + 0.5);

  /* candle yang sudah "terbentuk" = sudah lewat reveal frame-nya */
  const revealedCount = Math.min(
    N_CANDLES,
    Math.max(0, Math.floor((f - REVEAL_START) / REVEAL_IV) + 1),
  );
  const lastIdx = revealedCount - 1;
  const last = lastIdx >= 0 ? candles[lastIdx] : candles[0];

  /* harga live = close candle terakhir yang tampil */
  const priceP = interpolate(f, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const price = toPrice(last.c);

  /* ── event crash ── */
  const sinceCrash = f - crashFrame;
  const flash = interpolate(f, [crashFrame, crashFrame + 3, crashFrame + 10], [0, 0.4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shakeAmp = sinceCrash >= 0 && sinceCrash <= 14 ? 15 * (1 - sinceCrash / 14) : 0;
  const shakeX = shakeAmp * Math.sin(sinceCrash * 2.6);
  const shakeY = shakeAmp * Math.cos(sinceCrash * 3.1) * 0.6;

  /* momen recovery = stamp hijau menggantikan stamp merah (fixed offset
     dari crash — beri jeda biar "SL KENA!" sempat dibaca ±1.3 dtk) */
  const RECOVER_HOLD = 40;
  const sinceRecover = f - (crashFrame + RECOVER_HOLD);

  /* zoom punch pembuka (jempol berhenti scroll) + drift kamera pelan */
  const punch = interpolate(f, [0, 14], [1.1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const drift = interpolate(f, [0, durationInFrames], [1, 1.045], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });

  /* entry price utk PnL — sebelum crash pakai entry, recovery mulai count naik */
  const entryPrice = toPrice(ENTRY_Y);
  const pnlNow = (price - entryPrice) * 9.2;

  const stampS = spring({ fps, frame: Math.max(0, f - crashFrame - 2), config: { damping: 11, stiffness: 200, mass: 0.9 } });
  const winS = spring({ fps, frame: Math.max(0, f - crashFrame - RECOVER_HOLD - 4), config: { damping: 11, stiffness: 200, mass: 0.9 } });
  const winP = interpolate(f, [crashFrame + RECOVER_HOLD + 4, crashFrame + RECOVER_HOLD + 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const gridRows = [0.2, 0.4, 0.6, 0.8];
  const timeLabels = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];

  const fmtPnl = (v: number) => `${v < 0 ? "-" : "+"}$${Math.abs(v).toFixed(2)}`;

  return (
    <div
      style={{
        width,
        height,
        background: TV_BG,
        overflow: "hidden",
        position: "relative",
        fontFamily: FONT,
        transform: `scale(${punch * drift}) translate(${shakeX}px, ${shakeY}px)`,
      }}
    >
      {/* ═══ TOP BAR platform ═══ */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: TOP_BAR,
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "0 26px",
          borderBottom: "1px solid rgba(148,163,184,0.14)",
          background: "rgba(255,255,255,0.03)",
          zIndex: 5,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 11,
              height: 11,
              borderRadius: 999,
              background: C.green,
              boxShadow: "0 0 12px rgba(52,211,153,0.9)",
            }}
          />
          <span style={{ fontWeight: 800, fontSize: 30, color: "#FFFFFF", letterSpacing: 1 }}>XAUUSD</span>
          <span style={{ fontWeight: 700, fontSize: 19, color: TV_MUTED, letterSpacing: 2 }}>· M15</span>
        </div>
        <span
          style={{
            fontWeight: 800,
            fontSize: 38,
            color: last.c >= last.o ? TV_UP : TV_DOWN,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmtNum(price, 2)}
        </span>
        <span
          style={{
            padding: "4px 12px",
            borderRadius: 8,
            background: pnlNow >= 0 ? "rgba(38,166,154,0.16)" : "rgba(239,83,80,0.16)",
            color: pnlNow >= 0 ? TV_UP : TV_DOWN,
            fontWeight: 800,
            fontSize: 21,
          }}
        >
          {fmtPnl(pnlNow)}
        </span>
        <div style={{ marginLeft: "auto", fontWeight: 800, fontSize: 18, letterSpacing: 6, color: "rgba(255,255,255,0.4)" }}>
          LUXTRADE
        </div>
      </div>

      {/* ═══ PLOT AREA ═══ */}
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0 }}>
        {/* watermark */}
        <text
          x={plotX + plotW / 2}
          y={plotY + plotH / 2}
          textAnchor="middle"
          fill="rgba(255,255,255,0.045)"
          fontSize={72}
          fontWeight={900}
          letterSpacing={10}
        >
          XAUUSD
        </text>

        {/* grid */}
        {gridRows.map((g) => (
          <line key={g} x1={plotX} x2={plotX + plotW} y1={plotY + g * plotH} y2={plotY + g * plotH} stroke={TV_GRID} strokeWidth={1} />
        ))}
        {timeLabels.map((_, i) => (
          <line key={i} x1={plotX + plotW * (0.09 + i * 0.175)} x2={plotX + plotW * (0.09 + i * 0.175)} y1={plotY} y2={plotY + plotH} stroke={TV_GRID} strokeWidth={1} />
        ))}

        {/* axis harga kanan */}
        {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
          <text key={v} x={plotX + plotW + 12} y={py(v) + 6} fill={TV_AXIS} fontSize={17} fontWeight={600}>
            {fmtNum(toPrice(v), 1)}
          </text>
        ))}

        {/* label waktu bawah */}
        {timeLabels.map((t, i) => (
          <text key={t} x={plotX + plotW * (0.09 + i * 0.175)} y={plotY + plotH + 40} fill={TV_MUTED} fontSize={17} fontWeight={600}>
            {t}
          </text>
        ))}

        {/* ═══ garis ENTRY + SL (muncul cepat awal) ═══ */}
        {(() => {
          const lineP = interpolate(f, [3, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
          const slBroken = lastIdx >= 0 && candles[lastIdx].c < SL_Y;
          return (
            <g>
              {/* ENTRY */}
              <line x1={plotX} x2={plotX + plotW * lineP} y1={py(ENTRY_Y)} y2={py(ENTRY_Y)} stroke="rgba(34,211,238,0.75)" strokeWidth={2} strokeDasharray="10 7" />
              <rect x={plotX + plotW + 2} y={py(ENTRY_Y) - 16} width={98} height={32} rx={4} fill="#0891B2" opacity={clamp01(lineP)} />
              <text x={plotX + plotW + 51} y={py(ENTRY_Y) + 6} textAnchor="middle" fill="#FFFFFF" fontSize={17} fontWeight={800} opacity={clamp01(lineP)}>
                ENTRY
              </text>

              {/* SL */}
              <line x1={plotX} x2={plotX + plotW * lineP} y1={py(SL_Y)} y2={py(SL_Y)} stroke={slBroken ? TV_DOWN : "rgba(239,83,80,0.7)"} strokeWidth={2} strokeDasharray="10 7" style={slBroken ? { filter: "drop-shadow(0 0 10px rgba(239,83,80,0.8))" } : undefined} />
              <rect x={plotX + plotW + 2} y={py(SL_Y) - 16} width={98} height={32} rx={4} fill={slBroken ? "#B91C1C" : "#7F1D1D"} opacity={clamp01(lineP)} />
              <text x={plotX + plotW + 51} y={py(SL_Y) + 6} textAnchor="middle" fill="#FFFFFF" fontSize={17} fontWeight={800} opacity={clamp01(lineP)}>
                {slBroken ? "SL ✕" : "SL"}
              </text>
            </g>
          );
        })()}

        {/* ═══ candle streaming — TradingView style ═══ */}
        {candles.map((cd, i) => {
          if (i >= revealedCount) return null;
          const appear = spring({
            fps,
            frame: Math.max(0, f - (REVEAL_START + i * REVEAL_IV)),
            config: { damping: 15, stiffness: 190 },
          });
          const up = cd.c >= cd.o;
          const color = up ? TV_UP : TV_DOWN;
          const bodyTop = py(Math.max(cd.o, cd.c));
          const bodyH = Math.max(4, Math.abs(py(cd.o) - py(cd.c)));
          const xMid = px(i);
          return (
            <g
              key={i}
              opacity={clamp01(appear)}
              transform={`translate(${xMid} ${py(cd.c)}) scale(${clamp01(appear)}) translate(${-xMid} ${-py(cd.c)})`}
            >
              <line x1={xMid} x2={xMid} y1={py(cd.h)} y2={py(cd.l)} stroke={color} strokeWidth={2.5} />
              <rect x={xMid - bw / 2} y={bodyTop} width={bw} height={bodyH} fill={color} />
            </g>
          );
        })}

        {/* chip harga live di axis — nempel harga terakhir */}
        <rect
          x={plotX + plotW + 2}
          y={py(last.c) - 16}
          width={98}
          height={32}
          rx={4}
          fill={last.c >= last.o ? TV_UP : TV_DOWN}
          opacity={priceP}
        />
        <text x={plotX + plotW + 51} y={py(last.c) + 6} textAnchor="middle" fill="#FFFFFF" fontSize={16} fontWeight={800} opacity={priceP}>
          {fmtNum(price, 2)}
        </text>
      </svg>

      {/* ═══ STAMP SL KENA — slam saat crash, tahan sampai recovery ═══ */}
      {sinceCrash >= 0 && sinceCrash <= RECOVER_HOLD && (
        <div
          style={{
            position: "absolute",
            top: 470,
            left: 90,
            padding: "22px 44px",
            borderRadius: 22,
            background: "linear-gradient(135deg, #DC2626, #B91C1C)",
            border: "2px solid rgba(255,255,255,0.35)",
            boxShadow: "0 20px 70px rgba(220,38,38,0.55)",
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 72,
            color: "#FFFFFF",
            letterSpacing: 2,
            opacity: clamp01(stampS),
            transform: `rotate(-7deg) scale(${0.6 + 0.4 * clamp01(stampS)})`,
            zIndex: 8,
          }}
        >
          SL KENA!
        </div>
      )}

      {/* ═══ STAMP RECOVERY — harga jalan (hijau) ═══ */}
      {sinceRecover > 0 && (
        <div
          style={{
            position: "absolute",
            top: 430,
            right: 90,
            padding: "22px 44px",
            borderRadius: 22,
            background: "linear-gradient(135deg, #059669, #047857)",
            border: "2px solid rgba(255,255,255,0.35)",
            boxShadow: "0 20px 70px rgba(5,150,105,0.55)",
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 60,
            color: "#FFFFFF",
            letterSpacing: 1,
            opacity: clamp01(winS),
            transform: `rotate(5deg) scale(${0.6 + 0.4 * clamp01(winS)})`,
            zIndex: 8,
            textAlign: "center",
          }}
        >
          HARGA JALAN
          <div style={{ fontSize: 40, fontWeight: 800, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
            {fmtPnl(pnlNow * winP)}
          </div>
        </div>
      )}

      {/* ═══ FLASH merah saat crash ═══ */}
      {flash > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at 50% 60%, rgba(239,83,80,0.55), rgba(239,83,80,0.22) 60%, rgba(239,83,80,0) 100%)",
            opacity: flash,
            zIndex: 9,
          }}
        />
      )}

      {/* vignette halus biar fokus ke tengah */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.42) 100%)",
          zIndex: 4,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
