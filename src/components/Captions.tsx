import React from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { EditProps } from "../schema";

const Caption: React.FC<{
  text: string;
  durationInFrames: number;
  style: EditProps["captionStyle"];
}> = ({ text, durationInFrames, style }) => {
  const frame = useCurrentFrame();
  const fade = Math.min(6, Math.floor(durationInFrames / 2));
  const opacity =
    fade === 0
      ? 1
      : interpolate(
          frame,
          [0, fade, durationInFrames - fade, durationInFrames],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

  return (
    <AbsoluteFill
      style={{ justifyContent: "flex-end", alignItems: "center", opacity }}
    >
      <div
        style={{
          marginBottom: "8%",
          maxWidth: "80%",
          padding: "0.3em 0.7em",
          borderRadius: 12,
          fontFamily: "Helvetica, Arial, sans-serif",
          fontWeight: 700,
          textAlign: "center",
          lineHeight: 1.25,
          fontSize: style.fontSize,
          color: style.textColor,
          backgroundColor: style.backgroundColor,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

export const Captions: React.FC<{
  captions: EditProps["captions"];
  style: EditProps["captionStyle"];
  offsetInFrames: number;
}> = ({ captions, style, offsetInFrames }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {captions.map((c, i) => {
        const from = offsetInFrames + Math.round(c.start * fps);
        const durationInFrames = Math.round((c.end - c.start) * fps);
        if (durationInFrames <= 0) return null;
        return (
          <Sequence
            key={i}
            from={from}
            durationInFrames={durationInFrames}
            name={`Sottotitolo: ${c.text.slice(0, 20)}`}
            layout="none"
          >
            <Caption
              text={c.text}
              durationInFrames={durationInFrames}
              style={style}
            />
          </Sequence>
        );
      })}
    </>
  );
};
