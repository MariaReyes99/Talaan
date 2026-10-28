// GENERATED from talaan-app/src/rag/pipeline.ts by scripts/sync-rag.mjs. Edit the original, then run npm run sync:rag.
/**
 * Ask Tala end to end: input rails → hybrid retrieval → answer → output rails → citations.
 * Human in the loop: anything Tala cannot answer from a source, or refuses, becomes a handoff that a person
 * (the firm's payroll lead or CPA adviser) answers; their answer can then be added to the corpus after review.
 * The optional `generate` step lets the server phrase the answer with a language model; its output must pass the
 * output rails, otherwise Tala falls back to the source text itself.
 */
import { HybridRetriever, topEntries, type Lang, type RagEntry, type SearchOptions } from './retriever';
import { checkInput, checkOutput, sourceFlags, type Redaction } from './guard';

export type Status = 'answered' | 'declined' | 'blocked';
export interface Citation { id: string; question: string; source: string; sourceUrl: string; effective: string; verified: string; flags: string[] }
export interface TalaAnswer { status: Status; answer: string; citations: Citation[]; rails: string[]; redactions: Redaction[]; handoff: boolean; reason?: string; question: string; generated: boolean }
export interface PipelineOptions extends SearchOptions { asOf: string; generate?: (q: string, sources: RagEntry[], lang: Lang) => Promise<string | null> }

export const REFUSAL: Record<string, Record<Lang, string>> = {
  injection: { en: 'I can only answer payroll and compliance questions from Talaan’s sources, and I can’t change how I work.', tl: 'Mga tanong lang tungkol sa payroll at compliance ang masasagot ko mula sa mga source ng Talaan, at hindi ko mababago kung paano ako gumagana.', zh: '我只能根据 Talaan 的资料回答工资和合规问题，且无法更改我的工作方式。' },
  exfiltration: { en: 'I can’t share personal data, records or secrets. People with access can see them on the employee or client screens.', tl: 'Hindi ako makapagbibigay ng personal na datos, record o lihim. Makikita ito ng may access sa screen ng empleyado o client.', zh: '我不能提供个人数据、记录或机密信息。有权限的人员可在员工或客户页面查看。' },
  evasion: { en: 'I can’t help avoid taxes or contributions. Employers must withhold and remit them; late or missed payments carry penalties. I’ve passed your question to your adviser.', tl: 'Hindi ako makatutulong sa pag-iwas sa buwis o kontribusyon. Dapat itong kaltasin at i-remit ng employer; may multa ang late o hindi pagbabayad. Ipinasa ko ang tanong mo sa adviser mo.', zh: '我不能协助规避税款或社保缴款。雇主必须代扣代缴，逾期或漏缴会被处罚。我已将您的问题转给您的顾问。' },
  out_of_scope: { en: 'I only answer Philippine payroll, HR and compliance questions, and how to use Talaan.', tl: 'Mga tanong lang tungkol sa payroll, HR at compliance sa Pilipinas, at kung paano gamitin ang Talaan, ang sinasagot ko.', zh: '我只回答菲律宾工资、人事和合规问题，以及 Talaan 的使用方法。' },
  declined: { en: 'I don’t have an official source for that yet, so I won’t guess. I’ve passed it to your adviser, who will reply.', tl: 'Wala pa akong opisyal na source para diyan, kaya hindi ako manghuhula. Ipinasa ko ito sa adviser mo, na sasagot sa iyo.', zh: '我目前没有这方面的官方资料，因此不会猜测。我已将问题转给您的顾问，他们会回复您。' },
};

export async function askTala(retriever: HybridRetriever, question: string, lang: Lang, o: PipelineOptions): Promise<TalaAnswer> {
  const inp = checkInput(question);
  const base = { question: inp.text, redactions: inp.redactions, generated: false };
  if (inp.verdict !== 'ok') return { ...base, status: 'blocked', answer: REFUSAL[inp.verdict][lang], citations: [], rails: inp.rails, handoff: inp.verdict === 'evasion', reason: inp.verdict };
  const res = retriever.search(inp.text, { ...o, lang });
  const entries = topEntries(res);
  if (!entries.length) return { ...base, status: 'declined', answer: REFUSAL.declined[lang], citations: [], rails: [...inp.rails, 'no_source'], handoff: true, reason: res.reason };
  const citations: Citation[] = entries.map(e => ({ id: e.id, question: e.q[lang], source: e.source, sourceUrl: e.sourceUrl, effective: e.effective, verified: e.verified, flags: sourceFlags(e, o.asOf) }));
  const extractive = entries.map(e => e.a[lang]).join('\n\n');
  let answer = extractive, generated = false; const rails = [...inp.rails];
  if (o.generate) {
    const g = await o.generate(inp.text, entries, lang).catch(() => null);
    if (g) { const out = checkOutput(g, entries); rails.push(...out.rails); if (out.ok) { answer = out.text; generated = true; } else rails.push('fallback_to_source'); }
  }
  return { ...base, status: 'answered', answer, citations, rails, handoff: false, generated };
}

/** The grounded prompt the server gives a language model: answer only from these sources, in the user's language, and cite. */
export function groundedPrompt(question: string, sources: RagEntry[], lang: Lang) {
  const name = { en: 'English', tl: 'Tagalog', zh: 'Simplified Chinese' }[lang];
  return { system: `You are Tala, Talaan's payroll assistant for the Philippines. Answer ONLY from the numbered sources. If they do not answer the question, reply exactly "NO_SOURCE". Keep every peso amount, percentage, form number and date exactly as written in the sources. Do not give personal tax or legal advice beyond the sources. Reply in ${name}, in at most 120 words, and end with the source numbers you used, like [1].`,
    user: `Question: ${question}\n\nSources:\n${sources.map((e, i) => `[${i + 1}] ${e.q.en}\n${e.a.en}\n(${e.source}; effective ${e.effective}; checked ${e.verified})`).join('\n\n')}` };
}
