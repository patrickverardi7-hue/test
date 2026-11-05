# 🧠 Second Brain

Una "seconda mente" per gestire tutta la tua vita in un'unica app: task, agenda e time-blocking, promemoria, obiettivi e abitudini, note e brainstorming, finanze, alimentazione, allenamenti, contenuti social, notizie e un assistente AI che conosce tutti i tuoi dati.

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Node.js + Express 5 + SQLite (integrato in Node, nessun database da installare)
- **AI** (opzionale): Claude di Anthropic tramite `@anthropic-ai/sdk`

## Requisiti

- Node.js **22.13 o successivo** (serve il modulo `node:sqlite` integrato)

## Avvio rapido

```bash
cd second-brain
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

I dati vengono salvati in `server/data/second-brain.db` (escluso da git).

### Attivare l'assistente AI

```bash
cp server/.env.example server/.env
# poi apri server/.env e imposta ANTHROPIC_API_KEY=sk-ant-...
```

Riavvia `npm run dev`. Senza chiave l'app funziona normalmente; solo le funzioni AI restano disattivate.

### Uso "in produzione" (un solo server)

```bash
npm run build   # compila il frontend in client/dist
npm start       # il server su :3001 serve sia l'API sia l'app
```

Per proteggere l'app con una password (consigliato se la esponi in rete) imposta `APP_PASSWORD` in `server/.env`.

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
| 🥗 **Alimentazione** | Diario dei pasti, calorie e macro rispetto agli obiettivi, grafico settimanale, pasti frequenti |
| 🏋️ **Allenamenti** | Sessioni con esercizi (serie × ripetizioni × kg), obiettivo settimanale, volume, record personali, “Ripeti” |
| 📱 **Social** | Kanban dei contenuti (idea → bozza → pronto → programmato → pubblicato), hook, script, metriche, **generatore di idee AI** |
| 📰 **Notizie** | Aggregatore RSS con categorie, salvataggio degli articoli nelle note |
| ✨ **Assistente AI** | Chat che riceve un'istantanea dei tuoi dati: pianificazione della giornata, revisione settimanale, analisi delle spese, idee, allenamenti. Le risposte si salvano come nota o diventano task |
| ⚙️ **Impostazioni** | Profilo, obiettivi nutrizionali e di allenamento, nicchia social, fonti RSS, backup e ripristino in JSON |

Funzioni trasversali: **cattura rapida** (`Alt+N`) per inbox, task, idee, promemoria, eventi e spese; **ricerca globale** (`/`) in tutti i moduli; tema chiaro/scuro automatico; interfaccia adatta al telefono.

## Architettura

```
second-brain/
├── server/src/
│   ├── resources.ts      # definizione di tutte le collezioni (campi, default, ordinamenti)
│   ├── db.ts             # SQLite, migrazioni automatiche, CRUD generico
│   ├── summary.ts        # calcoli aggregati (dashboard, finanze, abitudini…)
│   └── routes/
│       ├── crud.ts       # REST automatico per ogni collezione
│       ├── features.ts   # dashboard, ricerca, abitudini, promemoria, backup
│       ├── news.ts       # feed RSS
│       └── ai.ts         # assistente Claude
└── client/src/
    ├── App.tsx           # layout, navigazione, cattura rapida, notifiche
    ├── api.ts            # client HTTP e hook dati
    ├── components/ui.tsx # componenti riutilizzabili (form, modal, grafici, markdown)
    └── pages/            # una pagina per modulo
```

### API REST

Ogni collezione in `resources.ts` (`tasks`, `events`, `reminders`, `transactions`, `budgets`, `goals`, `habits`, `habit_logs`, `notes`, `meals`, `workouts`, `social_posts`, `feeds`) espone automaticamente:

```
GET    /api/<collezione>?campo=valore&campo__ne=valore&from=YYYY-MM-DD&to=YYYY-MM-DD&q=testo&order=-campo&limit=100
GET    /api/<collezione>/:id
POST   /api/<collezione>
PATCH  /api/<collezione>/:id
DELETE /api/<collezione>/:id
```

Endpoint specifici: `GET /api/dashboard`, `GET /api/finance/summary?month=YYYY-MM`, `GET /api/habits/overview`, `POST /api/habits/:id/toggle`, `POST /api/reminders/:id/complete`, `GET|PUT /api/settings`, `GET /api/search?q=`, `GET /api/news`, `POST /api/ai/chat`, `GET /api/export`, `POST /api/import`.

### Aggiungere un campo o un modulo

1. Aggiungi il campo (o una nuova collezione) in `server/src/resources.ts`: la colonna viene creata in automatico al riavvio.
2. Aggiorna il tipo in `client/src/types.ts` e il form in `client/src/forms.ts`.
3. Per un nuovo modulo crea una pagina in `client/src/pages/` e aggiungila a `NAV` in `App.tsx`.

## Idee per i prossimi passi

- Sincronizzazione con Google Calendar e import degli estratti conto (CSV)
- L'assistente che crea task ed eventi direttamente (tool use)
- PWA installabile sul telefono con notifiche push
- Statistiche dei social collegate alle API di Instagram, TikTok e YouTube
