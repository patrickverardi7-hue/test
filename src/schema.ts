import { zColor } from "@remotion/zod-types";
import { z } from "zod";

export const transitionTypes = [
  "none",
  "fade",
  "slide",
  "wipe",
  "flip",
  "clock-wipe",
] as const;

export const clipSchema = z.object({
  // Nome di un file dentro public/ (es. "clip1.mp4") oppure un URL https://
  src: z.string(),
  // Punto di inizio del taglio, in secondi
  startFrom: z.number().min(0).default(0),
  // Punto di fine del taglio, in secondi. null = fino alla fine del file
  endAt: z.number().min(0).nullable().default(null),
  volume: z.number().min(0).max(2).default(1),
  playbackRate: z.number().min(0.25).max(4).default(1),
  muted: z.boolean().default(false),
});

export const captionSchema = z.object({
  text: z.string(),
  // Secondi sulla timeline finale (dopo il titolo iniziale)
  start: z.number().min(0),
  end: z.number().min(0),
});

export const editSchema = z.object({
  fps: z.number().int().min(1).max(120).default(30),
  width: z.number().int().min(16).default(1920),
  height: z.number().int().min(16).default(1080),
  clips: z.array(clipSchema).min(1),
  transition: z.object({
    type: z.enum(transitionTypes).default("fade"),
    durationInSeconds: z.number().min(0).default(0.5),
  }),
  title: z
    .object({
      text: z.string(),
      subtitle: z.string().default(""),
      durationInSeconds: z.number().min(0.5).default(3),
      backgroundColor: zColor().default("#000000"),
      textColor: zColor().default("#ffffff"),
    })
    .nullable()
    .default(null),
  outro: z
    .object({
      text: z.string(),
      durationInSeconds: z.number().min(0.5).default(3),
      backgroundColor: zColor().default("#000000"),
      textColor: zColor().default("#ffffff"),
    })
    .nullable()
    .default(null),
  captions: z.array(captionSchema).default([]),
  captionStyle: z.object({
    fontSize: z.number().min(8).default(56),
    textColor: zColor().default("#ffffff"),
    backgroundColor: zColor().default("rgba(0,0,0,0.6)"),
  }),
  music: z
    .object({
      src: z.string(),
      volume: z.number().min(0).max(1).default(0.3),
      startFrom: z.number().min(0).default(0),
      fadeInSeconds: z.number().min(0).default(1),
      fadeOutSeconds: z.number().min(0).default(2),
    })
    .nullable()
    .default(null),
  watermark: z.string().default(""),
  // Riempito automaticamente da calculateMetadata: durata (in secondi) di ogni clip dopo il taglio
  resolvedClipDurations: z.array(z.number()).default([]),
});

export type EditProps = z.infer<typeof editSchema>;
export type Clip = z.infer<typeof clipSchema>;
