import { linearTiming, TransitionSeries } from "@remotion/transitions";
import type { TransitionPresentation } from "@remotion/transitions";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { fade } from "@remotion/transitions/fade";
import { flip } from "@remotion/transitions/flip";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { getTransitionFrames } from "./calculate-metadata";
import { BackgroundMusic } from "./components/BackgroundMusic";
import { Captions } from "./components/Captions";
import { ClipPlayer } from "./components/ClipPlayer";
import { TitleCard } from "./components/TitleCard";
import { Watermark } from "./components/Watermark";
import type { EditProps } from "./schema";

const getPresentation = (
  type: EditProps["transition"]["type"],
  width: number,
  height: number,
): TransitionPresentation<any> | null => {
  switch (type) {
    case "fade":
      return fade();
    case "slide":
      return slide({ direction: "from-right" });
    case "wipe":
      return wipe({ direction: "from-left" });
    case "flip":
      return flip({ direction: "from-right" });
    case "clock-wipe":
      return clockWipe({ width, height });
    case "none":
      return null;
  }
};

export const VideoEditor: React.FC<EditProps> = (props) => {
  const { fps, width, height } = useVideoConfig();
  const { clips, resolvedClipDurations, title, outro } = props;

  const segments: { key: string; frames: number; node: React.ReactNode }[] = [];

  if (title) {
    segments.push({
      key: "title",
      frames: Math.round(title.durationInSeconds * fps),
      node: <TitleCard {...title} />,
    });
  }

  clips.forEach((clip, i) => {
    const duration = resolvedClipDurations[i];
    if (duration === undefined) return;
    segments.push({
      key: `clip-${i}`,
      frames: Math.round(duration * fps),
      node: <ClipPlayer clip={clip} durationInSeconds={duration} />,
    });
  });

  if (outro) {
    segments.push({
      key: "outro",
      frames: Math.round(outro.durationInSeconds * fps),
      node: <TitleCard {...outro} />,
    });
  }

  const transitionFrames = getTransitionFrames(
    props,
    segments.map((s) => s.frames),
  );
  const presentation = getPresentation(props.transition.type, width, height);

  // I sottotitoli partono dall'inizio della prima clip
  const captionOffset = title
    ? Math.round(title.durationInSeconds * fps) - transitionFrames
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <TransitionSeries>
        {segments.flatMap((segment, i) => {
          const items = [
            <TransitionSeries.Sequence
              key={segment.key}
              durationInFrames={segment.frames}
              name={segment.key}
            >
              {segment.node}
            </TransitionSeries.Sequence>,
          ];
          if (presentation && transitionFrames > 0 && i < segments.length - 1) {
            items.push(
              <TransitionSeries.Transition
                key={`${segment.key}-transition`}
                presentation={presentation}
                timing={linearTiming({ durationInFrames: transitionFrames })}
              />,
            );
          }
          return items;
        })}
      </TransitionSeries>

      <Captions
        captions={props.captions}
        style={props.captionStyle}
        offsetInFrames={captionOffset}
      />

      {props.watermark ? <Watermark text={props.watermark} /> : null}
      {props.music ? <BackgroundMusic music={props.music} /> : null}
    </AbsoluteFill>
  );
};
