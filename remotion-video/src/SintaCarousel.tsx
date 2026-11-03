import React from "react";
import { AbsoluteFill, random } from "remotion";
import { Backdrop } from "./components/Backdrop";
import { C, CARD, FONT } from "./components/Ui";
import { genCandles } from "./components/Chart";

/* ============================================================
   SintaCarousel — komposisi CAROUSEL Instagram 1080×1350 (4:5)
   ============================================================
   Konten carousel karyawan AI (Sinta, CMO) — dibuat untuk
   renderStill (PNG per slide), BUKAN video: semua slide STATIS
   (tanpa animasi frame) supaya pixel-perfect di frame apapun.

   Slide kinds:
     cover → slide 1: hook raksasa + underline + chart statis + "GESER →"
     point → kartu bernomor (isi slide)
     stat  → angka raksasa + sub
     chart → panel candlestick statis + title + sub
     quote → kartu kutipan
     cta   → slide terakhir: pil CTA + domain

   Props: { slides, index } → komposisi merender SATU slide
   (runner panggil renderStill N kali dgn index 0..N-1). */

export interface CarouselSlide {
  kind?: "cover" | "point" | "chart" | "stat" | "quote" | "cta";
  title: string;
  sub: string;
}

export interface SintaCarouselProps {
  slides: CarouselSlide[];
  /** Slide mana yang dirender (0-based). */
  index: number;
  handle: string;
  domain: string;
}

export const CAROUSEL_W = 1080;
export const CAROUSEL_H = 1350;

const KINDS = ["cover", "point", "chart", "stat", "quote", "cta"] as const;
type Kind = (typeof KINDS)[number];

const normalizeKind = (k: string | undefined, i: number, total: number): Kind => {
  if (k && (KINDS as readonly string[]).includes(k)) return k as Kind;
  if (i === 0) return "cover";
  if (i === total - 1) return "cta";
  return "point";
};

/* ---------------- chart statis (stills — tanpa animasi) ---------------- */

const StaticCandles: React.FC<{ seed: number; trend?: "up" | "down"; width?: number; height?: number }> = ({
  seed,
  trend = "up",
  width = 840,
  height = 380,
}) => {
  const candles = genCandles(seed, trend, 18);
  const n = candles.length;
  const slot = width / n;
  const bodyW = slot * 0.52;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* grid samar */}
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={0} x2={width} y1={height * g} y2={height * g} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
      {candles.map((cd, i) => {
        const x = i * slot + slot / 2;
        const up = cd.c >= cd.o;
        const color = up ? C.green : C.red;
        const yH = (1 - cd.h) * height;
        const yL = (1 - cd.l) * height;
        const yO = (1 - cd.o) * height;
        const yC = (1 - cd.c) * height;
        const top = Math.min(yO, yC);
        const h = Math.max(4, Math.abs(yC - yO));
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={yH} y2={yL} stroke={color} strokeWidth={2} opacity={0.75} />
            <rect x={x - bodyW / 2} y={top} width={bodyW} height={h} rx={3} fill={color} />
          </g>
        );
      })}
    </svg>
  );
};

/* ---------------- chrome statis ---------------- */

const BrandChipStatic: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 60,
      left: 56,
      zIndex: 10,
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "14px 24px 14px 16px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(34,211,238,0.25)",
      boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
    }}
  >
    <svg width={32} height={26} viewBox="0 0 36 28">
      <line x1={7} y1={3} x2={7} y2={25} stroke={C.green} strokeWidth={2} strokeLinecap="round" opacity={0.7} />
      <rect x={3.5} y={9} width={7} height={10} rx={2.5} fill={C.green} />
      <line x1={18} y1={5} x2={18} y2={23} stroke={C.red} strokeWidth={2} strokeLinecap="round" opacity={0.7} />
      <rect x={14.5} y={11} width={7} height={7} rx={2.5} fill={C.red} />
      <line x1={29} y1={2} x2={29} y2={26} stroke={C.accent} strokeWidth={2} strokeLinecap="round" opacity={0.85} />
      <rect x={25.5} y={7} width={7} height={13} rx={2.5} fill={C.accent} />
    </svg>
    <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, letterSpacing: 6, color: C.white }}>
      LUXTRADE
    </span>
  </div>
);

const PageIndicator: React.FC<{ index: number; total: number; handle: string }> = ({ index, total, handle }) => (
  <>
    {/* dots */}
    <div
      style={{
        position: "absolute",
        bottom: 78,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
        zIndex: 10,
      }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === index ? 34 : 10,
            height: 10,
            borderRadius: 999,
            background: i === index ? C.accent : "rgba(255,255,255,0.18)",
            boxShadow: i === index ? "0 0 14px rgba(34,211,238,0.5)" : "none",
          }}
        />
      ))}
    </div>
    {/* nomor halaman */}
    <div
      style={{
        position: "absolute",
        bottom: 66,
        right: 60,
        zIndex: 10,
        fontFamily: FONT,
        fontWeight: 800,
        fontSize: 26,
        letterSpacing: 2,
        color: C.muted,
        opacity: 0.85,
      }}
    >
      {String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}
    </div>
    {/* handle */}
    <div
      style={{
        position: "absolute",
        bottom: 66,
        left: 60,
        zIndex: 10,
        fontFamily: FONT,
        fontWeight: 500,
        fontSize: 24,
        color: C.muted,
        opacity: 0.6,
      }}
    >
      {handle}
    </div>
  </>
);

const SwipeHint: React.FC = () => (
  <div
    style={{
      position: "absolute",
      bottom: 120,
      right: 64,
      zIndex: 10,
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "14px 26px",
      borderRadius: 999,
      background: "rgba(34,211,238,0.12)",
      border: "1px solid rgba(34,211,238,0.4)",
      fontFamily: FONT,
      fontWeight: 800,
      fontSize: 28,
      letterSpacing: 3,
      color: C.accent,
    }}
  >
    GESER <span style={{ fontSize: 32 }}>→</span>
  </div>
);

const TitleBlockStatic: React.FC<{ title: string; sub?: string; titleSize?: number; accent?: boolean }> = ({
  title,
  sub,
  titleSize = 104,
  accent = false,
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 30, alignItems: "center", textAlign: "center" }}>
    <div
      style={{
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: titleSize,
        lineHeight: 1.06,
        letterSpacing: 1,
        color: C.white,
        textShadow: accent ? "0 0 60px rgba(34,211,238,0.5)" : "0 0 44px rgba(34,211,238,0.3)",
        maxWidth: 920,
      }}
    >
      {title}
    </div>
    {sub ? (
      <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 38, lineHeight: 1.4, color: C.muted, maxWidth: 860 }}>
        {sub}
      </div>
    ) : null}
  </div>
);

/* ---------------- slide kinds ---------------- */

const CoverSlide: React.FC<{ title: string; sub: string; seed: number }> = ({ title, sub, seed }) => (
  <>
    <div
      style={{
        position: "absolute",
        top: 220,
        left: 70,
        right: 70,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 36,
      }}
    >
      <div
        style={{
          padding: "12px 30px",
          borderRadius: 999,
          background: "rgba(34,211,238,0.1)",
          border: "1px solid rgba(34,211,238,0.35)",
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 26,
          letterSpacing: 6,
          color: C.accent,
        }}
      >
        EDUKASI TRADING
      </div>
      <TitleBlockStatic title={title} sub={sub} titleSize={112} accent />
      <div
        style={{
          width: 300,
          height: 14,
          borderRadius: 999,
          background: `linear-gradient(90deg, ${C.accentDeep}, ${C.accent})`,
          boxShadow: "0 0 30px rgba(34,211,238,0.6)",
        }}
      />
    </div>
    <div style={{ position: "absolute", bottom: 190, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: 0.9 }}>
      <StaticCandles seed={seed} width={860} height={330} />
    </div>
    <SwipeHint />
  </>
);

const PointSlide: React.FC<{ title: string; sub: string; badge: number }> = ({ title, sub, badge }) => (
  <>
    {/* angka ghost raksasa di belakang */}
    <div
      style={{
        position: "absolute",
        top: 130,
        right: 60,
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: 380,
        lineHeight: 1,
        color: "rgba(34,211,238,0.08)",
      }}
    >
      {String(badge).padStart(2, "0")}
    </div>
    <div
      style={{
        position: "absolute",
        top: 340,
        left: 80,
        right: 80,
        padding: "70px 60px",
        borderRadius: 48,
        ...CARD,
        boxShadow: "0 30px 90px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: 30,
            background: `linear-gradient(135deg, ${C.accentDeep}, ${C.accent})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 42,
            color: "#04121a",
            boxShadow: "0 12px 40px rgba(34,211,238,0.4)",
          }}
        >
          {String(badge).padStart(2, "0")}
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 27, color: C.muted, letterSpacing: 5 }}>
          INSIGHT
        </div>
      </div>
      <div
        style={{
          marginTop: 44,
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: 82,
          lineHeight: 1.08,
          color: C.white,
          textShadow: "0 0 40px rgba(34,211,238,0.3)",
        }}
      >
        {title}
      </div>
      <div style={{ marginTop: 28, fontFamily: FONT, fontWeight: 500, fontSize: 38, lineHeight: 1.4, color: C.muted }}>
        {sub}
      </div>
    </div>
  </>
);

const StatSlide: React.FC<{ title: string; sub: string }> = ({ title, sub }) => {
  const match = title.match(/-?\d+([.,]\d+)?/);
  const numPart = match ? match[0].replace(",", ".") : null;
  const big = numPart != null
    ? (Math.abs(parseFloat(numPart)) >= 100 ? String(Math.round(parseFloat(numPart))) : numPart) + (title.includes("%") ? "%" : "")
    : title;
  return (
    <div
      style={{
        position: "absolute",
        top: 380,
        left: 70,
        right: 70,
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
          fontSize: 210,
          lineHeight: 1,
          color: C.accent,
          textShadow: "0 0 90px rgba(34,211,238,0.55)",
        }}
      >
        {big}
      </div>
      <div style={{ marginTop: 40, fontFamily: FONT, fontWeight: 500, fontSize: 40, color: C.muted, maxWidth: 860, lineHeight: 1.4 }}>
        {sub}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 34, marginTop: 70, height: 180 }}>
        {[0.62, 0.86, 0.72].map((h, i) => (
          <div
            key={i}
            style={{
              width: 92,
              height: 180 * h,
              borderRadius: 18,
              background: i === 1 ? `linear-gradient(180deg, ${C.accent}, ${C.accentDeep})` : "rgba(255,255,255,0.12)",
              boxShadow: i === 1 ? "0 0 30px rgba(34,211,238,0.45)" : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
};

const ChartSlide: React.FC<{ title: string; sub: string; seed: number }> = ({ title, sub, seed }) => (
  <div
    style={{
      position: "absolute",
      top: 300,
      left: 76,
      right: 76,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
    }}
  >
    <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 72, color: C.white, textShadow: "0 0 44px rgba(34,211,238,0.4)" }}>
      {title}
    </div>
    <div style={{ marginTop: 20, fontFamily: FONT, fontWeight: 500, fontSize: 36, color: C.muted, marginBottom: 44 }}>
      {sub}
    </div>
    <div
      style={{
        padding: 36,
        borderRadius: 40,
        ...CARD,
        boxShadow: "0 26px 80px rgba(0,0,0,0.5)",
      }}
    >
      <StaticCandles seed={seed} width={840} height={440} />
    </div>
  </div>
);

const QuoteSlide: React.FC<{ title: string; sub: string }> = ({ title, sub }) => (
  <div
    style={{
      position: "absolute",
      top: 350,
      left: 84,
      right: 84,
      padding: "64px 56px",
      borderRadius: 48,
      ...CARD,
      textAlign: "center",
      boxShadow: "0 30px 90px rgba(0,0,0,0.5)",
    }}
  >
    <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 140, color: C.accent, lineHeight: 0.6, opacity: 0.9 }}>
      “
    </div>
    <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 66, lineHeight: 1.18, color: C.white, marginTop: 10 }}>
      {title}
    </div>
    <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 38, color: C.muted, marginTop: 30, lineHeight: 1.4 }}>
      {sub}
    </div>
    <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 42 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={40} height={40} viewBox="0 0 24 24">
          <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" fill={C.accent} />
        </svg>
      ))}
    </div>
  </div>
);

const CtaSlide: React.FC<{ title: string; sub: string; domain: string }> = ({ title, sub, domain }) => (
  <div
    style={{
      position: "absolute",
      top: 330,
      left: 70,
      right: 70,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
    }}
  >
    <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 96, color: C.white, textShadow: "0 0 50px rgba(34,211,238,0.4)" }}>
      {title}
    </div>
    <div style={{ marginTop: 24, fontFamily: FONT, fontWeight: 500, fontSize: 38, color: C.muted, maxWidth: 840, lineHeight: 1.4 }}>
      {sub}
    </div>
    <div
      style={{
        marginTop: 84,
        padding: "36px 80px",
        borderRadius: 999,
        background: `linear-gradient(90deg, ${C.accentDeep}, ${C.accent})`,
        fontFamily: FONT,
        fontWeight: 900,
        fontSize: 48,
        letterSpacing: 3,
        color: "#04121a",
        boxShadow: "0 0 70px rgba(34,211,238,0.55)",
      }}
    >
      CEK LINK DI BIO
    </div>
    <div style={{ marginTop: 44, fontFamily: FONT, fontWeight: 700, fontSize: 44, color: C.white, opacity: 0.92 }}>
      {domain}
    </div>
    <div style={{ marginTop: 30, fontFamily: FONT, fontWeight: 600, fontSize: 30, color: C.muted, letterSpacing: 2 }}>
      SAVE 📌 · SHARE 📤 · FOLLOW ➕
    </div>
  </div>
);

/* ---------------- komposisi utama ---------------- */

export const SintaCarousel: React.FC<SintaCarouselProps> = ({ slides, index, handle, domain }) => {
  const total = Math.max(1, slides.length);
  const i = Math.min(Math.max(0, index), total - 1);
  const slide = slides[i] ?? { title: "LUXTRADE", sub: "" };
  const kind = normalizeKind(slide.kind, i, total);

  // badge utk slide 'point' = urutan point ke-berapa
  let pointCount = 0;
  const badges = slides.map((s, idx) => (normalizeKind(s.kind, idx, total) === "point" ? ++pointCount : 0));
  const seedBase = Math.abs(handle.length * 7 + total * 13 + i * 31) || 11;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily: FONT }}>
      <Backdrop />
      <BrandChipStatic />
      <PageIndicator index={i} total={total} handle={handle} />

      {kind === "cover" ? <CoverSlide title={slide.title} sub={slide.sub} seed={seedBase} />
      : kind === "stat" ? <StatSlide title={slide.title} sub={slide.sub} />
      : kind === "chart" ? <ChartSlide title={slide.title} sub={slide.sub} seed={seedBase} />
      : kind === "quote" ? <QuoteSlide title={slide.title} sub={slide.sub} />
      : kind === "cta" ? <CtaSlide title={slide.title} sub={slide.sub} domain={domain} />
      : <PointSlide title={slide.title} sub={slide.sub} badge={Math.max(1, badges[i])} />}
    </AbsoluteFill>
  );
};

/* ---------------- default props (fallback render test) ---------------- */

export const SINTA_CAROUSEL_DEFAULT_PROPS: SintaCarouselProps = {
  slides: [
    { kind: "cover", title: "SL KEBJAK TERUS?", sub: "bukan salah analisa — kamu entry kepagian" },
    { kind: "point", title: "EQUAL HIGHS = UMPAN", sub: "liquidity numpuk di atas — smart money narik dulu, baru price turun" },
    { kind: "chart", title: "TUNGGU SWEEP SELESAI", sub: "reaksi + displacement dulu, baru entry" },
    { kind: "point", title: "BARU BOLEH ENTRY", sub: "kembali ke setup kamu — bukan FOMO ikut gerakan" },
    { kind: "cta", title: "CATAT TIAP SETUP", sub: "screenshot → luxtradee auto jurnal, winrate kehitung sendiri" },
  ],
  index: 0,
  handle: "@luxtradee",
  domain: "luxtradee.web.id",
};

/** Deterministic seed helper (dipakai tests/worker bila perlu). */
export const carouselSeed = (base: string): number =>
  Math.max(1, Math.floor(random(`seed-${base}`) * 100000));
