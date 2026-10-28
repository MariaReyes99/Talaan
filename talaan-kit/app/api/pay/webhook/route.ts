/**
 * PayMongo webhook (register https://talaan-ivory.vercel.app/api/pay/webhook for checkout_session.payment.paid).
 * Records a confirmed online payment against the invoice once, as talaan:payment:<level>:<docNo>:<paymentId>.
 * Talaan's app reads these with GET /api/pay/webhook?docNo=... (service token) and adds them to the invoice as
 * "paid online"; staff still reconcile deposits against the bank statement (human in the loop for money received).
 */
import { assertTalaanEnv, envErrorResponse, required } from '../../../../lib/env';
import { verifySignature } from '../../../../lib/pay';
import { getJson, setIfNew, setJson } from '../../../../lib/store';

import { serviceOk } from '../../../../lib/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let secret: string;
  try { assertTalaanEnv(); secret = required('PAYMONGO_WEBHOOK_SECRET'); } catch (e) { return envErrorResponse(e); }
  const raw = await req.text();
  if (!verifySignature(req.headers.get('paymongo-signature'), raw, secret)) return Response.json({ error: 'Invalid signature' }, { status: 400 });
  let ev: { data?: { id?: string; attributes?: { type?: string; data?: { id?: string; attributes?: { metadata?: Record<string, string>; payments?: { id: string; attributes: { amount: number; paid_at?: number; source?: { type?: string } } }[]; payment_method_used?: string } } } } };
  try { ev = JSON.parse(raw); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  // Duplicate check first; the event is marked as handled only after its payments are saved, so a failed write is retried.
  if (await getJson(`paymongo:event:${ev.data?.id}`)) return Response.json({ received: true, duplicate: true });
  if (ev.data?.attributes?.type !== 'checkout_session.payment.paid') { await setIfNew(`paymongo:event:${ev.data?.id}`, 1, 30 * 86400); return Response.json({ received: true }); }
  const cs = ev.data.attributes.data?.attributes; const md = cs?.metadata ?? {};
  if (!md.docNo || !md.level) return Response.json({ received: true, ignored: 'no invoice reference' });
  for (const p of cs?.payments ?? []) {
    const rec = { docNo: md.docNo, level: md.level, customerId: md.customerId, orgId: md.orgId, paymentId: p.id, amount: p.attributes.amount / 100,
      method: cs?.payment_method_used ?? p.attributes.source?.type ?? 'online', paidAt: new Date((p.attributes.paid_at ?? Date.now() / 1000) * 1000).toISOString(), source: 'online' };
    await setJson(`payment:${md.level}:${md.docNo}:${p.id}`, rec);
    // Each payment has its own key; the per-invoice index is rebuilt from what is stored, so two webhooks at once cannot lose one.
    const list = (await getJson<string[]>(`payments:${md.level}:${md.docNo}`)) ?? []; if (!list.includes(p.id)) await setJson(`payments:${md.level}:${md.docNo}`, [...new Set([...list, p.id])]);
  }
  await setIfNew(`paymongo:event:${ev.data?.id}`, 1, 30 * 86400);
  return Response.json({ received: true });
}

export async function GET(req: Request) {
  try { assertTalaanEnv(); } catch (e) { return envErrorResponse(e); }
  if (!serviceOk(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const u = new URL(req.url); const doc = u.searchParams.get('docNo'); const level = u.searchParams.get('level') ?? 'firm';
  if (!doc) return Response.json({ error: 'Missing docNo' }, { status: 400 });
  const ids = (await getJson<string[]>(`payments:${level}:${doc}`)) ?? [];
  return Response.json({ payments: await Promise.all(ids.map(id => getJson(`payment:${level}:${doc}:${id}`))) });
}
