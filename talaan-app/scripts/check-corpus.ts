/**
 * Corpus checks (run: npm run check:corpus). Fails on errors.
 * 1. Every entry has a question and answer in en, tl and zh, a source and dates.
 * 2. Locked terms (SSS, BIR, form numbers, peso amounts) in English appear unchanged in tl and zh.
 * 3. Chinese uses Simplified characters only.
 * 4. Retrieval: each FAQ question, in each language, finds its own entry with Ask Tala.
 * 5. Questions the corpus does not cover are declined, not guessed.
 */
import * as OpenCC from 'opencc-js';
import { KB, ask } from '../src/kb';
import type { Lang } from '../src/i18n';
import raw from '../corpus/corpus.json';

const LOCKED = ['SSS', 'PhilHealth', 'Pag-IBIG', 'BIR', 'EC', '1601-C', '1604-C', '2316', 'Xero', 'NCR', 'RA 9262', 'Talaan'];
const toS = OpenCC.Converter({ from: 'tw', to: 'cn' });
let errors = 0, warns = 0;
const err = (m: string) => { errors++; console.log('ERROR ', m); };
const warn = (m: string) => { warns++; console.log('warn  ', m); };
const langs: Lang[] = ['en', 'tl', 'zh'];

// Separation guard: this corpus is Talaan's only.
const FOREIGN = /kiwisaver|superannuation|\bsuper fund|\betfs?\b|index fund|managed fund|sorted\.org|monte carlo|wealth projection|\bfma\b|\basic\b|investment portfolio/i;
for (const e of raw as unknown as { product?: string; namespace?: string; id: string; q: Record<string, string>; a: Record<string, string>; source: string }[]) {
  if (e.product !== 'talaan' || e.namespace !== 'talaan-ph-payroll') err(`${e.id}: not tagged as a Talaan entry (product/namespace)`);
  const all = [...Object.values(e.q), ...Object.values(e.a), e.source].join(' ');
  if (FOREIGN.test(all)) err(`${e.id}: contains content that belongs to another product (${all.match(FOREIGN)![0]})`);
}
for (const e of KB) {
  for (const l of langs) { if (!e.q[l]?.trim()) err(`${e.id}: missing question (${l})`); if (!e.a[l]?.trim()) err(`${e.id}: missing answer (${l})`); }
  if (!e.source || !e.effective || !e.verified) err(`${e.id}: missing source or dates`);
  const money = e.a.en.match(/₱\d{1,3}(,\d{3})*(\.\d+)?/g) ?? [];
  for (const l of ['tl', 'zh'] as Lang[]) {
    for (const term of LOCKED) if (new RegExp(`\\b${term}\\b`).test(e.a.en) && !e.a[l].includes(term)) err(`${e.id} [${l}]: locked term "${term}" missing`);
    for (const m of money) if (!e.a[l].includes(m)) err(`${e.id} [${l}]: amount ${m} missing or changed`);
  }
  for (const k of ['q', 'a'] as const) { const z = e[k].zh; if (toS(z) !== z) err(`${e.id}: Traditional characters in Chinese ${k}: ${toS(z)}`); }
}
let hits = 0, total = 0;
for (const e of KB) for (const l of langs) {
  total++; const got = ask(e.q[l], l);
  if (got.some(x => x.id === e.id)) hits++; else warn(`retrieval [${l}] "${e.q[l]}" → ${got.map(x => x.id).join(', ') || 'declined'}`);
}
const offTopic: [string, Lang][] = [['What is the capital of France?', 'en'], ['Can you recommend a restaurant?', 'en'], ['Sino ang presidente?', 'tl'], ['今天天气怎么样？', 'zh'], ['How do I bake bread?', 'en']];
for (const [q, l] of offTopic) { const got = ask(q, l); if (got.length) err(`should decline "${q}" but answered ${got.map(x => x.id).join(', ')}`); }
console.log(`\n${KB.length} entries. Retrieval: ${hits}/${total} questions found their own answer. ${errors} error(s), ${warns} warning(s).`);
process.exit(errors ? 1 : 0);
