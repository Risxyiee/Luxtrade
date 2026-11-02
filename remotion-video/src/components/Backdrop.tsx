import React from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import { C, clamp01 } from "./Ui";

/* Deterministic floating particles warna landing (cyan/biru, computed once). */
const PARTICLES = Array.from({ length: 18 }).map((_, i) => ({
  x0: random(i * 7),
  y0: random(i * 7 + 1),
  size: 2 + random(i * 7 + 2) * 2,
  speed: 14 + random(i * 7 + 3) * 26,
  opacity: 0.15 + random(i * 7 + 4) * 0.25,
  sway: 16 + random(i * 7 + 5) * 30,
  phase: random(i * 7 + 6) * Math.PI * 2,
}));

const blob = (
  x: number,
  y: number,
  size: number,
  background: string,
  transform: string,
  opacity: number,
): React.CSSProperties => ({
  position: "absolute",
  left: x,
  top: y,
  width: size,
  height: size,
  borderRadius: "50%",
  background,
  transform,
  opacity,
});

/**
 * Continuous cinematic backdrop for the whole video.
 * Rendered once, outside of every Sequence.
 */
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const gridX = -((frame * 0.35) % 80);
  const gridY = -((frame * 0.22) % 80);

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: "hidden" }}>
      {/* huge drifting glow blobs — trio sama dgn glow logo hero landing */}
      <div
        style={blob(
          width * 0.7 - 620,
          height * 0.22 - 620,
          1240,
          "radial-gradient(circle, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0) 65%)", // biru — blue-500
          `translate3d(${Math.sin(frame / 180) * 180}px, ${Math.cos(frame / 230) * 130}px, 0)`,
          0.85 + 0.15 * Math.sin(frame / 140),
        )}
      />
      <div
        style={blob(
          width * 0.14 - 520,
          height * 0.76 - 520,
          1040,
          "radial-gradient(circle, rgba(6,182,212,0.09) 0%, rgba(6,182,212,0) 65%)", // cyan — cyan-500
          `translate3d(${Math.cos(frame / 240) * 170}px, ${Math.sin(frame / 200) * 120}px, 0)`,
          0.9 + 0.1 * Math.cos(frame / 165),
        )}
      />
      <div
        style={blob(
          width * 0.5 - 750,
          height * 0.52 - 750,
          1500,
          "radial-gradient(circle, rgba(16,185,129,0.05) 0%, rgba(16,185,129,0) 62%)", // emerald — emerald-500
          `translate3d(${Math.sin(frame / 150) * 60}px, ${Math.cos(frame / 170) * 50}px, 0)`,
          0.95,
        )}
      />

      {/* faint panning grid */}
      <div
        style={{
          position: "absolute",
          left: -120,
          top: -120,
          right: -120,
          bottom: -120,
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 80px), repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 80px)",
          transform: `translate3d(${gridX}px, ${gridY}px, 0)`,
        }}
      />

      {/* floating particles (slow upward drift) — cyan muda & cyan */}
      {PARTICLES.map((p, i) => {
        const travelled = (p.speed * frame) / fps;
        const rawY = p.y0 * height - travelled;
        const y = ((rawY % height) + height) % height;
        const x = p.x0 * width + Math.sin(frame / 85 + p.phase) * p.sway;
        const edgeFade = Math.min(1, y / 140, (height - y) / 140);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: i % 4 === 0 ? "#A5F3FC" : i % 4 === 1 ? "#67E8F9" : C.accent,
              opacity: p.opacity * clamp01(edgeFade),
              transform: `translate3d(${x}px, ${y}px, 0)`,
              boxShadow:
                i % 5 === 0 ? "0 0 10px rgba(34,211,238,0.6)" : "none",
            }}
          />
        );
      })}

      {/* vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 42%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
