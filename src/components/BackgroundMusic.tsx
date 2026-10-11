import React from "react";
import { Audio, interpolate, useVideoConfig } from "remotion";
import type { EditProps } from "../schema";
import { resolveSrc } from "../utils";

export const BackgroundMusic: React.FC<{
  music: NonNullable<EditProps["music"]>;
}> = ({ music }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const fadeIn = Math.round(music.fadeInSeconds * fps);
  const fadeOut = Math.round(music.fadeOutSeconds * fps);

  return (
    <Audio
      src={resolveSrc(music.src)}
      trimBefore={Math.round(music.startFrom * fps)}
      loop
      volume={(f) => {
        const inGain =
          fadeIn > 0
            ? interpolate(f, [0, fadeIn], [0, 1], { extrapolateRight: "clamp" })
            : 1;
        const outGain =
          fadeOut > 0
            ? interpolate(
                f,
                [durationInFrames - fadeOut, durationInFrames],
                [1, 0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              )
            : 1;
        return music.volume * Math.min(inGain, outGain);
      }}
    />
  );
};
