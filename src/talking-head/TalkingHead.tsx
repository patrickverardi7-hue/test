import React from "react";
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { resolveSrc } from "../utils";
import { AnimatedCaptions } from "./AnimatedCaptions";
import { Callout } from "./Callout";
import type { TalkingHeadProps } from "./schema";

const ZOOM_RAMP_SECONDS = 0.2;

const getZoom = (t: number, zooms: TalkingHeadProps["zooms"]): number => {
  let scale = 1;
  for (const z of zooms) {
    const ramp = Math.min(ZOOM_RAMP_SECONDS, (z.end - z.start) / 2);
    const amount = interpolate(
      t,
      [z.start, z.start + ramp, z.end - ramp, z.end],
      [0, 1, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    scale = Math.max(scale, 1 + (z.scale - 1) * amount);
  }
  return scale;
};

export const TalkingHead: React.FC<TalkingHeadProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Tempo corrente sul video sorgente
  const t = frame / fps + props.trimStart;
  const scale = getZoom(t, props.zooms);
  const origin = `${props.focusX}% ${props.focusY}%`;

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: origin }}>
        <OffthreadVideo
          src={resolveSrc(props.src)}
          trimBefore={Math.round(props.trimStart * fps)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: origin,
            filter: props.colorFilter,
          }}
        />
      </AbsoluteFill>

      <AnimatedCaptions
        transcript={props.transcript}
        style={props.caption}
        timeOffset={props.trimStart}
      />

      {props.callouts.map((c, i) => {
        const from = Math.round((c.start - props.trimStart) * fps);
        const durationInFrames = Math.round((c.end - c.start) * fps);
        if (durationInFrames <= 0) return null;
        return (
          <Sequence
            key={i}
            from={from}
            durationInFrames={durationInFrames}
            name={`Callout ${c.type}`}
          >
            <Callout type={c.type} text={c.text} durationInFrames={durationInFrames} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
