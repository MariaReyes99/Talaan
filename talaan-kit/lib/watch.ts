/**
 * Source watch: fetches each official page on its schedule, reduces it to visible text, and compares a
 * SHA-256 fingerprint with the last check. A change adds an item to the review queue. Nothing is ever
 * written to the corpus automatically; a person reviews each change in Admin → Source watch.
 * One polite request per source per check, with a clear user agent and a timeout.
 */
import { createHash } from 'node:crypto';
import type { WatchSource } from './watch-sources';

export interface SourceState { hash: string; text: string; checkedAt: string }
export interface QueueItem { id: string; sourceId: string; detectedAt: string; summary: string; status: 'open' }
export interface CheckResult { id: string; status: 'first' | 'unchanged' | 'changed' | 'skipped' | 'error'; detail?: string }
export interface WatchDeps {
  fetch: typeof fetch; now: () => Date;
  get: <T>(key: string) => Promise<T | null>; set: (key: string, value: unknown) => Promise<void>;
}
const USER_AGENT = 'TalaanSourceWatch/1.0 (payroll compliance monitoring; contact via talaan-ivory.vercel.app)';
const EVERY_MS = { daily: 20 * 3600e3, weekly: 6.5 * 24 * 3600e3, monthly: 29 * 24 * 3600e3 };

/** Visible text only: drops scripts, styles and tags, so layout tweaks and tracking codes do not count as changes. */
export function pageText(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}
export const fingerprint = (text: string) => createHash('sha256').update(text).digest('hex');

/** A short excerpt around the first difference, for the reviewer. */
export function changeExcerpt(before: string, after: string, size = 240) {
  let i = 0; while (i < before.length && i < after.length && before[i] === after[i]) i++;
  const start = Math.max(0, i - 60); return (start > 0 ? '…' : '') + after.slice(start, start + size) + (after.length > start + size ? '…' : '');
}

export async function checkSource(src: WatchSource, d: WatchDeps): Promise<CheckResult> {
  const key = `watch:src:${src.id}`;
  const prev = await d.get<SourceState>(key);
  if (prev && d.now().getTime() - new Date(prev.checkedAt).getTime() < EVERY_MS[src.every]) return { id: src.id, status: 'skipped' };
  let html: string;
  try {
    const res = await d.fetch(src.url, { headers: { 'user-agent': USER_AGENT, accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { id: src.id, status: 'error', detail: `HTTP ${res.status}` };
    html = await res.text();
  } catch (e) { return { id: src.id, status: 'error', detail: (e as Error).name === 'TimeoutError' ? 'timeout' : 'unreachable' }; }
  const text = pageText(html).slice(0, 200_000); const hash = fingerprint(text); const at = d.now().toISOString();
  await d.set(key, { hash, text: text.slice(0, 20_000), checkedAt: at } satisfies SourceState);
  if (!prev) return { id: src.id, status: 'first' };
  if (prev.hash === hash) return { id: src.id, status: 'unchanged' };
  const queue = (await d.get<QueueItem[]>('watch:queue')) ?? [];
  queue.unshift({ id: `q_${at}_${src.id}`, sourceId: src.id, detectedAt: at.slice(0, 10), summary: `${src.name} changed: ${changeExcerpt(prev.text, text)}`, status: 'open' });
  await d.set('watch:queue', queue.slice(0, 200));
  return { id: src.id, status: 'changed' };
}
