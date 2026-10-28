/**
 * POST /api/integrations/roster  { obligations, clients: [{ id, assignee }], people: [{ id, role, clientId?, active?, name?, email? }], firmName? }
 * The app sends this whenever filings, due dates or people change, so the daily check can alert the right people
 * even when nobody is signed in. Firm owners only; used for alert recipients, never for approval rights.
 */
import { assertTalaanEnv, envErrorResponse } from '../../../../lib/env';
import { orgFromRequest } from '../../../../lib/auth';
import { requireModule } from '../../../../lib/entitlements';
import { saveRoster, type Roster } from '../../../../lib/ilog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  try { assertTalaanEnv(); } catch (e) { return envErrorResponse(e); }
  const who = orgFromRequest(req); if (!who) return Response.json({ error: 'Sign in to Talaan first' }, { status: 401 });
  // Only a firm owner: the roster decides who gets alert emails. Roles and approval duties are NOT taken from it (they come from sign-in).
  if (who.role !== 'firmOwner') return Response.json({ error: 'Firm owners only' }, { status: 403 });
  const denied = await requireModule(who.org, '/api/integrations/roster'); if (denied) return denied;
  let b: Partial<Roster>; try { b = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const obligations = (Array.isArray(b.obligations) ? b.obligations : []).slice(0, 20000).filter(o => o && typeof o.key === 'string' && typeof o.clientId === 'string' && DATE.test(String(o.due)));
  const clients = (Array.isArray(b.clients) ? b.clients : []).slice(0, 5000).filter(c => c && typeof c.id === 'string').map(c => ({ id: c.id, assignee: typeof c.assignee === 'string' ? c.assignee : undefined, name: typeof c.name === 'string' ? c.name.slice(0, 120) : undefined }));
  const people = (Array.isArray(b.people) ? b.people : []).slice(0, 5000).filter(p => p && typeof p.id === 'string' && typeof p.role === 'string')
    .map(p => ({ id: p.id, role: p.role, clientId: p.clientId, active: p.active !== false, name: typeof p.name === 'string' ? p.name.slice(0, 80) : undefined, email: typeof p.email === 'string' && EMAIL.test(p.email) ? p.email : undefined }));
  await saveRoster(who.org, { obligations, clients, people, firmName: typeof b.firmName === 'string' ? b.firmName.slice(0, 120) : undefined });
  return Response.json({ saved: true, obligations: obligations.length, people: people.length });
}
