import { staticFile } from "remotion";

// Accetta sia file in public/ sia URL assoluti
export const resolveSrc = (src: string): string =>
  /^(https?:|blob:|data:)/.test(src) ? src : staticFile(src);
