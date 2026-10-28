/**
 * POST /api/pay/checkout  { level, docNo, customerId, orgId, amount, description, payee, email? } → { url }
 * Creates a PayMongo checkout for an open invoice. Called by Talaan's own server (x-talaan-service), which looks up the
 * invoice and its balance itself: the amount never comes from the browser.
 */
import { assertTalaanEnv, envErrorResponse, siteUrl, TalaanEnvError } from '../../../../lib/env';
import { createCheckout, type CheckoutRequest } from '../../../../lib/pay';

import { serviceOk } from '../../../../lib/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try { assertTalaanEnv(); } catch (e) { return envErrorResponse(e); }
  if (!serviceOk(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  let b: CheckoutRequest;
  try { b = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!['firm', 'hq'].includes(b.level) || !b.docNo || !b.orgId || !(b.amount > 0) || b.amount > 5_000_000) return Response.json({ error: 'Invalid payment request' }, { status: 400 });
  try { const c = await createCheckout(b, siteUrl()); return Response.json({ url: c.url, id: c.id }); }
  catch (e) { if (e instanceof TalaanEnvError) return envErrorResponse(e); return Response.json({ error: (e as Error).message }, { status: 502 }); }
}
