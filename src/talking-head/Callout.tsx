import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fontFamily } from "./font";

const ThumbIcon: React.FC<{ size: number; color: string }> = ({
  size,
  color,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M2 21h3V9H2v12zm20-11a2 2 0 0 0-2-2h-6.3l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L13.17 1 6.59 7.59C6.22 7.95 6 8.45 6 9v10a2 2 0 0 0 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
  </svg>
);

const BellIcon: React.FC<{ size: number; color: string }> = ({
  size,
  color,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
  </svg>
);

export const Callout: React.FC<{
  type: "like" | "subscribe";
  text: string;
  durationInFrames: number;
}> = ({ type, text, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const unit = Math.min(width, height) / 1080;

  const enter = spring({ frame, fps, config: { damping: 14 } });
  const exit = interpolate(
    frame,
    [durationInFrames - 8, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Dopo un secondo il pulsante viene "cliccato"
  const clickFrame = Math.round(fps * 1.1);
  const clicked = frame >= clickFrame;
  const press = spring({
    frame: frame - clickFrame,
    fps,
    config: { damping: 8, stiffness: 300 },
  });
  const pressScale = clicked ? 1 - 0.12 * Math.sin(Math.PI * Math.min(press, 1)) : 1;

  const label =
    type === "like"
      ? clicked
        ? "GRAZIE!"
        : "MI PIACE"
      : clicked
        ? "ISCRITTO"
        : "ISCRIVITI";
  const background =
    type === "subscribe" && !clicked
      ? "#ff0033"
      : type === "like" && clicked
        ? "#1d6fff"
        : "rgba(30,30,30,0.92)";

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "flex-end",
        padding: 50 * unit,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 14 * unit,
          opacity: exit,
          transform: `translateY(${(enter - 1) * 120 * unit}px) scale(${enter * pressScale})`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18 * unit,
            padding: `${18 * unit}px ${40 * unit}px`,
            borderRadius: 999,
            background,
            color: "white",
            fontFamily,
            fontWeight: 800,
            fontSize: 44 * unit,
            letterSpacing: 1,
            boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
          }}
        >
          {type === "like" ? (
            <ThumbIcon size={48 * unit} color="white" />
          ) : (
            <BellIcon size={48 * unit} color="white" />
          )}
          {label}
        </div>
        {text ? (
          <div
            style={{
              fontFamily,
              fontWeight: 800,
              fontSize: 30 * unit,
              color: "white",
              textShadow: "0 2px 8px rgba(0,0,0,0.8)",
            }}
          >
            {text}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
