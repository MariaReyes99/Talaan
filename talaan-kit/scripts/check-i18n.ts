/**
 * Translation checker for Talaan.
 * Checks what a machine can check without anyone reading Chinese or Tagalog:
 *   1. Every key in English exists in every language, and no extra keys.
 *   2. Every message is valid ICU message syntax (the format next-intl reads).
 *   3. Placeholders match English exactly ({days}, {n}, {current}...).
 *   4. Locked glossary terms (SSS, BIR, form numbers...) appear unchanged.
 *   5. Chinese text contains Chinese characters and is all Simplified.
 *   6. Tagalog text is not just a copy of the English (missed translation).
 *   7. Length warnings: text much longer than English may overflow buttons.
 * Run: npx tsx scripts/check-i18n.ts   (exit code 1 on errors, for CI)
 */
import { readFileSync } from 'node:fs';
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import * as OpenCC from 'opencc-js';

type Tree = { [k: string]: string | Tree };
const LOCALES = ['tl', 'zh-Hans'] as const;
const load = (l: string): Tree => JSON.parse(readFileSync(`messages/${l}.json`, 'utf8'));
const glossary = JSON.parse(readFileSync('lib/i18n/glossary.json', 'utf8')) as { locked: string[]; lockedExceptions: Record<string, string[]> };

function flatten(t: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(t)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.set(key, v);
    else for (const [kk, vv] of flatten(v, key)) out.set(kk, vv);
  }
  return out;
}

function placeholders(els: MessageFormatElement[], acc = new Set<string>()): Set<string> {
  for (const e of els) {
    if (e.type === TYPE.argument || e.type === TYPE.number || e.type === TYPE.date || e.type === TYPE.time) acc.add(e.value);
    if (e.type === TYPE.plural || e.type === TYPE.select) { acc.add(e.value); for (const o of Object.values(e.options)) placeholders(o.value, acc); }
    if (e.type === TYPE.tag) placeholders(e.children, acc);
  }
  return acc;
}

const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });
const CJK = /[\u3400-\u9fff]/;
const SKIP_COPY_CHECK = new Set(['meta.langName', 'meta.htmlLang', 'meta.voiceLang']);

const en = flatten(load('en'));
let errors = 0, warnings = 0;
const err = (l: string, k: string, m: string) => { errors++; console.log(`ERROR  [${l}] ${k}: ${m}`); };
const warn = (l: string, k: string, m: string) => { warnings++; console.log(`warn   [${l}] ${k}: ${m}`); };

for (const [k, v] of en) { try { parse(v); } catch (e) { err('en', k, `invalid ICU syntax (${(e as Error).message})`); } }

for (const loc of LOCALES) {
  const tr = flatten(load(loc));
  for (const k of en.keys()) if (!tr.has(k)) err(loc, k, 'missing');
  for (const k of tr.keys()) if (!en.has(k)) err(loc, k, 'not in English (extra key)');

  for (const [k, enText] of en) {
    const text = tr.get(k);
    if (text === undefined || k.startsWith('meta.')) continue;
    let enPh: Set<string>, trPh: Set<string>;
    try { trPh = placeholders(parse(text)); } catch (e) { err(loc, k, `invalid ICU syntax (${(e as Error).message})`); continue; }
    enPh = placeholders(parse(enText));
    const a = [...enPh].sort().join(','), b = [...trPh].sort().join(',');
    if (a !== b) err(loc, k, `placeholders {${b}} should be {${a}}`);

    const exceptions = new Set(glossary.lockedExceptions[loc] ?? []);
    for (const term of glossary.locked) {
      if (enText.includes(term) && !exceptions.has(term) && !text.includes(term)) err(loc, k, `locked term "${term}" missing or changed`);
    }

    if (loc === 'zh-Hans') {
      const letters = text.replace(/\{[^}]*\}/g, '');
      if (!CJK.test(letters) && /[a-z]{3,}/i.test(letters.replace(new RegExp(glossary.locked.join('|'), 'g'), ''))) warn(loc, k, 'no Chinese characters: untranslated?');
      const simplified = toSimplified(text);
      if (simplified !== text) err(loc, k, `Traditional characters found; Simplified would be: ${simplified}`);
      if (/[\u3400-\u9fff][,;:?!]|[,;:?!][\u3400-\u9fff]/.test(text)) warn(loc, k, 'half-width punctuation next to Chinese; use ，；：？！');
    }
    if (loc === 'tl' && !SKIP_COPY_CHECK.has(k) && text === enText && enText.split(' ').length > 3) warn(loc, k, 'identical to English: untranslated?');

    const ratio = text.length / Math.max(enText.length, 1);
    if (loc !== 'zh-Hans' && ratio > 1.6 && enText.length > 12) warn(loc, k, `${Math.round(ratio * 100)}% of English length; check it fits`);
  }
}
console.log(`\n${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
