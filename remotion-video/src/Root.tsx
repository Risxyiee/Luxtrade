import React from "react";
import { Composition } from "remotion";
import { DEFAULT_PROPS, LuxtradePromo, totalFrames, type VideoProps } from "./LuxtradePromo";
import { SINTA_DEFAULT_PROPS, SintaReels, totalReelsFrames, type SintaReelsProps } from "./SintaReels";
import { SIGNAL_DEFAULT_PROPS, SignalRecap, totalSignalFrames, type SignalRecapProps } from "./SignalRecap";
import "./style.css";

// Tanpa zod schema: longorkan tipe komponen ke bentuk loose milik <Composition>,
// lalu kembalikan tipe asli saat menghitung durasi.
const LooseComp = LuxtradePromo as unknown as React.FC<Record<string, unknown>>;
const LooseReels = SintaReels as unknown as React.FC<Record<string, unknown>>;
const LooseSignal = SignalRecap as unknown as React.FC<Record<string, unknown>>;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LuxtradePromo"
        component={LooseComp}
        width={1080}
        height={1920}
        fps={30}
        defaultProps={DEFAULT_PROPS as unknown as Record<string, unknown>}
        calculateMetadata={({ props }) => ({
          durationInFrames: totalFrames((props as unknown as VideoProps).scenes),
        })}
      />
      <Composition
        id="SintaReels"
        component={LooseReels}
        width={1080}
        height={1920}
        fps={30}
        defaultProps={SINTA_DEFAULT_PROPS as unknown as Record<string, unknown>}
        calculateMetadata={({ props }) => ({
          durationInFrames: totalReelsFrames((props as unknown as SintaReelsProps).scenes),
        })}
      />
      <Composition
        id="SignalRecap"
        component={LooseSignal}
        width={1080}
        height={1920}
        fps={30}
        defaultProps={SIGNAL_DEFAULT_PROPS as unknown as Record<string, unknown>}
        calculateMetadata={({ props }) => ({
          durationInFrames: totalSignalFrames((props as unknown as SignalRecapProps).scenes),
        })}
      />
    </>
  );
};
