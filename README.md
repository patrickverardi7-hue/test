# Editor video con Remotion

Monta i tuoi video in codice con [Remotion](https://www.remotion.dev): tagli, transizioni, titolo iniziale, chiusura, sottotitoli, musica di sottofondo e watermark, tutto da un file JSON.

## Requisiti

- Node.js 18 o successivo
- Al primo render Remotion scarica automaticamente Chrome Headless Shell

## Avvio

```bash
npm install
npm run dev        # apre Remotion Studio su http://localhost:3000
```

Nello Studio scegli la composizione **VideoEditor** (16:9) o **VideoEditorVertical** (9:16, per Reels/TikTok/Shorts) e modifica i parametri dal pannello a destra: l'anteprima si aggiorna in tempo reale.

## Montare i tuoi video

1. Copia i tuoi file nella cartella `public/` (es. `public/clip1.mp4`, `public/musica.mp3`). Sono esclusi da git.
2. Copia `edit.example.json` in `edit.json` e modificalo.
3. Esegui il render:

```bash
npm run render:props          # → out/video.mp4
# oppure il formato verticale:
npx remotion render VideoEditorVertical out/reel.mp4 --props=./edit.json
```

Nel JSON basta indicare i campi da cambiare: gli altri prendono il valore di default.

## Parametri

| Campo | Descrizione |
| --- | --- |
| `fps`, `width`, `height` | Frame rate e risoluzione dell'output (default 30, 1920×1080) |
| `clips[]` | Clip in ordine di montaggio |
| `clips[].src` | Nome del file in `public/` oppure URL `https://` |
| `clips[].startFrom` / `endAt` | Taglio in secondi; `endAt: null` = fino alla fine del file |
| `clips[].volume`, `muted` | Volume (0–2) o audio disattivato |
| `clips[].playbackRate` | Velocità (0.25–4): `2` = doppia velocità, `0.5` = slow motion |
| `transition.type` | `none`, `fade`, `slide`, `wipe`, `flip`, `clock-wipe` |
| `transition.durationInSeconds` | Durata della transizione tra un segmento e l'altro |
| `title` / `outro` | Schermata iniziale/finale (`text`, `subtitle`, `durationInSeconds`, colori) oppure `null` |
| `captions[]` | Sottotitoli `{ text, start, end }`, in secondi dall'inizio della prima clip |
| `captionStyle` | `fontSize`, `textColor`, `backgroundColor` |
| `music` | `{ src, volume, startFrom, fadeInSeconds, fadeOutSeconds }` oppure `null`; va in loop per tutto il video |
| `watermark` | Testo in alto a destra (stringa vuota per disattivarlo) |

La durata totale si calcola da sola: se `endAt` è `null`, Remotion legge la durata reale del file.

## Struttura

```
src/
  index.ts               registerRoot
  Root.tsx               composizioni e props di default
  schema.ts              schema Zod dei parametri (genera i controlli dello Studio)
  calculate-metadata.ts  calcolo di durata e risoluzione
  VideoEditor.tsx        timeline con TransitionSeries
  components/            TitleCard, ClipPlayer, Captions, Watermark, BackgroundMusic
```

## Altri comandi

```bash
npm run still      # miniatura PNG (frame 30) in out/thumbnail.png
npm run typecheck  # controllo TypeScript
npm run upgrade    # aggiorna tutti i pacchetti Remotion
```

> Nota sulla licenza: Remotion è gratuito per privati e aziende fino a 3 persone; oltre serve una licenza aziendale. Dettagli su https://www.remotion.dev/license
