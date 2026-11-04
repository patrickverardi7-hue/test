// Esempio: genera un video con Seedance 2.5 (text-to-video) tramite l'SDK ufficiale Higgsfield.
// Esecuzione: npm run seedance
//
// Le credenziali vengono lette a runtime da .env.local (HF_CREDENTIALS=key-id:key-secret)
// e non vengono mai stampate. Questo script gira solo lato server (Node).
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config, higgsfield, HiggsfieldError, APIError } from "@higgsfield/client/v2";

const MODEL = "bytedance/seedance-2.5/text-to-video";

function loadCredentials(): string {
  const envFile = resolve(process.cwd(), ".env.local");
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile); // loader integrato in Node, non sovrascrive variabili già impostate
  }
  const credentials = process.env.HF_CREDENTIALS?.trim();
  if (!credentials || !/^[^:\s]+:[^:\s]+$/.test(credentials)) {
    throw new Error(
      "HF_CREDENTIALS mancante o non nel formato key-id:key-secret. " +
        "Impostala in .env.local (vedi .env.example).",
    );
  }
  return credentials;
}

async function main(): Promise<number> {
  config({
    credentials: loadCredentials(),
    pollInterval: 5_000, // ms
    maxPollTime: 15 * 60_000, // la generazione video può superare i 5 minuti di default
  });

  console.log(`Invio richiesta a ${MODEL}...`);
  const result = await higgsfield.subscribe(MODEL, {
    input: {
      prompt: "A cinematic scene at sunset",
      duration: 5,
      resolution: "720p",
      aspect_ratio: "16:9",
    },
    withPolling: true,
  });

  // Lo stato può essere anche "canceled"/"cancelled" lato API anche se il tipo dell'SDK non lo elenca.
  const status = String(result.status);
  console.log(`Richiesta ${result.request_id}: stato "${status}"`);

  if (status !== "completed") {
    const reason =
      status === "nsfw"
        ? "contenuto bloccato dalla moderazione"
        : status === "failed"
          ? "generazione fallita"
          : status === "canceled" || status === "cancelled"
            ? "richiesta annullata"
            : "stato non terminale o inatteso";
    console.error(`Nessun video generato: ${reason}.`);
    return 1;
  }

  const url = result.video?.url;
  if (!url) {
    console.error("Stato completed ma la risposta non contiene video.url.");
    return 1;
  }
  console.log(`Video generato: ${url}`);
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    // Stampa solo nome e messaggio: gli errori HTTP grezzi possono contenere gli header di autorizzazione.
    if (err instanceof APIError) {
      console.error(`Errore API Higgsfield (${err.name}): ${err.message}`);
    } else if (err instanceof HiggsfieldError || err instanceof Error) {
      console.error(`Errore (${err.name}): ${err.message}`);
    } else {
      console.error("Errore sconosciuto.");
    }
    process.exitCode = 1;
  });
