import React from "react";
import { AbsoluteFill, OffthreadVideo, useVideoConfig } from "remotion";
import type { Clip } from "../schema";
import { resolveSrc } from "../utils";

export const ClipPlayer: React.FC<{ clip: Clip; durationInSeconds: number }> = ({
  clip,
  durationInSeconds,
}) => {
  const { fps } = useVideoConfig();
  const trimBefore = Math.round(clip.startFrom * fps);
  const trimAfter =
    trimBefore + Math.round(durationInSeconds * clip.playbackRate * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <OffthreadVideo
        src={resolveSrc(clip.src)}
        trimBefore={trimBefore}
        trimAfter={trimAfter}
        playbackRate={clip.playbackRate}
        volume={clip.volume}
        muted={clip.muted}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </AbsoluteFill>
  );
};
