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
import { CandleChart, ChartPanel } from "./components/Chart";
import { BrandChip, C, CARD, FONT, ProgressBar, SceneDots, clamp01, pop, rise, SceneShell } from "./components/Ui";
import { FPS, sceneFrames, type SceneProps } from "./LuxtradePromo";

/* ============================================================
   SintaReels — komposisi DATA-DRIVEN untuk konten edukasi/insight
   ============================================================
   Berbeda dgn LuxtradePromo (5 scene produk tetap), komposisi ini
   merender scene APAPUN dari spesifikasi Sinta (LLM) via `kind`:
     hook  → tipografi raksasa kata-per-kata + underline swipe
     point → kartu bernomor + centang animasi
     chart → panel candlestick animasi (nuansa pasar)
     quote → kartu kutipan + bintang
     stat  → angka raksasa count-up + bar
     cta   → pil CTA glow + domain
   Audio voiceover opsional (voFile). Dipakai utk template 'tip'. */

export interface ReelsScene extends SceneProps {
  kind?: string;
}

export interface SintaReelsProps {
  scenes: ReelsScene[];
  handle: string;
  domain: string;
}

export const totalReelsFrames = (scenes: ReelsScene[]): number =>
  Math.max(1, scenes.reduce((sum, s) => sum + sceneFrames(s.durationSec), 0));

const KINDS = ["hook", "point", "chart", "quote", "stat", "cta"] as const;
type Kind = (typeof KINDS)[number];

const normalizeKind = (k: string | undefined, index: number, total: number): Kind => {
  if (k && (KINDS as readonly string[]).includes(k)) return k as Kind;
  if (index === 0) return "hook";
  if (index === total - 1) return "cta";
  return "point";
};

/* ---------------- hook — tipografi kata-per-kata ---------------- */

const HookScene: React.FC<{ title: string; sub: string; durationInFrames: number }> = ({ title, sub, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = title.split(/\s+/).slice(0, 4);

  const ringP = interpolate(frame, [0, 90], [0, 1], { extrapolateRight: "extend" });
  const ringScale = 0.85 + 0.3 * Math.sin(ringP * Math.PI * 2);

  return (
    <SceneShell durationInFrames={durationInFrames}>
      {/* cincin denyut latar */}
      <div
        style={{
          position: "absolute",
          top: 640,
          left: "50%",
          width: 760,
          height: 760,
          marginLeft: -380,
          borderRadius: "50%",
          border: "3px solid rgba(34,211,238,0.28)",
          transform: `scale(${ringScale})`,
          opacity: 0.5,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 640,
          left: "50%",
          width: 540,
          height: 540,
          marginLeft: -270,
          borderRadius: "50%",
          border: "2px solid rgba(59,130,246,0.2)",
          transform: `scale(${2 - ringScale})`,
          opacity: 0.4,
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 620,
          left: 70,
          right: 70,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        {words.map((w, i) => {
          const s = spring({ fps, frame: Math.max(0, frame - i * 7), config: { damping: 12, stiffness: 200, mass: 0.9 } });
          return (
            <div
              key={i}
              style={{
                fontFamily: FONT,
                fontWeight: 900,
                fontSize: 118,
                lineHeight: 1.02,
                letterSpacing: 1,
                color: i === words.length - 1 ? C.accent : C.white,
                textShadow: "0 0 60px rgba(34,211,238,0.45)",
                opacity: clamp01(s),
                transform: `translateY(${(1 - s) * 110}px) rotate(${(1 - s) * -4}deg)`,
              }}
            >
              {w}
            </div>
          );
        })}

        {/* underline swipe */}
        {(() => {
          const p = interpolate(frame, [words.length * 7 + 6, words.length * 7 + 22], [0, 1], { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              style={{
                marginTop: 22,
                width: 360 * p,
                height: 14,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${C.accentDeep}, ${C.accent})`,
                boxShadow: "0 0 26px rgba(34,211,238,0.6)",
              }}
            />
          );
        })()}

        <div
          style={{
            marginTop: 34,
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: 38,
            color: C.muted,
            maxWidth: 880,
            ...rise(frame, words.length * 7 + 10, 34),
          }}
        >
          {sub}
        </div>
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
      </div>
    </SceneShell>
  );
};

/* ---------------- chart — panel candlestick ---------------- */

const ChartScene: React.FC<{ title: string; sub: string; seed: number; durationInFrames: number }> = ({ title, sub, seed, durationInFrames }) => {
  const frame = useCurrentFrame();
  const r = rise(frame, 4, 44);
  return (
    <SceneShell durationInFrames={durationInFrames}>
      <div style={{ position: "absolute", top: 560, left: 80, right: 80, ...r }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 64, color: C.white, textAlign: "center", textShadow: "0 0 44px rgba(34,211,238,0.4)", marginBottom: 18 }}>
          {title}
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 32, color: C.muted, textAlign: "center", marginBottom: 36 }}>
          {sub}
        </div>
        <ChartPanel>
          <CandleChart seed={seed} trend="up" width={840} height={520} delay={8} />
        </ChartPanel>
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

/* ---------------- cta — pil glow + domain ---------------- */

const CtaScene: React.FC<{ title: string; sub: string; domain: string; durationInFrames: number }> = ({ title, sub, domain, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pillS = spring({ fps, frame: Math.max(0, frame - 4), config: { damping: 12, stiffness: 180 } });
  const glow = 0.5 + 0.5 * Math.sin(frame / 14);
  const arrowY = Math.sin(frame / 10) * 12;
  return (
    <SceneShell durationInFrames={durationInFrames}>
      <div style={{ position: "absolute", top: 660, left: 70, right: 70, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 84, color: C.white, textShadow: "0 0 50px rgba(34,211,238,0.4)", ...rise(frame, 0, 40) }}>
          {title}
        </div>
        <div style={{ marginTop: 18, fontFamily: FONT, fontWeight: 500, fontSize: 36, color: C.muted, maxWidth: 840, ...rise(frame, 8, 30) }}>
          {sub}
        </div>
        <div
          style={{
            marginTop: 74,
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
        <div style={{ marginTop: 26, fontSize: 60, color: C.accent, transform: `translateY(${arrowY}px)`, opacity: 0.9 }}>
          ↓
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

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily: FONT }}>
      <Backdrop />
      {/* 🎵 musik latar bebas-copyright di-bake ke MP4 (IG/TikTok API tidak bisa lampirkan musik library) */}
      <BackgroundMusic />
      <ProgressBar />
      <BrandChip />

      {scenes.map((scene, i) => {
        const kind = normalizeKind(scene.kind, i, scenes.length);
        return (
          <Sequence key={`${scene.voFile}-${i}`} from={starts[i]} durationInFrames={frames[i]} name={`Scene ${i + 1} · ${kind}`}>
            {scene.voFile ? <Audio src={staticFile(scene.voFile)} /> : null}
            {kind === "hook" ? <HookScene title={scene.title} sub={scene.sub} durationInFrames={frames[i]} />
            : kind === "chart" ? <ChartScene title={scene.title} sub={scene.sub} seed={seedBase + i * 17} durationInFrames={frames[i]} />
            : kind === "quote" ? <QuoteScene title={scene.title} sub={scene.sub} durationInFrames={frames[i]} />
            : kind === "stat" ? <StatScene title={scene.title} sub={scene.sub} durationInFrames={frames[i]} />
            : kind === "cta" ? <CtaScene title={scene.title} sub={scene.sub} domain={domain} durationInFrames={frames[i]} />
            : <PointScene title={scene.title} sub={scene.sub} badge={Math.max(1, pointBadges[i])} durationInFrames={frames[i]} />}
          </Sequence>
        );
      })}

      <SceneDots activeIndex={activeIndex} total={scenes.length} />
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

/* ---------------- default props (fallback render test) ---------------- */

export const SINTA_DEFAULT_PROPS: SintaReelsProps = {
  scenes: [
    { kind: "hook", title: "SL KEBJAK TERUS?", sub: "bukan salah analisa — kamu entry kepagian", voFile: "vo/vo0.mp3", durationSec: 3.2 },
    { kind: "chart", title: "EQUAL HIGHS = UMPAN", sub: "liquidity numpuk di atas — smart money narik dulu", voFile: "vo/vo1.mp3", durationSec: 3.6 },
    { kind: "point", title: "TUNGGU SWEEP SELESAI", sub: "reaksi + displacement dulu, baru entry", voFile: "vo/vo2.mp3", durationSec: 3.6 },
    { kind: "cta", title: "CATAT TIAP SETUP", sub: "screenshot → luxtradee auto jurnal — link di bio", voFile: "vo/vo3.mp3", durationSec: 3.0 },
  ],
  handle: "@luxtradee",
  domain: "luxtradee.web.id",
};

export { FPS };
