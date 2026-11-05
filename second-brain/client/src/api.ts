import { useCallback, useEffect, useRef, useState } from 'react';
import { nowLocal, today } from './utils';

// ---------- autenticazione (opzionale) ----------
const TOKEN_KEY = 'sb_token';

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage non disponibile */
  }
}

let unauthorizedHandler: (() => void) | null = null;
export const onUnauthorized = (fn: () => void) => {
  unauthorizedHandler = fn;
};

// ---------- richieste ----------
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch('/api' + url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (res.status === 401) unauthorizedHandler?.();
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).error ?? msg;
    } catch {
      /* risposta non JSON */
    }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
  patch: <T>(url: string, body: unknown) => request<T>('PATCH', url, body),
  put: <T>(url: string, body: unknown) => request<T>('PUT', url, body),
  del: (url: string) => request<void>('DELETE', url),
};

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// ---------- notifiche di modifica dati (per aggiornare le altre viste) ----------
const listeners = new Set<() => void>();
export function notifyChange() {
  listeners.forEach((l) => l());
}

// ---------- toast ----------
export type Toast = { id: number; text: string; tone: 'ok' | 'error' | 'info' };
const toastListeners = new Set<(t: Toast) => void>();
let toastId = 0;
export function toast(text: string, tone: Toast['tone'] = 'ok') {
  const t = { id: ++toastId, text, tone };
  toastListeners.forEach((l) => l(t));
}
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const add = (t: Toast) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3500);
    };
    toastListeners.add(add);
    return () => {
      toastListeners.delete(add);
    };
  }, []);
  return toasts;
}

export function errorToast(e: unknown) {
  toast(e instanceof Error ? e.message : String(e), 'error');
}

// ---------- hook di caricamento dati ----------
export function useFetch<T>(url: string | null) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const my = ++seq.current;
    setLoading(true);
    try {
      const d = await api.get<T>(url);
      if (my === seq.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (my === seq.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    load();
    listeners.add(load);
    return () => {
      listeners.delete(load);
    };
  }, [load]);

  return { data, error, loading, reload: load, setData };
}

/** CRUD su una collezione del backend con aggiornamento automatico */
export function useResource<T extends { id: number }>(name: string, query: Record<string, string | number | boolean | undefined> = {}) {
  const url = `/${name}${qs(query)}`;
  const { data, error, loading, reload } = useFetch<T[]>(url);

  const wrap = useCallback(
    <A extends unknown[], R>(fn: (...a: A) => Promise<R>, okMsg?: string) =>
      async (...a: A): Promise<R | undefined> => {
        try {
          const r = await fn(...a);
          notifyChange();
          if (okMsg) toast(okMsg);
          return r;
        } catch (e) {
          errorToast(e);
          return undefined;
        }
      },
    [],
  );

  return {
    items: data ?? [],
    loading,
    error,
    reload,
    create: wrap((body: Partial<T>) => api.post<T>(`/${name}`, body)),
    update: wrap((id: number, body: Partial<T>) => api.patch<T>(`/${name}/${id}`, body)),
    remove: wrap((id: number) => api.del(`/${name}/${id}`), 'Eliminato'),
  };
}

/** Esegue un'azione, mostra eventuali errori e aggiorna tutte le viste */
export async function act<R>(fn: () => Promise<R>, okMsg?: string): Promise<R | undefined> {
  try {
    const r = await fn();
    notifyChange();
    if (okMsg) toast(okMsg);
    return r;
  } catch (e) {
    errorToast(e);
    return undefined;
  }
}

// ---------- AI ----------
export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export async function askAI(messages: ChatMessage[]): Promise<string> {
  const res = await api.post<{ reply: string }>('/ai/chat', { messages, date: today(), now: nowLocal() });
  return res.reply;
}
