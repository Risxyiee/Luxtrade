import React from "react";
import { Composition } from "remotion";
import { DEFAULT_PROPS, LuxtradePromo, totalFrames, type VideoProps } from "./LuxtradePromo";
import "./style.css";

// Tanpa zod schema: longorkan tipe komponen ke bentuk loose milik <Composition>,
// lalu kembalikan tipe asli saat menghitung durasi.
const LooseComp = LuxtradePromo as unknown as React.FC<Record<string, unknown>>;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="LuxtradePromo"
      component={LooseComp}
      width={1080}
      height={1920}
      fps={30}
      defaultProps={DEFAULT_PROPS}
      calculateMetadata={({ props }) => ({
        durationInFrames: totalFrames((props as unknown as VideoProps).scenes),
      })}
    />
  );
};
