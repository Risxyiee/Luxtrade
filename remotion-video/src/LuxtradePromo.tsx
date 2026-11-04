import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Backdrop } from "./components/Backdrop";
import { BackgroundMusic } from "./components/Music";
import { BrandChip, C, FONT, ProgressBar, SceneDots } from "./components/Ui";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Phone } from "./scenes/Scene2Phone";
import { Scene3Agents } from "./scenes/Scene3Agents";
import { Scene4Execute } from "./scenes/Scene4Execute";
import { Scene5Cta } from "./scenes/Scene5Cta";

/* ---------------- prop schema (matched by a future props.json) ---------------- */

export interface SceneProps {
  title: string; // UPPERCASE Indonesian, max ~22 chars
  sub: string; // lowercase Indonesian, max ~44 chars
  voFile: string; // e.g. "vo/vo0.mp3"
  durationSec: number;
}

export interface VideoProps {
  scenes: SceneProps[];
  handle: string;
  domain: string;
}

/* ---------------- timing helpers ---------------- */

export const FPS = 30;

export const sceneFrames = (durationSec: number): number =>
  Math.max(96, Math.round((durationSec + 0.9) * FPS));

export const totalFrames = (scenes: SceneProps[]): number =>
  Math.max(
    1,
    scenes.reduce((sum, s) => sum + sceneFrames(s.durationSec), 0),
  );

const SCENE_COMPONENTS = [
  Scene1Hook,
  Scene2Phone,
  Scene3Agents,
  Scene4Execute,
  Scene5Cta,
];

/* ---------------- main composition ---------------- */

export const LuxtradePromo: React.FC<VideoProps> = ({ scenes, handle, domain }) => {
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
    if (frame >= starts[i] && frame < starts[i] + frames[i]) {
      activeIndex = i;
    }
  }

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily: FONT }}>
      <Backdrop />
      {/* 🎵 musik latar bebas-copyright di-bake ke MP4 (IG/TikTok API tidak bisa lampirkan musik library) */}
      <BackgroundMusic />
      <ProgressBar />
      <BrandChip />

      {scenes.map((scene, i) => {
        const SceneComp = SCENE_COMPONENTS[i % SCENE_COMPONENTS.length];
        return (
          <Sequence
            key={`${scene.voFile}-${i}`}
            from={starts[i]}
            durationInFrames={frames[i]}
            name={`Scene ${i + 1}`}
          >
            <Audio src={staticFile(scene.voFile)} />
            <SceneComp
              title={scene.title}
              sub={scene.sub}
              domain={domain}
              handle={handle}
              durationInFrames={frames[i]}
            />
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

/* ---------------- default props ---------------- */

export const DEFAULT_PROPS: VideoProps = {
  scenes: [
    {
      title: "MASIH NEBAK-NEBAK?",
      sub: "banyak trader kalah karena tebak-tebakan",
      voFile: "vo/vo0.mp3",
      durationSec: 3.2,
    },
    {
      title: "LUXTRADE",
      sub: "sinyal AI langsung ke HP kamu",
      voFile: "vo/vo1.mp3",
      durationSec: 3.6,
    },
    {
      title: "8 AGEN AI",
      sub: "pantau pasar 24 jam nonstop",
      voFile: "vo/vo2.mp3",
      durationSec: 3.6,
    },
    {
      title: "TINGGAL EKSEKUSI",
      sub: "alert masuk, kamu tinggal eksekusi",
      voFile: "vo/vo3.mp3",
      durationSec: 2.8,
    },
    {
      title: "LUXTRADE",
      sub: "mulai trading lebih tenang hari ini",
      voFile: "vo/vo4.mp3",
      durationSec: 3.8,
    },
  ],
  handle: "@luxtradee",
  domain: "luxtradee.web.id",
};
