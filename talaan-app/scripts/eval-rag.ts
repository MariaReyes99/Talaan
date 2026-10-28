/**
 * Metric-driven evaluation of Ask Tala (run: npm run eval:rag [-- --label "what changed"]).
 * Runs every question in talaan-ai/data/eval_questions.jsonl through
 *   - "baseline": the original keyword retriever (src/kb.ts ask), and
 *   - "hybrid":   the current pipeline (guardrails + hybrid retriever, src/rag),
 * scores both, compares against talaan-ai/metrics/targets.json, appends to history.jsonl, writes latest.json,
 * a readable REPORT.md and ragas_input.jsonl for the RAGAS step. Exits 1 if the current pipeline misses a target,
 * so CI blocks a change that makes answers worse.
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { KB, askKeyword as ask } from '../src/kb';
import { HybridRetriever, type Lang } from '../src/rag/retriever';
import { askTala } from '../src/rag/pipeline';

const ROOT = new URL('../../talaan-ai/', import.meta.url).pathname;
const label = process.argv.includes('--label') ? process.argv[process.argv.indexOf('--label') + 1] : 'manual run';
type Q = { id: string; question: string; lang: Lang; expected: string[]; type: string; split: 'dev' | 'test' };
const qs: Q[] = readFileSync(ROOT + 'data/eval_questions.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l));
const retriever = new HybridRetriever(KB);
const asOf = '2026-10-28';

interface Row { q: Q; ids: string[]; ranked: string[]; status: 'answered' | 'declined' | 'blocked'; redacted: boolean; ms: number; contexts: string[]; answer: string }
async function runBaseline(q: Q): Promise<Row> { const t = performance.now(); const r = ask(q.question, q.lang); return { q, ids: r.map(e => e.id), ranked: r.map(e => e.id), status: r.length ? 'answered' : 'declined', redacted: false, ms: performance.now() - t, contexts: r.map(e => e.a[q.lang]), answer: r.map(e => e.a[q.lang]).join('\n') }; }
async function runHybrid(q: Q): Promise<Row> {
  const t = performance.now(); const a = await askTala(retriever, q.question, q.lang, { asOf });
  const ranked = a.status === 'blocked' ? [] : retriever.search(a.question, { lang: q.lang, k: 5 }).hits.map(h => h.id);
  return { q, ids: a.citations.map(c => c.id), ranked, status: a.status, redacted: a.redactions.length > 0, ms: performance.now() - t, contexts: a.citations.map(c => KB.find(e => e.id === c.id)!.a[q.lang]), answer: a.answer };
}

function score(rows: Row[]) {
  const inScope = rows.filter(r => r.q.expected.length); const off = rows.filter(r => r.q.type === 'off_topic'); const adv = rows.filter(r => r.q.type === 'adversarial'); const pii = rows.filter(r => r.q.type === 'pii');
  const top1 = (r: Row) => r.ids[0] !== undefined && r.q.expected.includes(r.ids[0]);
  const anyCited = (r: Row) => r.ids.some(id => r.q.expected.includes(id));
  const rr = (r: Row) => { const i = r.ranked.findIndex(id => r.q.expected.includes(id)); return i < 0 ? 0 : 1 / (i + 1); };
  const frac = (xs: Row[], f: (r: Row) => boolean) => xs.length ? Math.round(xs.filter(f).length / xs.length * 1000) / 1000 : 1;
  const m = {
    questions: rows.length,
    answer_accuracy: frac(inScope, r => r.status === 'answered' && anyCited(r)),
    hit_at_1: frac(inScope, top1),
    recall_at_3: frac(inScope, r => r.ranked.slice(0, 3).some(id => r.q.expected.includes(id))),
    mrr: Math.round(inScope.reduce((a, r) => a + rr(r), 0) / Math.max(1, inScope.length) * 1000) / 1000,
    wrong_answer_rate: frac(inScope, r => r.status === 'answered' && !anyCited(r)),
    false_decline_rate: frac(inScope, r => r.status !== 'answered'),
    off_topic_declined: frac(off, r => r.status !== 'answered'),
    adversarial_blocked: frac(adv, r => r.status !== 'answered'),
    pii_redacted: frac(pii, r => r.redacted),
    heldout_accuracy: frac(inScope.filter(r => r.q.split === 'test'), r => r.status === 'answered' && anyCited(r)),
    p95_ms: Math.round([...rows.map(r => r.ms)].sort((a, b) => a - b)[Math.floor(rows.length * 0.95)] * 100) / 100,
  };
  const by = (key: (r: Row) => string) => Object.fromEntries([...new Set(inScope.map(key))].map(k => [k, frac(inScope.filter(r => key(r) === k), r => r.status === 'answered' && anyCited(r))]));
  return { metrics: m, byType: by(r => r.q.type), byLang: by(r => r.q.lang) };
}

// Sequential, so each timing measures one question only.
const base: Row[] = []; for (const q of qs) base.push(await runBaseline(q));
const hyb: Row[] = []; for (const q of qs) hyb.push(await runHybrid(q));
const B = score(base), H = score(hyb);
const targets: Record<string, { min?: number; max?: number }> = JSON.parse(readFileSync(ROOT + 'metrics/targets.json', 'utf8'));
const misses = Object.entries(targets).filter(([k, t]) => { const v = (H.metrics as Record<string, number>)[k]; return (t.min !== undefined && v < t.min) || (t.max !== undefined && v > t.max); });
const at = new Date().toISOString();
const latest = { at, label, corpus_entries: KB.length, baseline: B, hybrid: H, targets, misses: misses.map(([k]) => k) };
writeFileSync(ROOT + 'metrics/latest.json', JSON.stringify(latest, null, 1));
appendFileSync(ROOT + 'metrics/history.jsonl', JSON.stringify({ at, label, corpus_entries: KB.length, ...H.metrics }) + '\n');
// RAGAS input: one row per in-scope or off-topic question, with the retrieved contexts and the reference answer.
writeFileSync(ROOT + 'eval/ragas_input.jsonl', hyb.filter(r => r.q.type !== 'adversarial').map(r => JSON.stringify({
  id: r.q.id, type: r.q.type, lang: r.q.lang, user_input: r.q.question, response: r.answer, retrieved_contexts: r.contexts, retrieved_ids: r.ids,
  reference: r.q.expected.map(id => KB.find(e => e.id === id)!.a[r.q.lang]).join('\n\n'), reference_contexts: r.q.expected.map(id => KB.find(e => e.id === id)!.a[r.q.lang]), reference_ids: r.q.expected })).join('\n') + '\n');
// Readable report
const keys = Object.keys(H.metrics) as (keyof typeof H.metrics)[];
const fmt = (v: number, k: string) => k === 'questions' ? String(v) : k === 'p95_ms' ? `${v} ms` : `${(v * 100).toFixed(1)}%`;
const hist = existsSync(ROOT + 'metrics/history.jsonl') ? readFileSync(ROOT + 'metrics/history.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l)).slice(-10) : [];
const report = [`# Ask Tala evaluation`, '', `Run ${at.slice(0, 16).replace('T', ' ')} UTC · ${label} · ${qs.length} questions · ${KB.length} corpus entries`, '',
  '| Metric | Baseline (keyword) | Current (guardrails + hybrid) | Target |', '|---|---|---|---|',
  ...keys.map(k => `| ${k} | ${fmt(B.metrics[k], k)} | **${fmt(H.metrics[k], k)}** | ${targets[k] ? (targets[k].min !== undefined ? `≥ ${fmt(targets[k].min!, k)}` : `≤ ${fmt(targets[k].max!, k)}`) : ''} |`),
  '', '## Answer accuracy by question type', '', '| Type | Baseline | Current |', '|---|---|---|', ...Object.keys(H.byType).map(k => `| ${k} | ${fmt(B.byType[k], k)} | ${fmt(H.byType[k], k)} |`),
  '', '## By language', '', '| Language | Baseline | Current |', '|---|---|---|', ...Object.keys(H.byLang).map(k => `| ${k} | ${fmt(B.byLang[k], k)} | ${fmt(H.byLang[k], k)} |`),
  '', '## Misses on the tuning (dev) split', '', 'Held-out (test) misses count in heldout_accuracy but are not listed, so the retriever is never tuned to them.', '', ...hyb.filter(r => r.q.split !== 'test').filter(r => r.q.expected.length ? !(r.status === 'answered' && r.ids.some(i => r.q.expected.includes(i))) : r.status === 'answered').slice(0, 40).map(r => `- [${r.q.type}/${r.q.lang}] “${r.q.question}” → ${r.status}${r.ids.length ? ` (${r.ids.join(', ')})` : ''}; expected ${r.q.expected.join(', ') || 'decline'}`),
  '', '## Trend (last 10 runs)', '', '| When | Label | Accuracy | Wrong answers | Off-topic declined | Adversarial blocked |', '|---|---|---|---|---|---|',
  ...hist.map(h => `| ${h.at.slice(0, 16).replace('T', ' ')} | ${h.label} | ${fmt(h.answer_accuracy, '')} | ${fmt(h.wrong_answer_rate, '')} | ${fmt(h.off_topic_declined, '')} | ${fmt(h.adversarial_blocked, '')} |`),
  '', misses.length ? `**Below target:** ${misses.map(([k]) => k).join(', ')}` : '**All targets met.**'].join('\n');
writeFileSync(ROOT + 'metrics/REPORT.md', report + '\n');
console.log(report.split('\n').slice(0, 18).join('\n'));
console.log(misses.length ? `\nBELOW TARGET: ${misses.map(([k]) => k).join(', ')}` : '\nAll targets met.');
process.exit(misses.length ? 1 : 0);
