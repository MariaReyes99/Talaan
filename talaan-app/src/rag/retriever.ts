/**
 * Ask Tala hybrid retriever (RAG, retrieval step).
 * Three signals, fused with reciprocal rank fusion (RRF):
 *  1. Curated keyword rules from the corpus (exact phrases with weights: precise, written by the CPA-reviewed corpus).
 *  2. BM25 over every entry's questions, keywords and answers in all three languages, with typo-tolerant matching.
 *  3. Optional dense (embedding) similarity, passed in by the server when Talaan's own embedding index is configured.
 * Then metadata filters (audience, category, effective date, review status) and a confidence gate:
 * no confident match → decline and hand the question to a person, never guess.
 */
import { normalize, tokenize, oneEditApart } from './text';

export type Lang = 'en' | 'tl' | 'zh';
export interface RagEntry {
  id: string; category: string; audience: string[]; kw: [string, number][]; source: string; sourceUrl: string;
  effective: string; verified: string; status: string; q: Record<Lang, string>; a: Record<Lang, string>; product?: string;
}
export interface Hit { id: string; entry: RagEntry; score: number; kw: number; bm25: number; dense?: number; why: string[] }
export interface SearchOptions { lang?: Lang; audience?: string; categories?: string[]; asOf?: string; k?: number; dense?: Record<string, number>; minConfidence?: number }
export interface SearchResult { hits: Hit[]; confident: boolean; reason?: 'no_match' | 'low_confidence' }

const K1 = 1.4, B = 0.7;
const W = { kw: 0.5, bm25: 0.5, dense: 0.35 };
const A_WEIGHT = 0.75;
const ASCII = /^[a-z0-9 \-'.,]+$/;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Spelling variants users type for the same term: "pag ibig" / "pag-ibig" / "pagibig", "1601c" / "1601-c". */
const variants = (x: string) => [...new Set([x, x.replace(/-/g, ' '), x.replace(/-/g, '')])];
/** A keyword rule compiled once at index time: plain substring for Chinese, word-boundary pattern otherwise. */
type Kw = { k: string; w: number; test: (s: string) => boolean };
function compileKw(k: string, w: number): Kw {
  const tests = variants(normalize(k)).filter(Boolean).map(kk => ASCII.test(kk) ? ((re: RegExp) => (s: string) => re.test(s))(new RegExp(`(^|[^a-z0-9])${esc(kk)}(s|es)?($|[^a-z0-9])`)) : (s: string) => s.includes(kk));
  return { k, w: w * (1 + 0.15 * (k.trim().split(/\s+/).length - 1)), test: s => tests.some(t => t(s)) };
}

export class HybridRetriever {
  // BM25F-style: questions and keywords form the main field; answers a second field at lower weight
  // (answers mention many agencies and forms, so on their own they over-match).
  private docs: { e: RagEntry; tf: Map<string, number>; len: number; ta: Map<string, number>; la: number; kws: Kw[] }[] = [];
  private avgA = 1;
  private df = new Map<string, number>(); private avgLen = 1; private vocab: string[] = [];
  constructor(entries: RagEntry[]) { this.index(entries); }

  index(entries: RagEntry[]) {
    this.docs = entries.map(e => {
      const kwText = e.kw.flatMap(([k, w]) => Array(Math.max(1, Math.min(4, Math.round(w / 2)))).fill(k)).join(' ');
      const toks = tokenize([e.q.en, e.q.tl, e.q.zh, e.q.en, e.q.tl, e.q.zh, kwText].join(' ')); const tf = new Map<string, number>(); toks.forEach(t => tf.set(t, (tf.get(t) ?? 0) + 1));
      const at = tokenize([e.a.en, e.a.tl, e.a.zh].join(' ')); const ta = new Map<string, number>(); at.forEach(t => ta.set(t, (ta.get(t) ?? 0) + 1));
      return { e, tf, len: toks.length, ta, la: at.length, kws: e.kw.map(([k, w]) => compileKw(k, w)) };
    });
    this.df.clear(); this.docs.forEach(d => new Set([...d.tf.keys(), ...d.ta.keys()]).forEach(t => this.df.set(t, (this.df.get(t) ?? 0) + 1)));
    this.avgA = this.docs.reduce((a, d) => a + d.la, 0) / Math.max(1, this.docs.length);
    this.avgLen = this.docs.reduce((a, d) => a + d.len, 0) / Math.max(1, this.docs.length); this.vocab = [...this.df.keys()];
  }
  get size() { return this.docs.length; }

  /** Query terms mapped to the corpus vocabulary; an unknown word within one edit of a known one is treated as that word. */
  private terms(q: string) {
    const out: { t: string; fuzzy: boolean }[] = [];
    for (const t of tokenize(q)) { if (this.df.has(t)) { out.push({ t, fuzzy: false }); continue; }
      if (/[㐀-鿿]/.test(t) || t.length < 5) continue;
      let near = this.fuzzyCache.get(t);
      if (near === undefined) { near = this.vocab.find(v => Math.abs(v.length - t.length) <= 1 && v[0] === t[0] && oneEditApart(t, v)) ?? null; this.fuzzyCache.set(t, near); }
      if (near) out.push({ t: near, fuzzy: true }); }
    return out;
  }
  private fuzzyCache = new Map<string, string | null>();
  private idf(t: string) { const n = this.docs.length, d = this.df.get(t) ?? 0; return Math.log(1 + (n - d + 0.5) / (d + 0.5)); }

  search(question: string, o: SearchOptions = {}): SearchResult {
    const terms = this.terms(question);
    // Keyword rules also see the question with typos corrected to the nearest corpus word ("rqeuest" → "request").
    const fixes = new Map(tokenize(question).map(t => [t, this.fuzzyCache.get(t)] as const).filter((x): x is [string, string] => !!x[1]));
    const s = normalize(question) + (fixes.size ? ' ' + normalize(question).split(' ').map(w => { const st = tokenize(w)[0]; return st && fixes.get(st) ? fixes.get(st)! : w; }).join(' ') : '');
    const pool = this.docs.filter(d => (!o.audience || d.e.audience.includes(o.audience)) && (!o.categories || o.categories.includes(d.e.category)) && (!o.asOf || d.e.effective <= o.asOf.slice(0, 7)));
    const scored = pool.map(d => {
      const why: string[] = [];
      const kw = d.kws.reduce((a, x) => { if (x.test(s)) { why.push(`kw:${x.k}`); return a + x.w; } return a; }, 0);
      let bm = 0; for (const { t, fuzzy } of terms) { const f = d.tf.get(t) ?? 0, fa = d.ta.get(t) ?? 0; if (!f && !fa) continue;
        const sat = (x: number, len: number, avg: number) => x ? (x * (K1 + 1)) / (x + K1 * (1 - B + B * len / avg)) : 0;
        const part = this.idf(t) * (sat(f, d.len, this.avgLen) + A_WEIGHT * sat(fa, d.la, this.avgA)); bm += fuzzy ? part * 0.7 : part; }
      return { id: d.e.id, entry: d.e, kw, bm25: bm, dense: o.dense?.[d.e.id], why, score: 0 } as Hit;
    });
    // Score fusion: each signal scaled to the best document for this question, then weighted.
    // (Reciprocal rank fusion was tried first; it let a weak generic keyword outrank a strong text match. See talaan-ai/metrics/history.jsonl.)
    const max = (k: 'kw' | 'bm25' | 'dense') => Math.max(1e-9, ...scored.map(h => h[k] ?? 0));
    const mk = max('kw'), mb = max('bm25'), md = o.dense ? max('dense') : 1;
    const appQ = /\btalaan\b/i.test(question);
    for (const h of scored) {
      h.score = W.kw * (h.kw / mk) * Math.min(1, h.kw / 3) + W.bm25 * (h.bm25 / mb) + (o.dense ? W.dense * ((h.dense ?? 0) / md) : 0);
      if (appQ && h.entry.category === 'talaan') h.score *= 1.15;
    }
    const hits = scored.filter(h => h.score > 0).sort((a, b) => b.score - a.score || b.kw - a.kw || b.bm25 - a.bm25).slice(0, o.k ?? 5);
    if (!hits.length) return { hits: [], confident: false, reason: 'no_match' };
    // Confidence gate. A curated keyword hit is strong evidence; otherwise BM25 must clear a floor and
    // most of the question's meaningful words must be known to the corpus (stops "capital of France").
    // Coverage: share of the question's information (idf) the corpus knows; unknown words count at the highest idf.
    const top = hits[0]; const qTok = tokenize(question); const maxIdf = Math.log(1 + (this.docs.length + 0.5) / 0.5);
    const knownSet = new Set(terms.filter(x => !x.fuzzy).map(x => x.t)); const fuzzyIdf = terms.filter(x => x.fuzzy).reduce((a, x) => a + this.idf(x.t) * 0.7, 0);
    const known = qTok.length ? (qTok.filter(t => knownSet.has(t)).reduce((a, t) => a + this.idf(t), 0) + fuzzyIdf) / (qTok.reduce((a, t) => a + (this.df.has(t) ? this.idf(t) : maxIdf), 0) || 1) : 0;
    const floor = o.minConfidence ?? 4.0;
    const confident = top.kw >= 2 || (top.bm25 >= floor && known >= 0.6) || (top.kw >= 1 && top.bm25 >= floor * 0.6 && known >= 0.5) || (o.dense !== undefined && (top.dense ?? 0) >= 0.82);
    return confident ? { hits, confident } : { hits, confident: false, reason: 'low_confidence' };
  }
}

/** Compatible with the original kb.ask(): up to two entries close to the best, or none. */
export function topEntries(r: SearchResult, max = 2): RagEntry[] {
  if (!r.confident) return [];
  const best = r.hits[0].score; return r.hits.filter(h => h.score >= best * 0.85).slice(0, max).map(h => h.entry);
}
