import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";

export const Watermark: React.FC<{ text: string }> = ({ text }) => {
  const { width } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "flex-end",
        padding: width * 0.02,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: "Helvetica, Arial, sans-serif",
          fontWeight: 600,
          fontSize: width * 0.018,
          color: "white",
          opacity: 0.7,
          textShadow: "0 2px 6px rgba(0,0,0,0.6)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
