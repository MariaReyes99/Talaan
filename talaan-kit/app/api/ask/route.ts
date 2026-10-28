/**
 * POST /api/ask  { question, lang?: 'en'|'tl'|'zh', audience?: 'accountant'|'owner'|'employee', mode?: 'answer'|'retrieve' }
 * Authorization: Bearer <organisation token from Talaan sign-in> (the organisation is never taken from the body).
 * Ask Tala on the server: entitlement (the org must have the AI module), a daily limit per org, guardrails, hybrid
 * retrieval, optional model phrasing held to the output rails, citations, and a human handoff when Tala cannot answer.
 * mode 'retrieve' is for Talaan's NeMo Guardrails service only (header x-talaan-service: <TALAAN_SERVICE_TOKEN>).
 * Logs keep only the redacted question, the status and the rails that fired: never personal data.
 */
import { assertTalaanEnv, envErrorResponse } from '../../../lib/env';
import { requireModule } from '../../../lib/entitlements';
import { answer, retrieve } from '../../../lib/ask';
import { getJson, setJson } from '../../../lib/store';
import { checkInput } from '../../../lib/rag/guard';
import { orgFromRequest, serviceOk, ipKey } from '../../../lib/auth';
import type { Lang } from '../../../lib/rag/retriever';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const LIMIT = Number(process.env.TALAAN_ASK_DAILY_LIMIT ?? 500); // per org per day; the plan includes 200 a month, overage is billed
const LIMIT_IP = Number(process.env.TALAAN_ASK_DAILY_LIMIT_IP ?? 300); // per network address per day, against abuse

export async function POST(req: Request) {
  try { assertTalaanEnv(); } catch (e) { return envErrorResponse(e); }
  let b: { question?: string; lang?: Lang; audience?: string; mode?: string };
  try { b = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const question = String(b.question ?? '').slice(0, 1000).trim(); const lang: Lang = b.lang === 'tl' || b.lang === 'zh' ? b.lang : 'en';
  if (question.length < 2) return Response.json({ error: 'Ask a question' }, { status: 400 });

  if (b.mode === 'retrieve') {
    if (!serviceOk(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const inp = checkInput(question); if (inp.verdict !== 'ok') return Response.json({ sources: [], blocked: inp.verdict });
    return Response.json({ sources: retrieve(inp.text, lang) });
  }

  const who = orgFromRequest(req); if (!who) return Response.json({ error: 'Sign in to Talaan first' }, { status: 401 });
  const orgId = who.org;
  const denied = await requireModule(orgId, '/api/ask'); if (denied) return denied;
  const day = new Date().toISOString().slice(0, 10);
  for (const [ck, max] of [[`ask:count:${orgId}:${day}`, LIMIT], [`ask:ip:${ipKey(req)}:${day}`, LIMIT_IP]] as [string, number][]) {
    const n = ((await getJson<number>(ck)) ?? 0) + 1; if (n > max) return Response.json({ error: 'Daily question limit reached. Try again tomorrow or contact Talaan support.' }, { status: 429 });
    await setJson(ck, n, 2 * 86400);
  }

  const a = await answer(question, lang, b.audience);
  if (a.handoff) await setJson(`handoff:${orgId}:${Date.now()}`, { at: new Date().toISOString(), question: a.question, lang, reason: a.reason ?? 'no_source', status: 'open' }, 90 * 86400);
  console.log(JSON.stringify({ evt: 'ask', org: orgId, status: a.status, rails: a.rails, cited: a.citations.map(c => c.id), generated: a.generated, redactions: a.redactions.map(r => r.kind) }));
  return Response.json(a);
}
