// Caricato per primo: definisce la cartella dati condivisa (~/SecondBrain) e legge
// la configurazione da ~/SecondBrain/.env e da server/.env (se esistono).
// Così app desktop, server di sviluppo e server MCP usano gli stessi dati.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DATA_DIR = path.resolve(process.env.SECOND_BRAIN_HOME ?? path.join(os.homedir(), 'SecondBrain'));
fs.mkdirSync(DATA_DIR, { recursive: true });

for (const file of [path.join(DATA_DIR, '.env'), path.join(process.cwd(), '.env')]) {
  try {
    if (fs.existsSync(file)) process.loadEnvFile(file); // non sovrascrive variabili già impostate
  } catch (e) {
    console.warn(`Impossibile leggere ${file}:`, e);
  }
}
