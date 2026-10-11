import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const TitleCard: React.FC<{
  text: string;
  subtitle?: string;
  backgroundColor: string;
  textColor: string;
}> = ({ text, subtitle, backgroundColor, textColor }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 } });
  const subtitleOpacity = interpolate(frame, [fps * 0.4, fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        color: textColor,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Helvetica, Arial, sans-serif",
        textAlign: "center",
        padding: width * 0.06,
      }}
    >
      <div
        style={{
          fontSize: width * 0.06,
          fontWeight: 800,
          transform: `translateY(${(1 - enter) * 40}px)`,
          opacity: enter,
        }}
      >
        {text}
      </div>
      {subtitle ? (
        <div
          style={{
            fontSize: width * 0.025,
            marginTop: width * 0.015,
            opacity: subtitleOpacity * 0.85,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
