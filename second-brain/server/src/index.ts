import { DATA_DIR } from './env.js';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { DB_PATH, HttpError, migrate } from './db.js';
import { crudRouter } from './routes/crud.js';
import { featuresRouter } from './routes/features.js';
import { newsRouter } from './routes/news.js';
import { aiEnabled, aiRouter } from './routes/ai.js';
import { groceryRouter } from './routes/grocery.js';
import { progressRouter } from './routes/progress.js';

migrate();

const app = express();
const PORT = Number(process.env.PORT) || 3001;
// di default l'API è raggiungibile solo da questo computer; HOST=0.0.0.0 per aprirla alla rete locale (usa APP_PASSWORD!)
const HOST = process.env.HOST || '127.0.0.1';
const here = path.dirname(fileURLToPath(import.meta.url));
const PASSWORD = process.env.APP_PASSWORD ?? '';

app.disable('x-powered-by');
app.use(express.json({ limit: '20mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, authRequired: Boolean(PASSWORD), ai: aiEnabled() });
});

// Protezione opzionale con password (header Authorization: Bearer <APP_PASSWORD>)
function auth(req: Request, _res: Response, next: NextFunction) {
  if (!PASSWORD) return next();
  const header = req.get('authorization') ?? '';
  const token = Buffer.from(header.startsWith('Bearer ') ? header.slice(7) : '');
  const expected = Buffer.from(PASSWORD);
  if (token.length === expected.length && timingSafeEqual(token, expected)) return next();
  next(new HttpError(401, 'Accesso richiesto'));
}

app.use('/api', auth);

// Informazioni per collegare Claude (MCP) e altri strumenti
app.get('/api/integration', (_req, res) => {
  const mcpPath = process.env.MCP_PATH ?? path.resolve(here, '../../mcp/dist/second-brain-mcp.mjs');
  res.json({
    apiUrl: `http://127.0.0.1:${PORT}/api`,
    dataDir: DATA_DIR,
    dbPath: DB_PATH,
    mcpPath,
    mcpBuilt: fs.existsSync(mcpPath),
    passwordProtected: Boolean(PASSWORD),
    desktop: process.env.SECOND_BRAIN_DESKTOP === '1',
  });
});

app.use('/api', featuresRouter);
app.use('/api', groceryRouter);
app.use('/api', progressRouter);
app.use('/api', newsRouter);
app.use('/api', aiRouter);
app.use('/api', crudRouter);
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Endpoint non trovato')));

// In produzione il server serve anche il frontend compilato (client/dist)
const clientDist = path.resolve(process.env.CLIENT_DIST ?? path.join(here, '../../client/dist'));
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({ error: 'JSON non valido' });
  console.error(err);
  res.status(500).json({ error: 'Errore interno del server' });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`🧠 Second Brain in ascolto su http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`   Dati: ${DB_PATH}`);
  if (!aiEnabled()) console.log(`   Assistente AI disattivato: imposta ANTHROPIC_API_KEY in ${path.join(DATA_DIR, '.env')}`);
});
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') console.error(`La porta ${PORT} è già in uso: Second Brain è forse già aperto (app desktop?).`);
  else console.error(err);
  process.exit(1);
});
