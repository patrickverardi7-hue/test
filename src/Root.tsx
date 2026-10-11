import React from "react";
import { Composition } from "remotion";
import { calculateEditMetadata } from "./calculate-metadata";
import { editSchema, type EditProps } from "./schema";
import { calculateTalkingHeadMetadata } from "./talking-head/calculate-metadata";
import {
  talkingHeadSchema,
  type TalkingHeadProps,
} from "./talking-head/schema";
import { TalkingHead } from "./talking-head/TalkingHead";
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

// Video "parlato": sottotitoli animati parola per parola, zoom e pop-up.
// Per i tuoi video usa un file in edits/ con --props
const talkingHeadDefaults: TalkingHeadProps = {
  src: "https://remotion.media/BigBuckBunny.mp4",
  fps: 30,
  width: 1920,
  height: 1080,
  trimStart: 0,
  trimEnd: null,
  focusX: 50,
  focusY: 40,
  colorFilter: "contrast(1.05) saturate(1.1)",
  transcript: [
    { start: 0, end: 3, text: "Scrivi qui la trascrizione del tuo video" },
    { start: 3, end: 6, text: "e i sottotitoli appariranno parola per parola!" },
  ],
  caption: {
    fontSize: 80,
    positionY: 78,
    wordsPerPage: 3,
    textColor: "#ffffff",
    activeColor: "#ffd400",
    highlightColor: "#4ade80",
    highlightWords: ["sottotitoli"],
  },
  zooms: [{ start: 3, end: 6, scale: 1.15 }],
  callouts: [{ type: "subscribe", start: 5, end: 8, text: "" }],
  durationInSeconds: 0,
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
      <Composition
        id="TalkingHead"
        component={TalkingHead}
        schema={talkingHeadSchema}
        defaultProps={talkingHeadDefaults}
        calculateMetadata={calculateTalkingHeadMetadata}
        durationInFrames={240}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
