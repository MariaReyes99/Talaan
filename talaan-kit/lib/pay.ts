/**
 * Online invoice payments through PayMongo (Philippine provider: GCash, Maya, cards, QR Ph / online banking).
 * Used at both levels: a client employer paying its accounting firm, and a firm or direct employer paying Talaan.
 * The checkout page is PayMongo's; Talaan never sees card numbers. The webhook records the payment once PayMongo
 * confirms it. Talaan's own PayMongo keys only (PAYMONGO_SECRET_KEY, PAYMONGO_WEBHOOK_SECRET).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { required } from './env';

export interface CheckoutRequest { level: 'firm' | 'hq'; docNo: string; customerId: string; orgId: string; amount: number; description: string; payee: string; email?: string }
export async function createCheckout(r: CheckoutRequest, site: string) {
  const auth = 'Basic ' + Buffer.from(required('PAYMONGO_SECRET_KEY') + ':').toString('base64');
  const body = { data: { attributes: {
    line_items: [{ currency: 'PHP', amount: Math.round(r.amount * 100), name: r.description.slice(0, 120), quantity: 1 }],
    payment_method_types: ['gcash', 'paymaya', 'card', 'qrph'], send_email_receipt: true, show_description: true, show_line_items: true,
    description: `${r.payee}: ${r.docNo}`, reference_number: r.docNo, ...(r.email ? { billing: { email: r.email } } : {}),
    success_url: `${site}/pay/done?doc=${encodeURIComponent(r.docNo)}`, cancel_url: `${site}/pay/cancelled?doc=${encodeURIComponent(r.docNo)}`,
    metadata: { level: r.level, docNo: r.docNo, customerId: r.customerId, orgId: r.orgId } } } };
  const res = await fetch('https://api.paymongo.com/v1/checkout_sessions', { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json(); if (!res.ok) throw new Error(`PayMongo ${res.status}: ${JSON.stringify(j.errors ?? j).slice(0, 200)}`);
  return { id: j.data.id as string, url: j.data.attributes.checkout_url as string };
}

/** Verifies the Paymongo-Signature header: "t=<unix>,te=<test sig>,li=<live sig>", HMAC-SHA256 of "<t>.<raw body>". */
export function verifySignature(header: string | null, raw: string, secret: string, toleranceSec = 300): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map(p => p.trim().split('=') as [string, string]));
  const t = Number(parts.t); if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const want = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  const got = parts.li || parts.te || ''; if (got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(want), Buffer.from(got));
}
