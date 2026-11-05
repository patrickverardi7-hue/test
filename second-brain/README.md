# 🧠 Second Brain

Una "seconda mente" per gestire tutta la tua vita in un'unica app: task, agenda e time-blocking, promemoria, obiettivi e abitudini, note e brainstorming, finanze, alimentazione con piano alimentare e lista della spesa automatica, allenamenti con progressi, banca di idee video, notizie e un assistente AI che conosce tutti i tuoi dati.

- **App desktop** (Electron): sempre attiva nella barra di sistema, si avvia all'accesso, cattura rapida da qualsiasi programma
- **Claude ↔ Second Brain** (MCP): aggiungi spese, task, allenamenti, pasti e idee video parlando con Claude Desktop o Claude Code
- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Node.js + Express 5 + SQLite (integrato in Node, nessun database da installare)
- **AI** (opzionale): Claude di Anthropic tramite `@anthropic-ai/sdk`

## Requisiti

- Node.js **22.13 o successivo** (serve il modulo `node:sqlite` integrato)

## Installazione

```bash
cd second-brain
npm install
npm run build      # compila interfaccia e server MCP
```

### 🖥️ App desktop (consigliata)

```bash
npm run desktop
```

- La finestra si chiude ma l'app **resta attiva nella barra di sistema** (icona vicino all'orologio): promemoria, API e collegamento con Claude funzionano sempre.
- **Ctrl+Shift+Spazio** (⌘⇧Spazio su Mac) apre la cattura rapida da qualsiasi programma: task, spesa, idea video, allenamento, lista della spesa…
- Al primo avvio si registra per **partire all'accesso al computer** (si disattiva dal menu dell'icona).
- Per creare un installatore (`.exe`, `.dmg`, `AppImage`): `npm run desktop:dist` → cartella `desktop/release/`.

### Modalità sviluppo (browser)

```bash
npm run dev        # http://localhost:5173
```

### Dove sono i dati

Tutto è in **`~/SecondBrain/`** (cartella Home → SecondBrain): il database `second-brain.db`, il log dell'app desktop e il file di configurazione `.env`. App desktop, modalità sviluppo e server MCP usano gli stessi dati.

### Attivare l'assistente AI

Crea `~/SecondBrain/.env` (vedi `server/.env.example`) con:

```
ANTHROPIC_API_KEY=sk-ant-...
```

e riavvia l'app. Senza chiave tutto funziona normalmente; solo le funzioni AI restano disattivate.

## 🤖 Parlare con Second Brain da Claude (MCP)

Il server MCP (`mcp/`) collega Claude Desktop o Claude Code all'app: scrivi a Claude in linguaggio naturale e lui salva tutto in Second Brain.

> “Ho speso 32,40€ alla Coop” · “Oggi ho fatto petto: panca 4×8 a 75 kg e croci 3×12 a 14 kg” · “Aggiungi alla spesa 2 kg di mele e il caffè” · “Genera la lista della spesa per la settimana” · “Dammi 10 idee video sulla mia nicchia e salvale” · “Come sta andando lo squat?” · “Ho mangiato il pranzo del piano” · “Questa è la dieta del nutrizionista: caricala nel piano alimentare”

La configurazione pronta da copiare è in **Impostazioni → Collega Claude (MCP)** dentro l'app. In breve:

**Claude Desktop** — Impostazioni → Sviluppatore → Modifica configurazione, poi aggiungi:

```json
{
  "mcpServers": {
    "second-brain": {
      "command": "node",
      "args": ["/percorso/assoluto/second-brain/mcp/dist/second-brain-mcp.mjs"]
    }
  }
}
```

**Claude Code** — una volta sola:

```bash
claude mcp add second-brain --scope user -- node /percorso/assoluto/second-brain/mcp/dist/second-brain-mcp.mjs
```

Con l'app **installata** (da `desktop:dist`) il percorso giusto è `~/SecondBrain/second-brain-mcp.mjs`: l'app ce lo copia a ogni avvio, ed è quello mostrato in Impostazioni. Serve Node.js 22.13+ nel sistema.

Second Brain deve essere aperto (app desktop o `npm run dev`). Se hai impostato `APP_PASSWORD`, il server MCP la legge da `~/SecondBrain/.env`.

Strumenti disponibili: `riepilogo_oggi`, `cerca`, `registra_movimento`, `riepilogo_finanze`, `aggiungi_task`, `elenca_task`, `completa_task`, `aggiungi_evento`, `agenda`, `aggiungi_promemoria`, `registra_allenamento`, `progressi_allenamento`, `registra_misure`, `registra_pasto`, `piano_alimentare`, `aggiungi_pasti_al_piano`, `mangiato_dal_piano`, `lista_spesa`, `dispensa`, `aggiungi_idee_video`, `elenca_idee_video`, `aggiorna_idea_video`, `aggiungi_nota`, `segna_abitudine`.

### Solo server (senza app desktop)

```bash
npm run build
npm start       # http://127.0.0.1:3001 serve sia l'API sia l'app
```

Di default l'app è raggiungibile solo da questo computer. Per aprirla alla rete di casa (es. dal telefono) imposta in `~/SecondBrain/.env` sia `HOST=0.0.0.0` sia una `APP_PASSWORD`.

## Moduli

| Sezione | Cosa fa |
| --- | --- |
| 🏠 **Oggi** | Dashboard: task in scadenza e in ritardo, agenda, abitudini, promemoria, calorie, finanze del mese, obiettivi, social in programma, note recenti |
| ☑️ **Task** | Viste Oggi / Prossimi / Senza data / Aperti / Completati, aree, priorità, durata stimata, collegamento agli obiettivi. Aggiunta rapida (“!” = priorità alta) |
| 🗓️ **Agenda & tempo** | Vista giorno con timeline oraria e vista settimana. **Time-blocking**: trasforma un task in un blocco di tempo, con l'orario libero suggerito |
| 🔔 **Promemoria** | Data e ora, ricorrenze (giornaliera, settimanale, mensile), notifiche del browser |
| 🎯 **Obiettivi & abitudini** | Obiettivi con tappe, metriche (es. 6.200/10.000 follower) o progresso manuale. Tracker abitudini con serie 🔥 e percentuale sui 30 giorni |
| 💡 **Note & idee** | Inbox, note, idee, brainstorming, diario giornaliero. Markdown, tag, note fissate, collegamenti `[[Titolo]]` con backlink, salvataggio automatico, brainstorming con l'AI |
| 💶 **Finanze** | Entrate e uscite, categorie, conti, budget mensili con avvisi, andamento degli ultimi 6 mesi |
| 🥗 **Alimentazione** | Diario dei pasti, calorie e macro rispetto agli obiettivi, grafico settimanale, pasti frequenti, pasti del piano di oggi con “Mangiato” |
| 🛒 **Spesa & dispensa** | **Piano alimentare** settimanale con ingredienti · **Dispensa** con scorte minime e scadenze · **Lista della spesa generata** dal piano meno quello che hai in casa, divisa per reparto. “Spesa fatta” sposta gli acquisti in dispensa, “Mangiato” scala gli ingredienti |
| 🏋️ **Allenamenti** | Diario con esercizi (serie × ripetizioni × kg), obiettivo settimanale, “Ripeti”. **Progressi**: massimale stimato e carico migliore per esercizio nel tempo, variazione %, volume e sessioni settimanali, peso corporeo e misure |
| 🎬 **Idee video & social** | **Banca idee** con potenziale ★, formato, rubrica, hook, script, scene da girare, idea copertina · **Importa elenco** (incolla le idee che hai altrove) · generatore AI · bacheca di produzione (idea → bozza → pronto → programmato → pubblicato) con metriche |
| 📰 **Notizie** | Aggregatore RSS con categorie, salvataggio degli articoli nelle note |
| ✨ **Assistente AI** | Chat che riceve un'istantanea dei tuoi dati: pianificazione della giornata, revisione settimanale, analisi delle spese, idee, allenamenti. Le risposte si salvano come nota o diventano task |
| ⚙️ **Impostazioni** | Profilo, obiettivi nutrizionali e di allenamento, nicchia social, fonti RSS, backup e ripristino in JSON |

Funzioni trasversali: **cattura rapida** (`Alt+N` nell'app, `Ctrl+Shift+Spazio` ovunque con l'app desktop) per inbox, task, idee, idee video, promemoria, eventi, uscite, allenamenti e lista della spesa; **ricerca globale** (`/`) in tutti i moduli; tema chiaro/scuro automatico; interfaccia adatta al telefono.

## Architettura

```
second-brain/
├── desktop/src/main.ts   # app desktop Electron (barra di sistema, avvio automatico, scorciatoia)
├── mcp/src/index.ts      # server MCP per Claude
├── server/src/
│   ├── resources.ts      # definizione di tutte le collezioni (campi, default, ordinamenti)
│   ├── db.ts             # SQLite, migrazioni automatiche, CRUD generico
│   ├── summary.ts        # calcoli aggregati (dashboard, finanze, abitudini…)
│   └── routes/
│       ├── crud.ts       # REST automatico per ogni collezione
│       ├── features.ts   # dashboard, ricerca, abitudini, promemoria, backup
│       ├── grocery.ts    # piano alimentare → lista della spesa → dispensa
│       ├── progress.ts   # progressi allenamenti e misure corporee
│       ├── news.ts       # feed RSS
│       └── ai.ts         # assistente Claude
└── client/src/
    ├── App.tsx           # layout, navigazione, cattura rapida, notifiche
    ├── api.ts            # client HTTP e hook dati
    ├── components/ui.tsx # componenti riutilizzabili (form, modal, grafici, markdown)
    └── pages/            # una pagina per modulo
```

### API REST

Ogni collezione in `resources.ts` (`tasks`, `events`, `reminders`, `transactions`, `budgets`, `goals`, `habits`, `habit_logs`, `notes`, `meals`, `workouts`, `body_metrics`, `social_posts`, `meal_plan`, `pantry_items`, `shopping_items`, `feeds`) espone automaticamente:

```
GET    /api/<collezione>?campo=valore&campo__ne=valore&from=YYYY-MM-DD&to=YYYY-MM-DD&q=testo&order=-campo&limit=100
GET    /api/<collezione>/:id
POST   /api/<collezione>
PATCH  /api/<collezione>/:id
DELETE /api/<collezione>/:id
```

Endpoint specifici: `GET /api/dashboard`, `GET /api/finance/summary?month=YYYY-MM`, `GET /api/habits/overview`, `POST /api/habits/:id/toggle`, `POST /api/reminders/:id/complete`, `GET|PUT /api/settings`, `GET /api/search?q=`, `GET /api/news`, `POST /api/ai/chat`, `GET /api/export`, `POST /api/import`, `GET /api/workouts/progress`, `POST /api/shopping/generate`, `POST /api/shopping/add`, `POST /api/shopping/complete`, `GET /api/shopping/text`, `GET /api/meal_plan/today`, `POST /api/meal_plan/:id/eat`, `GET /api/integration`.

### Aggiungere un campo o un modulo

1. Aggiungi il campo (o una nuova collezione) in `server/src/resources.ts`: la colonna viene creata in automatico al riavvio.
2. Aggiorna il tipo in `client/src/types.ts` e il form in `client/src/forms.ts`.
3. Per un nuovo modulo crea una pagina in `client/src/pages/` e aggiungila a `NAV` in `App.tsx`.

## Verso la spesa automatica

La base è pronta: piano alimentare → fabbisogno → meno dispensa → lista della spesa, con la dispensa che si aggiorna quando mangi e quando fai la spesa. I prossimi passi possibili:

- **consumi reali**: confrontare quanto pianificato con quanto registri davvero e correggere le quantità
- **ordine online**: inviare la lista a un supermercato con spesa a domicilio (serve un servizio con API o un'automazione del browser)
- **spesa programmata**: generare la lista ogni settimana in un giorno fisso e avvisarti
- **prezzi**: stimare il costo della lista e collegarlo al budget “Spesa”

## Altre idee

- Sincronizzazione con Google Calendar e import degli estratti conto (CSV)
- Accesso dal telefono fuori casa (sincronizzazione cloud)
- Statistiche dei social collegate alle API di Instagram, TikTok e YouTube
