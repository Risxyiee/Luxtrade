import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Backdrop } from "./components/Backdrop";
import { CandleChart, ChartPanel, fmtNum, genCandles } from "./components/Chart";
import { BrandChip, C, CARD, FONT, ProgressBar, SceneDots, clamp01, pop, rise, SceneShell } from "./components/Ui";
import { FPS, sceneFrames, type SceneProps } from "./LuxtradePromo";

/* ============================================================
   SignalRecap — RECAP SINYAL ASLI (template 'signal')
   ============================================================
   Struktur tetap 4 scene (title/sub/vo dari Sinta, angka dari
   data pine_alert_log — TIDAK dikarang):
     slot 0 hook   → simbol + stempel arah (LONG/SHORT)
     slot 1 chart  → candle animasi + garis entry/exit + label harga
     slot 2 stat   → stempel hasil (TP HIT / SL) + % count-up
     slot 3 cta    → ajakan alert ke HP
   Kalau scenes lebih/kurang dari 4, dipetakan aman (clamp). */

export interface SignalVisual {
  symbol: string;
  symbolLabel?: string;
  side: "LONG" | "SHORT";
  entry: number;
  exit: number;
  result: "TP" | "SL";
  changePct: number;
  sl?: number | null;
  tp?: number | null;
}

export interface SignalRecapProps {
  signal: SignalVisual;
  scenes: SceneProps[];
  handle: string;
  domain: string;
}

export const totalSignalFrames = (scenes: SceneProps[]): number =>
  Math.max(1, scenes.reduce((sum, s) => sum + sceneFrames(s.durationSec), 0));

const chartTrend = (side: "LONG" | "SHORT", result: "TP" | "SL"): "up" | "down" =>
  (side === "LONG") === (result === "TP") ? "up" : "down";

/* ---------------- slot 0 — hook: simbol + stempel arah ---------------- */

const HookSlot: React.FC<{ label: string; side: "LONG" | "SHORT"; title: string; sub: string; durationInFrames: number }> = ({
  label,
  side,
  title,
  sub,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stampS = spring({ fps, frame: Math.max(0, frame - 10), config: { damping: 11, stiffness: 200, mass: 0.8 } });
  const sideColor = side === "LONG" ? C.green : C.red;

  return (
    <SceneShell durationInFrames={durationInFrames}>
      <div style={{ position: "absolute", top: 560, left: 80, right: 80, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 120, color: C.white, textShadow: "0 0 60px rgba(34,211,238,0.4)", ...rise(frame, 0, 44) }}>
          {label}
        </div>
        <div
          style={{
            marginTop: 46,
            padding: "22px 70px",
            borderRadius: 22,
            border: `5px solid ${sideColor}`,
            color: sideColor,
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 76,
            letterSpacing: 8,
            background: side === "LONG" ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
            boxShadow: `0 0 ${40 + 20 * Math.sin(frame / 12)}px ${side === "LONG" ? "rgba(52,211,153,0.45)" : "rgba(248,113,113,0.4)"}`,
            opacity: clamp01(stampS),
            transform: `scale(${1.6 - 0.6 * clamp01(stampS)}) rotate(${(1 - clamp01(stampS)) * -14}deg)`,
          }}
        >
          {side}
        </div>
        <div style={{ marginTop: 54, fontFamily: FONT, fontWeight: 500, fontSize: 38, color: C.muted, maxWidth: 860, ...rise(frame, 16, 30) }}>
          {sub}
        </div>
        <div style={{ marginTop: 30, fontFamily: FONT, fontWeight: 800, fontSize: 30, color: C.accent, letterSpacing: 2, opacity: 0.9, ...rise(frame, 22, 24) }}>
          {title}
        </div>
      </div>
    </SceneShell>
  );
};

/* ---------------- slot 1 — chart dgn garis entry/exit ---------------- */

const ChartSlot: React.FC<{
  signal: SignalVisual;
  title: string;
  sub: string;
  durationInFrames: number;
  seed: number;
}> = ({ signal, title, sub, durationInFrames, seed }) => {
  const frame = useCurrentFrame();
  const trend = chartTrend(signal.side, signal.result);
  const candles = React.useMemo(() => genCandles(seed, trend), [seed, trend]);
  const entryY = candles[0].c;
  const exitY = candles[candles.length - 1].c;
  const r = rise(frame, 4, 44);

  return (
    <SceneShell durationInFrames={durationInFrames}>
      <div style={{ position: "absolute", top: 520, left: 80, right: 80, ...r }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 60, color: C.white, textAlign: "center", textShadow: "0 0 44px rgba(34,211,238,0.4)", marginBottom: 14 }}>
          {title}
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 30, color: C.muted, textAlign: "center", marginBottom: 34 }}>
          {sub}
        </div>
        <ChartPanel>
          <CandleChart
            seed={seed}
            trend={trend}
            entryY={entryY}
            exitY={exitY}
            entryLabel={`ENTRY ${fmtNum(signal.entry)}`}
            exitLabel={`${signal.result} ${fmtNum(signal.exit)}`}
            exitColor={signal.result === "TP" ? C.green : C.red}
            width={840}
            height={560}
            delay={10}
          />
        </ChartPanel>
      </div>
    </SceneShell>
  );
};

/* ---------------- slot 2 — stempel hasil + % count-up ---------------- */

const ResultSlot: React.FC<{ signal: SignalVisual; sub: string; durationInFrames: number }> = ({ signal, sub, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const win = signal.result === "TP";
  const color = win ? C.green : C.red;
  const stampS = spring({ fps, frame: Math.max(0, frame - 4), config: { damping: 11, stiffness: 210, mass: 0.8 } });
  const pct = interpolate(frame, [14, 52], [0, signal.changePct], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const pctText = `${pct >= 0 ? "+" : ""}${Math.abs(pct) < 10 ? pct.toFixed(2) : pct.toFixed(1)}%`;

  return (
    <SceneShell durationInFrames={durationInFrames}>
      <div style={{ position: "absolute", top: 560, left: 80, right: 80, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div
          style={{
            padding: "20px 64px",
            borderRadius: 24,
            border: `5px solid ${color}`,
            color,
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 72,
            letterSpacing: 6,
            background: win ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
            boxShadow: `0 0 44px ${win ? "rgba(52,211,153,0.45)" : "rgba(248,113,113,0.4)"}`,
            opacity: clamp01(stampS),
            transform: `scale(${1.5 - 0.5 * clamp01(stampS)}) rotate(${(1 - clamp01(stampS)) * -12 - 4}deg)`,
          }}
        >
          {win ? "TP HIT ✅" : "SL HIT 🛡️"}
        </div>

        <div
          style={{
            marginTop: 44,
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 170,
            lineHeight: 1,
            color,
            textShadow: `0 0 90px ${win ? "rgba(52,211,153,0.5)" : "rgba(248,113,113,0.45)"}`,
          }}
        >
          {pctText}
        </div>

        {/* tabel entry/exit */}
        <div style={{ marginTop: 52, width: 720, borderRadius: 30, ...CARD, overflow: "hidden" }}>
          {[
            { k: "ENTRY", v: fmtNum(signal.entry) },
            { k: "EXIT", v: fmtNum(signal.exit) },
          ].map((row, i) => {
            const rp = pop(frame, fps, 24 + i * 8);
            return (
              <div
                key={row.k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "26px 40px",
                  borderBottom: i === 0 ? "1px solid rgba(255,255,255,0.08)" : "none",
                  opacity: clamp01(rp),
                  transform: `translateX(${(1 - rp) * -40}px)`,
                }}
              >
                <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, color: C.muted, letterSpacing: 3 }}>{row.k}</span>
                <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 40, color: C.white }}>{row.v}</span>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 40, fontFamily: FONT, fontWeight: 500, fontSize: 32, color: C.muted, maxWidth: 840, ...rise(frame, 34, 26) }}>
          {sub}
        </div>
      </div>
    </SceneShell>
  );
};

/* ---------------- slot 3 — cta ---------------- */

const CtaSlot: React.FC<{ title: string; sub: string; domain: string; durationInFrames: number }> = ({ title, sub, domain, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pillS = spring({ fps, frame: Math.max(0, frame - 4), config: { damping: 12, stiffness: 180 } });
  const glow = 0.5 + 0.5 * Math.sin(frame / 14);
  return (
    <SceneShell durationInFrames={durationInFrames}>
      <div style={{ position: "absolute", top: 640, left: 70, right: 70, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 88, color: C.white, textShadow: "0 0 50px rgba(34,211,238,0.4)", ...rise(frame, 0, 40) }}>
          {title}
        </div>
        <div style={{ marginTop: 20, fontFamily: FONT, fontWeight: 500, fontSize: 36, color: C.muted, maxWidth: 840, ...rise(frame, 8, 30) }}>
          {sub}
        </div>
        <div
          style={{
            marginTop: 76,
            padding: "34px 76px",
            borderRadius: 999,
            background: `linear-gradient(90deg, ${C.accentDeep}, ${C.accent})`,
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 46,
            letterSpacing: 3,
            color: "#04121a",
            boxShadow: `0 0 ${34 + glow * 40}px rgba(34,211,238,${0.4 + glow * 0.35})`,
            opacity: clamp01(pillS),
            transform: `scale(${0.85 + 0.15 * pillS})`,
          }}
        >
          CEK LINK DI BIO
        </div>
        <div style={{ marginTop: 40, fontFamily: FONT, fontWeight: 700, fontSize: 40, color: C.white, opacity: 0.9, ...rise(frame, 20, 24) }}>
          {domain}
        </div>
      </div>
    </SceneShell>
  );
};

/* ---------------- komposisi utama ---------------- */

export const SignalRecap: React.FC<SignalRecapProps> = ({ signal, scenes, handle, domain }) => {
  const frame = useCurrentFrame();

  const safeScenes = scenes.length >= 4 ? scenes : [
    ...scenes,
    ...Array.from({ length: 4 - scenes.length }).map((_, i) => ({
      title: ["SINYAL", "CHART", "HASIL", "CTA"][scenes.length + i] || "LUXTRADE",
      sub: "luxtradee.web.id",
      voFile: "",
      durationSec: 3,
    })),
  ];

  const starts: number[] = [];
  const frames: number[] = [];
  let acc = 0;
  for (const scene of safeScenes.slice(0, 4)) {
    starts.push(acc);
    const f = sceneFrames(scene.durationSec);
    frames.push(f);
    acc += f;
  }

  let activeIndex = 0;
  for (let i = 0; i < 4; i++) {
    if (frame >= starts[i] && frame < starts[i] + frames[i]) activeIndex = i;
  }

  const seed = Math.abs(Math.round(signal.entry * 100) + signal.symbol.length * 7) || 23;
  const label = signal.symbolLabel || signal.symbol;
  const slots = safeScenes.slice(0, 4);

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily: FONT }}>
      <Backdrop />
      <ProgressBar />
      <BrandChip />

      {slots.map((scene, i) => (
        <Sequence key={`${scene.voFile}-${i}`} from={starts[i]} durationInFrames={frames[i]} name={`Slot ${i + 1}`}>
          {scene.voFile ? <Audio src={staticFile(scene.voFile)} /> : null}
          {i === 0 ? <HookSlot label={label} side={signal.side} title={scene.title} sub={scene.sub} durationInFrames={frames[i]} />
          : i === 1 ? <ChartSlot signal={signal} title={scene.title} sub={scene.sub} durationInFrames={frames[i]} seed={seed} />
          : i === 2 ? <ResultSlot signal={signal} sub={scene.sub} durationInFrames={frames[i]} />
          : <CtaSlot title={scene.title} sub={scene.sub} domain={domain} durationInFrames={frames[i]} />}
        </Sequence>
      ))}

      <SceneDots activeIndex={activeIndex} total={4} />
      <div
        style={{
          position: "absolute",
          bottom: 130,
          left: 60,
          zIndex: 10,
          fontFamily: FONT,
          fontWeight: 500,
          fontSize: 24,
          color: C.muted,
          opacity: 0.5,
        }}
      >
        {handle}
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- default props ---------------- */

export const SIGNAL_DEFAULT_PROPS: SignalRecapProps = {
  signal: {
    symbol: "XAUUSD",
    symbolLabel: "GOLD (XAUUSD)",
    side: "LONG",
    entry: 2331.2,
    exit: 2338.5,
    result: "TP",
    changePct: 0.31,
  },
  scenes: [
    { title: "TP KEBELI 🎯", sub: "sinyal LONG GOLD (XAUUSD) dari engine luxtrade", voFile: "vo/vo0.mp3", durationSec: 3.2 },
    { title: "LONG SEJAK ENTRY", sub: "entry 2.331,20 → exit 2.338,50", voFile: "vo/vo1.mp3", durationSec: 3.6 },
    { title: "+0,31%", sub: "hasil per gerakan ini — tercatat otomatis di jurnal", voFile: "vo/vo2.mp3", durationSec: 3.4 },
    { title: "MAU SINYAL KE HP?", sub: "alert entry/sl/tp realtime — link di bio", voFile: "vo/vo3.mp3", durationSec: 3.0 },
  ],
  handle: "@luxtradee",
  domain: "luxtradee.web.id",
};

export { FPS };
