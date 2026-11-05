// Aggregatore di notizie da feed RSS/Atom configurabili.
import { Router } from 'express';
import Parser from 'rss-parser';
import { list } from '../db.js';
import { RESOURCES } from '../resources.js';

export const newsRouter = Router();

const parser = new Parser();
const CACHE_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; items: NewsItem[] }>();

interface NewsItem {
  title: string;
  link: string;
  date: string | null;
  snippet: string;
  source: string;
  category: string;
}

async function fetchFeed(feed: { name: string; url: string; category: string }, force: boolean): Promise<NewsItem[]> {
  const hit = cache.get(feed.url);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit.items;
  const res = await fetch(feed.url, {
    signal: AbortSignal.timeout(10_000),
    headers: { 'User-Agent': 'SecondBrain/1.0 (lettore RSS personale)', Accept: 'application/rss+xml, application/xml, text/xml, */*' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const parsed = await parser.parseString(await res.text());
  const items: NewsItem[] = (parsed.items ?? []).slice(0, 40).map((it) => ({
    title: (it.title ?? '').trim(),
    link: it.link ?? '',
    date: it.isoDate ?? it.pubDate ?? null,
    snippet: (it.contentSnippet ?? it.summary ?? '').replace(/\s+/g, ' ').trim().slice(0, 280),
    source: feed.name,
    category: feed.category,
  }));
  cache.set(feed.url, { at: Date.now(), items });
  return items;
}

export async function getNews(opts: { category?: string; force?: boolean } = {}) {
  const feeds = list(RESOURCES.feeds, { enabled: 'true' }) as unknown as { name: string; url: string; category: string }[];
  const selected = opts.category ? feeds.filter((f) => f.category === opts.category) : feeds;
  const results = await Promise.allSettled(selected.map((f) => fetchFeed(f, !!opts.force)));
  const items: NewsItem[] = [];
  const errors: { source: string; error: string }[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') items.push(...r.value);
    else errors.push({ source: selected[i].name, error: String(r.reason?.message ?? r.reason) });
  });
  items.sort((a, b) => (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0));
  return { items: items.slice(0, 200), errors, categories: [...new Set(feeds.map((f) => f.category))] };
}

newsRouter.get('/news', async (req, res) => {
  const category = typeof req.query.category === 'string' && req.query.category ? req.query.category : undefined;
  res.json(await getNews({ category, force: req.query.refresh === '1' }));
});
