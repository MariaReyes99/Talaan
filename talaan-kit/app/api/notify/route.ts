/**
 * POST /api/notify  { to: string[], subject: string, text: string, replyTo?: string }
 * Server-to-server only: requires "Authorization: Bearer <NOTIFY_SECRET>". In the full app this is called by
 * Talaan's own server code after an approval, remittance or statement, never directly from a browser.
 */
import { assertTalaanEnv, envErrorResponse, required } from '../../../lib/env';
import { sendEmail, type OutgoingEmail } from '../../../lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let secret: string;
  try { assertTalaanEnv(); secret = required('NOTIFY_SECRET'); required('RESEND_API_KEY'); required('EMAIL_FROM'); } catch (e) { return envErrorResponse(e); }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  let body: OutgoingEmail;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const r = await sendEmail(body);
  return r.ok ? Response.json({ sent: true, id: r.id }) : Response.json({ sent: false, error: r.error }, { status: r.status });
}
