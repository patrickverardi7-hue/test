# Second Brain — contesto per Claude

App personale "seconda mente" dell'utente (Patrick, scrive in italiano: rispondi in italiano).
Obiettivo: gestire tutta la vita in un'unica app desktop — finanze, task, agenda e pianificazione del tempo,
promemoria, obiettivi e abitudini, note e brainstorming, alimentazione, allenamenti con progressi,
contenuti social e idee video, notizie — con un assistente AI e un collegamento a Claude (MCP)
per inserire dati parlando.

## Storia del progetto (sessioni precedenti)

1. **v1** — app web completa: backend Express 5 + SQLite (`node:sqlite`), frontend React 19 + Vite,
   assistente AI con Claude, tutte le sezioni sopra.
2. **v2** — richieste dell'utente:
   - "poter sempre comunicare con l'app per desktop" → app **Electron** (`desktop/`) che avvia il server,
     resta nella barra di sistema, si avvia all'accesso, scorciatoia globale Ctrl/Cmd+Shift+Space per la cattura rapida
   - "userò un ambiente per aggiungere spese, task, allenamenti" → **server MCP** (`mcp/`, 24 strumenti)
     per Claude Desktop / Claude Code
   - "in futuro spesa automatica in base al piano alimentare e ai consumi" → basi già fatte:
     piano alimentare settimanale con ingredienti, dispensa, lista della spesa generata (piano − dispensa + scorte minime),
     "Mangiato" scala la dispensa, "Spesa fatta" la riempie. Manca: ordine online, consumi reali vs pianificati, prezzi
   - "allenamenti con i progressi" → scheda Progressi (massimale stimato Epley, carico record, volume, peso corporeo)
   - "le idee per i video ora devono essere su questa piattaforma" → banca idee video in Social
     (potenziale ★, formato, rubrica, hook, script, shot list, import da elenco, salvataggio da AI/MCP/cattura)

## Stato e cose NON ancora verificate

- Backend, frontend, MCP: testati (API via curl, UI con Playwright senza errori in console, MCP con client reale).
- **App Electron mai avviata**: nell'ambiente cloud il binario di Electron non era scaricabile. Compila e il
  server impacchettato (`desktop/dist/server.mjs`) gira con Node, ma finestra, tray, scorciatoia globale e
  avvio automatico vanno provati sul PC. Punto delicato: `node:sqlite` dentro il runtime di Electron
  (`utilityProcess.fork`). Se non disponibile, `desktop/src/main.ts` ripiega su `node` di sistema. Log: `~/SecondBrain/desktop.log`.
- `npm run desktop:dist` (electron-builder) mai eseguito.
- Feed RSS reali non provati (rete bloccata nel cloud); parser testato con feed locale.
- Assistente AI provato solo senza chiave (messaggio "non configurato").

## Comandi

```bash
npm install          # dalla cartella second-brain/ (postinstall compila il server MCP)
npm run build        # interfaccia (client/dist) + MCP (mcp/dist)
npm run desktop      # app desktop Electron
npm run dev          # sviluppo: API :3001 + Vite :5173
npm run typecheck    # tutti i pacchetti
npm run desktop:dist # installatore in desktop/release/
```

Requisiti: Node.js ≥ 22.13 (per `node:sqlite`).

## Dati e configurazione

- Tutto in `~/SecondBrain/`: `second-brain.db`, `.env` (vedi `server/.env.example`), `desktop.log`, `desktop-settings.json`.
- Variabili: `PORT` (3001), `APP_PASSWORD`, `ANTHROPIC_API_KEY`, `AI_MODEL` (default `claude-opus-5-5`), `HOST` (default `127.0.0.1`), `DB_PATH`, `SECOND_BRAIN_HOME`.
- Il server ascolta solo su 127.0.0.1 salvo `HOST=0.0.0.0` (in quel caso serve `APP_PASSWORD`).

## Architettura

```
second-brain/            workspaces npm: server, client, mcp, desktop
├── server/src/
│   ├── env.ts           cartella dati + caricamento .env (importato per primo)
│   ├── resources.ts     TUTTE le collezioni: campi, default, ordinamenti, hook beforeSave
│   ├── db.ts            SQLite, migrazioni automatiche (aggiunge colonne), CRUD generico
│   ├── units.ts         unità (g/ml/pz) e reparti del supermercato
│   ├── summary.ts       dashboard, finanze, abitudini, nutrizione
│   └── routes/          crud (REST automatico), features, grocery, progress, news, ai
├── client/src/          React: App.tsx (nav, cattura rapida, notifiche), api.ts, forms.ts, types.ts,
│                        components/ui.tsx (form, modal, grafici, markdown), pages/*
├── mcp/src/index.ts     server MCP (stdio) → chiama l'API HTTP locale
└── desktop/src/main.ts  Electron; build.mjs crea dist/main.cjs, dist/server.mjs, dist/second-brain-mcp.mjs
```

### Convenzioni per aggiungere funzionalità

- **Nuovo campo/collezione**: aggiungilo in `server/src/resources.ts` (la colonna si crea al riavvio, attenzione alle
  parole riservate SQL come `references`), poi `client/src/types.ts` e `client/src/forms.ts`.
  Ottieni subito `GET/POST /api/<nome>` e `GET/PATCH/DELETE /api/<nome>/:id` con filtri `?campo=`, `campo__ne=`, `from/to`, `q`, `order`.
- **Nuova pagina**: `client/src/pages/X.tsx` + voce in `NAV` in `client/src/App.tsx`. Router a hash (`#/percorso?param=`).
- **Dati che cambiano**: usa `useResource`/`act` di `api.ts` → chiamano `notifyChange()` e tutte le viste si aggiornano.
- **Nuovo strumento per Claude**: `server.registerTool(...)` in `mcp/src/index.ts`, poi `npm run build -w mcp`.
- Date sempre come stringhe locali `YYYY-MM-DD` / `YYYY-MM-DDTHH:MM` inviate dal client (niente fusi orari lato server).
- Quantità di dispensa/spesa salvate in unità base (g, ml, pz); la UI mostra kg/l.
- Testi dell'interfaccia in italiano. Verifica: `npm run typecheck` e `npm run build`.

## Idee già discusse per il futuro

Spesa: ordine online, lista programmata settimanale, prezzi e budget "Spesa", consumi reali vs piano.
Altro: Google Calendar, import estratti conto CSV, accesso dal telefono fuori casa, statistiche social via API.
