/** Tests email validation, the privacy guard and the Resend call with a fake service. Run: npx tsx scripts/test-email.mts */
import assert from 'node:assert';
process.env.APP_ID = 'talaan'; process.env.VECTOR_NAMESPACE = 'talaan-ph-payroll'; process.env.RESEND_API_KEY = 're_test'; process.env.EMAIL_FROM = 'Talaan <noreply@example.ph>';
const { sendEmail, validateEmail } = await import('../lib/email');
const ok = { to: ['owner@limtrading.ph'], subject: 'Lim Trading Corp.: payroll processed', text: 'Employees paid: 6\nTotal net pay: PHP 81,662.85' };
assert.equal(validateEmail(ok), null);
assert.match(validateEmail({ ...ok, to: ['not-an-email'] })!, /recipients/);
assert.match(validateEmail({ ...ok, text: 'SSS 34-1234567-8' })!, /ID or account/);
assert.match(validateEmail({ ...ok, text: 'TIN 123-456-789-000' })!, /ID or account/);
assert.match(validateEmail({ ...ok, text: 'Account 001234567890' })!, /ID or account/);
let sent: { url: string; body: Record<string, unknown>; auth: string } | null = null;
const fake = (async (url: string, init: RequestInit) => { sent = { url, body: JSON.parse(String(init.body)), auth: String((init.headers as Record<string, string>).Authorization) }; return new Response(JSON.stringify({ id: 'em_123' }), { status: 200 }); }) as unknown as typeof fetch;
const r = await sendEmail(ok, { fetch: fake });
assert.deepEqual(r, { ok: true, id: 'em_123' }); assert.equal(sent!.url, 'https://api.resend.com/emails'); assert.equal(sent!.auth, 'Bearer re_test'); assert.equal(sent!.body.from, 'Talaan <noreply@example.ph>');
const down = await sendEmail(ok, { fetch: (async () => new Response('x', { status: 500 })) as typeof fetch }); assert.equal(down.ok, false);
console.log('email tests passed');
