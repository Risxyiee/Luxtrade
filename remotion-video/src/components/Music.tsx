import React from "react";
import { Audio, interpolate, staticFile, useVideoConfig } from "remotion";

/* ============================================================
   BackgroundMusic — musik latar yang DI-BAKE ke dalam video
   ============================================================
   Kenapa bake, bukan lampirkan "musik trending" IG?
   Graph API Instagram / TikTok Content Posting API TIDAK
   mendukung melampirkan musik dari library resmi platform —
   audio hanya bisa berupa "original sound" dari file video itu
   sendiri. Jadi satu-satunya cara lewat API = musik sudah
   menyatu di MP4 hasil render (nilai plus: sama dipakai
   TikTok, nol risiko copyright strike karena track bebas).

   File   : public/music/bg.mp3 (SoundHelix — lihat CREDITS.txt)
   Level  : 0.16 dari VO — cukup terdengar, VO tetap jelas.
   Fade   : in 0.8 dtk · out 1.3 dtk (mengikuti durasi komposisi).
   Loop   : otomatis kalau video lebih panjang dari 60 dtk.
*/

export const BackgroundMusic: React.FC<{
  src?: string;
  /** 0–1 — level relatif thd voiceover (default 0.16). */
  level?: number;
}> = ({ src = "music/bg.mp3", level = 0.16 }) => {
  const { durationInFrames } = useVideoConfig();

  return (
    <Audio
      src={staticFile(src)}
      loop
      volume={(f) => {
        const fadeIn = interpolate(f, [0, 24], [0, 1], { extrapolateRight: "clamp" });
        const fadeOut = interpolate(f, [durationInFrames - 40, durationInFrames - 2], [1, 0], {
          extrapolateLeft: "clamp",
        });
        return level * Math.min(fadeIn, fadeOut);
      }}
    />
  );
};
