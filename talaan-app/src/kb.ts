import type { Lang } from './i18n';
import corpus from '../corpus/corpus.json';
/**
 * Ask Tala's source library (corpus/corpus.json). Every answer carries its official
 * source, effective date and the date it was last checked. No match, no answer.
 */
export interface Entry {
  id: string; category: string; audience: string[]; kw: [string, number][]; source: string; sourceUrl: string;
  effective: string; verified: string; status: string; q: Record<Lang, string>; a: Record<Lang, string>;
}
/** Talaan entries only: anything not tagged for Talaan is ignored, even if it slips into the file. */
export const KB = (corpus as unknown as (Entry & { product?: string })[]).filter(e => e.product === 'talaan');
export const CATEGORIES = ['contributions', 'tax', 'pay', 'benefits', 'separation', 'deadlines', 'talaan', 'employees'] as const;

const tokens = (s: string) => {
  const words = s.toLowerCase().match(/[a-z0-9\-']{4,}/g) ?? [];
  const cjk = s.match(/[\u3400-\u9fff]+/g)?.flatMap(run => Array.from({ length: Math.max(0, run.length - 1) }, (_, i) => run.slice(i, i + 2))) ?? [];
  return new Set([...words, ...cjk]);
};
const ASCII = /^[a-z0-9 \-'’.,]+$/;
const hasKw = (s: string, k: string) => { const kk = k.toLowerCase(); if (!ASCII.test(kk)) return s.includes(kk);
  return new RegExp(`(^|[^a-z0-9])${kk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s|es)?($|[^a-z0-9])`).test(s); };
const STOP = new Set(['what', 'when', 'much', 'does', 'paano', 'magkano', 'kailan', 'there', 'with', 'from', 'this', 'that', 'have', 'need', 'kung', 'ang', 'para']);

export function ask(question: string, lang: Lang, audience?: string, entries: Entry[] = KB): Entry[] {
  const s = question.toLowerCase(); const qt = [...tokens(question)].filter(w => !STOP.has(w));
  const scored = entries.filter(e => !audience || e.audience.includes(audience)).map(e => {
    const kw = e.kw.reduce((a, [k, w]) => a + (hasKw(s, k) ? w : 0), 0);
    const hay = tokens(`${e.q[lang]} ${e.q.en}`);
    const overlap = Math.min(2, qt.filter(w => hay.has(w)).length * 0.5);
    return { e, score: kw + overlap };
  }).filter(x => x.score >= 2).sort((a, b) => b.score - a.score);
  if (!scored.length) return [];
  return scored.filter(x => x.score >= scored[0].score - 0.5).slice(0, 2).map(x => x.e);
}

/** The live corpus: the base file plus entries added or edited in Admin, minus removed ones. Talaan entries only. */
export function liveCorpus(custom: Record<string, unknown>[], removed: string[]): Entry[] {
  const extra = (custom as unknown as (Entry & { product?: string })[]).filter(e => e.product === 'talaan');
  const ids = new Set(extra.map(e => e.id));
  return [...KB.filter(e => !ids.has(e.id) && !removed.includes(e.id)), ...extra.filter(e => !removed.includes(e.id))];
}

/** In-app corpus check (the full check, including Simplified Chinese, is `npm run check:corpus`). */
export function checkCorpus(entries: Entry[]) {
  const issues: { id: string; level: 'error' | 'warn'; text: string }[] = [];
  const LOCKED = ['SSS', 'PhilHealth', 'Pag-IBIG', 'BIR', '1601-C', '1604-C', '2316', 'Xero', 'NCR'];
  const FOREIGN = /kiwisaver|superannuation|\betfs?\b|index fund|managed fund|monte carlo/i;
  const langs: Lang[] = ['en', 'tl', 'zh'];
  for (const e of entries as (Entry & { product?: string })[]) {
    if (e.product !== 'talaan') issues.push({ id: e.id, level: 'error', text: 'not tagged as a Talaan entry' });
    for (const l of langs) { if (!e.q[l]?.trim()) issues.push({ id: e.id, level: 'error', text: `question missing (${l})` }); if (!e.a[l]?.trim()) issues.push({ id: e.id, level: 'error', text: `answer missing (${l})` }); }
    if (!e.source?.trim()) issues.push({ id: e.id, level: 'error', text: 'source missing' });
    const money = e.a.en?.match(/₱\d{1,3}(,\d{3})*(\.\d+)?/g) ?? [];
    for (const l of ['tl', 'zh'] as Lang[]) {
      for (const term of LOCKED) if (new RegExp(`\\b${term}\\b`).test(e.a.en ?? '') && !(e.a[l] ?? '').includes(term)) issues.push({ id: e.id, level: 'error', text: `"${term}" missing in ${l}` });
      for (const m of money) if (!(e.a[l] ?? '').includes(m)) issues.push({ id: e.id, level: 'error', text: `${m} missing in ${l}` });
    }
    if (FOREIGN.test(JSON.stringify([e.q, e.a]))) issues.push({ id: e.id, level: 'error', text: 'contains content from another product' });
    for (const l of langs) if (e.q[l] && !ask(e.q[l], l, undefined, entries).some(x => x.id === e.id)) issues.push({ id: e.id, level: 'warn', text: `question (${l}) does not find its own answer: add keywords` });
  }
  return issues;
}
