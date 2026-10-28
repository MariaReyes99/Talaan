/**
 * Ask Tala on the server: the same guardrails and hybrid retriever as the app (lib/rag, synced from talaan-app), plus
 *  - optional dense retrieval with Talaan's own embeddings (TALAAN_EMBEDDINGS=1), cached in Talaan's Redis, and
 *  - optional answer phrasing by a model (TALAAN_GENERATE=1), held to the output rails: an answer with a number that
 *    is not in the cited source is replaced by the source text.
 * Uses TALAAN_OPENAI_API_KEY only: never a global OPENAI_API_KEY and never another project's key.
 */
import corpus from './rag/corpus.json';
import { HybridRetriever, type Lang, type RagEntry } from './rag/retriever';
import { askTala, groundedPrompt, type TalaAnswer } from './rag/pipeline';
import { getJson, setJson } from './store';

const ENTRIES = corpus as unknown as RagEntry[];
let retriever: HybridRetriever | null = null;
const R = () => (retriever ??= new HybridRetriever(ENTRIES));
const key = () => process.env.TALAAN_OPENAI_API_KEY;

async function openai(path: string, body: unknown) {
  const r = await fetch(`https://api.openai.com/v1/${path}`, { method: 'POST', headers: { authorization: `Bearer ${key()}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`OpenAI ${r.status}`); return r.json();
}
const cos = (a: number[], b: number[]) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return d / Math.sqrt(x * y); };
const MODEL_EMB = 'text-embedding-3-small';
async function corpusVectors(): Promise<Record<string, number[]>> {
  const tag = `emb:${MODEL_EMB}:${ENTRIES.length}:${ENTRIES.map(e => e.verified).sort().pop()}`;
  const cached = await getJson<Record<string, number[]>>(tag); if (cached) return cached;
  const texts = ENTRIES.map(e => `${e.q.en}\n${e.a.en}`);
  const res = await openai('embeddings', { model: MODEL_EMB, input: texts });
  const out = Object.fromEntries(ENTRIES.map((e, i) => [e.id, res.data[i].embedding as number[]])); await setJson(tag, out, 30 * 864e2); return out;
}
async function denseScores(q: string): Promise<Record<string, number> | undefined> {
  if (process.env.TALAAN_EMBEDDINGS !== '1' || !key()) return undefined;
  try { const [vecs, qv] = await Promise.all([corpusVectors(), openai('embeddings', { model: MODEL_EMB, input: q }).then(r => r.data[0].embedding as number[])]);
    return Object.fromEntries(Object.entries(vecs).map(([id, v]) => [id, cos(qv, v)])); } catch { return undefined; } // dense is a bonus; keyword + BM25 still answer
}
async function generate(q: string, sources: RagEntry[], lang: Lang): Promise<string | null> {
  if (process.env.TALAAN_GENERATE !== '1' || !key()) return null;
  const p = groundedPrompt(q, sources, lang);
  const r = await openai('chat/completions', { model: process.env.TALAAN_CHAT_MODEL ?? 'gpt-4o-mini', temperature: 0, max_tokens: 300, messages: [{ role: 'system', content: p.system }, { role: 'user', content: p.user }] });
  const text = (r.choices?.[0]?.message?.content ?? '').trim(); return !text || text.includes('NO_SOURCE') ? null : text;
}

export async function answer(question: string, lang: Lang, audience?: string): Promise<TalaAnswer> {
  const dense = await denseScores(question);
  return askTala(R(), question, lang, { asOf: new Date().toISOString().slice(0, 10), audience, dense, generate });
}
/** Retrieval only, for the NeMo Guardrails server (it phrases the answer itself and applies its own rails). */
export function retrieve(question: string, lang: Lang) {
  const r = R().search(question, { lang, k: 3 });
  return r.confident ? r.hits.slice(0, 2).map(h => ({ id: h.id, answer: h.entry.a[lang], source: h.entry.source, effective: h.entry.effective, verified: h.entry.verified })) : [];
}
