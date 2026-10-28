/** Text normalisation shared by the retriever and the guardrails: English, Tagalog/Taglish and Simplified Chinese. */

/** Lower-case, fold accents and curly quotes, keep letters, digits, hyphens and CJK. */
export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’‘`]/g, "'").replace(/[^a-z0-9㐀-鿿\s\-']/g, ' ').replace(/\s+/g, ' ').trim();
}

const STOP = new Set([
  // English
  'a', 'an', 'the', 'is', 'are', 'was', 'be', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'do', 'does', 'did', 'i', 'we', 'my', 'our', 'me', 'you', 'your', 'it', 'its', 'this', 'that', 'these', 'those',
  'what', 'when', 'how', 'which', 'who', 'where', 'why', 'much', 'many', 'can', 'there', 'with', 'from', 'have', 'has', 'need', 'about', 'any', 'still', 'if', 'at', 'by', 'as', 'get', 'should', 'must', 'will', 'would',
  // Tagalog
  'ang', 'ng', 'sa', 'na', 'ba', 'ko', 'mo', 'ka', 'ako', 'kami', 'tayo', 'namin', 'natin', 'nila', 'kung', 'para', 'ay', 'mga', 'at', 'po', 'ito', 'iyan', 'yung', 'magkano', 'paano', 'kailan', 'ano', 'sino', 'saan', 'bakit', 'ilang', 'may', 'nga',
]);
/** Very light stemming so "contributions" matches "contribution" and "paying" matches "pay". */
function stem(w: string) {
  if (w.length > 5 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('es') && !w.endsWith('ses')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}
/** Small payroll thesaurus for query expansion: everyday words mapped to the corpus's terms. Reviewed with the corpus. */
const SYN: Record<string, string> = { leak: 'breach', leaked: 'breach', hacked: 'breach', submit: 'file', submits: 'file', efile: 'file', 'e-file': 'file', process: 'run', processing: 'run',
  bug: 'problem', error: 'problem', takehome: 'net', 'take-home': 'net', graveyard: 'night', salary: 'pay', wage: 'pay', bonuses: 'bonus', resignation: 'resign', quit: 'resign', fired: 'separation',
  'day-off': 'rest', dayoff: 'rest', holidays: 'holiday', sahod: 'pay', suweldo: 'pay', sweldo: 'pay', payslips: 'payslip', remitting: 'remit', remitted: 'remit' };
/** Word tokens (stemmed, stop words removed) plus Chinese character bigrams. */
export function tokenize(s: string): string[] {
  const n = normalize(s); const out: string[] = [];
  for (const raw of n.split(' ')) {
    if (!raw) continue;
    if (/[㐀-鿿]/.test(raw)) { const han = raw.replace(/[^㐀-鿿]/g, ''); for (let i = 0; i < han.length - 1; i++) out.push(han.slice(i, i + 2)); if (han.length === 1) out.push(han);
      const latin = raw.replace(/[㐀-鿿]+/g, ' ').trim(); if (latin) out.push(...tokenize(latin)); continue; }
    const w = raw.replace(/^[-']+|[-']+$/g, ''); if (w.length < 2 || STOP.has(w)) continue;
    const syn = SYN[w]; if (syn) out.push(stem(syn));
    out.push(stem(w)); if (w.includes('-')) out.push(...w.split('-').filter(x => x.length > 1 && !STOP.has(x)).map(stem), stem(w.replace(/-/g, '')));
  }
  return out;
}
/** Damerau-Levenshtein distance ≤ 1 (one insert, delete, substitute or adjacent swap): used to forgive typos. */
export function oneEditApart(a: string, b: string): boolean {
  if (a === b) return true; const la = a.length, lb = b.length; if (Math.abs(la - lb) > 1 || Math.min(la, lb) < 4) return false;
  let i = 0; while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}
