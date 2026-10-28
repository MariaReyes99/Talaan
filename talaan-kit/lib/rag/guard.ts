// GENERATED from talaan-app/src/rag/guard.ts by scripts/sync-rag.mjs. Edit the original, then run npm run sync:rag.
/**
 * Ask Tala guardrails that run on every question, in the browser and on the server, with no model call.
 * They mirror the NeMo Guardrails configuration in talaan-ai/guardrails (which adds model-based checks on the server):
 *  input rails  – redact personal data, stop prompt injection, refuse requests for other people's records or secrets,
 *                 refuse help with avoiding taxes or contributions;
 *  output rails – every answer must cite a corpus entry, every peso amount and percentage in a generated answer must
 *                 appear in the cited sources, no personal data in the answer, and stale or unreviewed sources are flagged.
 */
import type { RagEntry } from './retriever';
import { oneEditApart } from './text';

export type InputVerdict = 'ok' | 'injection' | 'exfiltration' | 'evasion' | 'out_of_scope';
export interface Redaction { kind: 'tin' | 'sss' | 'philhealth' | 'pagibig' | 'card' | 'bank' | 'email' | 'mobile'; count: number }
export interface InputCheck { verdict: InputVerdict; text: string; redactions: Redaction[]; rails: string[] }

const luhn = (d: string) => { let s = 0; for (let i = 0; i < d.length; i++) { let n = +d[d.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } s += n; } return s % 10 === 0; };
// Order matters: the most specific formats first, so a PhilHealth number is not taken for a TIN.
export const PII: [Redaction['kind'], RegExp, ((m: string) => boolean)?][] = [
  ['email', /[\w.+-]+@[\w-]+\.[\w.-]+/g],
  ['philhealth', /\b\d{2}-\d{9}-\d\b/g],
  ['sss', /\b\d{2}-\d{7}-\d\b/g],
  ['pagibig', /\b\d{4}-\d{4}-\d{4}\b/g],
  ['tin', /\b\d{3}-\d{3}-\d{3}(?:-\d{3,5})?\b/g],
  ['mobile', /(?:\+?63|\b0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g],
  ['card', /\b(?:\d[ -]?){13,19}\b/g, m => luhn(m.replace(/\D/g, ''))],
  ['bank', /\b\d{10,16}\b/g],
];
export function redact(text: string): { text: string; redactions: Redaction[] } {
  let out = text; const red: Redaction[] = [];
  for (const [kind, re, ok] of PII) { let n = 0; out = out.replace(re, m => { if (ok && !ok(m)) return m; n++; return `[${kind.toUpperCase()}]`; }); if (n) red.push({ kind, count: n }); }
  return { text: out, redactions: red };
}

export const INJECTION = [/ignore (all |any |the )?(previous|prior|above|your|these) (instructions|rules|prompts?)/i, /disregard (the |your )?(instructions|rules|system)/i, /\byou are now\b/i, /\bDAN\b/, /developer mode/i,
  /system prompt/i, /jailbreak/i, /pretend (you are|to be)/i, /act as (an? )?(unfiltered|unrestricted|lawyer|hacker)/i, /huwag (mong )?pansinin ang (mga )?(utos|instruction)/i, /忽略(之前|以上|前面)的?(指令|指示|说明)/, /越狱/, /reveal (your|the) (prompt|instructions)/i];
export const EXFIL = [/\b(password|passcode|api[ -]?key|secret key|token|credentials?)\b/i,
  /\b(show|list|give|send|tell|export|dump|reveal)\b.{0,40}\b(all|every|everyone'?s?|employees'?|staff'?s?|[A-Z][a-z]+ [A-Z][a-z]+'?s?)\b.{0,40}\b(salar(y|ies)|bank|account numbers?|tins?|sss numbers?|philhealth numbers?|address(es)?|payslips?|birth ?dates?)/i,
  /\b(salary|bank account|tin|sss number|payslip)\b.{0,15}\bof\b.{0,5}\b[A-Z][a-z]+ [A-Z][a-z]+/, /\b(show|give|tell) me\b.{0,30}\b[A-Z][a-z]+ [A-Z][a-z]+'?s? (salary|bank|tin|payslip)/i,
  /(所有|全部)员工的?(银行|工资|账号|税号)/, /ipakita ang (sahod|bank account|tin) ng (lahat|bawat)/i, /employer (sss|tin|philhealth|pag-?ibig) (number|no\.?) of\b/i];
export const EVASION = [/\b(avoid|evade|dodge|skip|get around|escape)\b.{0,30}\b(paying|pay|tax|taxes|sss|philhealth|pag-?ibig|contributions?|bir|remitting)\b/i, /\bhide\b.{0,30}\b(income|bonus(es)?|salar(y|ies)|from (the )?bir)\b/i,
  /\b(under the table|off the books|not declare|without (the )?bir knowing|fake (payslips?|receipts?))\b/i, /\biwasan\b.{0,30}\b(buwis|bayad|sss|philhealth|pag-?ibig|kontribusyon)/i, /hindi (malalaman|alam) ng bir/i, /(逃税|避税|偷税|少报|不申报)/];

/** Other products' topics (the Investment Research Library and similar): Talaan never answers them, and never shares their data. */
export const OTHER_PRODUCT = /\b(kiwisaver|superannuation|super fund|index funds?|etfs?|managed funds?|crypto(currency)?|bitcoin|stocks? to buy|invest(ing|ment)? (the |our )?(payroll|money|float)|retirement fund to (buy|pick))\b/i;
/** Undo common disguises before matching: extra spaces, upper case, leetspeak, zero-width characters. Red-team finding, 28 Oct 2026. */
/** Words the guard patterns rely on. A word one typo away from one of these is read as it (PyRIT character-swap finding, 28 Oct 2026). */
export const GUARD_WORDS = ['ignore', 'previous', 'instructions', 'disregard', 'pretend', 'developer', 'reveal', 'prompt', 'password', 'credentials', 'avoid', 'evade', 'dodge', 'escape', 'paying', 'under', 'table',
  'books', 'declare', 'income', 'bonus', 'bonuses', 'salary', 'salaries', 'account', 'accounts', 'numbers', 'employees', 'iwasan', 'buwis', 'malalaman', 'pansinin', 'payslips', 'receipts', 'contributions', 'remitting', 'rules', 'system', 'output', 'fake', 'hide', 'skip', 'evade'];
/** Four-letter words are only corrected for swapped letters ("fkae" → "fake"), never substitutions ("make" stays "make"). */
const swapped = (a: string, b: string) => a.length === b.length && a !== b && [...a].sort().join('') === [...b].sort().join('') && [...a].filter((ch, i) => ch !== b[i]).length === 2;
const fixCore = (w: string) => w.length < 4 || GUARD_WORDS.includes(w) ? w : (w.length === 4 ? GUARD_WORDS.find(g => g.length === 4 && swapped(w, g)) : GUARD_WORDS.find(g => oneEditApart(w, g))) ?? w;
const fixWord = (w: string) => w.replace(/[a-z]+/g, fixCore);
export function deobfuscate(s: string) {
  return deleet(s).split(' ').map(fixWord).join(' ');
}
/** Look-alike letters from other scripts mapped to Latin (PyRIT Unicode-confusable finding, 28 Oct 2026). */
export const CONFUSABLES: Record<string, string> = { 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'һ': 'h', 'ӏ': 'l', 'ԛ': 'q', 'ԝ': 'w', 'ѵ': 'v',
  'α': 'a', 'ε': 'e', 'ο': 'o', 'ρ': 'p', 'ν': 'v', 'ι': 'i', 'κ': 'k', 'τ': 't', 'υ': 'u', 'χ': 'x', 'ɡ': 'g', 'ո': 'n', 'ս': 'u', 'ⅰ': 'i', 'ⅼ': 'l', 'ı': 'i', 'ʏ': 'y', 'ᴀ': 'a', 'ʙ': 'b', 'ᴄ': 'c', 'ᴅ': 'd', 'ᴇ': 'e', 'ɢ': 'g', 'ʜ': 'h', 'ɪ': 'i', 'ᴋ': 'k', 'ʟ': 'l', 'ᴍ': 'm', 'ɴ': 'n', 'ᴏ': 'o', 'ᴘ': 'p', 'ʀ': 'r', 'ᴛ': 't', 'ᴜ': 'u', 'ᴠ': 'v', 'ᴡ': 'w', 'ᴢ': 'z' };
function deleet(s: string) {
  return [...s.normalize('NFKC').toLowerCase()].map(ch => CONFUSABLES[ch] ?? ch).join('').replace(/[\u200b-\u200d\ufeff]/g, '').toLowerCase().replace(/(?<=[a-z])[013457@$](?=[a-z])|(?<=[a-z])[013457@$]\b|\b[013457@$](?=[a-z])/g, ch => ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' } as Record<string, string>)[ch] ?? ch).replace(/\s+/g, ' ');
}
export function checkInput(raw: string): InputCheck {
  const rails: string[] = []; const { text, redactions } = redact(raw.slice(0, 1000));
  if (redactions.length) rails.push('pii_redacted');
  const forms = [raw.replace(/\s+/g, ' '), deobfuscate(raw)];
  const any = (rs: RegExp[]) => forms.some(f => rs.some(r => r.test(f)));
  if (any(INJECTION)) return { verdict: 'injection', text, redactions, rails: [...rails, 'jailbreak'] };
  if (any(EXFIL)) return { verdict: 'exfiltration', text, redactions, rails: [...rails, 'sensitive_data_request'] };
  if (any(EVASION)) return { verdict: 'evasion', text, redactions, rails: [...rails, 'tax_evasion'] };
  if (any([OTHER_PRODUCT])) return { verdict: 'out_of_scope', text, redactions, rails: [...rails, 'off_topic'] };
  return { verdict: 'ok', text, redactions, rails };
}

export interface OutputCheck { ok: boolean; rails: string[]; ungrounded: string[]; text: string }
/** Checks a generated answer against the entries it cites. Extractive answers (the corpus text itself) always pass. */
export function checkOutput(answer: string, cited: RagEntry[]): OutputCheck {
  const rails: string[] = [];
  if (!cited.length) return { ok: false, rails: ['no_citation'], ungrounded: [], text: answer };
  const src = cited.map(e => `${e.a.en} ${e.a.tl} ${e.a.zh} ${e.q.en}`).join(' ').replace(/,/g, '');
  const facts = [...answer.replace(/,/g, '').matchAll(/₱\s?\d+(?:\.\d+)?|\b\d+(?:\.\d+)?%/g)].map(m => m[0].replace(/\s/g, ''));
  const ungrounded = facts.filter(f => !src.includes(f));
  if (ungrounded.length) rails.push('ungrounded_numbers');
  const { text, redactions } = redact(answer); if (redactions.length) rails.push('pii_in_output');
  return { ok: !ungrounded.length, rails, ungrounded, text };
}

/** Flags on the cited sources: older than the review cycle, or not yet signed off by the CPA adviser. */
export function sourceFlags(e: RagEntry, asOf: string, reviewDays = 90): string[] {
  const out: string[] = []; const age = (new Date(asOf + 'T00:00').getTime() - new Date(e.verified + 'T00:00').getTime()) / 864e5;
  if (age > reviewDays) out.push('stale'); if (/needs cpa review/i.test(e.status)) out.push('cpa_review_pending'); return out;
}
