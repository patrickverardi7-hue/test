import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { HttpError, migrate } from './db.js';
import { crudRouter } from './routes/crud.js';
import { featuresRouter } from './routes/features.js';
import { newsRouter } from './routes/news.js';
import { aiEnabled, aiRouter } from './routes/ai.js';

migrate();

const app = express();
const PORT = Number(process.env.PORT) || 3001;
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
app.use('/api', featuresRouter);
app.use('/api', newsRouter);
app.use('/api', aiRouter);
app.use('/api', crudRouter);
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Endpoint non trovato')));

// In produzione il server serve anche il frontend compilato (client/dist)
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
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

app.listen(PORT, () => {
  console.log(`🧠 Second Brain API in ascolto su http://localhost:${PORT}`);
  if (!aiEnabled()) console.log('   (assistente AI disattivato: imposta ANTHROPIC_API_KEY in server/.env per attivarlo)');
});
