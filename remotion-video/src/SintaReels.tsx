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
import { genCandles } from "./components/Chart";
import { activeStepIndex, ChartScreen, type TerminalStep } from "./components/ChartScreen";
import { HOOK_CRASH_FRAME, HookTerminal } from "./components/HookTerminal";
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

/* ---------------- hook — TERMINAL FULL-BLEED (Bos 26-11) ----------------
   Dulu: tipografi raksasa di layar kosong = "teks aja" (komplain Bos:
   "visual masih jelek"). Sekarang: LANGSUNG layar trading penuh sejak
   frame 0 — candle streaming, SL ditembus (flash merah + screen shake +
   stamp), lalu harga rally keras. Caption TikTok-style overlay bawah. */

const PAIN_RE = /(SL|KENA|MC|FOMO|HABIS|BANTAI|MEPET)/i;
const WIN_RE = /(JALAN|CUAN|PROFIT|SISTEM|NAIK|BUFFER)/i;

const HookCaption: React.FC<{
  text: string;
  accent: string;
  matcher: RegExp;
  delay: number;
  align?: "flex-start" | "flex-end";
}> = ({ text, accent, matcher, delay, align = "flex-start" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ fps, frame: Math.max(0, frame - delay), config: { damping: 14, stiffness: 220, mass: 0.9 } });
  return (
    <div
      style={{
        alignSelf: align,
        padding: "16px 34px",
        borderRadius: 20,
        background: "rgba(3,6,12,0.62)",
        border: "1px solid rgba(255,255,255,0.14)",
        backdropFilter: "blur(8px)",
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: 64,
        lineHeight: 1.08,
        color: "#FFFFFF",
        textShadow: "0 2px 18px rgba(0,0,0,0.6)",
        opacity: clamp01(s),
        transform: `translateY(${(1 - s) * 56}px) scale(${0.92 + 0.08 * clamp01(s)})`,
      }}
    >
      {text.split(/\s+/).map((w, i) => (
        <span key={i} style={{ color: matcher.test(w) ? accent : "#FFFFFF" }}>
          {w}{" "}
        </span>
      ))}
    </div>
  );
};

const HookScene: React.FC<{ title: string; sub: string; durationInFrames: number }> = ({ title, sub, durationInFrames }) => {
  return (
    <SceneShell durationInFrames={durationInFrames} instantIn>
      <HookTerminal durationInFrames={durationInFrames} />
      {/* caption TikTok-style — penonton scroll TANPA SUARA */}
      <div
        style={{
          position: "absolute",
          bottom: 200,
          left: 56,
          right: 56,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          zIndex: 12,
        }}
      >
        <HookCaption text={title} accent="#FF5F56" matcher={PAIN_RE} delay={14} />
        <HookCaption text={sub} accent="#2DD4A7" matcher={WIN_RE} delay={HOOK_CRASH_FRAME + 6} align="flex-end" />
      </div>
    </SceneShell>
  );
};

/* ---------------- point — kartu bernomor + centang ---------------- */

const PointScene: React.FC<{ title: string; sub: string; badge: number; durationInFrames: number }> = ({ title, sub, badge, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardS = spring({ fps, frame: Math.max(0, frame - 2), config: { damping: 15, stiffness: 160 } });
  const tickP = interpolate(frame, [22, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
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

        {/* strip candle mini — kartu tidak polos teks saja (Bos 26-11:
            "bukan teks aja sama animasi biasa") */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 7, height: 84, marginTop: 34 }}>
          {genCandles(badge * 17 + 5, badge % 2 === 0 ? "up" : "down", 22).map((cd, i) => {
            const ap = spring({ fps, frame: Math.max(0, frame - 26 - i * 1.5), config: SPRING_POP });
            const up = cd.c >= cd.o;
            const bodyTop = (1 - Math.max(cd.o, cd.c)) * 84;
            const bodyH = Math.max(3, Math.abs(cd.o - cd.c) * 84);
            return (
              <div key={i} style={{ flex: 1, opacity: clamp01(ap), transform: `scaleY(${Math.max(0.1, ap)})`, transformOrigin: "bottom" }}>
                <div style={{ width: "100%", height: 2, background: up ? C.green : C.red, opacity: 0.7, transform: `translateY(${cd.h * 84 - 84}px)` }} />
                <div style={{ width: "100%", height: bodyH, marginTop: bodyTop - 0, borderRadius: 3, background: up ? C.green : C.red, opacity: 0.9 }} />
              </div>
            );
          })}
        </div>
      </div>
    </SceneShell>
  );
};

/* ---------------- overlay chips bersama utk scene full-bleed ----------------
   Judul = chip glass di atas, sub = caption TikTok di bawah. Chart
   full-bleed = SELURUH layar (gaya reel @inzaghitrades). */

const SceneTitleChip: React.FC<{ text: string; delay?: number }> = ({ text, delay = 4 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ fps, frame: Math.max(0, frame - delay), config: { damping: 15, stiffness: 200 } });
  return (
    <div
      style={{
        alignSelf: "flex-start",
        padding: "16px 30px",
        borderRadius: 20,
        background: "rgba(3,6,12,0.62)",
        border: "1px solid rgba(34,211,238,0.3)",
        backdropFilter: "blur(8px)",
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: 52,
        lineHeight: 1.1,
        color: "#FFFFFF",
        textShadow: "0 2px 16px rgba(0,0,0,0.6)",
        opacity: clamp01(s),
        transform: `translateY(${(1 - s) * -50}px)`,
      }}
    >
      {text}
    </div>
  );
};

const SceneCaption: React.FC<{ text: string; delay?: number; accent?: boolean }> = ({ text, delay = 12, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ fps, frame: Math.max(0, frame - delay), config: { damping: 14, stiffness: 210 } });
  return (
    <div
      style={{
        alignSelf: "center",
        padding: "18px 36px",
        borderRadius: 20,
        background: "rgba(3,6,12,0.62)",
        border: "1px solid rgba(255,255,255,0.14)",
        backdropFilter: "blur(8px)",
        fontFamily: FONT,
        fontWeight: 800,
        fontSize: 38,
        lineHeight: 1.15,
        color: "#E5E7EB",
        textAlign: "center",
        opacity: clamp01(s),
        transform: `translateY(${(1 - s) * 46}px)`,
        boxShadow: accent ? "0 0 34px rgba(34,211,238,0.18)" : undefined,
      }}
    >
      {text}
    </div>
  );
};

/** Kamera push pelan sepanjang scene — chart terasa "hidup" terus.
 *  Origin TOP: top-bar terminal tidak terpotong saat zoom. */
const useCameraPush = (durationInFrames: number, from = 1.0, to = 1.055): string => {
  const frame = useCurrentFrame();
  const push = interpolate(frame, [0, durationInFrames], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  return `scale(${push})`;
};

/* ---------------- chart — TERMINAL FULL-BLEED seluruh layar ---------------- */

const ChartScene: React.FC<{ title: string; sub: string; draw?: TerminalStep[]; path?: number[]; seed: number; durationInFrames: number }> = ({ title, sub, draw, path, seed, durationInFrames }) => {
  const push = useCameraPush(durationInFrames);
  return (
    <SceneShell durationInFrames={durationInFrames}>
      <AbsoluteFill style={{ transform: push, transformOrigin: "50% 0%" }}>
        <ChartScreen
          width={1080}
          height={1920}
          fullBleed
          seed={seed}
          trend="flat"
          path={path}
          steps={draw}
          delay={2}
          durationInFrames={durationInFrames}
        />
      </AbsoluteFill>
      <div style={{ position: "absolute", top: 104, left: 56, right: 56, display: "flex", flexDirection: "column", gap: 12, zIndex: 12 }}>
        <SceneTitleChip text={title} />
      </div>
      <div style={{ position: "absolute", bottom: 170, left: 56, right: 56, display: "flex", flexDirection: "column", zIndex: 12 }}>
        <SceneCaption text={sub} delay={14} />
      </div>
    </SceneShell>
  );
};

/* ---------------- tutorial — terminal full-bleed + langkah gambar sinkron VO ---------------- */

const TutorialScene: React.FC<{ title: string; sub: string; draw?: TerminalStep[]; path?: number[]; seed: number; durationInFrames: number }> = ({ title, sub, draw, path, seed, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const steps = Array.isArray(draw) ? draw.slice(0, 6) : [];
  const active = activeStepIndex(steps.length, frame, durationInFrames);
  const chip = spring({ fps, frame: Math.max(0, frame - 6), config: { damping: 15, stiffness: 200 } });
  const push = useCameraPush(durationInFrames);
  return (
    <SceneShell durationInFrames={durationInFrames}>
      {/* terminal full-bleed — HERO */}
      <AbsoluteFill style={{ transform: push, transformOrigin: "50% 0%" }}>
        <ChartScreen
          width={1080}
          height={1920}
          fullBleed
          seed={seed}
          trend="flat"
          path={path}
          steps={steps}
          delay={2}
          durationInFrames={durationInFrames}
        />
      </AbsoluteFill>

      {/* judul kiri + penghitung LANGKAH kanan (ikut langkah gambar = ikut VO) */}
      <div
        style={{
          position: "absolute",
          top: 104,
          left: 56,
          right: 56,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          zIndex: 12,
        }}
      >
        <SceneTitleChip text={title} delay={4} />
        {steps.length > 0 && (
          <div
            key={active}
            style={{
              flexShrink: 0,
              marginTop: 8,
              padding: "14px 28px",
              borderRadius: 999,
              background: `linear-gradient(90deg, ${C.accentDeep}, ${C.accent})`,
              color: "#04121a",
              fontFamily: FONT,
              fontWeight: 900,
              fontSize: 27,
              letterSpacing: 2,
              boxShadow: "0 0 30px rgba(34,211,238,0.45)",
              whiteSpace: "nowrap",
              opacity: clamp01(chip),
              transform: `scale(${0.8 + 0.2 * clamp01(chip)})`,
            }}
          >
            LANGKAH {Math.max(1, active + 1)}/{steps.length}
          </div>
        )}
      </div>

      {/* caption TikTok — penonton scroll tanpa suara */}
      <div style={{ position: "absolute", bottom: 170, left: 56, right: 56, display: "flex", flexDirection: "column", zIndex: 12 }}>
        <SceneCaption text={sub} delay={12} accent />
      </div>
    </SceneShell>
  );
};

/* ---------------- quote — kartu kutipan + bintang ---------------- */

const QuoteScene: React.FC<{ title: string; sub: string; durationInFrames: number }> = ({ title, sub, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardS = spring({ fps, frame: Math.max(0, frame - 2), config: { damping: 16, stiffness: 150 } });
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
            const s = spring({ fps, frame: Math.max(0, frame - 18 - i * 5), config: SPRING_SOFT });
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
    ? interpolate(frame, [6, 44], [0, target], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })
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
            const p = spring({ fps, frame: Math.max(0, frame - 24 - i * 8), config: SPRING_SOFT });
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
  const s = spring({ fps, frame: Math.max(0, frame - delay), config: { damping: 16, stiffness: 190 } });
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
  const phoneS = spring({ fps, frame: Math.max(0, frame - 4), config: { damping: 14, stiffness: 150 } });
  const pillS = spring({ fps, frame: Math.max(0, frame - 30), config: { damping: 12, stiffness: 180 } });
  const glow = 0.5 + 0.5 * Math.sin(frame / 14);
  const floatY = Math.sin(frame / 18) * 10;
  const prog = interpolate(frame, [36, 64], [12, 68], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pnl = interpolate(frame, [40, 72], [0, 187.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  return (
    <SceneShell durationInFrames={durationInFrames}>
      {/* judul atas */}
      <div style={{ position: "absolute", top: 150, left: 60, right: 60, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 14, zIndex: 12 }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 72, color: "#FFFFFF", textShadow: "0 0 50px rgba(34,211,238,0.4)", ...rise(frame, 0, 36) }}>
          {title}
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 31, color: C.muted, maxWidth: 860, ...rise(frame, 8, 26) }}>
          {sub}
        </div>
      </div>

      {/* mockup HP — app LuxTradee */}
      <div
        style={{
          position: "absolute",
          top: 420,
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
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 36, color: "#FFFFFF", opacity: 0.9, ...rise(frame, 40, 24) }}>
          {domain}
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
            {kind === "hook" ? <HookScene title={scene.title} sub={scene.sub} durationInFrames={frames[i]} />
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
