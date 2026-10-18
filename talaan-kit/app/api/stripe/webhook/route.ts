/**
 * Stripe webhook for Talaan's own Stripe account.
 * Register in Stripe (Talaan account) → Developers → Webhooks:
 *   https://talaan-ivory.vercel.app/api/stripe/webhook
 * Events: checkout.session.completed, customer.subscription.updated,
 *         customer.subscription.deleted, invoice.payment_failed
 * Then put the signing secret (whsec_...) in STRIPE_WEBHOOK_SECRET.
 *
 * Checkout must set client_reference_id (or metadata.orgId) to the firm's organisation ID,
 * so each payment is linked to the right firm.
 */
import Stripe from 'stripe';
import { assertTalaanEnv, envErrorResponse, required } from '../../../../lib/env';
import { getJson, setIfNew, setJson } from '../../../../lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface Billing { orgId: string; status: string; plan?: string; priceId?: string; customerId?: string; subscriptionId?: string; updatedAt: string }

async function saveBilling(orgId: string, patch: Partial<Billing>) {
  const prev = (await getJson<Billing>(`billing:org:${orgId}`)) ?? { orgId, status: 'none', updatedAt: '' };
  await setJson(`billing:org:${orgId}`, { ...prev, ...patch, orgId, updatedAt: new Date().toISOString() });
  if (patch.customerId) await setJson(`stripe:customer:${patch.customerId}`, orgId);
}
const idOf = (x: string | { id: string } | null | undefined) => (typeof x === 'string' ? x : x?.id);

export async function POST(req: Request) {
  try { assertTalaanEnv(); } catch (e) { return envErrorResponse(e); }

  const signature = req.headers.get('stripe-signature');
  if (!signature) return Response.json({ error: 'Missing Stripe signature' }, { status: 400 });

  let stripe: Stripe, secret: string;
  try { stripe = new Stripe(required('STRIPE_SECRET_KEY')); secret = required('STRIPE_WEBHOOK_SECRET'); } catch (e) { return envErrorResponse(e); }

  const body = await req.text(); // raw body is required for signature checking
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(body, signature, secret); }
  catch { return Response.json({ error: 'Invalid signature' }, { status: 400 }); }

  // Stripe can send the same event more than once; handle each only once.
  if (!(await setIfNew(`stripe:event:${event.id}`, 1, 7 * 24 * 3600))) return Response.json({ received: true, duplicate: true });

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session;
      const orgId = s.client_reference_id ?? s.metadata?.orgId;
      if (orgId) await saveBilling(orgId, { status: 'active', plan: s.metadata?.plan, customerId: idOf(s.customer), subscriptionId: idOf(s.subscription) });
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = idOf(sub.customer);
      const orgId = sub.metadata?.orgId ?? (customerId ? await getJson<string>(`stripe:customer:${customerId}`) : null);
      if (orgId) await saveBilling(orgId, { status: event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status, priceId: sub.items.data[0]?.price.id, customerId, subscriptionId: sub.id });
      break;
    }
    case 'invoice.payment_failed': {
      const inv = event.data.object as Stripe.Invoice;
      const customerId = idOf(inv.customer);
      const orgId = customerId ? await getJson<string>(`stripe:customer:${customerId}`) : null;
      if (orgId) await saveBilling(orgId, { status: 'past_due' });
      break;
    }
    default:
      break; // other events are acknowledged and ignored
  }
  return Response.json({ received: true });
}
