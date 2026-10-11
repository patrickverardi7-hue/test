import React, { useMemo } from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fontFamily } from "./font";
import type { TalkingHeadProps } from "./schema";
import { normalizeWord, transcriptToWords, wordsToPages } from "./words";

export const AnimatedCaptions: React.FC<{
  transcript: TalkingHeadProps["transcript"];
  style: TalkingHeadProps["caption"];
  timeOffset: number;
}> = ({ transcript, style, timeOffset }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps + timeOffset;

  const pages = useMemo(
    () => wordsToPages(transcriptToWords(transcript), style.wordsPerPage),
    [transcript, style.wordsPerPage],
  );
  const highlights = useMemo(
    () => new Set(style.highlightWords.map(normalizeWord)),
    [style.highlightWords],
  );

  // Una pagina resta visibile fino all'inizio della successiva (max 0.6s di pausa)
  const index = pages.findIndex((p, i) => {
    const next = pages[i + 1];
    const until = next ? Math.min(next.start, p.end + 0.6) : p.end + 0.6;
    return t >= p.start && t < until;
  });
  if (index === -1) return null;
  const page = pages[index];

  const pop = spring({
    frame: Math.round((t - page.start) * fps),
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.6 },
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: "8%",
          right: "8%",
          top: `${style.positionY}%`,
          transform: `translateY(-50%) scale(${0.85 + 0.15 * pop})`,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: `0 ${style.fontSize * 0.42}px`,
          fontFamily,
          fontWeight: 900,
          fontSize: style.fontSize,
          lineHeight: 1.15,
          textTransform: "uppercase",
          textAlign: "center",
          maxWidth: width * 0.84,
        }}
      >
        {page.words.map((w, i) => {
          const active = t >= w.start && t < w.end;
          const highlighted = highlights.has(normalizeWord(w.text));
          const color = active
            ? style.activeColor
            : highlighted
              ? style.highlightColor
              : style.textColor;
          return (
            <span
              key={i}
              style={{
                color,
                display: "inline-block",
                transform: `scale(${active ? 1.08 : 1})`,
                WebkitTextStroke: `${style.fontSize * 0.1}px black`,
                paintOrder: "stroke fill",
                textShadow: `0 ${style.fontSize * 0.06}px ${style.fontSize * 0.15}px rgba(0,0,0,0.55)`,
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
