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
import { BackgroundMusic } from "./components/Music";
import {
  ChartCard,
  activeCardStep,
  hookCrashFrame,
  type TerminalStep,
} from "./components/ChartCard";
import { BrandChip, C, CARD, FONT, ProgressBar, SceneDots, SPRING_POP, SPRING_SOFT, clamp01, pop, rise, SceneShell } from "./components/Ui";
import { FPS, sceneFrames, type SceneProps } from "./LuxtradePromo";

/* ============================================================
   SintaReels — komposisi DATA-DRIVEN untuk konten edukasi/insight
   ============================================================
   Berbeda dgn LuxtradePromo (5 scene produk tetap), komposisi ini
   merender scene APAPUN dari spesifikasi Sinta (LLM) via `kind`:
     hook     → tipografi raksasa kata-per-kata + underline swipe
     point    → kartu bernomor + centang animasi + strip candle mini
     chart    → LAYAR TERMINAL trading realistis (Bos 26-11)
     tutorial → terminal + ALAT GAMBAR langkah-demi-langkah
                (garis/zona/proyeksi/panah) sinkron VO — pola reel
                @inzaghitrades: "ui tampilan dan vonya keren, bukan
                teks aja sama animasi biasa"
     quote    → kartu kutipan + bintang
     stat     → angka raksasa count-up + bar
     cta      → pil CTA glow + domain
   Audio voiceover per scene (voFile, edge-tts di runner). */

export interface ReelsScene extends SceneProps {
  kind?: string;
  /** Langkah gambar utk kind 'tutorial' / 'chart' (sudah di-sanitize worker). */
  draw?: TerminalStep[];
  /** Narasi waypoint harga (normalisasi 0..1, 1 = tinggi) — chart
   *  full-bleed pakai ini biar cerita candle = cerita VO. */
  path?: number[];
  /* ---- hook custom (cerita FOMO/revenge dsb.) ---- */
  /** garis ENTRY (hook mode) */
  entryY?: number;
  /** garis SL (hook mode) — deteksi crash di sini */
  slY?: number;
  /** nilai PnL ticket (bisa negatif utk cerita loss) */
  pnl?: number;
  /** teks ticket di atas angka */
  pnlLabel?: string;
  /** win = hijau "harga jalan", loss = merah "masih turun" */
  pnlTone?: "win" | "loss";
}

export interface SintaReelsProps {
  scenes: ReelsScene[];
  handle: string;
  domain: string;
}

export const totalReelsFrames = (scenes: ReelsScene[]): number =>
  Math.max(1, scenes.reduce((sum, s) => sum + sceneFrames(s.durationSec), 0));

const KINDS = ["hook", "point", "chart", "tutorial", "quote", "stat", "cta"] as const;
type Kind = (typeof KINDS)[number];

const normalizeKind = (k: string | undefined, index: number, total: number): Kind => {
  if (k && (KINDS as readonly string[]).includes(k)) return k as Kind;
  if (index === 0) return "hook";
  if (index === total - 1) return "cta";
  return "point";
};

/* ---------------- SHARED: judul besar + step pills + caption polos ----------------
   Layout reel referensi Bos (DfeAm-wPf3k): judul raksasa di atas (kata
   kunci berwarna), pill langkah di bawahnya, kartu chart di tengah,
   caption polos tanpa kotak di bawah. */

const BigTitle: React.FC<{ lines: string[]; delay?: number; size?: number }> = ({
  lines,
  delay = 4,
  size = 78,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        top: 140,
        left: 48,
        right: 48,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        zIndex: 12,
        textAlign: "center",
      }}
    >
      {lines.map((line, li) => (
        <div
          key={li}
          style={{
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: size,
            lineHeight: 1.12,
            letterSpacing: -1,
            ...rise(frame, delay + li * 8, 40),
          }}
        >
          {line.split(/\s+/).map((w, i) => (
            <span key={i} style={{ color: titleWordColor(w), textShadow: "0 4px 30px rgba(0,0,0,0.55)" }}>
              {w}{" "}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};

/** pill langkah gaya reel: "1 UPTREND ✓" — done=teal ✓, aktif=teal solid, next=dim */
const StepPills: React.FC<{ steps: TerminalStep[]; active: number; delay?: number }> = ({
  steps,
  active,
  delay = 10,
}) => {
  const frame = useCurrentFrame();
  if (steps.length === 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 356,
        left: 40,
        right: 40,
        display: "flex",
        justifyContent: "center",
        gap: 12,
        flexWrap: "wrap",
        zIndex: 12,
      }}
    >
      {steps.slice(0, 6).map((s, i) => {
        const sIn = clamp01(
          spring({ fps: 30, frame: Math.max(0, frame - delay - i * 6), config: { damping: 16, stiffness: 150 } }),
        );
        const label = String(s.label || `LANGKAH ${i + 1}`).toUpperCase();
        const done = i < active;
        const isActive = i === active;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              borderRadius: 999,
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 21,
              letterSpacing: 1,
              whiteSpace: "nowrap",
              opacity: clamp01(sIn) * (i > active + 1 ? 0.45 : 1),
              transform: `scale(${0.8 + 0.2 * clamp01(sIn)})`,
              background: isActive ? "rgba(45,212,191,0.92)" : "rgba(6,14,12,0.72)",
              border: isActive ? "2px solid rgba(45,212,191,1)" : done ? "2px solid rgba(45,212,191,0.75)" : "2px solid rgba(255,255,255,0.16)",
              color: isActive ? "#04120E" : done ? "#2DD4BF" : "rgba(255,255,255,0.75)",
              boxShadow: isActive ? "0 0 26px rgba(45,212,191,0.5)" : "none",
            }}
          >
            <span style={{ opacity: 0.75 }}>{i + 1}</span>
            {label}
            {done && <span>✓</span>}
          </div>
        );
      })}
    </div>
  );
};

/** caption polos tanpa kotak di bawah — gaya reel referensi */
const PlainCaption: React.FC<{ text: string; delay?: number; bottom?: number }> = ({
  text,
  delay = 18,
  bottom = 172,
}) => {
  const frame = useCurrentFrame();
  const words = text.split(/\s+/);
  return (
    <div
      style={{
        position: "absolute",
        bottom,
        left: 64,
        right: 64,
        textAlign: "center",
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: 42,
        lineHeight: 1.25,
        color: "#FFFFFF",
        zIndex: 12,
        textShadow: "0 3px 24px rgba(0,0,0,0.6)",
      }}
    >
      {words.map((w, i) => (
        <PopWord key={i} word={w} accent="#2DD4BF" matcher={WIN_RE} index={i} delay={delay} />
      ))}
    </div>
  );
};

/* ---------------- hook — KARTU CHART + STICKMAN (gaya reel ref) ----------------
   Judul 2 baris raksasa + kartu chart streaming: candle rally →
   menembus SL (flash + shake + stamp SL KENA + stickman shock) →
   rally recovery (ticket PnL + stickman celebrate). */

const HOOK_PATH = [0.34, 0.46, 0.54, 0.58, 0.54, 0.44, 0.3, 0.18, 0.26, 0.4, 0.55, 0.7, 0.84, 0.92];
const HOOK_N = 20;
const HOOK_SL = 0.3;
const HOOK_RS = 6;
const HOOK_IV = 5; /* streaming lebih lambat — sinkron dgn REVEAL_IV ChartCard */

const HookScene: React.FC<{
  title: string;
  sub: string;
  durationInFrames: number;
  seed: number;
  path?: number[];
  entryY?: number;
  slY?: number;
  pnl?: number;
  pnlLabel?: string;
  pnlTone?: "win" | "loss";
}> = ({
  title,
  sub,
  durationInFrames,
  seed,
  path = HOOK_PATH,
  entryY = 0.55,
  slY = HOOK_SL,
  pnl: pnlTarget = 137.14,
  pnlLabel = "HARGA JALAN ↗",
  pnlTone = "win",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const crash = hookCrashFrame(HOOK_N, slY, seed, path, HOOK_RS, HOOK_IV);
  const recover = crash + 62; /* stamp sempat dibaca ±2 dtk (Bos: jgn kecepetan) */

  const stampS = spring({ fps, frame: Math.max(0, frame - crash - 2), config: { damping: 14, stiffness: 140, mass: 1 } });
  const winS = spring({ fps, frame: Math.max(0, frame - recover - 2), config: { damping: 15, stiffness: 130 } });
  const pnl = interpolate(frame, [recover + 8, recover + 48], [0, pnlTarget], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <SceneShell durationInFrames={durationInFrames} instantIn>
      {/* judul besar 2 baris */}
      <BigTitle lines={[title, sub]} size={80} />

      {/* kartu chart hook mode */}
      <div
        style={{
          position: "absolute",
          top: 430,
          left: "50%",
          marginLeft: -484,
          opacity: 1,
          zIndex: 10,
        }}
      >
        <ChartCard
          width={968}
          height={1150}
          seed={seed}
          path={path}
          durationInFrames={durationInFrames}
          hook
          slY={slY}
          entryY={entryY}
          hookLoss={pnlTone === "loss"}
          symbol="XAUUSD"
          tf="1 JAM"
        />
      </div>

      {/* stamp SL KENA — stempel miring saat crash */}
      {frame >= crash && frame < recover && (
        <div
          style={{
            position: "absolute",
            top: 700,
            left: 96,
            padding: "14px 32px",
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(220,38,38,0.96), rgba(153,27,27,0.96))",
            border: "2px solid rgba(255,255,255,0.5)",
            boxShadow:
              "0 18px 60px rgba(220,38,38,0.5), inset 0 0 0 3px rgba(0,0,0,0.25), inset 0 0 34px rgba(255,255,255,0.12)",
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 54,
            color: "#FFFFFF",
            letterSpacing: 3,
            opacity: clamp01(stampS),
            transform: `rotate(-6deg) scale(${0.55 + 0.45 * clamp01(stampS)})`,
            zIndex: 14,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 6, opacity: 0.85, marginBottom: 2 }}>ALERT</div>
          SL KENA!
        </div>
      )}

      {/* ticket hasil — win: harga jalan hijau / loss: masih turun merah */}
      {frame >= recover && (
        <div
          style={{
            position: "absolute",
            top: 660,
            right: 80,
            padding: "18px 28px",
            borderRadius: 20,
            background: pnlTone === "loss" ? "rgba(39,8,8,0.82)" : "rgba(6,39,32,0.82)",
            border: pnlTone === "loss" ? "1px solid rgba(248,113,113,0.55)" : "1px solid rgba(52,211,153,0.55)",
            backdropFilter: "blur(10px)",
            boxShadow:
              pnlTone === "loss"
                ? "0 20px 70px rgba(153,27,27,0.45), 0 0 44px rgba(248,113,113,0.22)"
                : "0 20px 70px rgba(5,150,105,0.4), 0 0 44px rgba(52,211,153,0.22)",
            fontFamily: FONT,
            zIndex: 14,
            textAlign: "right",
            opacity: clamp01(winS),
            transform: `scale(${0.7 + 0.3 * clamp01(winS)})`,
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 4, color: pnlTone === "loss" ? "#FCA5A5" : "#6EE7B7" }}>{pnlLabel}</div>
          <div
            style={{
              marginTop: 4,
              fontSize: 56,
              fontWeight: 900,
              color: "#FFFFFF",
              fontVariantNumeric: "tabular-nums",
              textShadow: pnlTone === "loss" ? "0 0 34px rgba(248,113,113,0.75)" : "0 0 34px rgba(52,211,153,0.75)",
              lineHeight: 1,
            }}
          >
            {pnlTarget >= 0 ? "+" : "-"}${Math.abs(pnl).toFixed(2)}
          </div>
        </div>
      )}
    </SceneShell>
  );
};

const PAIN_RE = /(SL|KENA|MC|FOMO|HABIS|BANTAI|MEPET|SIAL|JEBOL)/i;
const WIN_RE = /(JALAN|CUAN|PROFIT|SISTEM|NAIK|BUFFER|AMAN|SWEEP|LIKUIDITAS|ZONA|ENTRY|TARGET|DEMAND|SINYAL)/i;

/* kata ter-highlight merah (pain) / teal (win) — gaya judul reel */
const titleWordColor = (w: string): string => {
  if (PAIN_RE.test(w)) return "#F87171";
  if (WIN_RE.test(w)) return "#2DD4BF";
  return "#FFFFFF";
};

/** Kata tunggal dengan pop-in spring — TikTok style word timing. */
const PopWord: React.FC<{
  word: string;
  accent: string;
  matcher: RegExp;
  index: number;
  delay: number;
}> = ({ word, accent, matcher, index, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    fps,
    frame: Math.max(0, frame - delay - index * 4), /* jeda antar-kata lebih lega */
    config: { damping: 16, stiffness: 150, mass: 0.9 },
  });
  return (
    <span
      style={{
        display: "inline-block",
        marginRight: 14,
        color: matcher.test(word) ? accent : "#FFFFFF",
        opacity: clamp01(s),
        transform: `translateY(${(1 - clamp01(s)) * 26}px) scale(${0.7 + 0.3 * clamp01(s)})`,
        textShadow:
          matcher.test(word)
            ? `0 0 30px ${accent}66, 0 2px 18px rgba(0,0,0,0.65)`
            : "0 2px 18px rgba(0,0,0,0.65)",
      }}
    >
      {word}
    </span>
  );
};

/* ---------------- point — kartu bernomor + centang ---------------- */

const PointScene: React.FC<{ title: string; sub: string; badge: number; durationInFrames: number }> = ({ title, sub, badge, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardS = spring({ fps, frame: Math.max(0, frame - 2), config: { damping: 17, stiffness: 110 } });
  const tickP = interpolate(frame, [30, 56], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const num = String(badge).padStart(2, "0");

  return (
    <SceneShell durationInFrames={durationInFrames}>
      <div
        style={{
          position: "absolute",
          top: 600,
          left: 90,
          right: 90,
          padding: "56px 54px",
          borderRadius: 44,
          ...CARD,
          boxShadow: "0 30px 90px rgba(0,0,0,0.5)",
          opacity: clamp01(cardS),
          transform: `translateY(${(1 - cardS) * 120}px) rotate(${(1 - cardS) * -3}deg)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 28,
              background: `linear-gradient(135deg, ${C.accentDeep}, ${C.accent})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT,
              fontWeight: 900,
              fontSize: 40,
              color: "#04121a",
              boxShadow: "0 12px 40px rgba(34,211,238,0.4)",
            }}
          >
            {num}
          </div>
          <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 26, color: C.muted, letterSpacing: 4 }}>
            INSIGHT
          </div>
        </div>

        <div
          style={{
            marginTop: 40,
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 76,
            lineHeight: 1.06,
            color: C.white,
            textShadow: "0 0 40px rgba(34,211,238,0.3)",
          }}
        >
          {title}
        </div>
        <div style={{ marginTop: 24, fontFamily: FONT, fontWeight: 500, fontSize: 34, color: C.muted, lineHeight: 1.35 }}>
          {sub}
        </div>

        {/* centang animasi */}
        <svg width={72} height={72} viewBox="0 0 72 72" style={{ marginTop: 36 }}>
          <circle cx={36} cy={36} r={32} fill="none" stroke={C.green} strokeWidth={4} opacity={0.35} />
          <path
            d="M 20 38 L 32 50 L 52 26"
            fill="none"
            stroke={C.green}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="60"
            strokeDashoffset={60 * (1 - tickP)}
            style={{ filter: "drop-shadow(0 0 8px rgba(52,211,153,0.7))" }}
          />
        </svg>

        {/* strip candle mini — gelombang deterministik amplitudo besar,
            candle chunky keliatan jelas (Bos 26-11: "bukan teks aja sama
            animasi biasa") */}
        <div style={{ marginTop: 34 }}>
          <svg width="100%" height={84} viewBox="0 0 620 84" preserveAspectRatio="none">
            {(() => {
              const MINI_N = 12;
              const wave = (i: number) =>
                0.5 + Math.sin(i * 0.85 + badge * 1.37) * 0.3 + Math.cos(i * 0.42 + badge) * 0.06;
              const y = (v: number) => 4 + (1 - clamp01(v)) * 76;
              return Array.from({ length: MINI_N }).map((_, i) => {
                const ap = spring({ fps, frame: Math.max(0, frame - 30 - i * 3), config: SPRING_POP });
                const o = i === 0 ? wave(0) : wave(i - 1);
                const c = wave(i);
                const h = Math.max(o, c) + 0.07;
                const l = Math.min(o, c) - 0.07;
                const up = c >= o;
                const color = up ? C.green : C.red;
                const xMid = 620 * (i / (MINI_N - 1)) + 10;
                const bw = 26;
                const bodyTopY = y(Math.max(o, c));
                const bodyH = Math.max(4, Math.abs(y(o) - y(c)));
                return (
                  <g key={i} opacity={clamp01(ap)} transform={`translate(0 ${(1 - clamp01(ap)) * 24})`}>
                    <line x1={xMid} x2={xMid} y1={y(h)} y2={y(l)} stroke={color} strokeWidth={2.4} opacity={0.8} />
                    <rect x={xMid - bw / 2} y={bodyTopY} width={bw} height={bodyH} rx={2.5} fill={color} opacity={0.92} />
                  </g>
                );
              });
            })()}
          </svg>
        </div>
      </div>
    </SceneShell>
  );
};

/* ---------------- kartu chart: langkah gambar + stickman (gaya reel ref) ----------------
   Judul besar atas → pill langkah (sinkron VO) → kartu chart dengan
   alat gambar berurutan + Stickman yang jalan/nunjuk → caption polos. */

import { type StickmanPose } from "./components/Stickman";

const CardStepsScene: React.FC<{
  title: string;
  sub: string;
  draw?: TerminalStep[];
  path?: number[];
  seed: number;
  durationInFrames: number;
  poses: StickmanPose[];
}> = ({ title, sub, draw, path, seed, durationInFrames, poses }) => {
  const frame = useCurrentFrame();
  const steps = Array.isArray(draw) ? draw.slice(0, 6) : [];
  const active = activeCardStep(steps.length, frame, durationInFrames);
  return (
    <SceneShell durationInFrames={durationInFrames}>
      <BigTitle lines={[title]} size={72} />
      <StepPills steps={steps} active={active} />
      <div
        style={{
          position: "absolute",
          top: 448,
          left: "50%",
          marginLeft: -484,
          zIndex: 10,
        }}
      >
        <ChartCard
          width={968}
          height={1130}
          seed={seed}
          path={path}
          steps={steps}
          durationInFrames={durationInFrames}
          stickPoses={poses}
          symbol="XAUUSD"
          tf="1 JAM"
        />
      </div>
      <PlainCaption text={sub} delay={20} />
    </SceneShell>
  );
};

const ChartScene: React.FC<{ title: string; sub: string; draw?: TerminalStep[]; path?: number[]; seed: number; durationInFrames: number }> = (props) => (
  <CardStepsScene {...props} poses={["walk", "point", "point", "celebrate"]} />
);

const TutorialScene: React.FC<{ title: string; sub: string; draw?: TerminalStep[]; path?: number[]; seed: number; durationInFrames: number }> = (props) => (
  <CardStepsScene {...props} poses={["point", "idle", "shock", "point"]} />
);

/* ---------------- quote — kartu kutipan + bintang ---------------- */

const QuoteScene: React.FC<{ title: string; sub: string; durationInFrames: number }> = ({ title, sub, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardS = spring({ fps, frame: Math.max(0, frame - 2), config: { damping: 18, stiffness: 105 } });
  return (
    <SceneShell durationInFrames={durationInFrames}>
      <div
        style={{
          position: "absolute",
          top: 620,
          left: 90,
          right: 90,
          padding: "60px 56px",
          borderRadius: 44,
          ...CARD,
          textAlign: "center",
          opacity: clamp01(cardS),
          transform: `translateY(${(1 - cardS) * 110}px)`,
        }}
      >
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 130, color: C.accent, lineHeight: 0.6, opacity: 0.9 }}>
          “
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 62, lineHeight: 1.15, color: C.white, marginTop: 8 }}>
          {title}
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 34, color: C.muted, marginTop: 26, lineHeight: 1.4 }}>
          {sub}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 40 }}>
          {[0, 1, 2, 3, 4].map((i) => {
            const s = spring({ fps, frame: Math.max(0, frame - 26 - i * 7), config: SPRING_SOFT });
            return (
              <svg key={i} width={40} height={40} viewBox="0 0 24 24" style={{ opacity: clamp01(s), transform: `scale(${0.5 + 0.5 * s})` }}>
                <path
                  d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"
                  fill={C.accent}
                />
              </svg>
            );
          })}
        </div>
      </div>
    </SceneShell>
  );
};

/* ---------------- stat — angka count-up + bar ---------------- */

const StatScene: React.FC<{ title: string; sub: string; durationInFrames: number }> = ({ title, sub, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const match = title.match(/-?\d+([.,]\d+)?/);
  const numPart = match ? match[0].replace(",", ".") : null;
  const target = numPart ? parseFloat(numPart) : null;
  const shown = target != null
    ? interpolate(frame, [10, 64], [0, target], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })
    : null;
  const bigText = shown != null
    ? (target != null && Math.abs(target) >= 100 ? Math.round(shown).toString() : shown.toFixed(2).replace(/\.?0+$/, "")) + (title.includes("%") ? "%" : "")
    : title;
  const s = pop(frame, fps, 2);

  const bars = [0.62, 0.86, 0.72];
  return (
    <SceneShell durationInFrames={durationInFrames}>
      <div
        style={{
          position: "absolute",
          top: 640,
          left: 80,
          right: 80,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 190,
            lineHeight: 1,
            color: C.accent,
            textShadow: "0 0 90px rgba(34,211,238,0.55)",
            opacity: clamp01(s),
            transform: `scale(${0.8 + 0.2 * s})`,
          }}
        >
          {bigText}
        </div>
        <div style={{ marginTop: 26, fontFamily: FONT, fontWeight: 500, fontSize: 36, color: C.muted, maxWidth: 860, ...rise(frame, 16, 30) }}>
          {sub}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 34, marginTop: 64, height: 210 }}>
          {bars.map((h, i) => {
            const p = spring({ fps, frame: Math.max(0, frame - 30 - i * 10), config: SPRING_SOFT });
            return (
              <div
                key={i}
                style={{
                  width: 96,
                  height: 210 * h * p,
                  borderRadius: 20,
                  background: i === 1 ? `linear-gradient(180deg, ${C.accent}, ${C.accentDeep})` : "rgba(255,255,255,0.12)",
                  boxShadow: i === 1 ? "0 0 34px rgba(34,211,238,0.45)" : "none",
                }}
              />
            );
          })}
        </div>
      </div>
    </SceneShell>
  );
};

/* ---------------- cta — MOCKUP APP + FOLLOW (Bos: bukan teks doang) ----------------
   Tampilkan APP-nya beneran: kartu sinyal XAUUSD BUY dengan ENTRY/SL/TP,
   progress TP hit, hasil hari ini count-up, baru CTA follow + domain. */

const SignalRow: React.FC<{ label: string; value: string; color: string; delay: number; done?: boolean }> = ({ label, value, color, delay, done }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ fps, frame: Math.max(0, frame - delay), config: { damping: 17, stiffness: 130 } });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "15px 0",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        opacity: clamp01(s),
        transform: `translateX(${(1 - s) * 44}px)`,
      }}
    >
      <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 25, color: C.muted, letterSpacing: 1 }}>{label}</span>
      <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 27, color, fontVariantNumeric: "tabular-nums" }}>
        {done ? "\u2713 " : ""}
        {value}
      </span>
    </div>
  );
};

const CtaScene: React.FC<{ title: string; sub: string; domain: string; handle: string; durationInFrames: number }> = ({ title, sub, domain, handle, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneS = spring({ fps, frame: Math.max(0, frame - 4), config: { damping: 17, stiffness: 105 } });
  const pillS = spring({ fps, frame: Math.max(0, frame - 48), config: { damping: 15, stiffness: 130 } });
  const glow = 0.5 + 0.5 * Math.sin(frame / 20);
  const floatY = Math.sin(frame / 26) * 10;
  const floatY2 = Math.sin(frame / 20 + 1.7) * 12;
  const prog = interpolate(frame, [46, 92], [12, 68], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pnl = interpolate(frame, [50, 104], [0, 187.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  return (
    <SceneShell durationInFrames={durationInFrames}>
      {/* glow orb cyan di belakang HP — depth + brand glow */}
      <div
        style={{
          position: "absolute",
          top: 300,
          left: "50%",
          marginLeft: -420,
          width: 840,
          height: 840,
          borderRadius: 999,
          background: "radial-gradient(circle, rgba(34,211,238,0.16) 0%, rgba(59,130,246,0.07) 45%, rgba(0,0,0,0) 70%)",
          filter: "blur(6px)",
          opacity: clamp01(phoneS) * (0.75 + 0.25 * glow),
          zIndex: 0,
        }}
      />

      {/* judul atas — kata kunci di-highlight */}
      <div style={{ position: "absolute", top: 150, left: 60, right: 60, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 14, zIndex: 12 }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 72, color: "#FFFFFF", textShadow: "0 0 50px rgba(34,211,238,0.4)", ...rise(frame, 0, 36) }}>
          {title.split(/\s+/).map((w, i) => (
            <span key={i} style={{ color: WIN_RE.test(w) ? "#22D3EE" : "#FFFFFF" }}>{w} </span>
          ))}
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 31, color: C.muted, maxWidth: 860, ...rise(frame, 8, 26) }}>
          {sub}
        </div>
      </div>

      {/* chip mengapung kiri — ENTRY HIT */}
      <div
        style={{
          position: "absolute",
          top: 560,
          left: 44,
          padding: "14px 22px",
          borderRadius: 16,
          background: "rgba(3,6,12,0.62)",
          border: "1px solid rgba(34,211,238,0.4)",
          backdropFilter: "blur(8px)",
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: 24,
          color: "#22D3EE",
          boxShadow: "0 12px 40px rgba(0,0,0,0.4), 0 0 26px rgba(34,211,238,0.25)",
          opacity: clamp01(phoneS) * 0.95,
          transform: `translateY(${floatY}px)`,
          zIndex: 12,
        }}
      >
        ENTRY HIT ✓
      </div>

      {/* chip mengapung kanan — TP1 CUAICNG (count-up) */}
      <div
        style={{
          position: "absolute",
          top: 480,
          right: 40,
          padding: "14px 22px",
          borderRadius: 16,
          background: "rgba(6,39,32,0.7)",
          border: "1px solid rgba(52,211,153,0.5)",
          backdropFilter: "blur(8px)",
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: 24,
          color: "#34D399",
          textShadow: "0 0 22px rgba(52,211,153,0.6)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.4), 0 0 26px rgba(52,211,153,0.25)",
          opacity: clamp01(pillS),
          transform: `translateY(${floatY2}px)`,
          fontVariantNumeric: "tabular-nums",
          zIndex: 12,
        }}
      >
        +${pnl.toFixed(2)} ✓
      </div>

      {/* mockup HP — app LuxTradee */}
      <div
        style={{
          position: "absolute",
          top: 500,
          left: "50%",
          width: 640,
          marginLeft: -320,
          borderRadius: 54,
          background: "linear-gradient(180deg, #0B1220, #0A0F1A)",
          border: "3px solid rgba(34,211,238,0.4)",
          boxShadow: "0 40px 120px rgba(0,0,0,0.65), 0 0 90px rgba(34,211,238,0.16)",
          padding: "34px 38px",
          opacity: clamp01(phoneS),
          transform: `translateY(${(1 - phoneS) * 130 + floatY}px) scale(${0.94 + 0.06 * clamp01(phoneS)})`,
          zIndex: 11,
        }}
      >
        {/* app bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 26 }}>
          <div style={{ width: 12, height: 12, borderRadius: 999, background: C.green, boxShadow: "0 0 10px rgba(52,211,153,0.9)" }} />
          <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 26, letterSpacing: 5, color: "#FFFFFF" }}>LUXTRADEE</span>
          <span
            style={{
              marginLeft: "auto",
              padding: "6px 16px",
              borderRadius: 999,
              background: "rgba(52,211,153,0.16)",
              color: C.green,
              fontWeight: 800,
              fontSize: 20,
              letterSpacing: 1,
            }}
          >
            AKTIF
          </span>
        </div>

        {/* kartu sinyal */}
        <div style={{ padding: "26px 30px", borderRadius: 26, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(34,211,238,0.25)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
            <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 34, color: "#FFFFFF" }}>XAUUSD</span>
            <span style={{ padding: "6px 18px", borderRadius: 10, background: "rgba(52,211,153,0.18)", color: C.green, fontWeight: 900, fontSize: 24 }}>BUY</span>
            <span style={{ marginLeft: "auto", fontFamily: FONT, fontWeight: 700, fontSize: 22, color: C.muted }}>M15</span>
          </div>
          <SignalRow label="ENTRY" value="3.646.20" color="#22D3EE" delay={16} />
          <SignalRow label="STOP LOSS" value="3.641.80" color="#F87171" delay={22} />
          <SignalRow label="TAKE PROFIT 1" value="3.652.40" color="#34D399" delay={28} done />
          <SignalRow label="TAKE PROFIT 2" value="3.658.90" color="#34D399" delay={34} />

          {/* progress TP */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 22, color: C.muted }}>PROGRES</span>
              <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 22, color: C.green }}>{"TP1 HIT \u2713"}</span>
            </div>
            <div style={{ height: 14, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${prog}%`,
                  background: `linear-gradient(90deg, ${C.accentDeep}, ${C.accent})`,
                  boxShadow: "0 0 16px rgba(34,211,238,0.5)",
                }}
              />
            </div>
          </div>
        </div>

        {/* hasil hari ini — count-up */}
        <div
          style={{
            marginTop: 26,
            padding: "20px 26px",
            borderRadius: 20,
            background: "rgba(52,211,153,0.1)",
            border: "1px solid rgba(52,211,153,0.3)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 24, color: "#D1FAE5" }}>HASIL HARI INI</span>
          <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 30, color: C.green, fontVariantNumeric: "tabular-nums" }}>
            +${pnl.toFixed(2)}
          </span>
        </div>
      </div>

      {/* row fitur — isi gap antara HP dan CTA */}
      <div
        style={{
          position: "absolute",
          top: 1280,
          left: 60,
          right: 60,
          display: "flex",
          justifyContent: "center",
          gap: 16,
          zIndex: 12,
          flexWrap: "wrap",
        }}
      >
        {["✓ ENTRY JELAS", "✓ STOP LOGIS", "✓ JURNAL OTOMATIS"].map((t, i) => {
          const s = spring({ fps, frame: Math.max(0, frame - 34 - i * 9), config: { damping: 16, stiffness: 140 } });
          return (
            <div
              key={t}
              style={{
                padding: "16px 26px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(34,211,238,0.35)",
                backdropFilter: "blur(8px)",
                fontFamily: FONT,
                fontWeight: 800,
                fontSize: 26,
                color: "#22D3EE",
                opacity: clamp01(s),
                transform: `translateY(${(1 - clamp01(s)) * 30}px)`,
              }}
            >
              {t}
            </div>
          );
        })}
      </div>

      {/* CTA follow + domain */}
      <div style={{ position: "absolute", bottom: 200, left: 60, right: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 26, zIndex: 12 }}>
        <div
          style={{
            padding: "30px 70px",
            borderRadius: 999,
            background: `linear-gradient(90deg, ${C.accentDeep}, ${C.accent})`,
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 44,
            letterSpacing: 2,
            color: "#04121a",
            boxShadow: `0 0 ${34 + glow * 40}px rgba(34,211,238,${0.4 + glow * 0.35})`,
            opacity: clamp01(pillS),
            transform: `scale(${0.85 + 0.15 * clamp01(pillS)})`,
          }}
        >
          FOLLOW {handle.toUpperCase()}
        </div>
        {(() => {
          const d = rise(frame, 54, 30);
          return (
            <div
              style={{
                fontFamily: FONT,
                fontWeight: 700,
                fontSize: 36,
                color: "#FFFFFF",
                opacity: 0.9 * clamp01(d.opacity),
                transform: d.transform,
              }}
            >
              {domain}
            </div>
          );
        })()}
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 22,
            color: "rgba(255,255,255,0.45)",
            letterSpacing: 3,
            ...rise(frame, 64, 26),
          }}
        >
          SINYAL · JURNAL · DISIPLIN
        </div>
      </div>
    </SceneShell>
  );
};

/* ---------------- komposisi utama ---------------- */

export const SintaReels: React.FC<SintaReelsProps> = ({ scenes, handle, domain }) => {
  const frame = useCurrentFrame();

  const starts: number[] = [];
  const frames: number[] = [];
  let acc = 0;
  for (const scene of scenes) {
    starts.push(acc);
    const f = sceneFrames(scene.durationSec);
    frames.push(f);
    acc += f;
  }

  let activeIndex = 0;
  for (let i = 0; i < scenes.length; i++) {
    if (frame >= starts[i] && frame < starts[i] + frames[i]) activeIndex = i;
  }

  // nomor badge utk scene 'point' = urutan point ke-berapa
  let pointCount = 0;
  const pointBadges = scenes.map((s) => (normalizeKind(s.kind, scenes.indexOf(s), scenes.length) === "point" ? ++pointCount : 0));

  const seedBase = Math.abs(handle.length * 7 + scenes.length * 13) || 11;

  /* scene full-bleed (hook/chart/tutorial) = terminal 1080x1920 menempel
     ke seluruh layar — chrome global (brandchip/handle) disembunyikan biar
     bersih persis kayak reel @inzaghitrades. */
  const FULL_BLEED = new Set(["hook", "chart", "tutorial"]);
  const activeKind = normalizeKind(scenes[activeIndex]?.kind, activeIndex, scenes.length);
  const chromeHidden = FULL_BLEED.has(activeKind);

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily: FONT }}>
      <Backdrop />
      {/* 🎵 musik latar bebas-copyright di-bake ke MP4 (IG/TikTok API tidak bisa lampirkan musik library) */}
      <BackgroundMusic />
      <ProgressBar />
      {!chromeHidden && <BrandChip />}

      {scenes.map((scene, i) => {
        const kind = normalizeKind(scene.kind, i, scenes.length);
        return (
          <Sequence key={`${scene.voFile}-${i}`} from={starts[i]} durationInFrames={frames[i]} name={`Scene ${i + 1} · ${kind}`}>
            {scene.voFile ? <Audio src={staticFile(scene.voFile)} /> : null}
            {kind === "hook" ? <HookScene title={scene.title} sub={scene.sub} durationInFrames={frames[i]} seed={seedBase + i * 17} path={scene.path} entryY={scene.entryY} slY={scene.slY} pnl={scene.pnl} pnlLabel={scene.pnlLabel} pnlTone={scene.pnlTone} />
            : kind === "chart" ? <ChartScene title={scene.title} sub={scene.sub} draw={scene.draw} path={scene.path} seed={seedBase + i * 17} durationInFrames={frames[i]} />
            : kind === "tutorial" ? <TutorialScene title={scene.title} sub={scene.sub} draw={scene.draw} path={scene.path} seed={seedBase + i * 17} durationInFrames={frames[i]} />
            : kind === "quote" ? <QuoteScene title={scene.title} sub={scene.sub} durationInFrames={frames[i]} />
            : kind === "stat" ? <StatScene title={scene.title} sub={scene.sub} durationInFrames={frames[i]} />
            : kind === "cta" ? <CtaScene title={scene.title} sub={scene.sub} domain={domain} handle={handle} durationInFrames={frames[i]} />
            : <PointScene title={scene.title} sub={scene.sub} badge={Math.max(1, pointBadges[i])} durationInFrames={frames[i]} />}
          </Sequence>
        );
      })}

      <SceneDots activeIndex={activeIndex} total={scenes.length} bottom={chromeHidden ? 20 : 64} />
      {!chromeHidden && (
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
      )}
    </AbsoluteFill>
  );
};

/* ---------------- default props (fallback render test) ---------------- */

export const SINTA_DEFAULT_PROPS: SintaReelsProps = {
  scenes: [
    { kind: "hook", title: "SL KEBJAK TERUS?", sub: "bukan salah analisa — kamu entry kepagian", voFile: "vo/vo0.mp3", durationSec: 3.2 },
    {
      kind: "tutorial",
      title: "SWEEP DULU, BARU JALAN",
      sub: "equal highs = umpan — smart money narik dulu",
      voFile: "vo/vo1.mp3",
      durationSec: 4.4,
      draw: [
        { t: "high", y1: 0.84, label: "EQH", color: "red" },
        { t: "circle", x1: 0.66, y1: 0.86, label: "LIQUIDITY", color: "cyan" },
        { t: "path", x1: 0.62, y1: 0.8, x2: 0.3, y2: 0.3, label: "SWEEP", color: "cyan" },
        { t: "zone", x1: 0.12, x2: 0.45, y1: 0.34, y2: 0.2, label: "DEMAND", color: "green" },
      ],
    },
    { kind: "point", title: "TUNGGU SWEEP SELESAI", sub: "reaksi + displacement dulu, baru entry", voFile: "vo/vo2.mp3", durationSec: 3.6 },
    { kind: "cta", title: "CATAT TIAP SETUP", sub: "screenshot → luxtradee auto jurnal — link di bio", voFile: "vo/vo3.mp3", durationSec: 3.0 },
  ],
  handle: "@luxtradee",
  domain: "luxtradee.web.id",
};

export { FPS };
