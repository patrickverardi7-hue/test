import React from "react";
import { Composition } from "remotion";
import { calculateEditMetadata } from "./calculate-metadata";
import { editSchema, type EditProps } from "./schema";
import { VideoEditor } from "./VideoEditor";

// Props di default: modificale dallo Studio (pannello a destra) oppure
// passa un file JSON al render con --props=./edit.json
const defaultProps: EditProps = {
  fps: 30,
  width: 1920,
  height: 1080,
  clips: [
    {
      src: "https://remotion.media/BigBuckBunny.mp4",
      startFrom: 10,
      endAt: 16,
      volume: 1,
      playbackRate: 1,
      muted: false,
    },
    {
      src: "https://remotion.media/BigBuckBunny.mp4",
      startFrom: 60,
      endAt: 66,
      volume: 1,
      playbackRate: 1,
      muted: false,
    },
  ],
  transition: { type: "fade", durationInSeconds: 0.6 },
  title: {
    text: "Il mio video",
    subtitle: "Montato con Remotion",
    durationInSeconds: 3,
    backgroundColor: "#111111",
    textColor: "#ffffff",
  },
  outro: {
    text: "Grazie per la visione!",
    durationInSeconds: 2.5,
    backgroundColor: "#111111",
    textColor: "#ffffff",
  },
  captions: [
    { text: "Primo sottotitolo", start: 0.5, end: 3 },
    { text: "Secondo sottotitolo", start: 6.5, end: 9 },
  ],
  captionStyle: {
    fontSize: 56,
    textColor: "#ffffff",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  music: null,
  watermark: "@iltuocanale",
  resolvedClipDurations: [],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VideoEditor"
        component={VideoEditor}
        schema={editSchema}
        defaultProps={defaultProps}
        calculateMetadata={calculateEditMetadata}
        // Valori provvisori: vengono sovrascritti da calculateMetadata
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
      />
      {/* Formato verticale per Reels / TikTok / Shorts */}
      <Composition
        id="VideoEditorVertical"
        component={VideoEditor}
        schema={editSchema}
        defaultProps={{
          ...defaultProps,
          width: 1080,
          height: 1920,
          captionStyle: { ...defaultProps.captionStyle, fontSize: 64 },
        }}
        calculateMetadata={calculateEditMetadata}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
