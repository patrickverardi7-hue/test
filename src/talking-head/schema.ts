import { zColor } from "@remotion/zod-types";
import { z } from "zod";

export const talkingHeadSchema = z.object({
  // File in public/ oppure URL
  src: z.string(),
  fps: z.number().int().min(1).max(120).default(30),
  width: z.number().int().min(16).default(1920),
  height: z.number().int().min(16).default(1080),
  // Taglio del video sorgente, in secondi (trimEnd null = fino alla fine)
  trimStart: z.number().min(0).default(0),
  trimEnd: z.number().min(0).nullable().default(null),
  // Punto su cui centrare inquadratura e zoom (percentuali)
  focusX: z.number().min(0).max(100).default(50),
  focusY: z.number().min(0).max(100).default(40),
  // Filtro CSS per una leggera correzione colore
  colorFilter: z.string().default("contrast(1.05) saturate(1.1)"),
  // Trascrizione a blocchi: i tempi sono in secondi sul video sorgente
  transcript: z
    .array(z.object({ start: z.number(), end: z.number(), text: z.string() }))
    .default([]),
  caption: z.object({
    fontSize: z.number().min(8).default(80),
    // Posizione verticale del centro dei sottotitoli, in % dall'alto
    positionY: z.number().min(0).max(100).default(78),
    wordsPerPage: z.number().int().min(1).max(8).default(3),
    textColor: zColor().default("#ffffff"),
    activeColor: zColor().default("#ffd400"),
    highlightColor: zColor().default("#4ade80"),
    // Parole evidenziate sempre con highlightColor (senza distinzione maiuscole)
    highlightWords: z.array(z.string()).default([]),
  }),
  // Zoom "punch-in" sui momenti importanti
  zooms: z
    .array(
      z.object({
        start: z.number(),
        end: z.number(),
        scale: z.number().min(1).max(3).default(1.15),
      }),
    )
    .default([]),
  // Pop-up "mi piace" e "iscriviti"
  callouts: z
    .array(
      z.object({
        type: z.enum(["like", "subscribe"]),
        start: z.number(),
        end: z.number(),
        text: z.string().default(""),
      }),
    )
    .default([]),
  // Riempito da calculateMetadata
  durationInSeconds: z.number().default(0),
});

export type TalkingHeadProps = z.infer<typeof talkingHeadSchema>;
