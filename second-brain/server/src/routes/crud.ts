import { Router, type Request, type Response } from 'express';
import { RESOURCES, type ResourceDef } from '../resources.js';
import { create, getOne, HttpError, list, remove, update } from '../db.js';

export const crudRouter = Router();

function resolve(req: Request): ResourceDef {
  const def = RESOURCES[String(req.params.resource)];
  if (!def) throw new HttpError(404, 'Risorsa sconosciuta');
  return def;
}

function idParam(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'ID non valido');
  return id;
}

crudRouter.get('/:resource', (req: Request, res: Response) => {
  res.json(list(resolve(req), req.query as Record<string, unknown>));
});

crudRouter.get('/:resource/:id', (req, res) => {
  const row = getOne(resolve(req), idParam(req));
  if (!row) throw new HttpError(404, 'Elemento non trovato');
  res.json(row);
});

crudRouter.post('/:resource', (req, res) => {
  res.status(201).json(create(resolve(req), req.body ?? {}));
});

crudRouter.patch('/:resource/:id', (req, res) => {
  res.json(update(resolve(req), idParam(req), req.body ?? {}));
});

crudRouter.delete('/:resource/:id', (req, res) => {
  remove(resolve(req), idParam(req));
  res.status(204).end();
});
