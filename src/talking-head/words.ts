import type { TalkingHeadProps } from "./schema";

export type Word = { text: string; start: number; end: number };
export type Page = { words: Word[]; start: number; end: number };

// La trascrizione ha i tempi per blocco: distribuisce il tempo di ogni blocco
// tra le sue parole in proporzione alla lunghezza
export const transcriptToWords = (
  transcript: TalkingHeadProps["transcript"],
): Word[][] =>
  transcript.map((block) => {
    const tokens = block.text.split(/\s+/).filter(Boolean);
    const weights = tokens.map((t) => t.length + 2);
    const total = weights.reduce((a, b) => a + b, 0);
    let t = block.start;
    return tokens.map((text, i) => {
      const d = ((block.end - block.start) * weights[i]) / total;
      const word = { text, start: t, end: t + d };
      t += d;
      return word;
    });
  });

// Raggruppa le parole in "pagine" da mostrare insieme, andando a capo dopo
// la punteggiatura forte
export const wordsToPages = (blocks: Word[][], wordsPerPage: number): Page[] => {
  const pages: Page[] = [];
  for (const words of blocks) {
    let current: Word[] = [];
    const flush = () => {
      if (current.length === 0) return;
      pages.push({
        words: current,
        start: current[0].start,
        end: current[current.length - 1].end,
      });
      current = [];
    };
    for (const w of words) {
      current.push(w);
      if (current.length >= wordsPerPage || /[.,!?;:]$/.test(w.text)) flush();
    }
    flush();
  }
  return pages;
};

export const normalizeWord = (w: string) =>
  w.toLowerCase().replace(/[^\p{L}\p{N}.]/gu, "").replace(/\.$/, "");
