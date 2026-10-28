/**
 * POST /api/ask/handoff  { orgId?, question, reason }  – used by the NeMo Guardrails service to hand a question to a person.
 * Service-to-service only (x-talaan-service). The question arrives already redacted and is redacted again here.
 */
import { assertTalaanEnv, envErrorResponse } from '../../../../lib/env';
import { setJson } from '../../../../lib/store';
import { redact } from '../../../../lib/rag/guard';

import { serviceOk } from '../../../../lib/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try { assertTalaanEnv(); } catch (e) { return envErrorResponse(e); }
  if (!serviceOk(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  let b: { orgId?: string; question?: string; reason?: string };
  try { b = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const q = redact(String(b.question ?? '').slice(0, 1000)).text; if (!q.trim()) return Response.json({ error: 'Missing question' }, { status: 400 });
  await setJson(`handoff:${b.orgId ?? 'unknown'}:${Date.now()}`, { at: new Date().toISOString(), question: q, reason: String(b.reason ?? 'no_source').slice(0, 40), status: 'open' }, 90 * 86400);
  return Response.json({ queued: true });
}
